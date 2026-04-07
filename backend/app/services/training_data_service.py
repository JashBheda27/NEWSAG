"""
Training Data Service

Handles CRUD operations for sentiment and credibility training data.
Provides data retrieval methods for model fine-tuning.
"""

import logging
from typing import Dict, List, Optional, Literal
from datetime import datetime

logger = logging.getLogger(__name__)


class TrainingDataService:
    """
    Service for managing training data collection and retrieval.
    Supports both sentiment and credibility feedback loops.
    """

    @staticmethod
    def _normalize_sentiment_label(label: Optional[str]) -> Optional[str]:
        if not label:
            return None
        normalized = str(label).strip().lower()
        if normalized.startswith("pos"):
            return "Positive"
        if normalized.startswith("neu"):
            return "Neutral"
        if normalized.startswith("neg"):
            return "Negative"
        return None

    @staticmethod
    def _normalize_credibility_label(label: Optional[str]) -> Optional[str]:
        if not label:
            return None
        normalized = str(label).strip().upper()
        if normalized in ["REAL", "TRUE", "LEGIT", "RELIABLE"]:
            return "REAL"
        if normalized in ["FAKE", "FALSE", "MISLEADING", "POTENTIALLY MISLEADING"]:
            return "FAKE"
        return None

    SENTIMENT_INTERNAL_COLLECTION = "sentiment_training"
    SENTIMENT_EXTERNAL_COLLECTION = "sentiment_training_external"
    CREDIBILITY_INTERNAL_COLLECTION = "credibility_training"
    CREDIBILITY_EXTERNAL_COLLECTION = "credibility_training_external"
    
    # =========================================================
    # SENTIMENT TRAINING DATA
    # =========================================================
    
    @staticmethod
    async def add_sentiment_feedback(
        db,
        article_id: str,
        text: str,
        ai_label: str,
        ai_confidence: float,
        user_id: str,
        source: Literal["explicit", "implicit_bookmark", "implicit_read_later"],
        user_label: Optional[str] = None,
        article_url: Optional[str] = None,
    ) -> str:
        """
        Add sentiment training data entry.
        
        Args:
            db: Database instance
            article_id: Unique article identifier
            text: Combined title + description for training
            ai_label: AI's original prediction
            ai_confidence: AI's confidence score
            user_id: User who provided feedback
            source: Feedback source type
            user_label: User's corrected label (for explicit feedback)
            article_url: Article URL for reference
            
        Returns:
            Inserted document ID
        """
        # Check for duplicate from same user
        existing = await db.sentiment_training.find_one({
            "article_id": article_id,
            "user_id": user_id,
        })
        
        if existing:
            # Update existing entry if user provides new feedback
            if source == "explicit" and user_label:
                await db.sentiment_training.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "user_label": user_label,
                            "source": source,
                            "created_at": datetime.utcnow(),
                        }
                    }
                )
                logger.info(f"[TRAINING] Updated sentiment feedback for article={article_id}")
                return str(existing["_id"])
            else:
                logger.info(f"[TRAINING] Duplicate sentiment entry skipped for article={article_id}")
                return str(existing["_id"])
        
        # Determine final label for training
        final_label = user_label if user_label else ai_label
        
        doc = {
            "article_id": article_id,
            "article_url": article_url,
            "text": text,
            "ai_label": ai_label,
            "ai_confidence": ai_confidence,
            "user_label": user_label,
            "final_label": final_label,  # Label to use for training
            "source": source,
            "user_id": user_id,
            "created_at": datetime.utcnow(),
            "used_for_training": False,
        }
        
        result = await db.sentiment_training.insert_one(doc)
        logger.info(f"[TRAINING] Added sentiment feedback: article={article_id}, source={source}")
        return str(result.inserted_id)
    
    @staticmethod
    async def get_sentiment_training_data(
        db,
        include_used: bool = False,
        limit: int = 1000,
        data_source: Literal["internal", "external", "combined"] = "internal",
    ) -> List[Dict]:
        """
        Retrieve sentiment training data for fine-tuning.
        
        Args:
            db: Database instance
            include_used: Whether to include previously used data
            limit: Maximum records to retrieve
            
        Returns:
            List of training documents with text and labels
        """
        base_internal_query = {"import_source": {"$ne": "csv"}}
        base_legacy_external_query = {"import_source": "csv"}
        base_external_query = {}

        if not include_used:
            base_internal_query["used_for_training"] = False
            base_legacy_external_query["used_for_training"] = False
            base_external_query["used_for_training"] = False

        data = []

        async def _read_sentiment_collection(collection_name: str, query: Dict, max_limit: int) -> List[Dict]:
            rows: List[Dict] = []
            if max_limit <= 0:
                return rows

            cursor = db[collection_name].find(query).limit(max_limit)
            async for doc in cursor:
                label = TrainingDataService._normalize_sentiment_label(
                    doc.get("final_label") or doc.get("user_label") or doc.get("ai_label")
                )
                rows.append(
                    {
                        "id": str(doc["_id"]),
                        "text": doc.get("text", ""),
                        "label": label or "Neutral",
                        "source": doc.get("source") or "external_csv",
                        "ai_confidence": doc.get("ai_confidence", 0.0),
                        "collection_name": collection_name,
                    }
                )
            return rows

        if data_source == "internal":
            data = await _read_sentiment_collection(
                TrainingDataService.SENTIMENT_INTERNAL_COLLECTION,
                base_internal_query,
                limit,
            )
        elif data_source == "external":
            external_rows = await _read_sentiment_collection(
                TrainingDataService.SENTIMENT_EXTERNAL_COLLECTION,
                base_external_query,
                limit,
            )
            remaining = max(0, limit - len(external_rows))
            legacy_rows = await _read_sentiment_collection(
                TrainingDataService.SENTIMENT_INTERNAL_COLLECTION,
                base_legacy_external_query,
                remaining,
            )
            data = external_rows + legacy_rows
        else:
            internal_rows = await _read_sentiment_collection(
                TrainingDataService.SENTIMENT_INTERNAL_COLLECTION,
                base_internal_query,
                limit,
            )
            remaining_after_internal = max(0, limit - len(internal_rows))
            external_rows = await _read_sentiment_collection(
                TrainingDataService.SENTIMENT_EXTERNAL_COLLECTION,
                base_external_query,
                remaining_after_internal,
            )
            remaining_after_external = max(0, remaining_after_internal - len(external_rows))
            legacy_rows = await _read_sentiment_collection(
                TrainingDataService.SENTIMENT_INTERNAL_COLLECTION,
                base_legacy_external_query,
                remaining_after_external,
            )
            data = internal_rows + external_rows + legacy_rows
        
        logger.info(f"[TRAINING] Retrieved {len(data)} sentiment training samples")
        return data
    
    @staticmethod
    async def mark_sentiment_data_used(db, training_rows: List[Dict]) -> int:
        """
        Mark training data as used after fine-tuning.
        
        Args:
            db: Database instance
            doc_ids: List of document IDs to mark
            
        Returns:
            Number of documents updated
        """
        from bson import ObjectId

        grouped_ids: Dict[str, List[ObjectId]] = {}
        for row in training_rows:
            if not isinstance(row, dict) or not row.get("id"):
                continue
            collection_name = row.get("collection_name") or TrainingDataService.SENTIMENT_INTERNAL_COLLECTION
            grouped_ids.setdefault(collection_name, []).append(ObjectId(row["id"]))

        total_modified = 0
        for collection_name, object_ids in grouped_ids.items():
            result = await db[collection_name].update_many(
                {"_id": {"$in": object_ids}},
                {"$set": {"used_for_training": True}},
            )
            total_modified += int(result.modified_count)

        logger.info(f"[TRAINING] Marked {total_modified} sentiment samples as used")
        return total_modified

    @staticmethod
    async def purge_sentiment_imported_data(db, doc_ids: List[str]) -> int:
        """Delete CSV-imported sentiment rows after they have been consumed for training."""
        from bson import ObjectId

        object_ids = [ObjectId(id) for id in doc_ids]
        result = await db.sentiment_training.delete_many({
            "_id": {"$in": object_ids},
            "import_source": "csv",
        })
        logger.info(f"[TRAINING] Purged {result.deleted_count} imported sentiment samples")
        return result.deleted_count
    
    # =========================================================
    # CREDIBILITY TRAINING DATA
    # =========================================================
    
    @staticmethod
    async def add_credibility_report(
        db,
        article_id: str,
        article_url: str,
        title: str,
        ai_label: str,
        ai_score: float,
        ai_source: str,
        user_id: str,
        description: Optional[str] = None,
        content: Optional[str] = None,
        source_domain: Optional[str] = None,
        user_reason: Optional[str] = None,
    ) -> Dict:
        """
        Add credibility report (user flagging misleading content).
        
        Args:
            db: Database instance
            article_id: Unique article identifier
            article_url: Article URL
            title: Article title
            ai_label: AI's credibility assessment
            ai_score: AI's confidence score
            ai_source: Source of AI assessment (whitelist, ml_model, etc.)
            user_id: Reporting user
            description: Article description
            content: Article content
            source_domain: News source domain
            user_reason: User's reason for reporting
            
        Returns:
            Dict with insert status and report count
        """
        # Check if article was already reported
        existing = await db.credibility_training.find_one({
            "article_id": article_id,
        })
        
        if existing:
            # Check if same user already reported
            reporters = existing.get("reporter_ids", [existing.get("user_id")])
            if user_id in reporters:
                return {
                    "status": "duplicate",
                    "message": "You already reported this article",
                    "report_id": str(existing["_id"]),
                }
            
            # Increment report count and add user to reporters
            new_count = existing.get("report_count", 1) + 1
            reporters.append(user_id)
            
            # Auto-upgrade to multi_reported if threshold reached
            new_status = "multi_reported" if new_count >= 3 else existing["verification_status"]
            
            await db.credibility_training.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "report_count": new_count,
                        "reporter_ids": reporters,
                        "verification_status": new_status,
                    }
                }
            )
            
            logger.info(f"[TRAINING] Updated credibility report: article={article_id}, count={new_count}")
            return {
                "status": "incremented",
                "message": f"Report count increased to {new_count}",
                "report_id": str(existing["_id"]),
                "report_count": new_count,
            }
        
        # Create new report
        doc = {
            "article_id": article_id,
            "article_url": article_url,
            "source_domain": source_domain,
            "title": title,
            "description": description,
            "content": content,
            "ai_label": ai_label,
            "ai_score": ai_score,
            "ai_source": ai_source,
            "user_reason": user_reason,
            "verification_status": "pending",
            "user_id": user_id,
            "reporter_ids": [user_id],
            "report_count": 1,
            "created_at": datetime.utcnow(),
            "verified_at": None,
            "verified_by": None,
            "used_for_training": False,
        }
        
        result = await db.credibility_training.insert_one(doc)
        logger.info(f"[TRAINING] Added credibility report: article={article_id}")
        
        return {
            "status": "created",
            "message": "Report submitted successfully",
            "report_id": str(result.inserted_id),
            "report_count": 1,
        }
    
    @staticmethod
    async def get_credibility_training_data(
        db,
        status_filter: Optional[List[str]] = None,
        include_used: bool = False,
        limit: int = 1000,
        data_source: Literal["internal", "external", "combined"] = "internal",
    ) -> List[Dict]:
        """
        Retrieve credibility training data for fine-tuning.
        Only returns verified or multi-reported entries by default.
        
        Args:
            db: Database instance
            status_filter: List of verification statuses to include
            include_used: Whether to include previously used data
            limit: Maximum records to retrieve
            
        Returns:
            List of training documents
        """
        if status_filter is None:
            status_filter = ["verified", "multi_reported"]

        internal_query: Dict = {
            "verification_status": {"$in": status_filter},
            "import_source": {"$ne": "csv"},
        }
        legacy_external_query: Dict = {
            "verification_status": {"$in": status_filter},
            "import_source": "csv",
        }
        external_query: Dict = {}

        if not include_used:
            internal_query["used_for_training"] = False
            legacy_external_query["used_for_training"] = False
            external_query["used_for_training"] = False

        data: List[Dict] = []

        async def _read_credibility_collection(collection_name: str, query: Dict, max_limit: int) -> List[Dict]:
            rows: List[Dict] = []
            if max_limit <= 0:
                return rows

            cursor = db[collection_name].find(query).limit(max_limit)
            async for doc in cursor:
                text = str(doc.get("title") or "")
                if doc.get("description"):
                    text += " " + str(doc["description"])
                if not text.strip() and doc.get("content"):
                    text = str(doc.get("content"))

                label = TrainingDataService._normalize_credibility_label(doc.get("final_label"))
                if not label:
                    label = "REAL" if doc.get("verification_status") == "rejected" else "FAKE"

                rows.append(
                    {
                        "id": str(doc["_id"]),
                        "text": text,
                        "label": label,
                        "source_domain": doc.get("source_domain"),
                        "report_count": doc.get("report_count", 1),
                        "verification_status": doc.get("verification_status"),
                        "collection_name": collection_name,
                    }
                )
            return rows

        if data_source == "internal":
            data = await _read_credibility_collection(
                TrainingDataService.CREDIBILITY_INTERNAL_COLLECTION,
                internal_query,
                limit,
            )
        elif data_source == "external":
            external_rows = await _read_credibility_collection(
                TrainingDataService.CREDIBILITY_EXTERNAL_COLLECTION,
                external_query,
                limit,
            )
            remaining = max(0, limit - len(external_rows))
            legacy_rows = await _read_credibility_collection(
                TrainingDataService.CREDIBILITY_INTERNAL_COLLECTION,
                legacy_external_query,
                remaining,
            )
            data = external_rows + legacy_rows
        else:
            internal_rows = await _read_credibility_collection(
                TrainingDataService.CREDIBILITY_INTERNAL_COLLECTION,
                internal_query,
                limit,
            )
            remaining_after_internal = max(0, limit - len(internal_rows))
            external_rows = await _read_credibility_collection(
                TrainingDataService.CREDIBILITY_EXTERNAL_COLLECTION,
                external_query,
                remaining_after_internal,
            )
            remaining_after_external = max(0, remaining_after_internal - len(external_rows))
            legacy_rows = await _read_credibility_collection(
                TrainingDataService.CREDIBILITY_INTERNAL_COLLECTION,
                legacy_external_query,
                remaining_after_external,
            )
            data = internal_rows + external_rows + legacy_rows
        
        logger.info(f"[TRAINING] Retrieved {len(data)} credibility training samples")
        return data
    
    @staticmethod
    async def verify_credibility_report(
        db,
        report_id: str,
        admin_id: str,
        verified: bool,
    ) -> bool:
        """
        Admin verification of credibility report.
        
        Args:
            db: Database instance
            report_id: Report document ID
            admin_id: Admin user ID
            verified: True = confirmed misleading, False = rejected
            
        Returns:
            Success status
        """
        from bson import ObjectId
        
        new_status = "verified" if verified else "rejected"
        
        result = await db.credibility_training.update_one(
            {"_id": ObjectId(report_id)},
            {
                "$set": {
                    "verification_status": new_status,
                    "verified_at": datetime.utcnow(),
                    "verified_by": admin_id,
                }
            }
        )
        
        logger.info(f"[TRAINING] Admin {new_status} report={report_id}")
        return result.modified_count > 0
    
    @staticmethod
    async def mark_credibility_data_used(db, training_rows: List[Dict]) -> int:
        """
        Mark credibility training data as used after fine-tuning.
        """
        from bson import ObjectId

        grouped_ids: Dict[str, List[ObjectId]] = {}
        for row in training_rows:
            if not isinstance(row, dict) or not row.get("id"):
                continue
            collection_name = row.get("collection_name") or TrainingDataService.CREDIBILITY_INTERNAL_COLLECTION
            grouped_ids.setdefault(collection_name, []).append(ObjectId(row["id"]))

        total_modified = 0
        for collection_name, object_ids in grouped_ids.items():
            result = await db[collection_name].update_many(
                {"_id": {"$in": object_ids}},
                {"$set": {"used_for_training": True}},
            )
            total_modified += int(result.modified_count)

        logger.info(f"[TRAINING] Marked {total_modified} credibility samples as used")
        return total_modified

    @staticmethod
    async def purge_credibility_imported_data(db, doc_ids: List[str]) -> int:
        """Delete CSV-imported credibility rows after they have been consumed for training."""
        from bson import ObjectId

        object_ids = [ObjectId(id) for id in doc_ids]
        result = await db.credibility_training.delete_many({
            "_id": {"$in": object_ids},
            "import_source": "csv",
        })
        logger.info(f"[TRAINING] Purged {result.deleted_count} imported credibility samples")
        return result.deleted_count
    
    # =========================================================
    # STATS & MONITORING
    # =========================================================
    
    @staticmethod
    async def get_training_stats(db) -> Dict:
        """
        Get statistics on collected training data.
        """
        sentiment_total = await db.sentiment_training.count_documents({"import_source": {"$ne": "csv"}})
        sentiment_unused = await db.sentiment_training.count_documents({"used_for_training": False, "import_source": {"$ne": "csv"}})
        sentiment_explicit = await db.sentiment_training.count_documents({"source": "explicit"})
        sentiment_implicit = await db.sentiment_training.count_documents({
            "source": {"$in": ["implicit_bookmark", "implicit_read_later"]}
        })
        sentiment_external = await db.sentiment_training_external.count_documents({"used_for_training": False})
        sentiment_legacy_external = await db.sentiment_training.count_documents({"import_source": "csv", "used_for_training": False})
        
        credibility_total = await db.credibility_training.count_documents({"import_source": {"$ne": "csv"}})
        credibility_pending = await db.credibility_training.count_documents({"verification_status": "pending"})
        credibility_verified = await db.credibility_training.count_documents({
            "verification_status": "verified",
            "import_source": {"$ne": "csv"},
            "used_for_training": False,
        })
        credibility_multi = await db.credibility_training.count_documents({
            "verification_status": "multi_reported",
            "import_source": {"$ne": "csv"},
            "used_for_training": False,
        })
        credibility_external = await db.credibility_training_external.count_documents({"used_for_training": False})
        credibility_legacy_external = await db.credibility_training.count_documents({"import_source": "csv", "used_for_training": False})
        
        return {
            "sentiment": {
                "total": sentiment_total,
                "unused": sentiment_unused,
                "explicit": sentiment_explicit,
                "implicit": sentiment_implicit,
                "external_unused": sentiment_external + sentiment_legacy_external,
                "combined_unused": sentiment_unused + sentiment_external + sentiment_legacy_external,
            },
            "credibility": {
                "total": credibility_total,
                "pending": credibility_pending,
                "verified": credibility_verified,
                "multi_reported": credibility_multi,
                "ready_for_training": credibility_verified + credibility_multi,
                "external_ready_for_training": credibility_external + credibility_legacy_external,
                "combined_ready_for_training": credibility_verified + credibility_multi + credibility_external + credibility_legacy_external,
            },
        }
