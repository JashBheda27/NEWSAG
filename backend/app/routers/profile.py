import logging
from datetime import date, datetime, timedelta
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import get_user_id, require_auth
from app.services.badge_policy import (
    compute_engagement_score,
    resolve_badge_tier,
    compute_rolling_30day_stats,
    get_all_tier_names,
)

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


def _as_datetime(value):
    return value if isinstance(value, datetime) else None


def _parse_iso_day(value):
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _compute_streaks(day_set: set):
    if not day_set:
        return 0, 0

    sorted_days = sorted(day_set)
    best = 1
    running = 1

    for i in range(1, len(sorted_days)):
        if (sorted_days[i] - sorted_days[i - 1]).days == 1:
            running += 1
            best = max(best, running)
        else:
            running = 1

    today = datetime.utcnow().date()
    latest = sorted_days[-1]
    current = 0

    # Strict streak: user must have activity today for a non-zero current streak.
    if (today - latest).days == 0:
        probe = latest
        while probe in day_set:
            current += 1
            probe = probe - timedelta(days=1)

    return current, best


def _derive_title_from_url(url: str) -> str:
    if not isinstance(url, str) or not url:
        return "Untitled Article"
    parsed = urlparse(url)
    slug = (parsed.path or "").strip("/").split("/")[-1]
    if not slug:
        return parsed.netloc or "Untitled Article"
    return slug.replace("-", " ").replace("_", " ").strip().title() or "Untitled Article"


async def _compute_rolling_30day_stats(db, user_id: str):
    """
    Compute 30-day rolling activity stats for hybrid badge gating.
    
    Returns:
        Dict with articles_read_30d, bookmarks_30d, read_later_30d, active_days_30d
    """
    now = datetime.utcnow()
    start_of_30days = now - timedelta(days=29)  # 30 days ago
    
    # Count articles read in the last 30 days
    articles_count_30d = await db.summary_logs.count_documents(
        {"user_id": user_id, "created_at": {"$gte": start_of_30days}}
    )
    
    # Count bookmarks in the last 30 days
    bookmarks_count_30d = await db.bookmarks.count_documents(
        {"user_id": user_id, "created_at": {"$gte": start_of_30days}}
    )
    
    # Count read-later items in the last 30 days
    read_later_count_30d = await db.read_later.count_documents(
        {"user_id": user_id, "created_at": {"$gte": start_of_30days}}
    )
    
    # Count distinct activity days in the last 30 days
    active_days = set()
    summary_cursor = db.summary_logs.find(
        {"user_id": user_id, "created_at": {"$gte": start_of_30days}},
        projection={"created_at": 1}
    )
    async for row in summary_cursor:
        created_at = _as_datetime(row.get("created_at"))
        if created_at:
            active_days.add(created_at.date())
    
    return {
        "articles_read_30d": articles_count_30d,
        "bookmarks_30d": bookmarks_count_30d,
        "read_later_30d": read_later_count_30d,
        "active_days_30d": len(active_days),
    }


def _get_badge_progress_dict(engagement_score: int, rolling_stats: dict) -> dict:
    """
    Compute badge tier progression using hybrid scoring and gating policy.
    
    Args:
        engagement_score: User's all-time engagement score
        rolling_stats: 30-day rolling activity stats (articles, bookmarks, read_later, active_days)
    
    Returns:
        Dict with current_tier, next_tier, progress_to_next for API response
    """
    # Build rolling stats object for policy function
    rolling_activity = compute_rolling_30day_stats(
        articles_count_30d=rolling_stats.get("articles_read_30d", 0),
        bookmarks_count_30d=rolling_stats.get("bookmarks_30d", 0),
        read_later_count_30d=rolling_stats.get("read_later_30d", 0),
        active_days_set=set(),  # Already counted as active_days_30d
    )
    # Override active_days with the count we already have
    rolling_activity.active_days = rolling_stats.get("active_days_30d", 0)
    
    # Resolve tier using hybrid policy
    resolution = resolve_badge_tier(engagement_score, rolling_activity)
    
    return {
        "current_tier": resolution.current_tier,
        "next_tier": resolution.next_tier,
        "progress_to_next": resolution.progress_to_next,
    }


def _trend_percent(current: int, previous: int) -> int:
    if previous > 0:
        return round(((current - previous) / previous) * 100)
    if current > 0:
        return 100
    return 0


class ReadActivityPayload(BaseModel):
    article_id: str | None = None
    article_url: str | None = None
    title: str | None = None
    source: str | None = None
    category: str | None = None


@router.post("/activity/read")
async def track_read_activity(
    payload: ReadActivityPayload,
    user=Depends(require_auth),
    db=Depends(get_db),
):
    """
    Track an article read/open activity for streak analytics.
    Deduplicates to one record per user + article + UTC day.
    """
    user_id = get_user_id(user)
    article_key = payload.article_id or payload.article_url
    if not article_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="article_id or article_url is required",
        )

    now = datetime.utcnow()
    activity_day = now.date().isoformat()
    filter_query = {
        "user_id": user_id,
        "article_key": article_key,
        "activity_day": activity_day,
    }

    update_doc = {
        "$set": {
            "updated_at": now,
            "title": payload.title,
            "source": payload.source,
            "category": payload.category,
            "article_url": payload.article_url,
            "article_id": payload.article_id,
        },
        "$setOnInsert": {
            "user_id": user_id,
            "article_key": article_key,
            "activity_day": activity_day,
            "created_at": now,
        },
    }

    result = await db.read_activity_logs.update_one(filter_query, update_doc, upsert=True)
    return {
        "status": "created" if result.upserted_id else "updated",
        "activity_day": activity_day,
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
    latest_summary = await db.summary_logs.find_one(
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
    if latest_summary and latest_summary.get("created_at"):
        if not last_active_at or latest_summary.get("created_at") > last_active_at:
            last_active_at = latest_summary.get("created_at")

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
    previous_week_start = now - timedelta(days=13)
    previous_week_end = now - timedelta(days=7)
    weekly_counts: dict[str, int] = {}
    this_week_count = 0
    previous_week_count = 0

    this_week_bookmarks = await db.bookmarks.count_documents(
        {"user_id": user_id, "created_at": {"$gte": start_date}}
    )
    previous_week_bookmarks = await db.bookmarks.count_documents(
        {
            "user_id": user_id,
            "created_at": {"$gte": previous_week_start, "$lte": previous_week_end},
        }
    )
    this_week_read_later = await db.read_later.count_documents(
        {"user_id": user_id, "created_at": {"$gte": start_date}}
    )
    previous_week_read_later = await db.read_later.count_documents(
        {
            "user_id": user_id,
            "created_at": {"$gte": previous_week_start, "$lte": previous_week_end},
        }
    )

    streak_days = set()
    read_activity_days = await db.read_activity_logs.distinct("activity_day", {"user_id": user_id})
    for day_value in read_activity_days:
        parsed_day = _parse_iso_day(day_value)
        if parsed_day:
            streak_days.add(parsed_day)

    activity_days = set()
    summary_cursor = db.summary_logs.find(
        {"user_id": user_id},
        projection={"created_at": 1}
    ).sort("created_at", -1)

    async for row in summary_cursor:
        created_at = _as_datetime(row.get("created_at"))
        if not created_at:
            continue

        activity_days.add(created_at.date())

        if created_at >= start_date:
            day_label = created_at.strftime("%a")
            weekly_counts[day_label] = weekly_counts.get(day_label, 0) + 1
            this_week_count += 1
        elif previous_week_start <= created_at <= previous_week_end:
            previous_week_count += 1

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

    # Compute engagement score using rebalanced weights from policy
    engagement_score = compute_engagement_score(articles_read, bookmarks_count, read_later_count)
    
    # Get 30-day rolling stats for hybrid badge gating
    rolling_stats = await _compute_rolling_30day_stats(db, user_id)
    
    # Compute engagement label for tier3 fallback (legacy compatibility)
    # Synchronized with badge policy tier names
    baseline_tier_name = next(
        (tier[0] for tier in [("Curious Reader", 0, 14), ("Regular", 15, 34), ("Power Reader", 35, 69), ("News Addict", 70, None)]
         if tier[2] is None or engagement_score <= tier[2]),
        "Curious Reader"
    )
    if baseline_tier_name == "Curious Reader":
        engagement_label = "Curious Reader"
    elif baseline_tier_name == "Regular":
        engagement_label = "Regular"
    elif baseline_tier_name == "Power Reader":
        engagement_label = "Power Reader"
    else:
        engagement_label = "News Addict"

    trend_percent = _trend_percent(this_week_count, previous_week_count)
    bookmarks_trend_percent = _trend_percent(this_week_bookmarks, previous_week_bookmarks)
    read_later_trend_percent = _trend_percent(this_week_read_later, previous_week_read_later)
    total_saved_trend_percent = _trend_percent(
        this_week_bookmarks + this_week_read_later,
        previous_week_bookmarks + previous_week_read_later,
    )

    # Transition-safe fallback: use summary activity days when read activity is not yet populated.
    current_streak, best_streak = _compute_streaks(streak_days or activity_days)
    reading_time_estimate_minutes_week = this_week_count * 6
    badge = _get_badge_progress_dict(engagement_score, rolling_stats)

    recent_logs = []
    log_cursor = db.summary_logs.find(
        {"user_id": user_id},
        projection={"url": 1, "created_at": 1}
    ).sort("created_at", -1).limit(40)

    async for row in log_cursor:
        url = row.get("url")
        if not isinstance(url, str) or not url:
            continue
        created_at = _as_datetime(row.get("created_at"))
        if not created_at:
            continue
        recent_logs.append({"url": url, "created_at": created_at})

    deduped_logs = []
    seen_urls = set()
    for row in recent_logs:
        if row["url"] in seen_urls:
            continue
        deduped_logs.append(row)
        seen_urls.add(row["url"])
        if len(deduped_logs) >= 5:
            break

    article_meta_by_url = {}
    if deduped_logs:
        urls = [entry["url"] for entry in deduped_logs]
        article_cursor = db.articles.find(
            {"url": {"$in": urls}},
            projection={"title": 1, "category": 1, "source": 1, "url": 1}
        )
        async for article in article_cursor:
            article_url = article.get("url")
            if isinstance(article_url, str):
                article_meta_by_url[article_url] = article

    recent_activity = []
    for row in deduped_logs:
        meta = article_meta_by_url.get(row["url"], {})
        source_value = meta.get("source")
        if isinstance(source_value, dict):
            source_value = source_value.get("name")
        if not isinstance(source_value, str) or not source_value:
            source_value = "Unknown Source"
        recent_activity.append(
            {
                "title": meta.get("title") or _derive_title_from_url(row["url"]),
                "category": meta.get("category") or "general",
                "source": source_value,
                "url": row["url"],
                "timestamp": row["created_at"],
            }
        )

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
        "tier4": {
            "weekly_trend_percent": trend_percent,
            "stat_trends": {
                "articles_read": trend_percent,
                "bookmarks": bookmarks_trend_percent,
                "read_later": read_later_trend_percent,
                "total_saved": total_saved_trend_percent,
            },
            "reading_streak": {
                "current": current_streak,
                "best": best_streak,
            },
            "reading_time_estimate_minutes_week": reading_time_estimate_minutes_week,
            "most_read_category": top_category,
            "badge": badge,
            "recent_activity": recent_activity,
        },
    }
