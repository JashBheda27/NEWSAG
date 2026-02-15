"""
Sentiment Training Data Model

Stores user feedback for sentiment analysis fine-tuning.
Captures both explicit ratings and implicit signals (bookmarks, read-later).
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import Field
from app.models.base import MongoBase


class SentimentTrainingData(MongoBase):
    """
    Training data for sentiment model fine-tuning.
    
    Sources:
    - explicit: User directly rated the sentiment
    - implicit_bookmark: User bookmarked (assumed positive signal)
    - implicit_read_later: User saved for later (assumed positive signal)
    """
    
    # Article identification
    article_id: str
    article_url: Optional[str] = None
    
    # Text content for training
    text: str  # Title + description combined
    
    # Labels
    ai_label: str  # Original AI prediction: Positive, Neutral, Negative
    ai_confidence: float  # Original AI confidence score
    user_label: Optional[str] = None  # User's correction (if explicit)
    
    # Feedback source
    source: Literal["explicit", "implicit_bookmark", "implicit_read_later"]
    
    # User tracking
    user_id: str
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used_for_training: bool = False  # Flag to track if used in training batch


class SentimentRatingRequest(MongoBase):
    """
    Request model for explicit sentiment rating from frontend.
    """
    article_id: str
    article_url: Optional[str] = None
    title: str
    description: Optional[str] = None
    ai_label: str
    ai_confidence: float
    user_label: str  # User's corrected sentiment: Positive, Neutral, Negative
