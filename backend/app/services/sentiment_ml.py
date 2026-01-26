"""
Production-ready ML-based sentiment analysis using HuggingFace transformers.
Uses cardiffnlp/twitter-roberta-base-sentiment-latest for news headlines.
"""

import logging
from typing import Dict, Optional
from threading import Lock
import hashlib

# Import cache functions for per-article sentiment caching
from app.core.cache import get_from_cache, set_in_cache
from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton lock for thread-safe model loading
_model_lock = Lock()
_sentiment_pipeline = None


def _load_model():
    """
    Load the sentiment analysis model once at startup.
    Uses singleton pattern to avoid reloading.
    """
    global _sentiment_pipeline
    
    if _sentiment_pipeline is not None:
        return _sentiment_pipeline
    
    with _model_lock:
        # Double-check pattern to avoid race conditions
        if _sentiment_pipeline is not None:
            return _sentiment_pipeline
        
        try:
            from transformers import pipeline
            
            logger.info("Loading sentiment model: cardiffnlp/twitter-roberta-base-sentiment-latest")
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                device=-1  # -1 = CPU only (production safe, no GPU assumptions)
            )
            logger.info("Sentiment model loaded successfully")
            return _sentiment_pipeline
        except Exception as e:
            logger.error(f"Failed to load sentiment model: {str(e)}")
            raise


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
    """
    
    MODEL_NAME = "roberta-news"
    
    @staticmethod
    async def analyze(text: str) -> Dict[str, any]:
        """
        Analyze sentiment of given text using HuggingFace transformer.
        Includes per-article Redis caching to avoid repeated ML inference.
        
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
            # Load model (singleton)
            pipeline = _load_model()
            
            # Truncate to avoid overflow
            truncated_text = _truncate_text(text.strip(), max_tokens=512)
            
            # Run inference (expensive operation)
            results = pipeline(truncated_text, top_k=1)
            
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
