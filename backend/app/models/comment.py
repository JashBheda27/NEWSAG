from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CommentModel(BaseModel):
    """
    Comment data model stored in MongoDB.
    """

    article_id: str
    article_title: str
    user_name: str
    user_email: Optional[str] = None
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
