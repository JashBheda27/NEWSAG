"""
Fake News / Credibility Detection Service
-----------------------------------------
Uses a hybrid approach:
1. Domain Whitelist (fast heuristic for trusted sources)
2. ML Model (BERT-tiny for unknown sources)

Model: mrm8488/bert-tiny-finetuned-fake-news-detection (~67MB)

OPTIMIZED: Uses centralized ModelManager with thread pool execution
to avoid blocking the async event loop during inference.
"""

import asyncio
import logging
import hashlib
from typing import List, Dict, Optional
from urllib.parse import urlparse

from app.core.cache import get_from_cache, set_in_cache
from app.services.model_manager import model_manager, ML_EXECUTOR

logger = logging.getLogger(__name__)

# Trusted domains whitelist (bypass ML inference)
TRUSTED_DOMAINS = {
    # Major News Agencies
    "reuters.com", "apnews.com", "afp.com",
    # UK
    "bbc.com", "bbc.co.uk", "theguardian.com", "ft.com", "economist.com",
    # US
    "nytimes.com", "washingtonpost.com", "wsj.com", "npr.org", "cnn.com",
    "bloomberg.com", "usatoday.com", "abcnews.go.com", "cbsnews.com", "nbcnews.com",
    # India
    "thehindu.com", "indianexpress.com", "hindustantimes.com", "ndtv.com",
    "timesofindia.indiatimes.com", "economictimes.indiatimes.com",
    # Tech
    "techcrunch.com", "wired.com", "theverge.com", "arstechnica.com",
    # Business
    "cnbc.com", "forbes.com", "businessinsider.com",
    # International
    "aljazeera.com", "dw.com", "france24.com",
    # Google aggregated (trust the curation)
    "news.google.com",
}

# Known low-quality / satire domains (flag as potentially misleading)
SUSPECT_DOMAINS = {
    "theonion.com",  # Satire
    "babylonbee.com",  # Satire
    "infowars.com",
    "naturalnews.com",
}


def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _check_domain_trust(source_name: str, source_url: str, article_url: str) -> Optional[Dict]:
    """
    Check if the article source is in the trusted or suspect domains list.
    Returns credibility data if match found, None otherwise.
    """
    # Extract domain from article URL
    domain = _extract_domain(article_url)
    
    # Also check source URL if available
    source_domain = _extract_domain(source_url) if source_url else ""
    
    # Check trusted domains
    for trusted in TRUSTED_DOMAINS:
        if trusted in domain or trusted in source_domain or trusted in source_name.lower():
            return {
                "score": 1.0,
                "label": "Trusted Source",
                "source": "heuristic",
            }
    
    # Check suspect domains
    for suspect in SUSPECT_DOMAINS:
        if suspect in domain or suspect in source_domain or suspect in source_name.lower():
            return {
                "score": 0.2,
                "label": "Potentially Misleading",
                "source": "heuristic",
            }
    
    return None


async def analyze_article_credibility(title: str, description: str) -> Dict:
    """
    Analyze credibility of a single article using ML model.
    
    OPTIMIZED: ML inference runs in thread pool to avoid blocking event loop.
    """
    # Get model from centralized manager (lazy loading)
    pipeline = await model_manager.get_credibility_model()
    
    if not pipeline:
        return {
            "score": 0.5,
            "label": "Unverified",
            "source": "fallback",
        }
    
    try:
        # Combine title and description for analysis
        text = f"{title} {description}".strip()[:512]
        
        if not text:
            return {
                "score": 0.5,
                "label": "Unverified",
                "source": "fallback",
            }
        
        # ✅ Run inference in thread pool (CPU-bound, would block event loop)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            ML_EXECUTOR,
            lambda: pipeline(text)[0]
        )
        
        # Model output: LABEL_0 = Fake, LABEL_1 = Real
        # Alternatively some models use: 'FAKE' / 'REAL'
        label_raw = result.get("label", "").upper()
        confidence = result.get("score", 0.5)
        
        # Normalize to "is this real?" score (0-1)
        if "1" in label_raw or "REAL" in label_raw:
            score = confidence
        else:
            score = 1.0 - confidence
        
        # Map score to human-readable label
        if score > 0.75:
            label = "Reliable"
        elif score > 0.5:
            label = "Likely Reliable"
        elif score > 0.35:
            label = "Uncertain"
        else:
            label = "Potentially Misleading"
        
        return {
            "score": round(score, 3),
            "label": label,
            "source": "ml_model",
        }
    except Exception as e:
        logger.warning(f"Credibility ML inference failed: {e}")
        return {
            "score": 0.5,
            "label": "Unverified",
            "source": "fallback",
        }


async def _analyze_single_article_credibility(article: Dict) -> Dict:
    """
    Analyze credibility for a single article.
    Separated for parallel execution.
    """
    try:
        # Extract source info
        source_obj = article.get("source", {})
        if isinstance(source_obj, dict):
            source_name = source_obj.get("name", "")
            source_url = source_obj.get("url", "")
        else:
            source_name = str(source_obj)
            source_url = ""
        
        article_url = article.get("url", "")
        title = article.get("title", "")
        description = article.get("description", "")
        
        # 1. Check domain whitelist/blacklist (fast heuristic)
        heuristic_result = _check_domain_trust(source_name, source_url, article_url)
        if heuristic_result:
            article["credibility"] = heuristic_result
            return article
        
        # 2. Check Redis cache
        content_hash = hashlib.md5(f"{title}:{description}".encode()).hexdigest()
        cache_key = f"credibility:{content_hash}"
        
        cached = await get_from_cache(cache_key)
        if cached:
            article["credibility"] = cached
            return article
        
        # 3. Run ML model inference
        credibility_data = await analyze_article_credibility(title, description)
        
        # Cache the result (24 hours TTL)
        await set_in_cache(cache_key, credibility_data, ttl=86400)
        
        article["credibility"] = credibility_data
        
    except Exception as e:
        logger.warning(f"Credibility analysis failed for article: {e}")
        article["credibility"] = {
            "score": 0.5,
            "label": "Unverified",
            "source": "error",
        }
    
    return article


async def analyze_credibility(articles: List[Dict]) -> List[Dict]:
    """
    Analyze credibility for a list of articles.
    
    OPTIMIZED: Uses asyncio.gather for parallel execution.
    
    Pipeline per article:
    1. Check Domain Whitelist/Blacklist (instant)
    2. Check Redis Cache
    3. Run ML Model inference
    """
    if not articles:
        return articles
    
    # ✅ Run all credibility analyses in parallel
    tasks = [_analyze_single_article_credibility(article) for article in articles]
    await asyncio.gather(*tasks)
    
    return articles

