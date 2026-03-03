import os
import logging
import torch
from typing import Dict, Any
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from services.phishing_detector import PhishingDetector
from services.anomaly_detector import AnomalyDetector
from services.drift_detector import DriftDetector

logger = logging.getLogger("ai_service")

class ModelRegistry:
    """Singleton registry for AI models with warmup and lifecycle management."""
    _instance = None
    _models: Dict[str, Any] = {}
    _is_ready = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRegistry, cls).__new__(cls)
        return cls._instance

    async def initialize(self):
        """Warm up models on startup."""
        if self._is_ready:
            return

        logger.info("Initializing AI models and warming up...")
        try:
            # Initialize singleton instances
            self._models["phishing"] = PhishingDetector()
            self._models["anomaly"] = AnomalyDetector()
            self._models["drift"] = DriftDetector()

            # Warmup runs (optional but recommended for production)
            # await self._warmup()

            self._is_ready = True
            logger.info("AI models initialized and ready for inference.")
        except Exception as e:
            logger.error(f"Failed to initialize models: {str(e)}")
            raise

    def get_model(self, model_name: str):
        if not self._is_ready:
            raise RuntimeError("ModelRegistry not initialized. Call initialize() first.")
        return self._models.get(model_name)

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    async def shutdown(self):
        """Graceful shutdown logic."""
        logger.info("Shutting down AI models...")
        self._models.clear()
        self._is_ready = False

model_registry = ModelRegistry()
