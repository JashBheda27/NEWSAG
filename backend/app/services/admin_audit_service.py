"""
Admin Audit Service
-------------------
Logs all admin actions for compliance and troubleshooting.
"""

import logging
from datetime import datetime
from typing import Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.clerk_service import get_clerk_user_metadata

logger = logging.getLogger(__name__)


class AdminAuditService:
    """Service for logging and retrieving admin audit trails."""

    @staticmethod
    async def _resolve_admin_identity(db: AsyncIOMotorDatabase, admin_user_id: str) -> dict:
        """Resolve a display-friendly admin identity from users collection."""
        try:
            user_doc = await db.users.find_one(
                {"user_id": admin_user_id},
                projection={"username": 1, "name": 1},
            )
        except Exception:
            user_doc = None

        username = (user_doc or {}).get("username")
        name = (user_doc or {}).get("name")

        # Fallback: resolve identity directly from Clerk when local user profile is missing.
        if not username and not name:
            clerk_data = await get_clerk_user_metadata(admin_user_id)
            if isinstance(clerk_data, dict):
                username = clerk_data.get("username") or username
                name = clerk_data.get("name") or name

                # Best-effort cache in local users collection for future lookups.
                try:
                    await db.users.update_one(
                        {"user_id": admin_user_id},
                        {
                            "$set": {
                                "user_id": admin_user_id,
                                "username": username,
                                "name": name,
                                "email": clerk_data.get("email"),
                                "last_seen": datetime.utcnow(),
                            },
                            "$setOnInsert": {"created_at": datetime.utcnow()},
                        },
                        upsert=True,
                    )
                except Exception:
                    pass

        admin_display = username or name or admin_user_id
        return {
            "admin_username": username,
            "admin_name": name,
            "admin_display": admin_display,
        }

    @staticmethod
    async def log_action(
        db: AsyncIOMotorDatabase,
        admin_user_id: str,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> dict:
        """
        Log an admin action to the audit trail.
        
        Args:
            db: MongoDB database instance
            admin_user_id: ID of the admin performing the action
            action: Action type (e.g., 'verify_report', 'reset_quota', 'fine_tune')
            resource_type: Type of resource affected (e.g., 'credibility_report', 'cache', 'model')
            resource_id: ID of the specific resource (if applicable)
            details: Additional details about the action
            success: Whether the action succeeded
            error_message: Error message if action failed
        
        Returns:
            The inserted document
        """
        identity = await AdminAuditService._resolve_admin_identity(db, admin_user_id)

        audit_log = {
            "admin_user_id": admin_user_id,
            "admin_username": identity.get("admin_username"),
            "admin_name": identity.get("admin_name"),
            "admin_display": identity.get("admin_display"),
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "success": success,
            "error_message": error_message,
            "created_at": datetime.utcnow(),
            "ip_address": None,  # Could be added if request context is available
        }
        
        result = await db.admin_audit_logs.insert_one(audit_log)
        logger.info(
            f"[AUDIT] Admin {identity.get('admin_display')} performed {action} on {resource_type} "
            f"(status: {'success' if success else 'failed'})"
        )
        
        return {
            "id": str(result.inserted_id),
            **audit_log,
            "created_at": audit_log["created_at"].isoformat(),
        }

    @staticmethod
    async def get_audit_log(
        db: AsyncIOMotorDatabase,
        limit: int = 100,
        admin_user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
    ) -> list:
        """
        Retrieve audit log entries.
        
        Args:
            db: MongoDB database instance
            limit: Maximum number of records to return
            admin_user_id: Filter by admin user (optional)
            action: Filter by action type (optional)
            resource_type: Filter by resource type (optional)
        
        Returns:
            List of audit log entries
        """
        query = {}
        
        if admin_user_id:
            query["admin_user_id"] = admin_user_id
        
        if action:
            query["action"] = action
        
        if resource_type:
            query["resource_type"] = resource_type
        
        cursor = db.admin_audit_logs.find(query).sort("created_at", -1).limit(limit)
        
        raw_docs = []
        async for doc in cursor:
            raw_docs.append(doc)

        # Resolve identities for legacy rows that do not yet store display fields
        admin_ids_to_resolve = {
            doc.get("admin_user_id")
            for doc in raw_docs
            if doc.get("admin_user_id") and (
                not (doc.get("admin_display") or doc.get("admin_username") or doc.get("admin_name"))
                or (
                    (doc.get("admin_display") == doc.get("admin_user_id"))
                    and not (doc.get("admin_username") or doc.get("admin_name"))
                )
            )
        }

        resolved_identity_map = {}
        if admin_ids_to_resolve:
            users_cursor = db.users.find(
                {"user_id": {"$in": list(admin_ids_to_resolve)}},
                projection={"user_id": 1, "username": 1, "name": 1},
            )
            async for user_doc in users_cursor:
                uid = user_doc.get("user_id")
                if uid:
                    resolved_identity_map[uid] = {
                        "admin_username": user_doc.get("username"),
                        "admin_name": user_doc.get("name"),
                        "admin_display": user_doc.get("username") or user_doc.get("name") or uid,
                    }

        logs = []
        for doc in raw_docs:
            legacy_identity = resolved_identity_map.get(doc.get("admin_user_id"), {})
            current_display = doc.get("admin_display") or doc.get("admin_username") or doc.get("admin_name")
            should_use_resolved = bool(legacy_identity) and (
                not current_display or current_display == doc.get("admin_user_id")
            )

            logs.append({
                "id": str(doc["_id"]),
                "admin_user_id": doc["admin_user_id"],
                "admin_username": (
                    legacy_identity.get("admin_username") if should_use_resolved else (doc.get("admin_username") or legacy_identity.get("admin_username"))
                ),
                "admin_name": (
                    legacy_identity.get("admin_name") if should_use_resolved else (doc.get("admin_name") or legacy_identity.get("admin_name"))
                ),
                "admin_display": (
                    legacy_identity.get("admin_display")
                    if should_use_resolved
                    else (doc.get("admin_display") or doc.get("admin_username") or doc.get("admin_name") or legacy_identity.get("admin_display") or doc["admin_user_id"])
                ),
                "action": doc["action"],
                "resource_type": doc["resource_type"],
                "resource_id": doc.get("resource_id"),
                "success": doc.get("success", True),
                "error_message": doc.get("error_message"),
                "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
                "details": doc.get("details", {}),
            })
        
        return logs

    @staticmethod
    async def get_admin_activity_summary(
        db: AsyncIOMotorDatabase,
        admin_user_id: str,
        days: int = 7,
    ) -> dict:
        """
        Get a summary of admin activity for a specific user.
        
        Args:
            db: MongoDB database instance
            admin_user_id: Admin user ID
            days: Number of days to look back
        
        Returns:
            Summary of admin activity
        """
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all actions by this admin in the specified period
        cursor = db.admin_audit_logs.find({
            "admin_user_id": admin_user_id,
            "created_at": {"$gte": cutoff_date},
        }).sort("created_at", -1)
        
        actions = []
        success_count = 0
        failure_count = 0
        action_counts = {}
        
        async for doc in cursor:
            actions.append(doc)
            
            if doc.get("success", True):
                success_count += 1
            else:
                failure_count += 1
            
            action = doc["action"]
            action_counts[action] = action_counts.get(action, 0) + 1
        
        return {
            "admin_user_id": admin_user_id,
            "total_actions": len(actions),
            "successful_actions": success_count,
            "failed_actions": failure_count,
            "actions_by_type": action_counts,
            "period_days": days,
        }
