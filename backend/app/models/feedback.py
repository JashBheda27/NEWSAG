from datetime import datetime
from typing import Optional
from pydantic import Field, EmailStr
from app.models.base import MongoBase


class FeedbackModel(MongoBase):
    """
    Feedback model for user suggestions or issues.
    """

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
