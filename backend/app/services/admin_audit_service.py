"""
Admin Audit Service
-------------------
Logs all admin actions for compliance and troubleshooting.
"""

import logging
from datetime import datetime
from typing import Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class AdminAuditService:
    """Service for logging and retrieving admin audit trails."""

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
        audit_log = {
            "admin_user_id": admin_user_id,
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
            f"[AUDIT] Admin {admin_user_id} performed {action} on {resource_type} "
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
        
        logs = []
        async for doc in cursor:
            logs.append({
                "id": str(doc["_id"]),
                "admin_user_id": doc["admin_user_id"],
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
