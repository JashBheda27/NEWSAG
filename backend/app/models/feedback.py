from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class FeedbackModel(BaseModel):
    """
    Feedback model for user suggestions or issues.
    """

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
