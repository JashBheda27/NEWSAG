import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from app.services.news_service import GNewsService
from app.services.sentiment_ml import SentimentService  # ✅ Use new ML-based sentiment
from app.services.credibility_service import analyze_credibility  # ✅ Fake news detection
from app.core.cache import get_from_cache, set_in_cache, delete_from_cache
from app.core.gnews_counter import GNewsCounter
from app.core.auth import require_auth, require_admin

router = APIRouter()
logger = logging.getLogger(__name__)

# Default categories
CATEGORIES = ["general", "nation", "business", "technology", "sports", "entertainment", "health"]


# -----------------------------
# SEARCH SUGGESTIONS (CACHE ONLY)
# -----------------------------
@router.get("/suggestions")
async def get_search_suggestions(q: str):
    """
    Return matching articles from Redis-cached categories only.
    Matches query against title, description, content, and source (case-insensitive).
    """
    query = (q or "").strip()
    if len(query) < 2:
        logger.info("[SUGGESTIONS REJECTED] query too short")
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    query_lower = query.lower()
    results = []
    seen_ids = set()

    for category in CATEGORIES:
        cache_key = f"gnews:{category}"
        cached = await get_from_cache(cache_key)
        if not cached:
            continue

        for article in cached:
            title = (article.get("title") or "").lower()
            description = (article.get("description") or "").lower()
            content = (article.get("content") or "").lower()
            source = article.get("source") or ""
            if isinstance(source, dict):
                source = source.get("name") or ""
            source_lower = source.lower()

            if query_lower not in title and query_lower not in description and query_lower not in content and query_lower not in source_lower:
                continue

            article_id = article.get("id") or article.get("url")
            if article_id in seen_ids:
                continue
            seen_ids.add(article_id)

            article_out = dict(article)
            if isinstance(article_out.get("source"), dict):
                article_out["source"] = article_out.get("source", {}).get("name") or ""

            results.append(article_out)

            if len(results) >= 6:
                break

        if len(results) >= 6:
            break

    logger.info(f"[SUGGESTIONS] query='{query_lower}' | count={len(results)}")

    return {
        "query": query,
        "count": len(results),
        "articles": results[:6],
    }


# -----------------------------
# GET TRENDING HEADLINES (BULLETIN)
# -----------------------------
@router.get("/trending/headlines")
async def get_trending_headlines(max_items: int = 8):
    """
    Fetch trending top headlines for the bulletin ticker.
    Uses cached general news or fetches fresh if needed.
    Returns lightweight headline data for the ticker display.
    """
    cache_key = "gnews:trending:headlines"
    
    # Try trending headlines cache first
    cached = await get_from_cache(cache_key)
    if cached:
        logger.info(f"[CACHE HIT] trending headlines | count={len(cached)}")
        hit_status = await GNewsCounter.get_hit_status()
        return {
            "source": "cache",
            "count": len(cached),
            "headlines": cached,
            "hits": hit_status,
        }
    
    # Fallback: Use general news cache to avoid extra API hit
    logger.info("[CACHE MISS] trending headlines | checking general news cache...")
    general_cache = await get_from_cache("gnews:general")
    
    if general_cache:
        logger.info(f"[CACHE HIT] general news for trending | extracting {max_items} headlines")
        # Extract headlines from cached general news
        headlines = [
            {
                "id": article.get("id"),
                "title": article.get("title"),
                "source": article.get("source"),
                "url": article.get("url"),
                "published_at": article.get("published_at"),
                "category": article.get("category", "general"),
            }
            for article in general_cache[:max_items]
        ]
        # Cache the extracted headlines with shorter TTL
        await set_in_cache(cache_key, headlines, ttl=60 * 10)  # 10 min TTL
        logger.info(f"[CACHE SET] trending headlines | count={len(headlines)} | ttl=600s")
        hit_status = await GNewsCounter.get_hit_status()
        return {
            "source": "cache",
            "count": len(headlines),
            "headlines": headlines,
            "hits": hit_status,
        }
    
    # No cache available - do NOT fetch to avoid extra API hits
    logger.warning("[CACHE MISS] trending headlines | no cache available, skipping API fetch")
    raise HTTPException(
        status_code=503,
        detail="Trending headlines are unavailable until the news cache is populated."
    )

# --------------------------------------------------
# HELPER: Add ML-based sentiment to articles (PARALLELIZED)
# --------------------------------------------------
async def _analyze_single_article_sentiment(article: dict) -> dict:
    """Analyze sentiment for a single article and attach result."""
    sentiment_result = await SentimentService.analyze_article(
        title=article.get('title', ''),
        description=article.get('description', ''),
        content=article.get('content', '')
    )
    article["sentiment"] = {
        "label": sentiment_result["label"],
        "confidence": sentiment_result["confidence"],
        "model": sentiment_result["model"]
    }
    return article


async def add_sentiment_to_articles(articles):
    """
    Calculate sentiment for each article using ML model.
    
    OPTIMIZED: Uses asyncio.gather for parallel execution.
    With 20 articles: Sequential = 6 seconds, Parallel = ~300ms
    """
    import asyncio
    
    if not articles:
        return articles
    
    # ✅ Run all sentiment analyses in parallel
    tasks = [_analyze_single_article_sentiment(article) for article in articles]
    await asyncio.gather(*tasks)
    
    return articles

# -----------------------------
# GET NEWS BY TOPIC (CACHE FIRST)
# -----------------------------
@router.get("/topic/{topic}")
async def get_news_by_topic(topic: str):
    """Fetch news by topic/category with caching"""
    # TODO: Future enhancement - include country/language/pagination in cache key
    cache_key = f"gnews:{topic}"

    cached = await get_from_cache(cache_key)
    if cached:
        updated = False
        for article in cached:
            if "content_is_full" not in article:
                content_value = article.get("content")
                article["content_is_full"] = GNewsService.is_content_complete(content_value)
                updated = True
        if updated:
            await set_in_cache(cache_key, cached)
            logger.info(f"[CACHE UPDATE] {topic} | added content_is_full")
        logger.info(f"[CACHE HIT] {topic}")
        # Cached articles ALREADY have sentiment - do NOT recompute
        # (Sentiment was added before caching, see API fetch branch below)
        hit_status = await GNewsCounter.get_hit_status()
        return {
            "source": "cache",
            "count": len(cached),
            "articles": cached,
            "hits": hit_status,
        }

    logger.info(f"[GNEWS HIT] {topic}")
    try:
        articles = await GNewsService.fetch_category(topic)
    except Exception as e:
        logger.error(f"Error fetching news for {topic}: {str(e)}")
        raise HTTPException(status_code=502, detail=str(e))

    # Add sentiment ONCE before caching (includes per-article Redis caching)
    articles = await add_sentiment_to_articles(articles)
    
    # ✅ Add credibility/fake news detection
    articles = await analyze_credibility(articles)
    
    await set_in_cache(cache_key, articles)
    full_count = sum(1 for article in articles if article.get("content_is_full"))
    partial_count = sum(1 for article in articles if article.get("content") and not article.get("content_is_full"))
    missing_count = sum(1 for article in articles if not article.get("content"))
    logger.info(
        "[CACHE SET] %s | content_full=%d partial=%d missing=%d",
        topic,
        full_count,
        partial_count,
        missing_count,
    )
    
    # ✅ Get hit status after API call
    hit_status = await GNewsCounter.get_hit_status()

    return {
        "source": "api",
        "count": len(articles),
        "articles": articles,
        "hits": hit_status,  # ✅ Added
    }

# Backward compatibility
@router.get("/{category}")
async def get_news(category: str):
    """Fetch news by category (backward compatibility)"""
    return await get_news_by_topic(category)

# ✅ NEW: Get hit counter status
@router.get("/status/hits")
async def get_hit_status():
    """Get current GNews API hit count for today"""
    hit_status = await GNewsCounter.get_hit_status()
    return {
        "status": "ok",
        "hits": hit_status,
        "message": "GNews API hit counter"
    }

# ✅ NEW: Admin endpoint - Reset counter (testing only)
@router.post("/admin/reset-hits")
async def reset_hit_counter(
    user=Depends(require_admin),
):
    """Reset hit counter (ADMIN ONLY - for testing)"""
    result = await GNewsCounter.reset_counter()
    return {
        "status": "reset",
        "hits": result,
        "message": "Hit counter reset to 0"
    }


# -----------------------------
# MANUAL REFRESH (1 HIT)
# -----------------------------
@router.post("/refresh/{category}")
async def refresh_category(
    category: str,
    user=Depends(require_admin),
):
    """Manually refresh news for a specific category (ADMIN ONLY)"""
    cache_key = f"gnews:{category}"
    await delete_from_cache(cache_key)

    logger.warning(f"[MANUAL REFRESH] {category}")
    try:
        articles = await GNewsService.fetch_category(category)
    except Exception as e:
        logger.error(f"Error refreshing {category}: {str(e)}")
        raise HTTPException(status_code=502, detail=str(e))
    
    # Add sentiment BEFORE caching (computed once, cached with articles)
    articles = await add_sentiment_to_articles(articles)
    
    # ✅ Add credibility/fake news detection
    articles = await analyze_credibility(articles)
    
    await set_in_cache(cache_key, articles)

    return {
        "message": f"{category} refreshed",
        "hits_used": 1,
        "articles": len(articles),
    }


# -----------------------------
# REFRESH ALL (7 HITS) - PARALLELIZED
# -----------------------------
async def _refresh_single_category(cat: str, semaphore: asyncio.Semaphore) -> dict:
    """Refresh a single category with semaphore for rate limiting."""
    async with semaphore:  # Limit concurrent API calls
        try:
            await delete_from_cache(f"gnews:{cat}")
            articles = await GNewsService.fetch_category(cat)
            # Add sentiment BEFORE caching (computed once, cached with articles)
            articles = await add_sentiment_to_articles(articles)
            # Add credibility/fake news detection
            articles = await analyze_credibility(articles)
            await set_in_cache(f"gnews:{cat}", articles)
            return {"category": cat, "count": len(articles), "error": None}
        except Exception as e:
            logger.error(f"Error refreshing {cat}: {str(e)}")
            return {"category": cat, "count": 0, "error": str(e)}


@router.post("/refresh-all")
async def refresh_all(
    user=Depends(require_admin),
):
    """
    Refresh all categories at once (ADMIN ONLY).
    
    OPTIMIZED: Uses asyncio.gather with semaphore for controlled parallelism.
    Sequential: ~45 seconds → Parallel: ~8-10 seconds
    """
    import asyncio
    
    categories = CATEGORIES
    
    # Semaphore to limit concurrent API calls (avoid rate limiting)
    semaphore = asyncio.Semaphore(3)  # Max 3 concurrent fetches
    
    # ✅ Run all category refreshes in parallel (controlled by semaphore)
    tasks = [_refresh_single_category(cat, semaphore) for cat in categories]
    results = await asyncio.gather(*tasks)
    
    total_articles = sum(r["count"] for r in results)
    errors = [f"{r['category']}: {r['error']}" for r in results if r["error"]]

    logger.warning(f"[MANUAL REFRESH ALL] categories={len(categories)}, articles={total_articles}")

    return {
        "message": "All categories refreshed",
        "categories_refreshed": len(categories) - len(errors),
        "total_articles": total_articles,
        "errors": errors if errors else None,
    }


# -----------------------------
# SENTIMENT RATING (User Feedback)
# -----------------------------
from fastapi import Depends
from app.core.database import get_db
from app.core.auth import require_auth, require_admin, get_current_user_optional
from app.models.sentiment_training import SentimentRatingRequest
from app.models.credibility_training import CredibilityReportRequest
from app.services.training_data_service import TrainingDataService


async def get_article_category(article_id: str | None, article_url: str | None) -> str | None:
    """
    Find and return the category of an article by checking all cached categories.
    Returns 'general', another category, or None if not found.
    """
    if not article_id and not article_url:
        return None
    
    for category in CATEGORIES:
        cache_key = f"gnews:{category}"
        try:
            cached_articles = await get_from_cache(cache_key)
            if not cached_articles:
                continue
            
            for article in cached_articles:
                if (article_id and article.get("id") == article_id) or \
                   (article_url and article.get("url") == article_url):
                    return category
        except Exception as e:
            logger.warning(f"[CACHE] Error checking category {category}: {e}")
            continue
    
    return None


@router.post("/rate")
async def rate_article_sentiment(
    rating: SentimentRatingRequest,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """
    Submit user's sentiment rating for an article.
    - Authenticated users: any category
    - Anonymous users: general category only (or unknown category)
    
    Args:
        rating: User's sentiment correction
        
    Returns:
        Confirmation of feedback submission
    """
    is_demo = user.get("is_demo", False)
    user_id = user["user_id"]
    
    # Check category for anonymous users - block non-general
    if is_demo:
        article_category = await get_article_category(rating.article_id, rating.article_url)
        if article_category and article_category != "general":
            raise HTTPException(
                status_code=403,
                detail=f"Please sign in to rate '{article_category}' category articles."
            )
        logger.info(f"[RATE ANON] category={article_category or 'unknown'} | url={rating.article_url}")
    
    # Combine title and description for training text
    text = rating.title
    if rating.description:
        text += " " + rating.description
    
    result_id = await TrainingDataService.add_sentiment_feedback(
        db=db,
        article_id=rating.article_id,
        text=text,
        ai_label=rating.ai_label,
        ai_confidence=rating.ai_confidence,
        user_id=user_id,
        source="explicit",
        user_label=rating.user_label,
        article_url=rating.article_url,
    )
    
    logger.info(f"[FEEDBACK] Sentiment rating received: article={rating.article_id}, user_label={rating.user_label}")
    
    return {
        "message": "Thank you for your feedback!",
        "feedback_id": result_id,
        "ai_label": rating.ai_label,
        "user_label": rating.user_label,
    }


# -----------------------------
# REPORT MISLEADING CONTENT
# -----------------------------
@router.post("/report")
async def report_misleading_article(
    report: CredibilityReportRequest,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """
    Report an article as potentially misleading.
    - Authenticated users: any category
    - Anonymous users: general category only (or unknown category)
    
    Args:
        report: Article details and user's reason for reporting
        
    Returns:
        Report submission status
    """
    is_demo = user.get("is_demo", False)
    user_id = user["user_id"]
    
    # Check category for anonymous users - block non-general
    if is_demo:
        article_category = await get_article_category(report.article_id, report.article_url)
        if article_category and article_category != "general":
            raise HTTPException(
                status_code=403,
                detail=f"Please sign in to report '{article_category}' category articles."
            )
        logger.info(f"[REPORT ANON] category={article_category or 'unknown'} | url={report.article_url}")
    
    result = await TrainingDataService.add_credibility_report(
        db=db,
        article_id=report.article_id,
        article_url=report.article_url,
        title=report.title,
        ai_label=report.ai_label,
        ai_score=report.ai_score,
        ai_source=report.ai_source,
        user_id=user_id,
        description=report.description,
        content=report.content,
        source_domain=report.source_domain,
        user_reason=report.reason,
    )
    
    logger.info(f"[FEEDBACK] Misleading report received: article={report.article_id}, status={result['status']}")
    
    return {
        "message": result["message"],
        "report_id": result["report_id"],
        "report_count": result.get("report_count", 1),
        "status": result["status"],
    }
