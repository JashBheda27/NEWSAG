from pydantic import BaseModel
from typing import Optional, Dict, Any


class ArticleRecord(BaseModel):
    article_id: str
    title: Optional[str]
    source: Optional[str]
    url: Optional[str]
    published_at: Optional[str]
    fetched_at: Optional[str]
    category: Optional[str]
    content_is_full: Optional[bool] = False
    sentiment: Optional[Dict[str, Any]] = None
    cached_at: Optional[str] = None
