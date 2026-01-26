import logging
from fastapi import APIRouter, HTTPException
from app.services.news_service import GNewsService
from app.core.cache import get_from_cache, set_in_cache, delete_from_cache
from app.core.gnews_counter import GNewsCounter  # ✅ Added

router = APIRouter()
logger = logging.getLogger(__name__)

# Default categories
CATEGORIES = ["general", "nation", "business", "technology", "sports", "entertainment", "health"]

# -----------------------------
# GET NEWS BY TOPIC (CACHE FIRST)
# -----------------------------
@router.get("/topic/{topic}")
async def get_news_by_topic(topic: str):
    """Fetch news by topic/category with caching"""
    cache_key = f"gnews:{topic}"

    cached = await get_from_cache(cache_key)
    if cached:
        logger.info(f"[CACHE HIT] {topic}")
        # ✅ Return hit status even from cache
        hit_status = await GNewsCounter.get_hit_status()
        return {
            "source": "cache",
            "count": len(cached),
            "articles": cached,
            "hits": hit_status,  # ✅ Added
        }

    logger.info(f"[GNEWS HIT] {topic}")
    try:
        articles = await GNewsService.fetch_category(topic)
    except Exception as e:
        logger.error(f"Error fetching news for {topic}: {str(e)}")
        raise HTTPException(status_code=502, detail=str(e))

    await set_in_cache(cache_key, articles)
    
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
async def reset_hit_counter():
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
async def refresh_category(category: str):
    """Manually refresh news for a specific category"""
    cache_key = f"gnews:{category}"
    await delete_from_cache(cache_key)

    logger.warning(f"[MANUAL REFRESH] {category}")
    try:
        articles = await GNewsService.fetch_category(category)
    except Exception as e:
        logger.error(f"Error refreshing {category}: {str(e)}")
        raise HTTPException(status_code=502, detail=str(e))
    
    await set_in_cache(cache_key, articles)

    return {
        "message": f"{category} refreshed",
        "hits_used": 1,
        "articles": len(articles),
    }


# -----------------------------
# REFRESH ALL (7 HITS)
# -----------------------------
@router.post("/refresh-all")
async def refresh_all():
    """Refresh all categories at once"""
    categories = CATEGORIES
    total_articles = 0
    errors = []

    for cat in categories:
        try:
            await delete_from_cache(f"gnews:{cat}")
            articles = await GNewsService.fetch_category(cat)
            await set_in_cache(f"gnews:{cat}", articles)
            total_articles += len(articles)
        except Exception as e:
            logger.error(f"Error refreshing {cat}: {str(e)}")
            errors.append(f"{cat}: {str(e)}")

    logger.warning(f"[MANUAL REFRESH ALL] categories={len(categories)}, articles={total_articles}")

    return {
        "message": "All categories refreshed",
        "categories_refreshed": len(categories),
        "total_articles": total_articles,
        "errors": errors if errors else None,
    }
