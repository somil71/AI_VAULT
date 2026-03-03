import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LOG_PATH = Path(__file__).resolve().parents[1] / "logs" / "metrics.jsonl"


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def log_prediction_metric(endpoint: str, prediction_score: Any, inference_latency: Any, model_mode: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "prediction_score": _to_float(prediction_score),
        "inference_latency": _to_float(inference_latency),
        "model_mode": model_mode,
    }
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
