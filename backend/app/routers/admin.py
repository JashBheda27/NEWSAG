"""
Admin Router

Protected endpoints for model management and training data administration.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from app.core.database import get_db
from app.core.auth import get_current_user_optional
from app.services.training_data_service import TrainingDataService
from app.services.model_fine_tuning_service import ModelFineTuningService

router = APIRouter()
logger = logging.getLogger(__name__)


# --------------------------------------------------
# TRAINING STATS
# --------------------------------------------------
@router.get("/training/stats")
async def get_training_stats(
    user=Depends(get_current_user_optional),
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
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of the sentiment analysis model.
    Uses collected user feedback data.
    
    Args:
        min_samples: Minimum samples required to start training
        epochs: Number of training epochs
    """
    logger.info(f"[ADMIN] Fine-tune sentiment requested by user={user['user_id']}")
    
    result = await ModelFineTuningService.fine_tune_sentiment(
        db=db,
        min_samples=min_samples,
        epochs=epochs,
    )
    
    return result


# --------------------------------------------------
# FINE-TUNE CREDIBILITY MODEL
# --------------------------------------------------
@router.post("/fine-tune/credibility")
async def fine_tune_credibility_model(
    min_samples: int = 30,
    epochs: int = 3,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of the credibility/fake-news detection model.
    Only uses verified or multi-reported samples.
    
    Args:
        min_samples: Minimum samples required to start training
        epochs: Number of training epochs
    """
    logger.info(f"[ADMIN] Fine-tune credibility requested by user={user['user_id']}")
    
    result = await ModelFineTuningService.fine_tune_credibility(
        db=db,
        min_samples=min_samples,
        epochs=epochs,
    )
    
    return result


# --------------------------------------------------
# FINE-TUNE ALL MODELS
# --------------------------------------------------
@router.post("/fine-tune/all")
async def fine_tune_all_models(
    user=Depends(get_current_user_optional),
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
    user=Depends(get_current_user_optional),
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
    user=Depends(get_current_user_optional),
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
    user=Depends(get_current_user_optional),
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
