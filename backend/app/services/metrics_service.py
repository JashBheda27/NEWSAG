from datetime import datetime
from app.core.database import get_db


class MetricsService:
    """Centralized metrics persistence helpers."""

    @staticmethod
    async def record_gnews_hit(count: int = 1):
        """Record one or more GNews API hits into `gnews_hits` collection.

        Stores both daily total (date) and hourly slot under `hours` subdocument.
        Best-effort: failures are ignored to avoid blocking API calls.
        """
        try:
            db = await get_db()
            now = datetime.utcnow()
            date_str = now.strftime("%Y-%m-%d")
            hour_str = now.strftime("%H")  # 00..23

            # Increment daily count and hourly bucket
            await db.gnews_hits.update_one(
                {"date": date_str},
                {
                    "$inc": {"count": int(count), f"hours.{hour_str}": int(count)},
                    "$setOnInsert": {"created_at": now},
                    "$set": {"updated_at": now},
                },
                upsert=True,
            )
        except Exception:
            # best-effort only
            pass

    @staticmethod
    async def get_daily_hits(date_str: str):
        db = await get_db()
        return await db.gnews_hits.find_one({"date": date_str})
