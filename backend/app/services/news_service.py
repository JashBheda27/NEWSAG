import httpx
import hashlib
from typing import List, Dict
from app.core.config import settings
from app.core.gnews_counter import GNewsCounter  # ✅ Added

ALLOWED_CATEGORIES = [
    "general",
    "nation",
    "business",
    "technology",
    "sports",
    "entertainment",
    "health",
]

MAX_ARTICLES = 20  # HARD CAP

class GNewsService:
    @staticmethod
    def is_content_complete(content: str) -> bool:
        """Best-effort check for full article text in GNews content."""
        if not content or not isinstance(content, str):
            return False
        content_stripped = content.strip()
        if not content_stripped:
            return False
        lowered = content_stripped.lower()
        truncation_markers = ["[+", "read more", "continue reading", "...", "…"]
        if any(marker in lowered for marker in truncation_markers):
            return False
        if content_stripped.endswith(("...", "…")):
            return False
        return True

    @staticmethod
    async def fetch_category(category: str) -> List[Dict]:
        if category not in ALLOWED_CATEGORIES:
            category = "general"

        # ✅ Check API limit before calling
        can_call, message = await GNewsCounter.check_limit()
        if not can_call:
            raise Exception(f"GNews API limit: {message}")

        params = {
            "category": category,
            "country": "in",
            "lang": "en",
            "max": MAX_ARTICLES,
            "apikey": settings.GNEWS_API_KEY,
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{settings.GNEWS_BASE_URL}/top-headlines",
                params=params
            )

        if response.status_code != 200:
            raise Exception(
                f"GNews error {response.status_code}: {response.text}"
            )

        data = response.json()
        articles = []

        for item in data.get("articles", []):
            if not item.get("title") or not item.get("url"):
                continue

            article_id = hashlib.md5(
                item["url"].encode()
            ).hexdigest()

            content_value = item.get("content")
            articles.append({
                "id": article_id,
                "title": item["title"],
                "description": item.get("description"),
                "content": content_value,  # ✅ Added: Full content from GNews
                "content_is_full": GNewsService.is_content_complete(content_value),
                "image_url": item.get("image"),
                "source": item.get("source", {}).get("name"),
                "url": item["url"],
                "published_at": item.get("publishedAt"),
                "category": category,
            })

        # ✅ Increment hit counter only when at least one valid article is returned
        if articles:
            await GNewsCounter.increment_hit()

        return articles[:MAX_ARTICLES]
