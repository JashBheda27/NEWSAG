import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.auth import get_user_id, require_auth

router = APIRouter()
logger = logging.getLogger(__name__)


async def _get_user_counts(db, user_id: str) -> dict:
    """Return frequently used profile counters for a user."""
    bookmarks = await db.bookmarks.count_documents({"user_id": user_id})
    read_later = await db.read_later.count_documents({"user_id": user_id})
    summaries = await db.summary_logs.count_documents({"user_id": user_id})
    return {
        "bookmarks": bookmarks,
        "read_later": read_later,
        "summaries": summaries,
    }


@router.get("/stats")
async def get_profile_stats(
    user=Depends(require_auth),
    db=Depends(get_db),
):
    user_id = get_user_id(user)
    counts = await _get_user_counts(db, user_id)
    bookmarks_count = counts["bookmarks"]
    read_later_count = counts["read_later"]
    total_saved = bookmarks_count + read_later_count
    articles_read = counts["summaries"]

    logger.info(
        "[PROFILE STATS] user_id=%s bookmarks=%s read_later=%s articles_read=%s",
        user_id,
        bookmarks_count,
        read_later_count,
        articles_read,
    )

    return {
        "articles_read": articles_read,
        "bookmarks": bookmarks_count,
        "read_later": read_later_count,
        "total_saved": total_saved,
    }


@router.get("/analytics")
async def get_profile_analytics(
    user=Depends(require_auth),
    db=Depends(get_db),
):
    user_id = get_user_id(user)
    counts = await _get_user_counts(db, user_id)
    bookmarks_count = counts["bookmarks"]
    read_later_count = counts["read_later"]
    total_saved = bookmarks_count + read_later_count
    articles_read = counts["summaries"]

    latest_bookmark = await db.bookmarks.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        projection={"created_at": 1}
    )
    latest_read_later = await db.read_later.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        projection={"created_at": 1}
    )

    last_active_at = None
    if latest_bookmark and latest_bookmark.get("created_at"):
        last_active_at = latest_bookmark.get("created_at")
    if latest_read_later and latest_read_later.get("created_at"):
        if not last_active_at or latest_read_later.get("created_at") > last_active_at:
            last_active_at = latest_read_later.get("created_at")

    category_counts: dict[str, int] = {}
    for collection in (db.bookmarks, db.read_later):
        pipeline = [
            {"$match": {"user_id": user_id, "category": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        ]
        async for row in collection.aggregate(pipeline):
            category = row.get("_id")
            if not category:
                continue
            category_counts[category] = category_counts.get(category, 0) + int(row.get("count", 0))

    top_category = None
    if category_counts:
        top_category = max(category_counts.items(), key=lambda item: item[1])[0]

    category_breakdown = [
        {"category": category, "count": count}
        for category, count in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    now = datetime.utcnow()
    start_date = now - timedelta(days=6)
    weekly_counts: dict[str, int] = {}

    for collection in (db.bookmarks, db.read_later):
        cursor = collection.find(
            {"user_id": user_id, "created_at": {"$gte": start_date}},
            projection={"created_at": 1}
        )
        async for row in cursor:
            created_at = row.get("created_at")
            if not isinstance(created_at, datetime):
                continue
            day_label = created_at.strftime("%a")
            weekly_counts[day_label] = weekly_counts.get(day_label, 0) + 1

    weekly_activity = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%a")
        weekly_activity.append({"day": day, "count": weekly_counts.get(day, 0)})

    sentiment_counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
    sentiment_found = False
    for collection in (db.bookmarks, db.read_later):
        cursor = collection.find(
            {"user_id": user_id, "sentiment": {"$exists": True}},
            projection={"sentiment": 1}
        )
        async for row in cursor:
            sentiment = row.get("sentiment")
            if not isinstance(sentiment, dict):
                continue
            label = sentiment.get("label")
            if label in sentiment_counts:
                sentiment_counts[label] += 1
                sentiment_found = True

    engagement_score = articles_read + (bookmarks_count * 2) + read_later_count
    if engagement_score < 10:
        engagement_label = "Casual Reader"
    elif engagement_score <= 25:
        engagement_label = "Active Reader"
    else:
        engagement_label = "Power Reader"

    logger.info(
        "[PROFILE ANALYTICS] user_id=%s bookmarks=%s read_later=%s articles_read=%s",
        user_id,
        bookmarks_count,
        read_later_count,
        articles_read,
    )

    return {
        "tier1": {
            "articles_read": articles_read,
            "bookmarks": bookmarks_count,
            "read_later": read_later_count,
            "total_saved": total_saved,
            "last_active_at": last_active_at,
        },
        "tier2": {
            "top_category": top_category,
            "category_breakdown": category_breakdown,
            "weekly_activity": weekly_activity,
        },
        "tier3": {
            "sentiment_breakdown": sentiment_counts if sentiment_found else None,
            "engagement_score": engagement_score,
            "engagement_label": engagement_label,
        },
    }
