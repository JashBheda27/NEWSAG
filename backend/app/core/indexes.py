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
        
        # Compound index for user's comments (_id + user_id) for faster lookups
        await db.comments.create_index(
            [("_id", 1), ("user_id", 1)],
            name="idx_id_user"
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

        # --------------------------------------------------
        # SUMMARY LOGS COLLECTION
        # --------------------------------------------------
        await db.summary_logs.create_index(
            [("user_id", 1), ("created_at", -1)],
            name="idx_summary_user_created"
        )

        logger.info("[OK] Summary logs indexes created")

        # --------------------------------------------------
        # READ ACTIVITY LOGS COLLECTION
        # --------------------------------------------------
        await db.read_activity_logs.create_index(
            [("user_id", 1), ("created_at", -1)],
            name="idx_read_activity_user_created"
        )

        await db.read_activity_logs.create_index(
            [("user_id", 1), ("article_key", 1), ("activity_day", 1)],
            unique=True,
            name="idx_read_activity_unique_day_article"
        )

        await db.read_activity_logs.create_index(
            [("user_id", 1), ("activity_day", 1)],
            name="idx_read_activity_user_day"
        )

        logger.info("[OK] Read activity logs indexes created")

        # --------------------------------------------------
        # ADMIN AUDIT LOG COLLECTION
        # --------------------------------------------------
        # Index for admin action audit trail
        await db.admin_audit_logs.create_index(
            [("created_at", -1)],
            name="idx_audit_created"
        )
        
        # Index for filtering by admin user
        await db.admin_audit_logs.create_index(
            [("admin_user_id", 1), ("created_at", -1)],
            name="idx_audit_admin_created"
        )
        
        # Index for filtering by action type
        await db.admin_audit_logs.create_index(
            [("action", 1), ("created_at", -1)],
            name="idx_audit_action_created"
        )
        
        logger.info("[OK] Admin audit log indexes created")
        # --------------------------------------------------
        # ARTICLES COLLECTION
        # --------------------------------------------------
        # Index for article_id (unique)
        await db.articles.create_index(
            [("article_id", 1)],
            unique=True,
            name="idx_article_id_unique"
        )
        logger.info("[OK] Articles indexes created")

        # --------------------------------------------------
        # GNEWS HITS COLLECTION
        # --------------------------------------------------
        # Index for date field for fast daily lookups
        await db.gnews_hits.create_index(
            [("date", 1)],
            unique=True,
            name="idx_gnews_hits_date"
        )
        logger.info("[OK] GNews hits indexes created")

        # --------------------------------------------------
        # USERS COLLECTION
        # --------------------------------------------------
        # Index for user_id (unique)
        await db.users.create_index(
            [("user_id", 1)],
            unique=True,
            name="idx_users_user_id"
        )
        logger.info("[OK] Users indexes created")
        
        logger.info("[OK] All MongoDB indexes created successfully")
        
    except Exception as e:
        logger.error(f"[ERROR] Error creating indexes: {e}")
        # Don't raise - allow app to start even if indexes fail
        # Indexes can be created manually if needed
