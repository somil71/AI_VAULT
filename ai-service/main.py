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

app = FastAPI(title="LifeVault AI Service", version="2.0.0")

@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    """
    Standard Health Check for Production Monitoring (Phase 8)
    """
    return {
        "status": "success",
        "service": "lifevault-ai-inference",
        "version": "2.0.0",
        "uptime": "active"
    }

@app.get("/")
async def root():
    return {
        "message": "LifeVault AI Service is running",
        "version": "2.0.0",
        "docs": "/docs"
    }
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
    try:
        from ml.feedback_loop import get_pipeline
        pipeline = get_pipeline()
        drift = pipeline.drift_monitor.check_drift()
        return {"status": "success", "data": drift}
    except Exception as e:
        return {
            "status": "success",
            "data": {
                "drift_detected": False,
                "last_check": time.time(),
                "message": str(e),
            }
        }

# ── New ML-Powered Endpoints ────────────────────────────────────────────────

class URLAnalysisRequest(BaseModel):
    url: str = Field(..., max_length=2048)
    context: Optional[str] = None

class TextAnalysisRequest(BaseModel):
    text: str = Field(..., max_length=50000)
    sender: Optional[str] = None
    subject: Optional[str] = None

class TransactionAnalysisRequestV2(BaseModel):
    amount: float
    merchant: str
    category: Optional[str] = "Unknown"
    timestamp: Optional[str] = None
    hour_of_day: Optional[int] = 12
    day_of_week: Optional[int] = 3
    merchant_frequency: Optional[float] = 5.0
    amount_zscore: Optional[float] = 0.0
    is_weekend: Optional[int] = 0
    time_since_last_txn_hours: Optional[float] = 12.0

class CombinedAnalysisRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    transactions: Optional[List[dict]] = None

class FeedbackRequest(BaseModel):
    prediction_id: str
    correct_label: int = Field(..., ge=0, le=1)
    notes: Optional[str] = None

@app.post("/api/v1/analyze/url")
async def analyze_url(req: URLAnalysisRequest):
    """Analyze a URL for phishing/threat indicators using the ML ensemble."""
    req_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        from ml.model_server import get_model_server
        server = get_model_server()
        result = server.predict_url(req.url)
        latency = (time.perf_counter() - start) * 1000
        return {
            "status": "success",
            "data": result,
            "meta": {"request_id": req_id, "latency_ms": round(latency, 2)},
        }
    except Exception as e:
        logger.error(f"URL analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/analyze/text")
async def analyze_text(req: TextAnalysisRequest):
    """Analyze text/email for phishing indicators using the ML ensemble."""
    req_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        from ml.model_server import get_model_server
        server = get_model_server()
        result = server.predict_text(req.text, req.sender or "", req.subject or "")
        latency = (time.perf_counter() - start) * 1000
        return {
            "status": "success",
            "data": result,
            "meta": {"request_id": req_id, "latency_ms": round(latency, 2)},
        }
    except Exception as e:
        logger.error(f"Text analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/analyze/transaction")
async def analyze_transaction(req: TransactionAnalysisRequestV2):
    """Analyze a single transaction for anomalies."""
    req_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        from ml.model_server import get_model_server
        server = get_model_server()
        features = req.model_dump()
        result = server.predict_transaction(features)
        latency = (time.perf_counter() - start) * 1000
        return {
            "status": "success",
            "data": result,
            "meta": {"request_id": req_id, "latency_ms": round(latency, 2)},
        }
    except Exception as e:
        logger.error(f"Transaction analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/analyze/combined")
async def analyze_combined(req: CombinedAnalysisRequest):
    """Combined ensemble analysis across URL, text, and transactions."""
    req_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        from ml.model_server import get_model_server
        server = get_model_server()
        result = server.predict_combined(
            url=req.url,
            text=req.text,
            transactions=req.transactions,
        )
        latency = (time.perf_counter() - start) * 1000
        return {
            "status": "success",
            "data": result,
            "meta": {"request_id": req_id, "latency_ms": round(latency, 2)},
        }
    except Exception as e:
        logger.error(f"Combined analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Submit user feedback on a prediction (for continuous learning)."""
    try:
        from ml.feedback_loop import get_feedback_store
        store = get_feedback_store()
        success = await store.store_feedback({
            "prediction_id": req.prediction_id,
            "correct_label": req.correct_label,
            "notes": req.notes,
        })
        return {"status": "success", "data": {"accepted": success}}
    except Exception as e:
        logger.error(f"Feedback submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/threat-intelligence/summary")
async def threat_intelligence_summary():
    """High-level threat intelligence summary."""
    return {
        "status": "success",
        "data": {
            "threats_blocked_today": 0,
            "top_phishing_domains": [],
            "trending_scam_types": ["credential_theft", "payment_fraud", "brand_impersonation"],
            "message": "Connect MongoDB for live data.",
        }
    }

@app.get("/api/v1/ml/metrics")
async def ml_metrics():
    """Get ML model server metrics."""
    try:
        from ml.model_server import get_model_server
        server = get_model_server()
        return {"status": "success", "data": server.get_metrics()}
    except Exception as e:
        return {"status": "success", "data": {"error": str(e), "models_loaded": False}}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1)

