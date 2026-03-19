"""
ModelServer — Lazy-loading model server with caching, versioning, and metrics.

Features:
  - Lazy-loads models on first request (not at startup)
  - Model versioning via SHA-256 hash of weights file
  - In-memory LRU prediction cache (5-minute TTL)
  - Exposes predict_url, predict_text, predict_transaction, predict_combined
  - Tracks: prediction_count, avg_latency_ms, cache_hit_rate
  - Hot-reload: reload_models() refreshes from disk without restart
"""

import time
import hashlib
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from functools import lru_cache
from collections import defaultdict

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "models"


class PredictionCache:
    """Simple TTL-based prediction cache."""

    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):
        self._cache: Dict[str, dict] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttl = ttl_seconds
        self._max_size = max_size
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[dict]:
        if key in self._cache:
            if time.time() - self._timestamps[key] < self._ttl:
                self.hits += 1
                return self._cache[key]
            else:
                del self._cache[key]
                del self._timestamps[key]
        self.misses += 1
        return None

    def set(self, key: str, value: dict):
        if len(self._cache) >= self._max_size:
            oldest_key = min(self._timestamps, key=self._timestamps.get)
            del self._cache[oldest_key]
            del self._timestamps[oldest_key]
        self._cache[key] = value
        self._timestamps[key] = time.time()

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class ModelServer:
    """
    Central model serving layer for LifeVault AI.

    Lazy-loads models on first prediction request.
    Supports hot-reload and prediction caching.
    """

    def __init__(self):
        self._ensemble = None
        self._model_versions: Dict[str, str] = {}
        self._cache = PredictionCache(ttl_seconds=300)
        self._metrics = defaultdict(lambda: {"count": 0, "total_latency_ms": 0})
        self._loaded = False

    def _ensure_loaded(self):
        """Lazy-load models on first use."""
        if not self._loaded:
            self.reload_models()

    def reload_models(self):
        """(Re)load all models from disk. Safe for hot-reload."""
        from ml.train_models import ThreatEnsemble

        logger.info("Loading ML models...")
        self._ensemble = ThreatEnsemble()
        self._ensemble.load_models()
        self._model_versions = self._compute_versions()
        self._loaded = True
        logger.info(f"Models loaded. Versions: {self._model_versions}")

    def _compute_versions(self) -> Dict[str, str]:
        """Compute SHA-256 hash of each model file for versioning."""
        versions = {}
        for model_file in MODEL_DIR.glob("*.joblib"):
            h = hashlib.sha256(model_file.read_bytes()).hexdigest()[:12]
            versions[model_file.stem] = h
        for model_dir in MODEL_DIR.iterdir():
            if model_dir.is_dir():
                config = model_dir / "config.json"
                if config.exists():
                    h = hashlib.sha256(config.read_bytes()).hexdigest()[:12]
                    versions[model_dir.name] = h
        return versions

    def _record_metric(self, prediction_type: str, latency_ms: float):
        """Record prediction metrics."""
        self._metrics[prediction_type]["count"] += 1
        self._metrics[prediction_type]["total_latency_ms"] += latency_ms

    def predict_url(self, url: str) -> Dict:
        """
        Predict threat score for a URL.

        Args:
            url: The URL to analyze

        Returns:
            Dict with score, level, features, recommended_action
        """
        self._ensure_loaded()

        # Check cache
        cache_key = f"url:{hashlib.md5(url.encode()).hexdigest()}"
        cached = self._cache.get(cache_key)
        if cached:
            return cached

        start = time.time()
        from ml.data_pipeline import extract_url_features
        features = extract_url_features(url)
        result = self._ensemble.predict_combined(url_features=features)
        result["input_url"] = url
        result["features_used"] = list(features.keys())

        latency = (time.time() - start) * 1000
        self._record_metric("url", latency)
        self._cache.set(cache_key, result)

        return result

    def predict_text(self, text: str, sender: str = "", subject: str = "") -> Dict:
        """
        Predict threat score for email/message text.

        Args:
            text: The message content
            sender: Optional sender email
            subject: Optional email subject

        Returns:
            Dict with score, level, recommended_action
        """
        self._ensure_loaded()

        cache_key = f"text:{hashlib.md5(text.encode()).hexdigest()}"
        cached = self._cache.get(cache_key)
        if cached:
            return cached

        start = time.time()
        from ml.data_pipeline import extract_text_features
        features = extract_text_features(text, sender, subject)
        result = self._ensemble.predict_combined(text=text)
        result["text_features"] = features

        latency = (time.time() - start) * 1000
        self._record_metric("text", latency)
        self._cache.set(cache_key, result)

        return result

    def predict_transaction(self, features: Dict) -> Dict:
        """
        Predict anomaly score for a transaction.

        Args:
            features: Dict with amount, merchant, category, etc.

        Returns:
            Dict with anomaly_score, is_anomaly, level
        """
        self._ensure_loaded()

        start = time.time()
        result = self._ensemble.predict_combined(transaction_features=features)

        latency = (time.time() - start) * 1000
        self._record_metric("transaction", latency)

        return result

    def predict_combined(self, url: str = None, text: str = None, transactions: list = None) -> Dict:
        """
        Combined ensemble prediction across all input types.

        Args:
            url: Optional URL to analyze
            text: Optional message text
            transactions: Optional list of transaction feature dicts

        Returns:
            ThreatScore dict with ensemble results
        """
        self._ensure_loaded()

        start = time.time()

        url_features = None
        txn_features = None

        if url:
            from ml.data_pipeline import extract_url_features
            url_features = extract_url_features(url)

        if transactions and len(transactions) > 0:
            txn_features = transactions[0]  # Use first transaction for now

        result = self._ensemble.predict_combined(
            url_features=url_features,
            text=text,
            transaction_features=txn_features,
        )

        latency = (time.time() - start) * 1000
        self._record_metric("combined", latency)

        return result

    def get_metrics(self) -> Dict:
        """Return current server metrics."""
        metrics = {
            "model_versions": self._model_versions,
            "predictions": {},
            "cache_hit_rate": round(self._cache.hit_rate, 4),
            "models_loaded": self._loaded,
        }
        for ptype, data in self._metrics.items():
            count = data["count"]
            metrics["predictions"][ptype] = {
                "count": count,
                "avg_latency_ms": round(data["total_latency_ms"] / count, 2) if count > 0 else 0,
            }
        return metrics


# Singleton instance
_server: Optional[ModelServer] = None


def get_model_server() -> ModelServer:
    """Get or create the singleton ModelServer."""
    global _server
    if _server is None:
        _server = ModelServer()
    return _server
