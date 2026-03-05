"""
Admin Router

Protected endpoints for model management and training data administration.
ALL routes require admin authentication.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from app.core.database import get_db
from app.core.auth import require_admin
from app.services.training_data_service import TrainingDataService
from app.services.model_fine_tuning_service import ModelFineTuningService
from app.services.admin_audit_service import AdminAuditService
from app.core.cache import get_redis, get_from_cache
from app.core.gnews_counter import GNewsCounter
from datetime import datetime, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)


# --------------------------------------------------
# TRAINING STATS
# --------------------------------------------------
@router.get("/training/stats")
async def get_training_stats(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get statistics on collected training data.
    Shows counts of sentiment and credibility feedback.
    """
    stats = await TrainingDataService.get_training_stats(db)
    model_info = ModelFineTuningService.get_model_info()
    
    return {
        "training_data": stats,
        "models": model_info,
    }


# --------------------------------------------------
# FINE-TUNE SENTIMENT MODEL
# --------------------------------------------------
@router.post("/fine-tune/sentiment")
async def fine_tune_sentiment_model(
    min_samples: int = 50,
    epochs: int = 3,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of the sentiment analysis model.
    Uses collected user feedback data.
    
    Args:
        min_samples: Minimum samples required to start training
        epochs: Number of training epochs
    """
    admin_id = user["user_id"]
    logger.info(f"[ADMIN] Fine-tune sentiment requested by user={admin_id}")
    
    result = await ModelFineTuningService.fine_tune_sentiment(
        db=db,
        min_samples=min_samples,
        epochs=epochs,
    )
    
    # Log to audit trail
    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="fine_tune",
        resource_type="sentiment_model",
        details={"min_samples": min_samples, "epochs": epochs},
        success=True,
    )
    
    return result


# --------------------------------------------------
# FINE-TUNE CREDIBILITY MODEL
# --------------------------------------------------
@router.post("/fine-tune/credibility")
async def fine_tune_credibility_model(
    min_samples: int = 30,
    epochs: int = 3,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of the credibility/fake-news detection model.
    Only uses verified or multi-reported samples.
    
    Args:
        min_samples: Minimum samples required to start training
        epochs: Number of training epochs
    """
    admin_id = user["user_id"]
    logger.info(f"[ADMIN] Fine-tune credibility requested by user={admin_id}")
    
    result = await ModelFineTuningService.fine_tune_credibility(
        db=db,
        min_samples=min_samples,
        epochs=epochs,
    )
    
    # Log to audit trail
    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="fine_tune",
        resource_type="credibility_model",
        details={"min_samples": min_samples, "epochs": epochs},
        success=True,
    )
    
    return result


# --------------------------------------------------
# FINE-TUNE ALL MODELS
# --------------------------------------------------
@router.post("/fine-tune/all")
async def fine_tune_all_models(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of all ML models.
    """
    logger.info(f"[ADMIN] Fine-tune all requested by user={user['user_id']}")
    
    result = await ModelFineTuningService.fine_tune_all(db)
    
    return result


# --------------------------------------------------
# PENDING CREDIBILITY REPORTS
# --------------------------------------------------
@router.get("/reports/pending")
async def get_pending_reports(
    limit: int = 50,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get pending credibility reports for admin review.
    """
    cursor = db.credibility_training.find(
        {"verification_status": "pending"}
    ).sort("report_count", -1).limit(limit)
    
    reports = []
    async for doc in cursor:
        reports.append({
            "id": str(doc["_id"]),
            "article_id": doc["article_id"],
            "title": doc["title"],
            "article_url": doc["article_url"],
            "source_domain": doc.get("source_domain"),
            "ai_label": doc["ai_label"],
            "ai_score": doc["ai_score"],
            "user_reason": doc.get("user_reason"),
            "report_count": doc.get("report_count", 1),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })
    
    return {
        "count": len(reports),
        "reports": reports,
    }


# --------------------------------------------------
# VERIFY REPORT
# --------------------------------------------------
@router.post("/reports/{report_id}/verify")
async def verify_report(
    report_id: str,
    verified: bool = True,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Verify or reject a credibility report.
    
    Args:
        report_id: Report document ID
        verified: True = confirmed misleading, False = rejected
    """
    admin_id = user["user_id"]
    
    success = await TrainingDataService.verify_credibility_report(
        db=db,
        report_id=report_id,
        admin_id=admin_id,
        verified=verified,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    
    status = "verified" if verified else "rejected"
    logger.info(f"[ADMIN] Report {report_id} {status} by {admin_id}")
    
    # Log to audit trail
    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="verify_report" if verified else "reject_report",
        resource_type="credibility_report",
        resource_id=report_id,
        details={"status": status},
        success=True,
    )
    
    return {
        "message": f"Report {status}",
        "report_id": report_id,
        "status": status,
    }


# --------------------------------------------------
# SENTIMENT FEEDBACK LIST
# --------------------------------------------------
@router.get("/feedback/sentiment")
async def get_sentiment_feedback(
    limit: int = 100,
    source: Optional[str] = None,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get collected sentiment feedback for review.
    
    Args:
        limit: Maximum records to return
        source: Filter by source type (explicit, implicit_bookmark, implicit_read_later)
    """
    query = {}
    if source:
        query["source"] = source
    
    cursor = db.sentiment_training.find(query).sort("created_at", -1).limit(limit)
    
    feedback = []
    async for doc in cursor:
        feedback.append({
            "id": str(doc["_id"]),
            "article_id": doc["article_id"],
            "text": doc["text"][:200] + "..." if len(doc["text"]) > 200 else doc["text"],
            "ai_label": doc["ai_label"],
            "ai_confidence": doc["ai_confidence"],
            "user_label": doc.get("user_label"),
            "final_label": doc.get("final_label"),
            "source": doc["source"],
            "used_for_training": doc.get("used_for_training", False),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })
    
    return {
        "count": len(feedback),
        "feedback": feedback,
    }


# --------------------------------------------------
# AUDIT LOG
# --------------------------------------------------
@router.get("/audit/logs")
async def get_audit_logs(
    limit: int = 100,
    admin_user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Retrieve admin audit log entries.
    
    Args:
        limit: Maximum records to return
        admin_user_id: Filter by admin user
        action: Filter by action type
        resource_type: Filter by resource type
    """
    logs = await AdminAuditService.get_audit_log(
        db=db,
        limit=limit,
        admin_user_id=admin_user_id,
        action=action,
        resource_type=resource_type,
    )
    
    return {
        "count": len(logs),
        "logs": logs,
    }


@router.get("/audit/activity-summary")
async def get_admin_activity_summary(
    admin_user_id: Optional[str] = None,
    days: int = 7,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get a summary of admin activity.
    
    Args:
        admin_user_id: Admin user ID (if None, defaults to current user)
        days: Number of days to look back
    """
    # If no admin_user_id provided, use current user
    target_admin_id = admin_user_id or user["user_id"]
    
    summary = await AdminAuditService.get_admin_activity_summary(
        db=db,
        admin_user_id=target_admin_id,
        days=days,
    )
    
    return summary


# --------------------------------------------------
# ADMIN OVERVIEW / METRICS
# --------------------------------------------------
@router.get("/metrics")
async def get_admin_metrics(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Return aggregated admin dashboard metrics:
    - total_users: count of persisted users (if any)
    - active_this_week: distinct users active in last 7 days (bookmarks/read_later/summary_logs)
    - articles_indexed: sum of cached articles across categories
    - avg_sentiment: average sentiment score from cached articles (pos=1, neutral=0, neg=-1)
    """
    now = datetime.utcnow()
    start_week = now - timedelta(days=7)

    # total users (may be 0 if users are not persisted)
    try:
        total_users = await db.users.count_documents({})
    except Exception:
        total_users = 0

    # active this week (distinct user_ids across collections)
    active_ids = set()
    try:
        bookmarks_ids = await db.bookmarks.distinct("user_id", {"created_at": {"$gte": start_week}})
        readlater_ids = await db.read_later.distinct("user_id", {"created_at": {"$gte": start_week}})
        summary_ids = await db.summary_logs.distinct("user_id", {"created_at": {"$gte": start_week}})

        for _id in (bookmarks_ids or []):
            if _id:
                active_ids.add(_id)
        for _id in (readlater_ids or []):
            if _id:
                active_ids.add(_id)
        for _id in (summary_ids or []):
            if _id:
                active_ids.add(_id)
    except Exception:
        active_ids = set()

    active_this_week = len(active_ids)

    # articles indexed: sum cached articles for known categories
    CATEGORIES = ["general", "nation", "business", "technology", "sports", "entertainment", "health"]
    articles_indexed = 0
    sentiment_score_total = 0.0
    sentiment_count = 0

    try:
        for cat in CATEGORIES:
            cache_key = f"gnews:{cat}"
            cached = await get_from_cache(cache_key)
            if cached and isinstance(cached, list):
                articles_indexed += len(cached)
                # compute sentiment avg from cached articles if present
                for article in cached:
                    sent = article.get("sentiment")
                    if sent and isinstance(sent, dict):
                        label = sent.get("label")
                        # map labels
                        if label == "positive" or label == "Positive":
                            sentiment_score_total += 1
                            sentiment_count += 1
                        elif label == "negative" or label == "Negative":
                            sentiment_score_total += -1
                            sentiment_count += 1
                        elif label == "neutral" or label == "Neutral":
                            sentiment_score_total += 0
                            sentiment_count += 1
    except Exception:
        articles_indexed = articles_indexed or 0

    avg_sentiment = None
    if sentiment_count > 0:
        avg = sentiment_score_total / sentiment_count
        # convert to a simple positive ratio (0..1) for display: (avg +1)/2
        avg_sentiment = (avg + 1) / 2

    return {
        "total_users": total_users,
        "active_this_week": active_this_week,
        "articles_indexed": articles_indexed,
        "avg_sentiment": avg_sentiment,
    }


# --------------------------------------------------
# SYSTEM STATUS (Redis)
# --------------------------------------------------
@router.get("/system/status")
async def get_system_status(
    user=Depends(require_admin),
):
    """
    Return simple system status including Redis INFO and GNews quota.
    """
    redis_client = await get_redis()
    redis_info = {}
    total_keys = None
    try:
        if redis_client is None:
            redis_info = {"connected": False}
        else:
            info = await redis_client.info()
            redis_info = {
                "connected": True,
                "used_memory_human": info.get("used_memory_human"),
                "uptime_in_seconds": info.get("uptime_in_seconds"),
            }
            try:
                total_keys = await redis_client.dbsize()
            except Exception:
                total_keys = None
    except Exception:
        redis_info = {"connected": False}

    # include GNews hit status
    try:
        hits = await GNewsCounter.get_hit_status()
    except Exception:
        hits = None

    return {
        "redis": redis_info,
        "redis_keys": total_keys,
        "gnews_hits": hits,
    }
