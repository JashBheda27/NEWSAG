"""
Centralized ML Model Manager
============================
- Singleton pattern with lazy loading
- Thread-safe model access
- Background prewarming without blocking startup
- Thread pool execution for CPU-bound inference
"""

import os
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import Any, Callable, Optional

# Import transformers at module level to avoid race conditions in thread pool
import torch
from transformers import pipeline, AutoModelForSequenceClassification, AutoTokenizer

logger = logging.getLogger(__name__)

# Dedicated thread pool for ML inference (CPU-bound operations)
# Size = number of CPU cores, capped at 4 to prevent memory exhaustion
ML_EXECUTOR = ThreadPoolExecutor(max_workers=min(4, (os.cpu_count() or 2)))


class ModelManager:
    """
    Thread-safe singleton manager for ML models.
    Provides lazy loading and async inference execution.
    """
    
    _instance = None
    _lock = Lock()
    
    # Model states
    _sentiment_pipeline = None
    _credibility_pipeline = None
    _sentiment_loading = False
    _credibility_loading = False
    _sentiment_ready = asyncio.Event()
    _credibility_ready = asyncio.Event()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    # -------------------------
    # Sentiment Model
    # -------------------------
    def _load_sentiment_model_sync(self) -> Any:
        """Synchronous model loading (runs in thread pool)."""
        if self._sentiment_pipeline is not None:
            return self._sentiment_pipeline
        
        try:
            logger.info("[MODEL] Loading sentiment model...")
            
            # Explicitly load model and tokenizer to avoid meta tensor issues
            model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                device_map=None,  # Disable accelerate device mapping
                low_cpu_mem_usage=False,  # Load full tensors, not meta
            )
            model = model.to("cpu")  # Explicitly move to CPU
            model.eval()  # Set to evaluation mode
            
            self._sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model=model,
                tokenizer=tokenizer,
                device="cpu",  # Explicit CPU string instead of -1
            )
            logger.info("[MODEL] Sentiment model loaded successfully")
            return self._sentiment_pipeline
        except Exception as e:
            logger.error(f"[MODEL] Failed to load sentiment model: {e}")
            return None
    
    async def get_sentiment_model(self) -> Optional[Any]:
        """Get sentiment model, loading lazily if needed."""
        if self._sentiment_pipeline is not None:
            return self._sentiment_pipeline
        
        # Load in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(ML_EXECUTOR, self._load_sentiment_model_sync)
    
    async def prewarm_sentiment(self) -> bool:
        """Background prewarm - call this from startup without awaiting."""
        if self._sentiment_pipeline is not None:
            self._sentiment_ready.set()
            return True
        
        if self._sentiment_loading:
            return False
        
        self._sentiment_loading = True
        try:
            await self.get_sentiment_model()
            self._sentiment_ready.set()
            return self._sentiment_pipeline is not None
        finally:
            self._sentiment_loading = False
    
    # -------------------------
    # Credibility Model
    # -------------------------
    def _load_credibility_model_sync(self) -> Any:
        """Synchronous model loading (runs in thread pool)."""
        if self._credibility_pipeline is not None:
            return self._credibility_pipeline
        
        try:
            logger.info("[MODEL] Loading credibility model...")
            
            # Explicitly load model and tokenizer to avoid meta tensor issues
            model_name = "mrm8488/bert-tiny-finetuned-fake-news-detection"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                device_map=None,  # Disable accelerate device mapping
                low_cpu_mem_usage=False,  # Load full tensors, not meta
            )
            model = model.to("cpu")  # Explicitly move to CPU
            model.eval()  # Set to evaluation mode
            
            self._credibility_pipeline = pipeline(
                "text-classification",
                model=model,
                tokenizer=tokenizer,
                device="cpu",  # Explicit CPU string instead of -1
            )
            logger.info("[MODEL] Credibility model loaded successfully")
            return self._credibility_pipeline
        except Exception as e:
            logger.error(f"[MODEL] Failed to load credibility model: {e}")
            return None
    
    async def get_credibility_model(self) -> Optional[Any]:
        """Get credibility model, loading lazily if needed."""
        if self._credibility_pipeline is not None:
            return self._credibility_pipeline
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(ML_EXECUTOR, self._load_credibility_model_sync)
    
    async def prewarm_credibility(self) -> bool:
        """Background prewarm - call this from startup without awaiting."""
        if self._credibility_pipeline is not None:
            self._credibility_ready.set()
            return True
        
        if self._credibility_loading:
            return False
        
        self._credibility_loading = True
        try:
            await self.get_credibility_model()
            self._credibility_ready.set()
            return self._credibility_pipeline is not None
        finally:
            self._credibility_loading = False
    
    # -------------------------
    # Async Inference Helpers
    # -------------------------
    async def run_inference(
        self,
        model_getter: Callable,
        text: str,
        **kwargs
    ) -> Optional[Any]:
        """
        Run ML inference in thread pool to avoid blocking event loop.
        
        Args:
            model_getter: Async function to get the model
            text: Input text for inference
            **kwargs: Additional arguments for pipeline
        
        Returns:
            Model output or None on failure
        """
        model = await model_getter()
        if model is None:
            return None
        
        loop = asyncio.get_event_loop()
        
        def _infer():
            return model(text, **kwargs)
        
        try:
            return await loop.run_in_executor(ML_EXECUTOR, _infer)
        except Exception as e:
            logger.error(f"[MODEL] Inference failed: {e}")
            return None
    
    # -------------------------
    # Health Check
    # -------------------------
    def get_status(self) -> dict:
        """Get model loading status for health checks."""
        return {
            "sentiment_model": {
                "loaded": self._sentiment_pipeline is not None,
                "loading": self._sentiment_loading,
            },
            "credibility_model": {
                "loaded": self._credibility_pipeline is not None,
                "loading": self._credibility_loading,
            },
        }


# Global singleton instance
model_manager = ModelManager()


async def prewarm_models_background():
    """
    Prewarm all models in background tasks.
    Call this from startup event - it returns immediately.
    """
    logger.info("[MODEL] Starting background model prewarming...")
    
    # Create background tasks (non-blocking)
    asyncio.create_task(model_manager.prewarm_sentiment())
    asyncio.create_task(model_manager.prewarm_credibility())
    
    logger.info("[MODEL] Background prewarming tasks scheduled")
