from datetime import datetime
from typing import Optional
from pydantic import Field, BaseModel
from app.models.base import MongoBase


class CommentCreateRequest(BaseModel):
    """Request model for creating a comment - only requires comment content."""
    article_id: str
    article_title: str
    text: str
    username: Optional[str] = None


class CommentModel(MongoBase):
    """
    Comment data model stored in MongoDB.
    """

    article_id: str
    article_title: str
    text: str
    user_id: str
    username: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
