import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from .model_loader import model_registry

logger = logging.getLogger("ai_service")

# Worker pool for CPU-bound inference (prevents event loop blocking)
model_executor = ThreadPoolExecutor(max_workers=4)
inference_semaphore = asyncio.Semaphore(5) # Max concurrent inferences

async def run_inference(model_key: str, method_name: str, *args, **kwargs):
    """Offload and gate blocking ML inference to worker threads."""
    async with inference_semaphore:
        loop = asyncio.get_event_loop()
        try:
            model = model_registry.get_model(model_key)
            method = getattr(model, method_name)

            # Measure specific P95 metrics (this could go to an observability hook)
            # await loop.run_in_executor(model_executor, lambda: method(*args, **kwargs))
            return await loop.run_in_executor(model_executor, lambda: method(*args, **kwargs))
        except Exception as e:
            logger.error(f"Inference fatal error for {model_key}.{method_name}: {str(e)}")
            raise
