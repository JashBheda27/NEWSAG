from datetime import datetime
from pydantic import BaseModel, Field


class BookmarkModel(BaseModel):
    """
    Bookmark model for saving articles.
    """

    user_id: str
    article_id: str
    title: str
    source: str
    url: str
    image_url: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
