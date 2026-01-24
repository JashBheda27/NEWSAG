"""
MongoDB index creation for performance optimization.
Indexes are critical for query performance at scale.
"""

import logging
from app.core.database import MongoDB

logger = logging.getLogger(__name__)


async def create_indexes():
    """
    Create indexes for all collections.
    Called once during application startup.
    """
    
    db = MongoDB.get_database()
    
    try:
        # --------------------------------------------------
        # BOOKMARKS COLLECTION
        # --------------------------------------------------
        # Compound index for duplicate checking (user_id + article_id)
        await db.bookmarks.create_index(
            [("user_id", 1), ("article_id", 1)],
            unique=True,
            name="idx_user_article_unique"
        )
        
        # Index for fetching user's bookmarks (sorted by created_at)
        await db.bookmarks.create_index(
            [("user_id", 1), ("created_at", -1)],
            name="idx_user_created"
        )
        
        logger.info("[OK] Bookmarks indexes created")
        
        # --------------------------------------------------
        # COMMENTS COLLECTION
        # --------------------------------------------------
        # Index for fetching article's comments (sorted by created_at)
        await db.comments.create_index(
            [("article_id", 1), ("created_at", -1)],
            name="idx_article_created"
        )
        
        logger.info("[OK] Comments indexes created")
        
        # --------------------------------------------------
        # READ LATER COLLECTION
        # --------------------------------------------------
        # Compound index for duplicate checking (user_id + article_id)
        await db.read_later.create_index(
            [("user_id", 1), ("article_id", 1)],
            unique=True,
            name="idx_user_article_unique"
        )
        
        # Index for fetching user's read later items (sorted by created_at)
        await db.read_later.create_index(
            [("user_id", 1), ("created_at", -1)],
            name="idx_user_created"
        )
        
        logger.info("[OK] Read Later indexes created")
        
        # --------------------------------------------------
        # FEEDBACK COLLECTION
        # --------------------------------------------------
        # Index for sorting/filtering feedback by date
        await db.feedback.create_index(
            [("created_at", -1)],
            name="idx_created"
        )
        
        # Optional: Index for searching by email (if needed for support)
        await db.feedback.create_index(
            [("email", 1)],
            sparse=True,  # Only index documents with email field
            name="idx_email"
        )
        
        logger.info("[OK] Feedback indexes created")
        
        logger.info("[OK] All MongoDB indexes created successfully")
        
    except Exception as e:
        logger.error(f"[ERROR] Error creating indexes: {e}")
        # Don't raise - allow app to start even if indexes fail
        # Indexes can be created manually if needed
