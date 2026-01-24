from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.models.feedback import FeedbackModel

router = APIRouter()


# --------------------------------------------------
# SUBMIT FEEDBACK
# --------------------------------------------------
@router.post("/")
async def submit_feedback(feedback: FeedbackModel, db=Depends(get_db)):
    """
    Store user feedback.
    """

    if len(feedback.message.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Feedback message is too short"
        )

    result = await db.feedback.insert_one(feedback.dict())

    return {
        "message": "Feedback submitted successfully",
        "feedback_id": str(result.inserted_id)
    }
