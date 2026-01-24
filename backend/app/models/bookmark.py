from datetime import datetime
from pydantic import Field
from app.models.base import MongoBase


class BookmarkModel(MongoBase):
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
