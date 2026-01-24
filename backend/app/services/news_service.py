import httpx
import hashlib
from typing import List, Dict
from app.core.config import settings


class NewsService:
    """
    Service class responsible for fetching news
    from external data providers (News API).
    """

    @staticmethod
    async def fetch_news_by_category(category: str) -> List[Dict]:
        """
        Fetch news articles by category from News API.

        :param category: news category (top, business, sports, etc.)
        :return: list of normalized news articles
        """

        url = f"{settings.NEWS_API_BASE_URL}/top-headlines"

        params = {
            "apiKey": settings.NEWS_API_KEY,
            "category": category,
            "language": "en",
            "pageSize": 40,
        }


        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)

        # --------------------------------------------------
        # Error Handling
        # --------------------------------------------------
        if response.status_code != 200:
            raise Exception(
                f"News API error: {response.status_code} - {response.text}"
            )

        data = response.json()
        articles = data.get("articles", [])

        return NewsService._normalize_articles(articles, category)

    # --------------------------------------------------
    # Internal Helpers
    # --------------------------------------------------

    @staticmethod
    def _normalize_articles(raw_articles: List[Dict], category: str) -> List[Dict]:
        """
        Normalize raw News API articles into
        frontend-friendly format.
        """

        normalized = []

        for article in raw_articles:
            # Skip invalid entries
            if not article.get("title") or not article.get("url"):
                continue

            normalized.append({
                "id": hashlib.md5(article["url"].encode()).hexdigest(),
                "title": article.get("title"),
                "description": article.get("description"),
                "imageUrl": article.get("urlToImage"),
                "source": article.get("source", {}).get("name"),
                "sourceUrl": article.get("url"),
                "category": category,
                "publishedAt": article.get("publishedAt"),
            })

        return normalized
