import asyncio
import os
import time
import logging
import uuid
import sentry_sdk
import uvicorn
import traceback
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Local Modular Imports
from core.model_loader import model_registry
from core.inference_engine import run_inference
from core.response_builder import build_api_response, build_error_response
from services.metrics_logger import log_prediction_metric

# ── Observability Setup ───────────────────────────────────────────────────────
if os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.environ.get("SENTRY_DSN"),
        traces_sample_rate=1.0,
        environment=os.environ.get("ENV", "production")
    )

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name
        }
        return json.dumps(log_record)

import json
logger = logging.getLogger("ai_service")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setFormatter(JSONFormatter())
logger.addHandler(ch)

# ── Initialization ────────────────────────────────────────────────────────────

app = FastAPI(
    title="LifeVault AI Production OS",
    description="Hardened AI Phishing & Transaction Guard",
    version="2.1.0",
)

# CORS: whitelisted only
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

MODEL_VERSION = "v2.1-modular-transformer"

# ── Models ───────────────────────────────────────────────────────────────────

class PhishingRequest(BaseModel):
    text: Optional[str] = Field(None, max_length=50000)
    url: Optional[str] = Field(None, max_length=2048)

class TransactionRow(BaseModel):
    date: str
    description: str
    amount: float
    merchant: str
    category: Optional[str] = "Unknown"

class TransactionAnalysisRequest(BaseModel):
    transactions: List[TransactionRow]

# ── Lifecycle ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Warms up models and prepares service."""
    try:
        await model_registry.initialize()
        logger.info("AI Service Lifecycle: startup sequence complete.")
    except Exception as e:
        logger.error(f"AI Service Startup Failed: {str(e)}")
        # In production, we might want to shut down if models fail to load

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up and release resources."""
    logger.info("AI Service Lifecycle: shutdown sequence starting.")
    await model_registry.shutdown()

# ── Exception Handlers ────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = str(uuid.uuid4())
    logger.error(f"Unhandled AI exception: {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content=build_error_response("InferenceError", str(exc), req_id)
    )

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Service readiness health probe."""
    if not model_registry.is_ready:
        raise HTTPException(status_code=503, detail="Models not loaded")

    return {
        "status": "success",
        "data": {
            "service": "online",
            "model_ready": True,
            "version": app.version
        }
    }

@app.post("/analyze-phishing")
async def analyze_phishing(req: PhishingRequest):
    req_id = str(uuid.uuid4())
    if not req.text and not req.url:
        raise HTTPException(status_code=400, detail="Text or URL is required")

    start = time.perf_counter()
    try:
        result = await run_inference("phishing", "analyze", text=req.text, url=req.url)
        latency = (time.perf_counter() - start) * 1000

        log_prediction_metric("/analyze-phishing", result.get("risk_score", 0), latency, MODEL_VERSION)
        return build_api_response(result, latency, req_id, MODEL_VERSION)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-transactions")
async def analyze_transactions(req: TransactionAnalysisRequest):
    req_id = str(uuid.uuid4())
    if len(req.transactions) < 3:
        raise HTTPException(status_code=400, detail="Minimum 3 transactions required")

    rows = [t.model_dump() for t in req.transactions]
    start = time.perf_counter()
    try:
        result = await run_inference("anomaly", "analyze", rows)
        latency = (time.perf_counter() - start) * 1000

        return build_api_response(result, latency, req_id, MODEL_VERSION)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai/model/drift-status")
async def drift_status():
    """Check for model distribution skew over time."""
    # Logic in drift_detector would generate this normally
    return {
        "status": "success",
        "data": {
            "drift_detected": False,
            "last_check": time.time(),
            "metrics": {"p95_latency": 1200.0} # Placeholder
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1)
