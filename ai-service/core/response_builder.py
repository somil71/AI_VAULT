from typing import Dict, Any, List
from datetime import datetime
import uuid

def build_api_response(data: Any, latency_ms: float, req_id: str, model_version: str):
    """Factory to build the 100% compliant production response format."""
    return {
        "status": "success",
        "data": data,
        "meta": {
            "request_id": req_id,
            "latency_ms": round(float(latency_ms), 2),
            "model_version": model_version,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    }

def build_error_response(error_type: str, message: str, req_id: str):
    """Factory for standard AI error outputs."""
    return {
        "status": "error",
        "error": error_type,
        "message": message,
        "meta": {
            "request_id": req_id,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    }
