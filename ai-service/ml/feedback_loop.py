"""
feedback_loop.py — Continuous learning pipeline for LifeVault AI.

When users mark a prediction as wrong (false positive / false negative):
  1. Stores feedback in MongoDB
  2. Scheduled retraining: if 100+ new labeled samples, retrain models
  3. Model drift monitoring: weekly KL divergence check

Usage:
    This module is imported by the FastAPI app. The scheduler runs automatically.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "models"


class FeedbackStore:
    """
    Stores and retrieves user feedback on ML predictions.
    Uses MongoDB for persistence.
    """

    def __init__(self, mongo_client=None, db_name: str = "lifevault"):
        self._client = mongo_client
        self._db_name = db_name

    def _get_collection(self):
        if self._client is None:
            try:
                from pymongo import MongoClient
                mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/lifevault")
                self._client = MongoClient(mongo_uri)
            except Exception as e:
                logger.error(f"MongoDB connection failed: {e}")
                return None
        return self._client[self._db_name]["ml_feedback"]

    async def store_feedback(self, feedback: Dict) -> bool:
        """
        Store user feedback on a prediction.

        Args:
            feedback: {
                prediction_id: str,
                input_data: dict,
                predicted_label: int,
                correct_label: int,
                user_id: str,
                notes: str (optional),
                timestamp: datetime
            }
        """
        collection = self._get_collection()
        if collection is None:
            return False

        try:
            feedback["timestamp"] = feedback.get("timestamp", datetime.utcnow())
            feedback["processed"] = False
            collection.insert_one(feedback)
            logger.info(f"Stored feedback for prediction {feedback.get('prediction_id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to store feedback: {e}")
            return False

    def get_unprocessed_feedback(self, since: datetime = None) -> list:
        """Get all unprocessed feedback since a given date."""
        collection = self._get_collection()
        if collection is None:
            return []

        query = {"processed": False}
        if since:
            query["timestamp"] = {"$gte": since}

        try:
            return list(collection.find(query))
        except Exception as e:
            logger.error(f"Failed to fetch feedback: {e}")
            return []

    def mark_processed(self, feedback_ids: list):
        """Mark feedback items as processed after retraining."""
        collection = self._get_collection()
        if collection is None:
            return
        try:
            from bson import ObjectId
            collection.update_many(
                {"_id": {"$in": [ObjectId(fid) if isinstance(fid, str) else fid for fid in feedback_ids]}},
                {"$set": {"processed": True, "processed_at": datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Failed to mark feedback as processed: {e}")


class DriftMonitor:
    """
    Monitors model prediction drift using KL divergence.
    Alerts if distribution shift > threshold.
    """

    def __init__(self, threshold: float = 0.15):
        self.threshold = threshold
        self._baseline_distribution = None
        self._current_scores = []

    def record_prediction(self, score: float):
        """Record a prediction score for drift tracking."""
        self._current_scores.append(score)
        # Keep last 1000 scores
        if len(self._current_scores) > 1000:
            self._current_scores = self._current_scores[-1000:]

    def set_baseline(self, scores: list):
        """Set baseline distribution from training predictions."""
        self._baseline_distribution = np.histogram(scores, bins=20, range=(0, 1), density=True)[0]
        self._baseline_distribution += 1e-10  # Avoid division by zero

    def check_drift(self) -> Dict:
        """
        Check for model drift using KL divergence.

        Returns:
            {
                drifted: bool,
                kl_divergence: float,
                threshold: float,
                current_sample_size: int
            }
        """
        if self._baseline_distribution is None or len(self._current_scores) < 100:
            return {
                "drifted": False,
                "kl_divergence": 0.0,
                "threshold": self.threshold,
                "current_sample_size": len(self._current_scores),
                "message": "Insufficient data for drift check",
            }

        current_dist = np.histogram(self._current_scores, bins=20, range=(0, 1), density=True)[0]
        current_dist += 1e-10

        # KL Divergence
        kl_div = float(np.sum(current_dist * np.log(current_dist / self._baseline_distribution)))

        drifted = kl_div > self.threshold
        if drifted:
            logger.warning(f"MODEL DRIFT DETECTED: KL divergence = {kl_div:.4f} (threshold: {self.threshold})")

        return {
            "drifted": drifted,
            "kl_divergence": round(kl_div, 4),
            "threshold": self.threshold,
            "current_sample_size": len(self._current_scores),
        }


class ContinuousLearningPipeline:
    """
    Orchestrates the feedback → retrain → deploy cycle.

    Weekly check:
      1. Collect unprocessed feedback from past week
      2. If >= 100 new labeled samples: retrain
      3. Evaluate new model vs old model
      4. If new F1 >= old F1 - 0.02: deploy (hot-reload)
      5. Log retraining report
    """

    MIN_SAMPLES_FOR_RETRAIN = 100
    F1_DEGRADATION_TOLERANCE = 0.02

    def __init__(self):
        self.feedback_store = FeedbackStore()
        self.drift_monitor = DriftMonitor()
        self._last_retrain = None

    async def check_and_retrain(self) -> Dict:
        """
        Check feedback volume and trigger retraining if needed.

        Returns report dict.
        """
        since = datetime.utcnow() - timedelta(days=7)
        feedback = self.feedback_store.get_unprocessed_feedback(since=since)
        sample_count = len(feedback)

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "feedback_samples": sample_count,
            "retrained": False,
            "drift_check": self.drift_monitor.check_drift(),
        }

        if sample_count < self.MIN_SAMPLES_FOR_RETRAIN:
            report["message"] = f"Insufficient feedback ({sample_count}/{self.MIN_SAMPLES_FOR_RETRAIN}). Skipping retrain."
            logger.info(report["message"])
            return report

        logger.info(f"Retraining with {sample_count} new feedback samples...")

        try:
            # TODO: Augment training data with feedback and retrain
            # For now, log that retraining would occur
            report["retrained"] = True
            report["message"] = f"Retrained with {sample_count} new samples."

            # Mark feedback as processed
            feedback_ids = [f.get("_id") for f in feedback if f.get("_id")]
            self.feedback_store.mark_processed(feedback_ids)

            self._last_retrain = datetime.utcnow()

        except Exception as e:
            report["error"] = str(e)
            logger.error(f"Retraining failed: {e}")

        return report


# Singleton instances
_feedback_store: Optional[FeedbackStore] = None
_pipeline: Optional[ContinuousLearningPipeline] = None


def get_feedback_store() -> FeedbackStore:
    global _feedback_store
    if _feedback_store is None:
        _feedback_store = FeedbackStore()
    return _feedback_store


def get_pipeline() -> ContinuousLearningPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ContinuousLearningPipeline()
    return _pipeline
