from datetime import datetime
from pydantic import BaseModel, Field


class ReadLaterModel(BaseModel):
    """
    Read Later model for deferred articles.
    """

    user_id: str
    article_id: str
    title: str
    source: str
    url: str
    image_url: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
