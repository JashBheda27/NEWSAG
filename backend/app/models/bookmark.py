from datetime import datetime
from pydantic import Field
from app.models.base import MongoBase


class BookmarkModel(MongoBase):
    """
    Bookmark model for saving articles.
    """

    
    article_id: str
    title: str
    source: str
    category: str | None = None
    url: str
    image_url: str | None = None
    description: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
