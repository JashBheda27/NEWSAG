from fastapi import APIRouter, HTTPException
from app.services.news_service import NewsService
from app.core.cache import news_cache, get_from_cache, set_in_cache

router = APIRouter()


@router.get("/{category}")
async def get_news_by_category(category: str):
    """
    Fetch news articles by category.

    Uses caching to improve performance and
    reduce external API calls.
    """

    cache_key = f"news:{category}"

    # --------------------------------------------------
    # 1. Check cache first
    # --------------------------------------------------
    cached_data = get_from_cache(news_cache, cache_key)
    if cached_data:
        return {
            "source": "cache",
            "count": len(cached_data),
            "articles": cached_data,
        }

    # --------------------------------------------------
    # 2. Fetch from News API service
    # --------------------------------------------------
    try:
        articles = await NewsService.fetch_news_by_category(category)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch news: {exc}"
        )

    # --------------------------------------------------
    # 3. Store in cache
    # --------------------------------------------------
    set_in_cache(news_cache, cache_key, articles)

    return {
        "source": "api",
        "count": len(articles),
        "articles": articles,
    }
