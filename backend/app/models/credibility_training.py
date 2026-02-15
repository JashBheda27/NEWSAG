"""
Credibility Training Data Model

Stores user reports for fake news detection fine-tuning.
Captures user-flagged misleading content for model improvement.
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import Field
from app.models.base import MongoBase


class CredibilityTrainingData(MongoBase):
    """
    Training data for credibility/fake-news model fine-tuning.
    
    Data Quality:
    - pending: Awaiting verification
    - verified: Admin confirmed as misleading
    - rejected: Admin rejected report (false positive)
    - multi_reported: Multiple independent users flagged same article
    """
    
    # Article identification
    article_id: str
    article_url: str
    source_domain: Optional[str] = None
    
    # Text content for training
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    
    # AI prediction at time of report
    ai_label: str  # Reliable, Uncertain, Potentially Misleading
    ai_score: float
    ai_source: str  # whitelist, ml_model, suspect_list
    
    # User feedback
    user_reason: Optional[str] = None  # Why user thinks it's misleading
    
    # Verification status
    verification_status: Literal["pending", "verified", "rejected", "multi_reported"] = "pending"
    
    # User tracking
    user_id: str
    report_count: int = 1  # Number of independent reports for same article
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None  # Admin user ID
    used_for_training: bool = False


class CredibilityReportRequest(MongoBase):
    """
    Request model for reporting misleading content from frontend.
    """
    article_id: str
    article_url: str
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    source_domain: Optional[str] = None
    ai_label: str
    ai_score: float
    ai_source: str
    reason: Optional[str] = None  # User's reason for reporting
