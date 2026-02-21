"""
Production-ready ML-based sentiment analysis using HuggingFace transformers.
Uses cardiffnlp/twitter-roberta-base-sentiment-latest for news headlines.

OPTIMIZED: Uses centralized ModelManager with thread pool execution
to avoid blocking the async event loop during inference.
"""

import asyncio
import logging
from typing import Dict
import hashlib

# Import cache functions for per-article sentiment caching
from app.core.cache import get_from_cache, set_in_cache
from app.core.config import settings
from app.services.model_manager import model_manager, ML_EXECUTOR

logger = logging.getLogger(__name__)


def _normalize_label(raw_label: str) -> str:
    """
    Convert raw model labels to normalized labels.
    Model returns: NEGATIVE, NEUTRAL, POSITIVE
    We normalize to: Negative, Neutral, Positive
    """
    label_map = {
        "POSITIVE": "Positive",
        "NEUTRAL": "Neutral",
        "NEGATIVE": "Negative"
    }
    normalized = label_map.get(raw_label.upper(), "Neutral")
    return normalized


def _truncate_text(text: str, max_tokens: int = 512) -> str:
    """
    Truncate text to avoid transformer overflow.
    Uses word-level truncation (rough estimate: 1 token ≈ 1 word).
    """
    words = text.split()
    if len(words) > max_tokens:
        words = words[:max_tokens]
    return " ".join(words)


class SentimentService:
    """
    ML-based sentiment analysis service.
    Provides label, confidence score, and model information.
    
    OPTIMIZED: Uses thread pool execution to avoid blocking event loop.
    """
    
    MODEL_NAME = "roberta-news"
    
    @staticmethod
    async def analyze(text: str) -> Dict[str, any]:
        """
        Analyze sentiment of given text using HuggingFace transformer.
        Includes per-article Redis caching to avoid repeated ML inference.
        
        OPTIMIZED: ML inference runs in thread pool to avoid blocking event loop.
        
        Args:
            text: Input text (title, description, or content)
            
        Returns:
            {
                "label": "Positive" | "Neutral" | "Negative",
                "confidence": float (0.0-1.0),
                "model": "roberta-news"
            }
        """
        if not text or len(text.strip()) < 3:
            return {
                "label": "Neutral",
                "confidence": 1.0,
                "model": SentimentService.MODEL_NAME
            }
        
        # Generate cache key for this specific text
        cache_key = SentimentService.get_sentiment_cache_key(text)
        
        # Check Redis cache BEFORE running expensive ML inference
        cached_sentiment = await get_from_cache(cache_key)
        if cached_sentiment:
            logger.debug(f"[SENTIMENT CACHE HIT] {text[:50]}")
            return cached_sentiment
        
        try:
            # Get model from centralized manager (lazy loading)
            pipeline = await model_manager.get_sentiment_model()

            # If model failed to load, fallback gracefully
            if pipeline is None:
                logger.warning("Sentiment model unavailable; returning neutral fallback")
                return {
                    "label": "Neutral",
                    "confidence": 1.0,
                    "model": SentimentService.MODEL_NAME
                }

            # Truncate to avoid overflow
            truncated_text = _truncate_text(text.strip(), max_tokens=512)

            # ✅ Run inference in thread pool (CPU-bound, would block event loop)
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                ML_EXECUTOR,
                lambda: pipeline(truncated_text, top_k=1)
            )
            
            if not results or len(results) == 0:
                logger.warning(f"No sentiment results for text: {text[:50]}")
                return {
                    "label": "Neutral",
                    "confidence": 1.0,
                    "model": SentimentService.MODEL_NAME
                }
            
            # Extract top result
            result = results[0]
            raw_label = result.get("label", "NEUTRAL")
            raw_score = result.get("score", 0.0)
            
            # Normalize label and ensure confidence is 0-1 float
            normalized_label = _normalize_label(raw_label)
            confidence = float(raw_score)  # Keep raw precision, frontend formats
            
            logger.debug(f"Sentiment: {normalized_label} ({confidence:.4f}) for: {text[:60]}")
            
            sentiment_result = {
                "label": normalized_label,
                "confidence": confidence,  # Raw float (not rounded)
                "model": SentimentService.MODEL_NAME
            }
            
            # Cache result to avoid repeated ML inference on same text
            await set_in_cache(cache_key, sentiment_result, ttl=settings.CACHE_TTL_NEWS)
            
            return sentiment_result
            
        except Exception as e:
            logger.error(f"Sentiment analysis error: {str(e)}")
            # Fallback to neutral on error
            return {
                "label": "Neutral",
                "confidence": 1.0,
                "model": SentimentService.MODEL_NAME
            }

    @staticmethod
    async def ensure_model_loaded() -> None:
        """Best-effort model preload; never raises. Now async-safe."""
        try:
            await model_manager.prewarm_sentiment()
        except Exception:
            logger.warning("Sentiment model preload failed; will fallback to neutral on requests")
    
    @staticmethod
    async def analyze_article(title: str = "", description: str = "", content: str = "") -> Dict[str, any]:
        """
        Analyze sentiment for a complete article.
        Combines title, description, and content, ignoring empty fields.
        Includes Redis caching per unique text combination.
        
        Args:
            title: Article title
            description: Article description
            content: Full article content
            
        Returns:
            Sentiment dict with label, confidence, model
        """
        # Combine available fields with space separation
        parts = [p.strip() for p in [title, description, content] if p and p.strip()]
        combined_text = " ".join(parts)
        
        return await SentimentService.analyze(combined_text)
    
    @staticmethod
    def get_sentiment_cache_key(text: str) -> str:
        """Generate cache key for sentiment result"""
        return f"sentiment:{hashlib.md5(text.encode()).hexdigest()}"
