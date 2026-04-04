"""
Admin Router

Protected endpoints for model management and training data administration.
ALL routes require admin authentication.
"""

import logging
from fastapi import APIRouter, Body, Depends, HTTPException
from typing import Optional, List
from bson import ObjectId
from app.core.database import get_db
from app.core.auth import get_user_id, require_admin
from app.services.training_data_service import TrainingDataService
from app.services.model_fine_tuning_service import ModelFineTuningService
from app.services.admin_audit_service import AdminAuditService
from app.services.sentiment_ml import SentimentService
from app.core.cache import get_from_cache, get_redis, gnews_cache_key
from app.core.constants import NEWS_CATEGORIES
from app.core.gnews_counter import GNewsCounter
from datetime import datetime, timedelta
import time
import os
from app.services.metrics_service import MetricsService
from app.services.clerk_service import get_clerk_user_count

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

    # Get sample counts and last trained times
    try:
        sentiment_samples = await db.sentiment_training.count_documents({})
    except Exception:
        sentiment_samples = 0

    try:
        credibility_samples = await db.credibility_training.count_documents({})
    except Exception:
        credibility_samples = 0

    def _get_mtime(path):
        try:
            if path:
                return datetime.utcfromtimestamp(os.path.getmtime(path)).isoformat()
        except Exception:
            return None

    sentiment_last = _get_mtime(model_info.get("sentiment", {}).get("fine_tuned_path"))
    credibility_last = _get_mtime(model_info.get("credibility", {}).get("fine_tuned_path"))

    # Recent fine-tune jobs from audit logs
    recent_jobs = []
    try:
        cursor = db.admin_audit_logs.find({"action": "fine_tune"}).sort("created_at", -1).limit(10)
        async for doc in cursor:
            details = doc.get("details", {})
            normalized_status = details.get("status")
            if normalized_status == "success":
                normalized_status = "completed"
            elif normalized_status == "error":
                normalized_status = "failed"

            recent_jobs.append({
                "model": doc.get("resource_type", "unknown").replace("_model", ""),
                "date": doc.get("created_at").isoformat() if doc.get("created_at") else None,
                "samples": details.get("samples_used") or details.get("samples_available") or details.get("min_samples"),
                "samples_used": details.get("samples_used"),
                "samples_available": details.get("samples_available"),
                "min_required": details.get("min_required") or details.get("min_samples"),
                "status": normalized_status or ("completed" if doc.get("success", True) else "failed"),
                "training_loss": details.get("training_loss"),
                "eval_loss": details.get("eval_loss"),
                "duration_seconds": details.get("duration_seconds"),
            })

        # Derive last_trained from audit logs for more reliable tracking
        try:
            sentiment_last_audit = await db.admin_audit_logs.find_one(
                {"action": "fine_tune", "resource_type": "sentiment_model", "details.status": "success"},
                sort=[("created_at", -1)]
            )
            if sentiment_last_audit:
                sentiment_last = sentiment_last_audit.get("created_at").isoformat() if sentiment_last_audit.get("created_at") else sentiment_last
        
            credibility_last_audit = await db.admin_audit_logs.find_one(
                {"action": "fine_tune", "resource_type": "credibility_model", "details.status": "success"},
                sort=[("created_at", -1)]
            )
            if credibility_last_audit:
                credibility_last = credibility_last_audit.get("created_at").isoformat() if credibility_last_audit.get("created_at") else credibility_last
        except Exception:
            pass
    except Exception:
        recent_jobs = []

    return {
        "training_data": stats,
        "models": model_info,
        "sentiment_model": {
            "last_trained": sentiment_last,
            "training_samples": sentiment_samples,
        },
        "credibility_model": {
            "last_trained": credibility_last,
            "training_samples": credibility_samples,
        },
        "recent_jobs": recent_jobs,
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
    admin_id = get_user_id(user)
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
        details={
            "min_samples": min_samples,
            "epochs": epochs,
            "status": result.get("status"),
            "samples_used": result.get("samples_used"),
            "samples_available": result.get("samples_available"),
            "min_required": result.get("min_required"),
            "training_loss": result.get("training_loss"),
            "eval_loss": result.get("eval_loss"),
            "duration_seconds": result.get("duration_seconds"),
        },
        success=result.get("status") in ["success", "skipped"],
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
    admin_id = get_user_id(user)
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
        details={
            "min_samples": min_samples,
            "epochs": epochs,
            "status": result.get("status"),
            "samples_used": result.get("samples_used"),
            "samples_available": result.get("samples_available"),
            "min_required": result.get("min_required"),
            "training_loss": result.get("training_loss"),
            "eval_loss": result.get("eval_loss"),
            "duration_seconds": result.get("duration_seconds"),
        },
        success=result.get("status") in ["success", "skipped"],
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
    logger.info(f"[ADMIN] Fine-tune all requested by user={get_user_id(user)}")
    
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
    admin_id = get_user_id(user)
    
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
    offset: int = 0,
    source: Optional[str] = None,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get collected sentiment feedback for review.
    
    Args:
        limit: Maximum records to return
        offset: Records to skip for pagination
        source: Filter by source type (explicit, implicit_bookmark, implicit_read_later)
    """
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be >= 0")

    query = {}
    if source:
        query["source"] = source
    
    cursor = db.sentiment_training.find(query).sort("created_at", -1).skip(offset).limit(limit)
    
    feedback = []
    async for doc in cursor:
        feedback.append({
            "id": str(doc["_id"]),
            "article_id": doc["article_id"],
            "article_url": doc.get("article_url"),
            "text": doc.get("text", ""),
            "ai_label": doc["ai_label"],
            "ai_confidence": doc["ai_confidence"],
            "user_label": doc.get("user_label"),
            "final_label": doc.get("final_label"),
            "source": doc["source"],
            "review_flag": doc.get("review_flag", False),
            "review_reason": doc.get("review_reason"),
            "used_for_training": doc.get("used_for_training", False),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
            "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
            "sentiment_history": doc.get("sentiment_history", []),
        })
    
    return {
        "limit": limit,
        "offset": offset,
        "count": len(feedback),
        "feedback": feedback,
    }


@router.get("/sentiment/trends")
async def get_sentiment_trends(
    days: int = 30,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Return daily sentiment counts and ratios for trend visualization."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    since = datetime.utcnow() - timedelta(days=days - 1)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$project": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "label": {
                    "$toLower": {
                        "$ifNull": ["$final_label", "$ai_label"]
                    }
                },
            }
        },
        {
            "$project": {
                "date": 1,
                "normalized_label": {
                    "$switch": {
                        "branches": [
                            {"case": {"$regexMatch": {"input": "$label", "regex": "pos"}}, "then": "positive"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neu"}}, "then": "neutral"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neg"}}, "then": "negative"},
                        ],
                        "default": "neutral",
                    }
                },
            }
        },
        {
            "$group": {
                "_id": {"date": "$date", "label": "$normalized_label"},
                "count": {"$sum": 1},
            }
        },
    ]

    data_map = {}
    cursor = db.sentiment_training.aggregate(pipeline)
    async for doc in cursor:
        day = doc["_id"]["date"]
        label = doc["_id"]["label"]
        count = int(doc.get("count", 0))
        if day not in data_map:
            data_map[day] = {"positive": 0, "neutral": 0, "negative": 0}
        data_map[day][label] = count

    points = []
    now = datetime.utcnow()
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        c = data_map.get(d, {"positive": 0, "neutral": 0, "negative": 0})
        total = c["positive"] + c["neutral"] + c["negative"]
        points.append({
            "date": d,
            "positive": c["positive"],
            "neutral": c["neutral"],
            "negative": c["negative"],
            "total": total,
            "positive_ratio": round((c["positive"] / total) * 100, 1) if total else 0,
            "neutral_ratio": round((c["neutral"] / total) * 100, 1) if total else 0,
            "negative_ratio": round((c["negative"] / total) * 100, 1) if total else 0,
        })

    return {"days": days, "points": points}


@router.get("/sentiment/heatmap")
async def get_sentiment_heatmap(
    days: int = 30,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Return source x sentiment matrix counts for heatmap visualization."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    since = datetime.utcnow() - timedelta(days=days - 1)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$project": {
                "source": {"$ifNull": ["$source", "unknown"]},
                "label": {
                    "$toLower": {
                        "$ifNull": ["$final_label", "$ai_label"]
                    }
                },
            }
        },
        {
            "$project": {
                "source": 1,
                "normalized_label": {
                    "$switch": {
                        "branches": [
                            {"case": {"$regexMatch": {"input": "$label", "regex": "pos"}}, "then": "positive"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neu"}}, "then": "neutral"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neg"}}, "then": "negative"},
                        ],
                        "default": "neutral",
                    }
                },
            }
        },
        {
            "$group": {
                "_id": {"source": "$source", "label": "$normalized_label"},
                "count": {"$sum": 1},
            }
        },
    ]

    matrix = {}
    max_count = 0
    cursor = db.sentiment_training.aggregate(pipeline)
    async for doc in cursor:
        source_name = doc["_id"]["source"]
        label = doc["_id"]["label"]
        count = int(doc.get("count", 0))
        if source_name not in matrix:
            matrix[source_name] = {"positive": 0, "neutral": 0, "negative": 0}
        matrix[source_name][label] = count
        if count > max_count:
            max_count = count

    sources = sorted(matrix.keys())
    cells = []
    for source_name in sources:
        for label in ["positive", "neutral", "negative"]:
            value = matrix[source_name].get(label, 0)
            intensity = round(value / max_count, 3) if max_count else 0
            cells.append({
                "source": source_name,
                "sentiment": label,
                "value": value,
                "intensity": intensity,
            })

    return {
        "days": days,
        "sources": sources,
        "sentiments": ["positive", "neutral", "negative"],
        "max": max_count,
        "cells": cells,
    }


@router.patch("/feedback/sentiment/{feedback_id}/override-label")
async def override_sentiment_label(
    feedback_id: str,
    payload: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Allow admin to manually override final sentiment label for a feedback item."""
    admin_id = get_user_id(user)
    new_label = str(payload.get("new_label", "")).strip().lower()
    reason = str(payload.get("reason", "")).strip() or None

    if new_label not in {"positive", "neutral", "negative"}:
        raise HTTPException(status_code=400, detail="new_label must be one of positive, neutral, negative")

    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    existing = await db.sentiment_training.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Feedback not found")

    old_label = existing.get("final_label") or existing.get("ai_label")
    history_entry = {
        "type": "manual_override",
        "old_label": old_label,
        "new_label": new_label,
        "reason": reason,
        "changed_by": admin_id,
        "changed_at": datetime.utcnow().isoformat() + "Z",
    }

    await db.sentiment_training.update_one(
        {"_id": oid},
        {
            "$set": {
                "final_label": new_label,
                "user_label": new_label,
                "updated_at": datetime.utcnow(),
            },
            "$push": {"sentiment_history": history_entry},
        },
    )

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="override_sentiment_label",
        resource_type="sentiment_feedback",
        resource_id=feedback_id,
        details={"old_label": old_label, "new_label": new_label, "reason": reason},
        success=True,
    )

    return {
        "message": "Sentiment label overridden",
        "id": feedback_id,
        "old_label": old_label,
        "new_label": new_label,
    }


@router.patch("/feedback/sentiment/{feedback_id}/flag")
async def flag_sentiment_feedback(
    feedback_id: str,
    payload: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Mark/unmark feedback for review with optional reason."""
    admin_id = get_user_id(user)
    flagged = bool(payload.get("flagged", True))
    reason = str(payload.get("reason", "")).strip() or None

    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    result = await db.sentiment_training.update_one(
        {"_id": oid},
        {
            "$set": {
                "review_flag": flagged,
                "review_reason": reason,
                "flagged_by": admin_id if flagged else None,
                "flagged_at": datetime.utcnow() if flagged else None,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="flag_sentiment_feedback" if flagged else "unflag_sentiment_feedback",
        resource_type="sentiment_feedback",
        resource_id=feedback_id,
        details={"flagged": flagged, "reason": reason},
        success=True,
    )

    return {
        "message": "Feedback flagged for review" if flagged else "Feedback unflagged",
        "id": feedback_id,
        "flagged": flagged,
        "reason": reason,
    }


@router.post("/feedback/sentiment/{feedback_id}/reanalyze")
async def reanalyze_sentiment_feedback(
    feedback_id: str,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Re-run sentiment analysis for a feedback entry using the latest model."""
    admin_id = get_user_id(user)

    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    existing = await db.sentiment_training.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Feedback not found")

    text = existing.get("text") or ""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Feedback text is empty; cannot re-analyze")

    previous_ai_label = existing.get("ai_label")
    previous_ai_confidence = existing.get("ai_confidence")
    previous_final_label = existing.get("final_label")

    result = await SentimentService.analyze(text)
    new_ai_label = result.get("label", "Neutral")
    new_ai_confidence = float(result.get("confidence", 1.0))

    # Preserve explicit manual label if present; otherwise keep final label aligned to AI output.
    preserved_user_label = existing.get("user_label")
    new_final_label = preserved_user_label or new_ai_label

    history_entry = {
        "type": "reanalyze",
        "old_label": previous_ai_label,
        "new_label": new_ai_label,
        "previous_final_label": previous_final_label,
        "new_final_label": new_final_label,
        "previous_confidence": previous_ai_confidence,
        "new_confidence": new_ai_confidence,
        "changed_by": admin_id,
        "changed_at": datetime.utcnow().isoformat() + "Z",
    }

    await db.sentiment_training.update_one(
        {"_id": oid},
        {
            "$set": {
                "ai_label": new_ai_label,
                "ai_confidence": new_ai_confidence,
                "final_label": new_final_label,
                "updated_at": datetime.utcnow(),
            },
            "$push": {"sentiment_history": history_entry},
        },
    )

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="reanalyze_sentiment_feedback",
        resource_type="sentiment_feedback",
        resource_id=feedback_id,
        details={
            "previous_ai_label": previous_ai_label,
            "new_ai_label": new_ai_label,
            "previous_final_label": previous_final_label,
            "new_final_label": new_final_label,
            "previous_ai_confidence": previous_ai_confidence,
            "new_ai_confidence": new_ai_confidence,
        },
        success=True,
    )

    return {
        "message": "Feedback re-analyzed",
        "id": feedback_id,
        "previous_ai_label": previous_ai_label,
        "new_ai_label": new_ai_label,
        "previous_ai_confidence": previous_ai_confidence,
        "new_ai_confidence": new_ai_confidence,
        "new_final_label": new_final_label,
        "sentiment_history": history_entry,
    }


def _default_anomaly_config() -> dict:
    return {
        "window_hours": 24,
        "negative_threshold": 50,
        "minimum_samples": 20,
    }


async def _get_anomaly_config(db) -> dict:
    config = _default_anomaly_config()
    doc = await db.admin_settings.find_one({"key": "sentiment_anomaly_config"})
    if doc and isinstance(doc.get("value"), dict):
        value = doc["value"]
        if isinstance(value.get("window_hours"), int):
            config["window_hours"] = value["window_hours"]
        if isinstance(value.get("negative_threshold"), (int, float)):
            config["negative_threshold"] = value["negative_threshold"]
        if isinstance(value.get("minimum_samples"), int):
            config["minimum_samples"] = value["minimum_samples"]
    return config


@router.get("/sentiment/anomaly-config")
async def get_sentiment_anomaly_config(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Return the current sentiment anomaly detection settings."""
    return await _get_anomaly_config(db)


@router.put("/sentiment/anomaly-config")
async def update_sentiment_anomaly_config(
    payload: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Persist sentiment anomaly detection settings."""
    admin_id = get_user_id(user)
    current = await _get_anomaly_config(db)

    window_hours = int(payload.get("window_hours", current["window_hours"]))
    negative_threshold = float(payload.get("negative_threshold", current["negative_threshold"]))
    minimum_samples = int(payload.get("minimum_samples", current["minimum_samples"]))

    if window_hours < 1 or window_hours > 168:
        raise HTTPException(status_code=400, detail="window_hours must be between 1 and 168")
    if negative_threshold < 0 or negative_threshold > 100:
        raise HTTPException(status_code=400, detail="negative_threshold must be between 0 and 100")
    if minimum_samples < 1 or minimum_samples > 1000:
        raise HTTPException(status_code=400, detail="minimum_samples must be between 1 and 1000")

    new_config = {
        "window_hours": window_hours,
        "negative_threshold": negative_threshold,
        "minimum_samples": minimum_samples,
    }

    await db.admin_settings.update_one(
        {"key": "sentiment_anomaly_config"},
        {
            "$set": {
                "key": "sentiment_anomaly_config",
                "value": new_config,
                "updated_at": datetime.utcnow(),
                "updated_by": admin_id,
            },
            "$setOnInsert": {"created_at": datetime.utcnow()},
        },
        upsert=True,
    )

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="update_sentiment_anomaly_config",
        resource_type="sentiment_feedback",
        details=new_config,
        success=True,
    )

    return new_config


@router.get("/sentiment/anomalies")
async def get_sentiment_anomalies(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Detect whether negative sentiment spikes above the configured threshold."""
    config = await _get_anomaly_config(db)
    window_hours = int(config["window_hours"])
    since = datetime.utcnow() - timedelta(hours=window_hours)

    cursor = db.sentiment_training.find({"created_at": {"$gte": since}})
    total = 0
    negative = 0
    positive = 0
    neutral = 0
    samples = []

    async for doc in cursor:
      total += 1
      label = str(doc.get("final_label") or doc.get("ai_label") or "neutral").lower()
      if "neg" in label:
          negative += 1
      elif "pos" in label:
          positive += 1
      else:
          neutral += 1
      samples.append({
          "id": str(doc.get("_id")),
          "article_id": doc.get("article_id"),
          "label": doc.get("final_label") or doc.get("ai_label"),
          "source": doc.get("source"),
          "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
      })

    negative_ratio = round((negative / total) * 100, 1) if total else 0
    alert = total >= config["minimum_samples"] and negative_ratio >= config["negative_threshold"]

    return {
        "window_hours": window_hours,
        "minimum_samples": config["minimum_samples"],
        "negative_threshold": config["negative_threshold"],
        "total": total,
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "negative_ratio": negative_ratio,
        "alert": alert,
        "message": (
            f"Negative sentiment is {negative_ratio}% over the last {window_hours}h, which is above the {config['negative_threshold']}% threshold."
            if alert else
            "No negative sentiment anomaly detected."
        ),
        "samples": samples[:10],
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
    target_admin_id = admin_user_id or get_user_id(user)
    
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

    # total users: prefer authoritative Clerk count when available
    total_users = 0
    try:
        clerk_count = await get_clerk_user_count()
        if clerk_count is not None:
            total_users = clerk_count
        else:
            total_users = await db.users.count_documents({})
    except Exception:
        # fallback to DB count if Clerk fails
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
    # Prefer DB-backed articles if available; fall back to cache if DB is empty
    articles_indexed = 0
    sentiment_score_total = 0.0
    sentiment_count = 0

    try:
        # Try DB first
        try:
            articles_indexed = await db.articles.count_documents({})
        except Exception:
            articles_indexed = 0

        if articles_indexed and articles_indexed > 0:
            # compute avg sentiment from DB-stored sentiment field
            cursor = db.articles.find({"sentiment": {"$exists": True}})
            async for doc in cursor:
                sent = doc.get("sentiment")
                if sent and isinstance(sent, dict):
                    label = sent.get("label")
                    if label and isinstance(label, str):
                        l = label.lower()
                        if "pos" in l:
                            sentiment_score_total += 1
                            sentiment_count += 1
                        elif "neg" in l:
                            sentiment_score_total += -1
                            sentiment_count += 1
                        elif "neu" in l:
                            sentiment_score_total += 0
                            sentiment_count += 1
        else:
            # Fallback to cache-based calculation
            for cat in NEWS_CATEGORIES:
                cache_key = gnews_cache_key(cat)
                cached = await get_from_cache(cache_key)
                if cached and isinstance(cached, list):
                    articles_indexed += len(cached)
                    for article in cached:
                        sent = article.get("sentiment")
                        if sent and isinstance(sent, dict):
                            label = sent.get("label")
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


@router.get("/clerk-user-count")
async def get_clerk_user_count_endpoint(
    user=Depends(require_admin),
):
    """Return authoritative user count from Clerk (server-side)."""
    try:
        count = await get_clerk_user_count()
        if count is None:
            raise Exception("Clerk API not configured or failed")
        return {"total_users": count, "source": "clerk"}
    except Exception:
        # Fallback response when Clerk not available
        return {"total_users": None, "source": "clerk_unavailable"}


# --------------------------------------------------
# SYSTEM STATUS (Redis)
# --------------------------------------------------
@router.get("/system/status")
async def get_system_status(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Return simple system status including Redis INFO and GNews quota.
    """
    logger.info("[ADMIN] Fetching system status")
    redis_client = await get_redis()
    redis_info = {}
    total_keys = None
    try:
        if redis_client is None:
            redis_info = {"connected": False}
        else:
            info = await redis_client.info()
            # compute hit rate if possible
            hits = info.get("keyspace_hits", 0) or 0
            misses = info.get("keyspace_misses", 0) or 0
            hit_rate = None
            try:
                total = int(hits) + int(misses)
                hit_rate = (int(hits) / total) * 100 if total > 0 else None
            except Exception:
                hit_rate = None

            redis_info = {
                "connected": True,
                "used_memory_human": info.get("used_memory_human"),
                "uptime_in_seconds": info.get("uptime_in_seconds"),
                "keyspace_hits": hits,
                "keyspace_misses": misses,
                "hit_rate": hit_rate,
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

    # Database ping + collections
    db_status = {"connected": False, "latency_ms": None, "collections": None}
    try:
        start = time.time()
        await db.command({"ping": 1})
        latency = (time.time() - start) * 1000
        cols = await db.list_collection_names()
        db_status = {
            "connected": True,
            "latency_ms": latency,
            "collections": len(cols) if cols is not None else None,
        }
    except Exception:
        db_status = {"connected": False}

    # Build normalized gnews info
    gnews_info = None
    try:
        if hits:
            reset_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            gnews_info = {
                "today_hits": hits.get("today_hits") if isinstance(hits, dict) else None,
                "remaining": hits.get("remaining_hits") if isinstance(hits, dict) else None,
                "limit": hits.get("max_hits") if isinstance(hits, dict) else None,
                "reset_time": reset_time.isoformat() + "Z",
            }
    except Exception:
        gnews_info = None

    return {
        "database": db_status,
        "redis": {
            "connected": redis_info.get("connected", False),
            "hit_rate": redis_info.get("hit_rate"),
            "memory_usage": redis_info.get("used_memory_human"),
        },
        "gnews": gnews_info,
    }


# --------------------------------------------------
# SENTIMENT STATS
# --------------------------------------------------
@router.get("/sentiment/stats")
async def get_sentiment_stats(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Aggregate sentiment distribution counts and percentages.
    """
    logger.info("[ADMIN] Fetching sentiment stats")
    pipeline = [
        {"$group": {"_id": "$final_label", "count": {"$sum": 1}}}
    ]

    counts = {"positive": 0, "neutral": 0, "negative": 0}
    total = 0
    try:
        cursor = db.sentiment_training.aggregate(pipeline)
        async for doc in cursor:
            label = (doc.get("_id") or "").lower()
            c = int(doc.get("count", 0))
            total += c
            if "pos" in label:
                counts["positive"] = c
            elif "neu" in label:
                counts["neutral"] = c
            elif "neg" in label:
                counts["negative"] = c
            else:
                # try mapping explicit labels
                if label == "positive":
                    counts["positive"] = c
                elif label == "neutral":
                    counts["neutral"] = c
                elif label == "negative":
                    counts["negative"] = c
    except Exception:
        # fallback to simple counts
        try:
            counts["positive"] = await db.sentiment_training.count_documents({"final_label": {"$in": ["positive", "Positive"]}})
            counts["neutral"] = await db.sentiment_training.count_documents({"final_label": {"$in": ["neutral", "Neutral"]}})
            counts["negative"] = await db.sentiment_training.count_documents({"final_label": {"$in": ["negative", "Negative"]}})
            total = counts["positive"] + counts["neutral"] + counts["negative"]
        except Exception:
            total = 0

    # compute percentages
    percentages = {"positive": 0, "neutral": 0, "negative": 0}
    if total > 0:
        percentages = {
            k: round((v / total) * 100, 1) for k, v in counts.items()
        }

    return {
        "counts": counts,
        "total": total,
        "percentages": percentages,
    }


@router.get("/metrics/hits")
async def get_hit_history(
    days: int = 7,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Return daily hit counts for the past `days` days (default 7).
    Each entry contains: { date: YYYY-MM-DD, count: int, hours: {HH: count, ...} }
    """
    if days < 1 or days > 30:
        raise HTTPException(status_code=400, detail="days must be between 1 and 30")

    results = []
    try:
        now = datetime.utcnow()
        for i in range(days - 1, -1, -1):
            d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            doc = await MetricsService.get_daily_hits(d)
            if doc:
                results.append({
                    "date": d,
                    "count": int(doc.get("count", 0)),
                    "hours": doc.get("hours", {}),
                })
            else:
                results.append({"date": d, "count": 0, "hours": {}})
    except Exception:
        logger.exception("Failed to retrieve GNews hit history", extra={"days": days})
        raise HTTPException(status_code=500, detail="Failed to retrieve hit history")

    return {"days": days, "history": results}
