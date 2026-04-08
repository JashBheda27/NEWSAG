"""
Admin Router

Protected endpoints for model management and training data administration.
ALL routes require admin authentication.
"""

import asyncio
import csv
import io
import json
import logging
import threading
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from typing import Optional, List
from bson import ObjectId
from app.core.database import get_db
from app.core.auth import get_user_id, require_admin, _validate_token
from app.services.training_data_service import TrainingDataService
from app.services.model_fine_tuning_service import ModelFineTuningService
from app.services.admin_audit_service import AdminAuditService
from app.services.sentiment_ml import SentimentService
from app.core.cache import get_from_cache, get_redis, gnews_cache_key
from app.core.constants import NEWS_CATEGORIES
from app.core.gnews_counter import GNewsCounter
from datetime import datetime, timedelta
import time
import os
from app.services.metrics_service import MetricsService
from app.services.clerk_service import get_clerk_user_count

router = APIRouter()
logger = logging.getLogger(__name__)

# Tracks currently running fine-tune background tasks keyed by job_id.
RUNNING_TUNING_TASKS: dict[str, asyncio.Task] = {}
# Tracks per-job cooperative cancellation flags keyed by job_id.
RUNNING_TUNING_STOP_EVENTS: dict[str, threading.Event] = {}

CSV_SCHEMA_ALIASES: dict[str, dict[str, list[str]]] = {
    "sentiment": {
        "text": ["text", "content", "article_text", "body", "headline", "title", "description"],
        "label": ["label", "sentiment", "target", "class", "final_label", "user_label"],
        "article_id": ["article_id", "id", "news_id", "post_id"],
        "article_url": ["article_url", "url", "link", "article_link"],
        "ai_label": ["ai_label", "predicted_label", "prediction"],
        "ai_confidence": ["ai_confidence", "confidence", "score", "probability"],
        "source": ["source", "feedback_source", "origin"],
        "user_id": ["user_id", "uid", "annotator_id", "reviewer_id"],
    },
    "credibility": {
        "title_or_text": ["title", "headline", "text", "content", "article_text"],
        "label": ["label", "credibility", "verdict", "class", "target", "final_label", "verification_label"],
        "article_id": ["article_id", "id", "news_id", "post_id"],
        "article_url": ["article_url", "url", "link", "article_link"],
        "description": ["description", "summary", "deck"],
        "content": ["content", "body", "article_body"],
        "source_domain": ["source_domain", "domain", "publisher", "source"],
        "ai_label": ["ai_label", "predicted_label", "prediction"],
        "ai_score": ["ai_score", "confidence", "score", "probability"],
        "ai_source": ["ai_source", "model_source", "classifier"],
        "user_reason": ["user_reason", "reason", "notes", "comment"],
        "user_id": ["user_id", "uid", "annotator_id", "reviewer_id"],
    },
}

CSV_REQUIRED_FIELDS = {
    "sentiment": ["text", "label"],
    "credibility": ["title_or_text", "label"],
}


def _normalize_header(value: Optional[str]) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value).strip().lower() if ch.isalnum())


def _normalize_sentiment_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = str(value).strip().lower()
    if normalized.startswith("pos"):
        return "Positive"
    if normalized.startswith("neu"):
        return "Neutral"
    if normalized.startswith("neg"):
        return "Negative"
    return None


def _normalize_credibility_label(value: Optional[str]) -> Optional[str]:
    if value is None or str(value).strip() == "":
        return None
    normalized = str(value).strip().upper()
    if normalized in ["0", "FALSE", "NO", "FAKE"]:
        return "FAKE"
    if normalized in ["1", "TRUE", "YES", "REAL"]:
        return "REAL"
    if normalized in ["REAL", "TRUE", "LEGIT", "RELIABLE"]:
        return "REAL"
    if normalized in ["FAKE", "FALSE", "MISLEADING", "POTENTIALLY MISLEADING"]:
        return "FAKE"
    return None


def _clean_csv_value(value: Optional[str]) -> str:
    return str(value).strip() if value is not None else ""


def _coerce_float(value: Optional[str], default: float = 0.0) -> float:
    try:
        if value is None or str(value).strip() == "":
            return default
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def _combine_article_text(row: dict) -> str:
    pieces = [
        _clean_csv_value(row.get("text")),
        _clean_csv_value(row.get("title")),
        _clean_csv_value(row.get("description")),
        _clean_csv_value(row.get("content")),
    ]
    return " ".join(piece for piece in pieces if piece).strip()


def _derive_article_id(row: dict, index: int, model_type: str) -> str:
    base = _clean_csv_value(row.get("article_id") or row.get("id") or row.get("article_url"))
    if base:
        return base
    return f"csv-{model_type}-{index + 1}"


def _resolve_field_mapping(model_type: str, headers: list[str], override: Optional[dict] = None) -> dict:
    aliases = CSV_SCHEMA_ALIASES[model_type]
    normalized_headers = {_normalize_header(header): header for header in headers if str(header).strip()}
    mapping: dict[str, Optional[str]] = {}

    for canonical_field, candidates in aliases.items():
        selected = None
        for candidate in candidates:
            matched = normalized_headers.get(_normalize_header(candidate))
            if matched:
                selected = matched
                break
        mapping[canonical_field] = selected

    if override:
        for canonical_field, chosen_column in override.items():
            if canonical_field not in aliases:
                continue
            if chosen_column and chosen_column in headers:
                mapping[canonical_field] = chosen_column

    unresolved_required = [field for field in CSV_REQUIRED_FIELDS[model_type] if not mapping.get(field)]

    return {
        "mapping": mapping,
        "unresolved_required": unresolved_required,
        "ready": len(unresolved_required) == 0,
    }


def _extract_row_value(row: dict, mapping: dict, canonical_field: str) -> str:
    column_name = mapping.get(canonical_field)
    if not column_name:
        return ""
    return _clean_csv_value(row.get(column_name))


def _build_csv_validation_result(
    model_type: str,
    rows: list[dict],
    mapping: dict,
    file_name: Optional[str] = None,
    headers: Optional[list[str]] = None,
) -> dict:
    seen_keys: set[str] = set()
    duplicate_estimate = 0
    valid_rows = 0
    invalid_rows = 0
    issues: list[dict] = []
    label_distribution = {"Positive": 0, "Neutral": 0, "Negative": 0} if model_type == "sentiment" else {"REAL": 0, "FAKE": 0}
    preview_rows: list[dict] = []
    raw_preview_headers = (headers or [])[:6]
    raw_preview_rows: list[dict] = []

    for idx, row in enumerate(rows[:8]):
        raw_preview_rows.append(
            {
                "row": idx + 2,
                "values": {header: _clean_csv_value(row.get(header)) for header in raw_preview_headers},
            }
        )

    for index, row in enumerate(rows):
        article_id = _extract_row_value(row, mapping, "article_id") or _extract_row_value(row, mapping, "article_url") or f"row-{index + 1}"
        row_key = article_id.lower()
        if row_key in seen_keys:
            duplicate_estimate += 1
        else:
            seen_keys.add(row_key)

        if model_type == "sentiment":
            text_value = _extract_row_value(row, mapping, "text")
            label = _normalize_sentiment_label(_extract_row_value(row, mapping, "label"))
            row_valid = bool(text_value and label)
            if label:
                label_distribution[label] += 1
            if len(preview_rows) < 8:
                preview_rows.append(
                    {
                        "row": index + 2,
                        "article_id": article_id,
                        "text": text_value[:140],
                        "label": label,
                        "valid": row_valid,
                    }
                )
            if not row_valid:
                invalid_rows += 1
                issues.append({"row": index + 2, "error": "Missing sentiment text or label"})
            else:
                valid_rows += 1
        else:
            title_or_text = _extract_row_value(row, mapping, "title_or_text")
            label = _normalize_credibility_label(_extract_row_value(row, mapping, "label"))
            row_valid = bool(title_or_text and label)
            if label:
                label_distribution[label] += 1
            if len(preview_rows) < 8:
                preview_rows.append(
                    {
                        "row": index + 2,
                        "article_id": article_id,
                        "title_or_text": title_or_text[:140],
                        "label": label,
                        "valid": row_valid,
                    }
                )
            if not row_valid:
                invalid_rows += 1
                issues.append({"row": index + 2, "error": "Missing credibility title/text or REAL/FAKE label (or 1/0)"})
            else:
                valid_rows += 1

    total_rows = len(rows)
    warnings: list[str] = []
    if duplicate_estimate > 0:
        warnings.append(f"Estimated duplicates: {duplicate_estimate}")
    if total_rows > 0 and invalid_rows / total_rows > 0.2:
        warnings.append("More than 20% rows are invalid for this model mapping")

    if model_type == "sentiment":
        active_classes = sum(1 for count in label_distribution.values() if count > 0)
        if active_classes < 2:
            warnings.append("Sentiment data currently has fewer than 2 classes")
        class_balance_status = "balanced" if active_classes >= 2 else "one-sided"
    else:
        has_real = label_distribution["REAL"] > 0
        has_fake = label_distribution["FAKE"] > 0
        if not (has_real and has_fake):
            warnings.append("Credibility data should contain both REAL and FAKE labels")
        class_balance_status = "balanced" if has_real and has_fake else "one-sided"

    return {
        "model_type": model_type,
        "file_name": file_name,
        "total_rows": total_rows,
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "duplicate_estimate": duplicate_estimate,
        "label_distribution": label_distribution,
        "class_balance_status": class_balance_status,
        "warnings": warnings,
        "issues": issues[:100],
        "preview_rows": preview_rows,
        "raw_preview_headers": raw_preview_headers,
        "raw_preview_rows": raw_preview_rows,
    }


async def _build_model_data_quality(db, model_type: str) -> dict:
    if model_type == "sentiment":
        cursor = db.sentiment_training.find(
            {},
            {
                "article_id": 1,
                "text": 1,
                "final_label": 1,
                "user_label": 1,
                "ai_label": 1,
                "ai_confidence": 1,
                "source": 1,
            },
        )
        label_counts = {"positive": 0, "neutral": 0, "negative": 0}
        min_required = 50
    else:
        cursor = db.credibility_training.find(
            {},
            {
                "article_id": 1,
                "title": 1,
                "description": 1,
                "final_label": 1,
                "verification_status": 1,
                "ai_label": 1,
                "ai_score": 1,
                "source_domain": 1,
                "report_count": 1,
            },
        )
        label_counts = {"real": 0, "fake": 0}
        min_required = 30

    total = 0
    verified_labels = 0
    duplicates = 0
    missing_values = 0
    confidence_sum = 0.0
    confidence_count = 0
    seen_article_ids: set[str] = set()

    async for doc in cursor:
        total += 1
        article_id = str(doc.get("article_id") or "").strip()
        if article_id:
            if article_id in seen_article_ids:
                duplicates += 1
            else:
                seen_article_ids.add(article_id)
        else:
            missing_values += 1

        if model_type == "sentiment":
            text = str(doc.get("text") or "").strip()
            label = _normalize_sentiment_label(doc.get("final_label") or doc.get("user_label") or doc.get("ai_label"))
            ai_confidence = doc.get("ai_confidence")
            if doc.get("user_label"):
                verified_labels += 1
            if not text:
                missing_values += 1
            if not label:
                missing_values += 1
            if isinstance(ai_confidence, (int, float)):
                confidence_sum += float(ai_confidence)
                confidence_count += 1
            else:
                missing_values += 1
            if label:
                label_counts[label.lower()] += 1
        else:
            title = str(doc.get("title") or "").strip()
            label = _normalize_credibility_label(
                doc.get("final_label") or ("REAL" if doc.get("verification_status") == "rejected" else "FAKE")
            )
            ai_score = doc.get("ai_score")
            if doc.get("verification_status") in ["verified", "multi_reported"] or doc.get("final_label"):
                verified_labels += 1
            if not title:
                missing_values += 1
            if not label:
                missing_values += 1
            if isinstance(ai_score, (int, float)):
                confidence_sum += float(ai_score)
                confidence_count += 1
            else:
                missing_values += 1
            if label:
                label_counts[label.lower()] += 1

    duplicate_rate = round((duplicates / total) * 100, 1) if total else 0.0
    average_confidence = round(confidence_sum / confidence_count, 2) if confidence_count else 0.0
    verified_labels_percentage = round((verified_labels / total) * 100, 1) if total else 0.0

    if total == 0:
        class_balance_status = "no data"
    else:
        active_counts = [count for count in label_counts.values() if count > 0]
        if len(active_counts) <= 1:
            class_balance_status = "one-sided"
        else:
            ratio = min(active_counts) / max(active_counts)
            if ratio >= 0.75:
                class_balance_status = "balanced"
            elif ratio >= 0.4:
                class_balance_status = "moderately imbalanced"
            else:
                class_balance_status = "highly imbalanced"

    tips: list[str] = []
    if total < min_required:
        tips.append("Collect more labeled samples before fine-tuning.")
    if duplicate_rate > 10:
        tips.append("Remove duplicate articles to reduce label bias.")
    if class_balance_status in ["one-sided", "highly imbalanced"]:
        if model_type == "credibility":
            tips.append("Add REAL examples from trusted CSV sources before training.")
        else:
            tips.append("Balance Positive, Neutral, and Negative labels before retraining.")
    if missing_values > 0:
        tips.append("Fill missing title, text, and label fields in the source data.")

    warning_message = f"Need {max(0, min_required - total)} more samples to reach minimum threshold." if total < min_required else None

    return {
        "model_type": model_type,
        "total_samples": total,
        "minimum_required": min_required,
        "samples_shortfall": max(0, min_required - total),
        "average_confidence": average_confidence,
        "verified_labels_count": verified_labels,
        "verified_labels_percentage": verified_labels_percentage,
        "duplicate_rate": duplicate_rate,
        "class_balance_status": class_balance_status,
        "missing_values_count": missing_values,
        "warning_message": warning_message,
        "tips": tips,
        "label_distribution": label_counts,
    }


@router.post("/tuning/import/{model_type}")
async def import_training_csv(
    model_type: str,
    file: UploadFile = File(...),
    mapping_json: Optional[str] = Form(None),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    model_type = model_type.lower()
    if model_type not in ["sentiment", "credibility"]:
        raise HTTPException(status_code=400, detail="model_type must be 'sentiment' or 'credibility'")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw_bytes.decode("utf-8", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file must include a header row")

    rows = [{str(k).strip(): _clean_csv_value(v) for k, v in row.items()} for row in reader]
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows")

    mapping_override = None
    if mapping_json:
        try:
            parsed = json.loads(mapping_json)
            if isinstance(parsed, dict):
                mapping_override = {str(k): str(v) for k, v in parsed.items() if v is not None}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid mapping_json payload: {str(e)}")

    mapping_result = _resolve_field_mapping(model_type, list(reader.fieldnames), mapping_override)
    if not mapping_result["ready"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Required fields are not mapped. Run validation and provide mapping_json.",
                "unresolved_required": mapping_result["unresolved_required"],
                "mapping": mapping_result["mapping"],
            },
        )

    validation_result = _build_csv_validation_result(
        model_type,
        rows,
        mapping_result["mapping"],
        file.filename,
        list(reader.fieldnames),
    )
    if validation_result["valid_rows"] == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No valid rows found in CSV for the selected model",
                "validation": validation_result,
            },
        )

    skipped = 0
    errors: list[dict] = []
    documents: list[dict] = []
    seen_keys: set[str] = set()
    admin_id = get_user_id(user)
    mapping = mapping_result["mapping"]

    for index, row in enumerate(rows):
        article_id = _extract_row_value(row, mapping, "article_id") or _derive_article_id(row, index, model_type)
        row_key = article_id.lower()
        if row_key in seen_keys:
            skipped += 1
            continue
        seen_keys.add(row_key)

        if model_type == "sentiment":
            text_value = _extract_row_value(row, mapping, "text")
            label = _normalize_sentiment_label(_extract_row_value(row, mapping, "label"))
            ai_label = _normalize_sentiment_label(_extract_row_value(row, mapping, "ai_label")) or label or "Neutral"
            ai_confidence = _coerce_float(_extract_row_value(row, mapping, "ai_confidence"), 0.0)
            if not text_value or not label:
                skipped += 1
                errors.append({"row": index + 2, "error": "Sentiment rows require text and a Positive/Neutral/Negative label"})
                continue

            documents.append(
                {
                    "article_id": article_id,
                    "article_url": _extract_row_value(row, mapping, "article_url") or None,
                    "text": text_value,
                    "ai_label": ai_label,
                    "ai_confidence": ai_confidence,
                    "user_label": label,
                    "final_label": label,
                    "source": _extract_row_value(row, mapping, "source") or "csv_import",
                    "user_id": _extract_row_value(row, mapping, "user_id") or admin_id,
                    "created_at": datetime.utcnow(),
                    "used_for_training": False,
                    "import_source": "csv",
                }
            )
        else:
            title = _extract_row_value(row, mapping, "title_or_text")
            if not title:
                skipped += 1
                errors.append({"row": index + 2, "error": "Credibility rows require at least title or text"})
                continue

            final_label = _normalize_credibility_label(_extract_row_value(row, mapping, "label"))
            if not final_label:
                skipped += 1
                errors.append({"row": index + 2, "error": "Credibility rows require a REAL/FAKE label or binary 1/0 label"})
                continue

            documents.append(
                {
                    "article_id": article_id,
                    "article_url": _extract_row_value(row, mapping, "article_url") or None,
                    "source_domain": _extract_row_value(row, mapping, "source_domain") or None,
                    "title": title,
                    "description": _extract_row_value(row, mapping, "description") or None,
                    "content": _extract_row_value(row, mapping, "content") or None,
                    "ai_label": _extract_row_value(row, mapping, "ai_label") or final_label,
                    "ai_score": _coerce_float(_extract_row_value(row, mapping, "ai_score"), 0.0),
                    "ai_source": _extract_row_value(row, mapping, "ai_source") or "csv_import",
                    "user_reason": _extract_row_value(row, mapping, "user_reason") or None,
                    "verification_status": "verified",
                    "user_id": _extract_row_value(row, mapping, "user_id") or admin_id,
                    "reporter_ids": [_extract_row_value(row, mapping, "user_id") or admin_id],
                    "report_count": 1,
                    "created_at": datetime.utcnow(),
                    "verified_at": datetime.utcnow(),
                    "verified_by": admin_id,
                    "used_for_training": False,
                    "final_label": final_label,
                    "import_source": "csv",
                }
            )

    if not documents:
        raise HTTPException(status_code=400, detail={"message": "No valid rows found in CSV", "errors": errors})

    collection = db.sentiment_training_external if model_type == "sentiment" else db.credibility_training_external
    result = await collection.insert_many(documents)

    return {
        "model_type": model_type,
        "file_name": file.filename,
        "mapping": mapping,
        "validation": {
            "total_rows": validation_result["total_rows"],
            "valid_rows": validation_result["valid_rows"],
            "invalid_rows": validation_result["invalid_rows"],
            "duplicate_estimate": validation_result["duplicate_estimate"],
            "label_distribution": validation_result["label_distribution"],
            "warnings": validation_result["warnings"],
        },
        "imported": len(result.inserted_ids),
        "skipped": skipped,
        "errors": errors,
        "message": f"Imported {len(result.inserted_ids)} rows into {model_type} training data",
    }


@router.post("/tuning/import/validate/{model_type}")
async def validate_training_csv(
    model_type: str,
    file: UploadFile = File(...),
    mapping_json: Optional[str] = Form(None),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    model_type = model_type.lower()
    if model_type not in ["sentiment", "credibility"]:
        raise HTTPException(status_code=400, detail="model_type must be 'sentiment' or 'credibility'")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw_bytes.decode("utf-8", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file must include a header row")

    rows = [{str(k).strip(): _clean_csv_value(v) for k, v in row.items()} for row in reader]
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows")

    mapping_override = None
    if mapping_json:
        try:
            parsed = json.loads(mapping_json)
            if isinstance(parsed, dict):
                mapping_override = {str(k): str(v) for k, v in parsed.items() if v is not None}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid mapping_json payload: {str(e)}")

    mapping_result = _resolve_field_mapping(model_type, list(reader.fieldnames), mapping_override)
    validation = _build_csv_validation_result(
        model_type,
        rows,
        mapping_result["mapping"],
        file.filename,
        list(reader.fieldnames),
    )

    return {
        "model_type": model_type,
        "headers": list(reader.fieldnames),
        "mapping": mapping_result["mapping"],
        "required_fields": CSV_REQUIRED_FIELDS[model_type],
        "unresolved_required": mapping_result["unresolved_required"],
        "ready_to_import": mapping_result["ready"] and validation["valid_rows"] > 0,
        "validation": validation,
    }


# --------------------------------------------------
# TRAINING STATS
# --------------------------------------------------
@router.get("/training/stats")
async def get_training_stats(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get statistics on collected training data.
    Shows counts of sentiment and credibility feedback.
    """
    stats = await TrainingDataService.get_training_stats(db)
    model_info = ModelFineTuningService.get_model_info()

    # Split counts for model cards: internal project data vs external CSV imports.
    sentiment_internal_samples = int((stats.get("sentiment") or {}).get("unused", 0))
    credibility_internal_samples = int((stats.get("credibility") or {}).get("ready_for_training", 0))
    sentiment_external_samples = int((stats.get("sentiment") or {}).get("external_unused", 0))
    credibility_external_samples = int((stats.get("credibility") or {}).get("external_ready_for_training", 0))
    sentiment_combined_samples = int((stats.get("sentiment") or {}).get("combined_unused", sentiment_internal_samples + sentiment_external_samples))
    credibility_combined_samples = int((stats.get("credibility") or {}).get("combined_ready_for_training", credibility_internal_samples + credibility_external_samples))

    def _get_mtime(path):
        try:
            if path:
                return datetime.utcfromtimestamp(os.path.getmtime(path)).isoformat()
        except Exception:
            return None

    sentiment_last = _get_mtime(model_info.get("sentiment", {}).get("fine_tuned_path"))
    credibility_last = _get_mtime(model_info.get("credibility", {}).get("fine_tuned_path"))

    # Recent fine-tune jobs from audit logs
    recent_jobs = []
    try:
        cursor = db.admin_audit_logs.find({"action": "fine_tune"}).sort("created_at", -1).limit(10)
        async for doc in cursor:
            details = doc.get("details", {})
            normalized_status = details.get("status")
            if normalized_status == "success":
                normalized_status = "completed"
            elif normalized_status == "error":
                normalized_status = "failed"

            recent_jobs.append({
                "model": doc.get("resource_type", "unknown").replace("_model", ""),
                "date": doc.get("created_at").isoformat() if doc.get("created_at") else None,
                "samples": details.get("samples_used") or details.get("samples_available") or details.get("min_samples"),
                "samples_used": details.get("samples_used"),
                "samples_available": details.get("samples_available"),
                "min_required": details.get("min_required") or details.get("min_samples"),
                "status": normalized_status or ("completed" if doc.get("success", True) else "failed"),
                "training_loss": details.get("training_loss"),
                "eval_loss": details.get("eval_loss"),
                "duration_seconds": details.get("duration_seconds"),
            })

        # Derive last_trained from audit logs for more reliable tracking
        try:
            sentiment_last_audit = await db.admin_audit_logs.find_one(
                {"action": "fine_tune", "resource_type": "sentiment_model", "details.status": "success"},
                sort=[("created_at", -1)]
            )
            if sentiment_last_audit:
                sentiment_last = sentiment_last_audit.get("created_at").isoformat() if sentiment_last_audit.get("created_at") else sentiment_last
        
            credibility_last_audit = await db.admin_audit_logs.find_one(
                {"action": "fine_tune", "resource_type": "credibility_model", "details.status": "success"},
                sort=[("created_at", -1)]
            )
            if credibility_last_audit:
                credibility_last = credibility_last_audit.get("created_at").isoformat() if credibility_last_audit.get("created_at") else credibility_last
        except Exception:
            pass
    except Exception:
        recent_jobs = []

    return {
        "training_data": stats,
        "models": model_info,
        "sentiment_model": {
            "last_trained": sentiment_last,
            "training_samples": sentiment_internal_samples,
            "internal_training_samples": sentiment_internal_samples,
            "external_training_samples": sentiment_external_samples,
            "combined_training_samples": sentiment_combined_samples,
            "min_required_samples": 50,
            "samples_shortfall": max(0, 50 - sentiment_internal_samples),
        },
        "credibility_model": {
            "last_trained": credibility_last,
            "training_samples": credibility_internal_samples,
            "internal_training_samples": credibility_internal_samples,
            "external_training_samples": credibility_external_samples,
            "combined_training_samples": credibility_combined_samples,
            "min_required_samples": 30,
            "samples_shortfall": max(0, 30 - credibility_internal_samples),
        },
        "recent_jobs": recent_jobs,
    }


# --------------------------------------------------
# FINE-TUNE SENTIMENT MODEL
# --------------------------------------------------
@router.post("/fine-tune/sentiment")
async def fine_tune_sentiment_model(
    min_samples: int = 50,
    epochs: int = 3,
    data_source: str = "internal",
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of the sentiment analysis model.
    Uses collected user feedback data.
    
    Args:
        min_samples: Minimum samples required to start training
        epochs: Number of training epochs
    """
    admin_id = get_user_id(user)
    logger.info(f"[ADMIN] Fine-tune sentiment requested by user={admin_id}")
    
    result = await ModelFineTuningService.fine_tune_sentiment(
        db=db,
        min_samples=min_samples,
        epochs=epochs,
        data_source=data_source if data_source in ["internal", "external", "combined"] else "internal",
    )
    
    # Log to audit trail
    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="fine_tune",
        resource_type="sentiment_model",
        details={
            "min_samples": min_samples,
            "epochs": epochs,
            "status": result.get("status"),
            "samples_used": result.get("samples_used"),
            "samples_available": result.get("samples_available"),
            "min_required": result.get("min_required"),
            "data_source": result.get("data_source", data_source),
            "training_loss": result.get("training_loss"),
            "eval_loss": result.get("eval_loss"),
            "duration_seconds": result.get("duration_seconds"),
        },
        success=result.get("status") in ["success", "skipped"],
    )
    
    return result


# --------------------------------------------------
# FINE-TUNE CREDIBILITY MODEL
# --------------------------------------------------
@router.post("/fine-tune/credibility")
async def fine_tune_credibility_model(
    min_samples: int = 30,
    epochs: int = 3,
    data_source: str = "internal",
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of the credibility/fake-news detection model.
    Only uses verified or multi-reported samples.
    
    Args:
        min_samples: Minimum samples required to start training
        epochs: Number of training epochs
    """
    admin_id = get_user_id(user)
    logger.info(f"[ADMIN] Fine-tune credibility requested by user={admin_id}")
    
    result = await ModelFineTuningService.fine_tune_credibility(
        db=db,
        min_samples=min_samples,
        epochs=epochs,
        data_source=data_source if data_source in ["internal", "external", "combined"] else "internal",
    )
    
    # Log to audit trail
    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="fine_tune",
        resource_type="credibility_model",
        details={
            "min_samples": min_samples,
            "epochs": epochs,
            "status": result.get("status"),
            "samples_used": result.get("samples_used"),
            "samples_available": result.get("samples_available"),
            "min_required": result.get("min_required"),
            "data_source": result.get("data_source", data_source),
            "training_loss": result.get("training_loss"),
            "eval_loss": result.get("eval_loss"),
            "duration_seconds": result.get("duration_seconds"),
        },
        success=result.get("status") in ["success", "skipped"],
    )
    
    return result


# --------------------------------------------------
# FINE-TUNE ALL MODELS
# --------------------------------------------------
@router.post("/fine-tune/all")
async def fine_tune_all_models(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Trigger fine-tuning of all ML models.
    """
    logger.info(f"[ADMIN] Fine-tune all requested by user={get_user_id(user)}")
    
    result = await ModelFineTuningService.fine_tune_all(db)
    
    return result


# --------------------------------------------------
# TUNING API COMPATIBILITY (USED BY FRONTEND MODELTUNING PAGE)
# --------------------------------------------------
@router.post("/tuning/start")
async def start_fine_tuning_with_hyperparameters(
    request_body: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    admin_id = get_user_id(user)

    model_type = str(request_body.get("model_type", "")).lower()
    if model_type not in ["sentiment", "credibility"]:
        raise HTTPException(status_code=400, detail="model_type must be 'sentiment' or 'credibility'")

    min_samples = int(request_body.get("min_samples") or (50 if model_type == "sentiment" else 30))
    data_source = str(request_body.get("data_source") or "internal").strip().lower()
    if data_source not in ["internal", "external", "combined"]:
        raise HTTPException(status_code=400, detail="data_source must be 'internal', 'external', or 'combined'")
    hyperparams = request_body.get("hyperparameters") or {}
    job_id = str(ObjectId())
    now = datetime.utcnow()

    learning_rate = float(hyperparams.get("learning_rate", 0.0001))
    epochs = int(hyperparams.get("epochs", 5))
    batch_size = int(hyperparams.get("batch_size", 32))
    optimizer = str(hyperparams.get("optimizer", "AdamW"))
    warmup_steps = int(hyperparams.get("warmup_steps", 100))
    dropout = float(hyperparams.get("dropout", 0.1))

    audit_insert = await db.admin_audit_logs.insert_one(
        {
            "admin_user_id": admin_id,
            "action": "fine_tune",
            "resource_type": f"{model_type}_model",
            "resource_id": None,
            "details": {
                "job_id": job_id,
                "status": "running",
                "message": "Fine-tuning started",
                "min_samples": min_samples,
                "data_source": data_source,
                "learning_rate": learning_rate,
                "epochs": epochs,
                "batch_size": batch_size,
                "optimizer": optimizer,
                "warmup_steps": warmup_steps,
                "dropout": dropout,
            },
            "success": True,
            "error_message": None,
            "created_at": now,
            "ip_address": None,
        }
    )

    await db.tuning_job_logs.insert_many(
        [
            {
                "job_id": job_id,
                "model_type": model_type,
                "event": "queued",
                "message": f"{model_type} fine-tuning queued",
                "epoch": 0,
                "step": 0,
                "timestamp": now,
            },
            {
                "job_id": job_id,
                "model_type": model_type,
                "event": "running",
                "message": f"{model_type} fine-tuning started",
                "epoch": 0,
                "step": 1,
                "timestamp": now,
            },
        ]
    )

    cancellation_event = threading.Event()

    async def _runner() -> None:
        try:
            if model_type == "sentiment":
                result = await ModelFineTuningService.fine_tune_sentiment(
                    db=db,
                    min_samples=min_samples,
                    epochs=epochs,
                    batch_size=batch_size,
                    learning_rate=learning_rate,
                    optimizer=optimizer,
                    warmup_steps=warmup_steps,
                    dropout=dropout,
                    data_source=data_source,
                    job_id=job_id,
                    cancellation_event=cancellation_event,
                )
            else:
                result = await ModelFineTuningService.fine_tune_credibility(
                    db=db,
                    min_samples=min_samples,
                    epochs=epochs,
                    batch_size=batch_size,
                    learning_rate=learning_rate,
                    optimizer=optimizer,
                    warmup_steps=warmup_steps,
                    dropout=dropout,
                    data_source=data_source,
                    job_id=job_id,
                    cancellation_event=cancellation_event,
                )

            final_status = result.get("status", "success")
            final_message = result.get("message") or f"{model_type} fine-tuning {final_status}"

            await db.admin_audit_logs.update_one(
                {"_id": audit_insert.inserted_id},
                {
                    "$set": {
                        "details.status": final_status,
                        "details.message": final_message,
                        "details.data_source": result.get("data_source", data_source),
                        "details.warning_message": result.get("warning_message"),
                        "details.samples_used": result.get("samples_used"),
                        "details.samples_used_internal": result.get("samples_used_internal"),
                        "details.samples_used_external": result.get("samples_used_external"),
                        "details.samples_available": result.get("samples_available"),
                        "details.samples_remaining": result.get("samples_remaining"),
                        "details.min_required": result.get("min_required"),
                        "details.training_loss": result.get("training_loss"),
                        "details.eval_loss": result.get("eval_loss"),
                        "details.accuracy": result.get("accuracy"),
                        "details.f1_score": result.get("f1_score"),
                        "details.epochs_completed": result.get("epochs_completed"),
                        "details.artifact_saved": result.get("artifact_saved"),
                        "details.duration_seconds": result.get("duration_seconds"),
                        "success": final_status in ["success", "skipped"],
                    }
                },
            )

            await db.tuning_job_logs.insert_one(
                {
                    "job_id": job_id,
                    "model_type": model_type,
                    "event": "completed" if final_status in ["success", "skipped"] else "failed",
                    "message": final_message,
                    "epoch": 9999,
                    "step": 9999,
                    "loss": result.get("training_loss"),
                    "eval_loss": result.get("eval_loss"),
                    "accuracy": result.get("accuracy"),
                    "f1_score": result.get("f1_score"),
                    "timestamp": datetime.utcnow(),
                }
            )
        except asyncio.CancelledError:
            existing_audit = await db.admin_audit_logs.find_one(
                {"_id": audit_insert.inserted_id},
                projection={"details.status": 1},
            )
            current_status = (existing_audit or {}).get("details", {}).get("status")
            if current_status != "cancelled":
                await db.admin_audit_logs.update_one(
                    {"_id": audit_insert.inserted_id},
                    {
                        "$set": {
                            "details.status": "cancelled",
                            "details.message": "Fine-tuning cancelled",
                            "success": False,
                            "error_message": "cancelled by admin",
                        }
                    },
                )
                await db.tuning_job_logs.insert_one(
                    {
                        "job_id": job_id,
                        "model_type": model_type,
                        "event": "cancelled",
                        "message": "Fine-tuning cancelled",
                        "epoch": 9999,
                        "step": 9999,
                        "timestamp": datetime.utcnow(),
                    }
                )
            raise
        except Exception as e:
            await db.admin_audit_logs.update_one(
                {"_id": audit_insert.inserted_id},
                {
                    "$set": {
                        "details.status": "failed",
                        "details.message": str(e),
                        "success": False,
                        "error_message": str(e),
                    }
                },
            )
            await db.tuning_job_logs.insert_one(
                {
                    "job_id": job_id,
                    "model_type": model_type,
                    "event": "failed",
                    "message": str(e),
                    "epoch": 9999,
                    "step": 9999,
                    "timestamp": datetime.utcnow(),
                }
            )
        finally:
            RUNNING_TUNING_TASKS.pop(job_id, None)
            RUNNING_TUNING_STOP_EVENTS.pop(job_id, None)

    task = asyncio.create_task(_runner())
    RUNNING_TUNING_TASKS[job_id] = task
    RUNNING_TUNING_STOP_EVENTS[job_id] = cancellation_event

    return {
        "status": "running",
        "job_id": job_id,
        "model": model_type,
        "data_source": data_source,
        "message": f"{model_type} fine-tuning started",
    }


@router.post("/tuning/cancel/{job_id}")
async def cancel_fine_tuning(job_id: str, user=Depends(require_admin), db=Depends(get_db)):
    admin_id = get_user_id(user)

    task = RUNNING_TUNING_TASKS.get(job_id)
    stop_event = RUNNING_TUNING_STOP_EVENTS.get(job_id)
    if task and not task.done():
        if stop_event:
            stop_event.set()
        await db.admin_audit_logs.update_one(
            {
                "action": "fine_tune",
                "details.job_id": job_id,
            },
            {
                "$set": {
                    "details.status": "cancelled",
                    "details.message": f"Cancelled by admin {admin_id}",
                    "success": False,
                    "error_message": "cancelled by admin",
                }
            },
        )
        await db.tuning_job_logs.insert_one(
            {
                "job_id": job_id,
                "event": "cancelled",
                "message": f"Cancelled by admin {admin_id}",
                "timestamp": datetime.utcnow(),
            }
        )
        return {
            "status": "cancelled",
            "job_id": job_id,
            "message": "Fine-tuning cancelled",
        }

    # Fallback for stale UI state: convert running/queued audit rows to cancelled.
    update_result = await db.admin_audit_logs.update_one(
        {
            "action": "fine_tune",
            "details.job_id": job_id,
            "details.status": {"$in": ["running", "queued"]},
        },
        {
            "$set": {
                "details.status": "cancelled",
                "details.message": f"Cancelled by admin {admin_id}",
                "success": False,
                "error_message": "cancelled by admin",
            }
        },
    )

    if update_result.modified_count > 0:
        await db.tuning_job_logs.insert_one(
            {
                "job_id": job_id,
                "event": "cancelled",
                "message": f"Cancelled by admin {admin_id}",
                "timestamp": datetime.utcnow(),
            }
        )
        return {
            "status": "cancelled",
            "job_id": job_id,
            "message": "Fine-tuning job cancelled",
        }

    return {
        "status": "not_running",
        "job_id": job_id,
        "message": "Job is already finished or not found",
    }


@router.delete("/tuning/jobs/{job_id}")
async def delete_tuning_job(job_id: str, user=Depends(require_admin), db=Depends(get_db)):
    task = RUNNING_TUNING_TASKS.get(job_id)
    if task and not task.done():
        raise HTTPException(status_code=409, detail="Cannot delete a running job")

    audit_delete = await db.admin_audit_logs.delete_many(
        {
            "action": "fine_tune",
            "details.job_id": job_id,
        }
    )
    logs_delete = await db.tuning_job_logs.delete_many({"job_id": job_id})
    metrics_delete = await db.tuning_model_metrics.delete_many({"job_id": job_id})
    versions_delete = await db.tuning_model_versions.delete_many({"source_job_id": job_id})

    return {
        "job_id": job_id,
        "deleted": {
            "audit_logs": audit_delete.deleted_count,
            "tuning_logs": logs_delete.deleted_count,
            "metrics": metrics_delete.deleted_count,
            "versions": versions_delete.deleted_count,
        },
    }


@router.get("/tuning/jobs")
async def get_tuning_jobs(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    model_type: Optional[str] = None,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    query = {"action": "fine_tune"}
    if model_type:
        query["resource_type"] = f"{model_type.lower()}_model"
    if status and status != "all":
        query["details.status"] = status

    total = await db.admin_audit_logs.count_documents(query)
    skip = (page - 1) * page_size

    jobs = []
    cursor = db.admin_audit_logs.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    async for doc in cursor:
        details = doc.get("details", {})
        jobs.append(
            {
                "id": details.get("job_id") or str(doc.get("_id")),
                "job_id": details.get("job_id") or str(doc.get("_id")),
                "model": doc.get("resource_type", "unknown").replace("_model", ""),
                "date": doc.get("created_at").isoformat() if doc.get("created_at") else None,
                "samples": details.get("samples_used") or details.get("samples_available") or details.get("min_samples"),
                "samples_used": details.get("samples_used"),
                "samples_available": details.get("samples_available"),
                "min_required": details.get("min_required") or details.get("min_samples"),
                "status": details.get("status") or ("completed" if doc.get("success", True) else "failed"),
                "message": details.get("message"),
                "training_loss": details.get("training_loss"),
                "eval_loss": details.get("eval_loss"),
                "duration_seconds": details.get("duration_seconds"),
            }
        )

    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "jobs": jobs,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


@router.get("/tuning/logs/{job_id}")
async def get_tuning_logs(job_id: str, user=Depends(require_admin), db=Depends(get_db)):
    logs = []
    cursor = db.tuning_job_logs.find({"job_id": job_id}).sort([("epoch", 1), ("step", 1), ("timestamp", 1)])
    async for item in cursor:
        logs.append(
            {
                "job_id": item.get("job_id"),
                "model_type": item.get("model_type"),
                "event": item.get("event"),
                "message": item.get("message"),
                "epoch": item.get("epoch"),
                "step": item.get("step"),
                "loss": item.get("loss"),
                "eval_loss": item.get("eval_loss"),
                "accuracy": item.get("accuracy"),
                "f1_score": item.get("f1_score"),
                "learning_rate": item.get("learning_rate"),
                "timestamp": item.get("timestamp").isoformat() if item.get("timestamp") else None,
            }
        )
    return {"job_id": job_id, "logs": logs}


@router.websocket("/tuning/logs/ws/{job_id}")
async def tuning_logs_websocket(websocket: WebSocket, job_id: str, db=Depends(get_db)):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = await _validate_token(token)
        if not payload.get("is_admin"):
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    known_count_raw = websocket.query_params.get("known_count", "0")
    try:
        known_count = max(0, int(known_count_raw))
    except ValueError:
        known_count = 0

    try:
        while True:
            logs = []
            cursor = db.tuning_job_logs.find({"job_id": job_id}).sort([("epoch", 1), ("step", 1), ("timestamp", 1)])
            async for item in cursor:
                logs.append(
                    {
                        "job_id": item.get("job_id"),
                        "model_type": item.get("model_type"),
                        "event": item.get("event"),
                        "message": item.get("message"),
                        "epoch": item.get("epoch"),
                        "step": item.get("step"),
                        "loss": item.get("loss"),
                        "eval_loss": item.get("eval_loss"),
                        "accuracy": item.get("accuracy"),
                        "f1_score": item.get("f1_score"),
                        "learning_rate": item.get("learning_rate"),
                        "timestamp": item.get("timestamp").isoformat() if item.get("timestamp") else None,
                    }
                )

            if len(logs) != known_count:
                await websocket.send_json({"type": "snapshot", "job_id": job_id, "logs": logs})
                known_count = len(logs)

            await asyncio.sleep(1.2)
    except WebSocketDisconnect:
        logger.info(f"[ADMIN] Live log websocket disconnected for job={job_id}")
    except Exception as e:
        logger.warning(f"[ADMIN] Live log websocket error for job={job_id}: {str(e)}")


@router.get("/tuning/metrics/{model_type}")
async def get_tuning_metrics(model_type: str, user=Depends(require_admin), db=Depends(get_db)):
    model_type = model_type.lower()
    if model_type not in ["sentiment", "credibility"]:
        raise HTTPException(status_code=400, detail="model_type must be 'sentiment' or 'credibility'")

    latest = await db.tuning_model_metrics.find_one({"model_type": model_type}, sort=[("created_at", -1)])
    if latest:
        return {
            "model_type": model_type,
            "accuracy": latest.get("accuracy"),
            "f1_score": latest.get("f1_score"),
            "loss": latest.get("loss"),
            "eval_loss": latest.get("eval_loss"),
            "model_health": latest.get("model_health"),
            "last_updated": latest.get("created_at").isoformat() if latest.get("created_at") else None,
        }

    return {
        "model_type": model_type,
        "accuracy": None,
        "f1_score": None,
        "loss": None,
        "eval_loss": None,
        "model_health": None,
        "last_updated": None,
    }


@router.get("/tuning/data-quality/{model_type}")
async def get_tuning_data_quality(model_type: str, user=Depends(require_admin), db=Depends(get_db)):
    model_type = model_type.lower()
    if model_type not in ["sentiment", "credibility"]:
        raise HTTPException(status_code=400, detail="model_type must be 'sentiment' or 'credibility'")

    return await _build_model_data_quality(db, model_type)


@router.get("/tuning/versions/{model_type}")
async def get_tuning_versions(model_type: str, user=Depends(require_admin), db=Depends(get_db)):
    model_type = model_type.lower()
    if model_type not in ["sentiment", "credibility"]:
        raise HTTPException(status_code=400, detail="model_type must be 'sentiment' or 'credibility'")

    versions = []
    cursor = db.tuning_model_versions.find({"model_type": model_type}).sort("version", -1)
    async for item in cursor:
        versions.append(
            {
                "version": item.get("version"),
                "sample_count": item.get("sample_count"),
                "accuracy": item.get("accuracy"),
                "f1_score": item.get("f1_score"),
                "loss": item.get("loss"),
                "eval_loss": item.get("eval_loss"),
                "created_at": item.get("created_at").isoformat() if item.get("created_at") else None,
                "checkpoint_path": item.get("checkpoint_path"),
                "source_job_id": item.get("source_job_id"),
                "is_active": bool(item.get("is_active", False)),
            }
        )
    return {"model_type": model_type, "versions": versions}


# --------------------------------------------------
# PENDING CREDIBILITY REPORTS
# --------------------------------------------------
@router.get("/reports/pending")
async def get_pending_reports(
    limit: int = 50,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get pending credibility reports for admin review.
    """
    cursor = db.credibility_training.find(
        {"verification_status": "pending"}
    ).sort("report_count", -1).limit(limit)
    
    reports = []
    async for doc in cursor:
        reports.append({
            "id": str(doc["_id"]),
            "article_id": doc["article_id"],
            "title": doc["title"],
            "article_url": doc["article_url"],
            "source_domain": doc.get("source_domain"),
            "ai_label": doc["ai_label"],
            "ai_score": doc["ai_score"],
            "user_reason": doc.get("user_reason"),
            "report_count": doc.get("report_count", 1),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })
    
    return {
        "count": len(reports),
        "reports": reports,
    }


# --------------------------------------------------
# VERIFY REPORT
# --------------------------------------------------
@router.post("/reports/{report_id}/verify")
async def verify_report(
    report_id: str,
    verified: bool = True,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Verify or reject a credibility report.
    
    Args:
        report_id: Report document ID
        verified: True = confirmed misleading, False = rejected
    """
    admin_id = get_user_id(user)
    
    success = await TrainingDataService.verify_credibility_report(
        db=db,
        report_id=report_id,
        admin_id=admin_id,
        verified=verified,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    
    status = "verified" if verified else "rejected"
    logger.info(f"[ADMIN] Report {report_id} {status} by {admin_id}")
    
    # Log to audit trail
    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="verify_report" if verified else "reject_report",
        resource_type="credibility_report",
        resource_id=report_id,
        details={"status": status},
        success=True,
    )
    
    return {
        "message": f"Report {status}",
        "report_id": report_id,
        "status": status,
    }


# --------------------------------------------------
# SENTIMENT FEEDBACK LIST
# --------------------------------------------------
@router.get("/feedback/sentiment")
async def get_sentiment_feedback(
    limit: int = 100,
    offset: int = 0,
    source: Optional[str] = None,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get collected sentiment feedback for review.
    
    Args:
        limit: Maximum records to return
        offset: Records to skip for pagination
        source: Filter by source type (explicit, implicit_bookmark, implicit_read_later)
    """
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be >= 0")

    query = {}
    if source:
        query["source"] = source
    
    cursor = db.sentiment_training.find(query).sort("created_at", -1).skip(offset).limit(limit)
    
    feedback = []
    async for doc in cursor:
        feedback.append({
            "id": str(doc["_id"]),
            "article_id": doc["article_id"],
            "article_url": doc.get("article_url"),
            "text": doc.get("text", ""),
            "ai_label": doc["ai_label"],
            "ai_confidence": doc["ai_confidence"],
            "user_label": doc.get("user_label"),
            "final_label": doc.get("final_label"),
            "source": doc["source"],
            "review_flag": doc.get("review_flag", False),
            "review_reason": doc.get("review_reason"),
            "used_for_training": doc.get("used_for_training", False),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
            "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
            "sentiment_history": doc.get("sentiment_history", []),
        })
    
    return {
        "limit": limit,
        "offset": offset,
        "count": len(feedback),
        "feedback": feedback,
    }


@router.get("/sentiment/trends")
async def get_sentiment_trends(
    days: int = 30,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Return daily sentiment counts and ratios for trend visualization."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    since = datetime.utcnow() - timedelta(days=days - 1)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$project": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "label": {
                    "$toLower": {
                        "$ifNull": ["$final_label", "$ai_label"]
                    }
                },
            }
        },
        {
            "$project": {
                "date": 1,
                "normalized_label": {
                    "$switch": {
                        "branches": [
                            {"case": {"$regexMatch": {"input": "$label", "regex": "pos"}}, "then": "positive"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neu"}}, "then": "neutral"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neg"}}, "then": "negative"},
                        ],
                        "default": "neutral",
                    }
                },
            }
        },
        {
            "$group": {
                "_id": {"date": "$date", "label": "$normalized_label"},
                "count": {"$sum": 1},
            }
        },
    ]

    data_map = {}
    cursor = db.sentiment_training.aggregate(pipeline)
    async for doc in cursor:
        day = doc["_id"]["date"]
        label = doc["_id"]["label"]
        count = int(doc.get("count", 0))
        if day not in data_map:
            data_map[day] = {"positive": 0, "neutral": 0, "negative": 0}
        data_map[day][label] = count

    points = []
    now = datetime.utcnow()
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        c = data_map.get(d, {"positive": 0, "neutral": 0, "negative": 0})
        total = c["positive"] + c["neutral"] + c["negative"]
        points.append({
            "date": d,
            "positive": c["positive"],
            "neutral": c["neutral"],
            "negative": c["negative"],
            "total": total,
            "positive_ratio": round((c["positive"] / total) * 100, 1) if total else 0,
            "neutral_ratio": round((c["neutral"] / total) * 100, 1) if total else 0,
            "negative_ratio": round((c["negative"] / total) * 100, 1) if total else 0,
        })

    return {"days": days, "points": points}


@router.get("/sentiment/heatmap")
async def get_sentiment_heatmap(
    days: int = 30,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Return source x sentiment matrix counts for heatmap visualization."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    since = datetime.utcnow() - timedelta(days=days - 1)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$project": {
                "source": {"$ifNull": ["$source", "unknown"]},
                "label": {
                    "$toLower": {
                        "$ifNull": ["$final_label", "$ai_label"]
                    }
                },
            }
        },
        {
            "$project": {
                "source": 1,
                "normalized_label": {
                    "$switch": {
                        "branches": [
                            {"case": {"$regexMatch": {"input": "$label", "regex": "pos"}}, "then": "positive"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neu"}}, "then": "neutral"},
                            {"case": {"$regexMatch": {"input": "$label", "regex": "neg"}}, "then": "negative"},
                        ],
                        "default": "neutral",
                    }
                },
            }
        },
        {
            "$group": {
                "_id": {"source": "$source", "label": "$normalized_label"},
                "count": {"$sum": 1},
            }
        },
    ]

    matrix = {}
    max_count = 0
    cursor = db.sentiment_training.aggregate(pipeline)
    async for doc in cursor:
        source_name = doc["_id"]["source"]
        label = doc["_id"]["label"]
        count = int(doc.get("count", 0))
        if source_name not in matrix:
            matrix[source_name] = {"positive": 0, "neutral": 0, "negative": 0}
        matrix[source_name][label] = count
        if count > max_count:
            max_count = count

    sources = sorted(matrix.keys())
    cells = []
    for source_name in sources:
        for label in ["positive", "neutral", "negative"]:
            value = matrix[source_name].get(label, 0)
            intensity = round(value / max_count, 3) if max_count else 0
            cells.append({
                "source": source_name,
                "sentiment": label,
                "value": value,
                "intensity": intensity,
            })

    return {
        "days": days,
        "sources": sources,
        "sentiments": ["positive", "neutral", "negative"],
        "max": max_count,
        "cells": cells,
    }


@router.patch("/feedback/sentiment/{feedback_id}/override-label")
async def override_sentiment_label(
    feedback_id: str,
    payload: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Allow admin to manually override final sentiment label for a feedback item."""
    admin_id = get_user_id(user)
    new_label = str(payload.get("new_label", "")).strip().lower()
    reason = str(payload.get("reason", "")).strip() or None

    if new_label not in {"positive", "neutral", "negative"}:
        raise HTTPException(status_code=400, detail="new_label must be one of positive, neutral, negative")

    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    existing = await db.sentiment_training.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Feedback not found")

    old_label = existing.get("final_label") or existing.get("ai_label")
    history_entry = {
        "type": "manual_override",
        "old_label": old_label,
        "new_label": new_label,
        "reason": reason,
        "changed_by": admin_id,
        "changed_at": datetime.utcnow().isoformat() + "Z",
    }

    await db.sentiment_training.update_one(
        {"_id": oid},
        {
            "$set": {
                "final_label": new_label,
                "user_label": new_label,
                "updated_at": datetime.utcnow(),
            },
            "$push": {"sentiment_history": history_entry},
        },
    )

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="override_sentiment_label",
        resource_type="sentiment_feedback",
        resource_id=feedback_id,
        details={"old_label": old_label, "new_label": new_label, "reason": reason},
        success=True,
    )

    return {
        "message": "Sentiment label overridden",
        "id": feedback_id,
        "old_label": old_label,
        "new_label": new_label,
    }


@router.patch("/feedback/sentiment/{feedback_id}/flag")
async def flag_sentiment_feedback(
    feedback_id: str,
    payload: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Mark/unmark feedback for review with optional reason."""
    admin_id = get_user_id(user)
    flagged = bool(payload.get("flagged", True))
    reason = str(payload.get("reason", "")).strip() or None

    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    result = await db.sentiment_training.update_one(
        {"_id": oid},
        {
            "$set": {
                "review_flag": flagged,
                "review_reason": reason,
                "flagged_by": admin_id if flagged else None,
                "flagged_at": datetime.utcnow() if flagged else None,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="flag_sentiment_feedback" if flagged else "unflag_sentiment_feedback",
        resource_type="sentiment_feedback",
        resource_id=feedback_id,
        details={"flagged": flagged, "reason": reason},
        success=True,
    )

    return {
        "message": "Feedback flagged for review" if flagged else "Feedback unflagged",
        "id": feedback_id,
        "flagged": flagged,
        "reason": reason,
    }


@router.post("/feedback/sentiment/{feedback_id}/reanalyze")
async def reanalyze_sentiment_feedback(
    feedback_id: str,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Re-run sentiment analysis for a feedback entry using the latest model."""
    admin_id = get_user_id(user)

    try:
        oid = ObjectId(feedback_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    existing = await db.sentiment_training.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Feedback not found")

    text = existing.get("text") or ""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Feedback text is empty; cannot re-analyze")

    previous_ai_label = existing.get("ai_label")
    previous_ai_confidence = existing.get("ai_confidence")
    previous_final_label = existing.get("final_label")

    result = await SentimentService.analyze(text)
    new_ai_label = result.get("label", "Neutral")
    new_ai_confidence = float(result.get("confidence", 1.0))

    # Preserve explicit manual label if present; otherwise keep final label aligned to AI output.
    preserved_user_label = existing.get("user_label")
    new_final_label = preserved_user_label or new_ai_label

    history_entry = {
        "type": "reanalyze",
        "old_label": previous_ai_label,
        "new_label": new_ai_label,
        "previous_final_label": previous_final_label,
        "new_final_label": new_final_label,
        "previous_confidence": previous_ai_confidence,
        "new_confidence": new_ai_confidence,
        "changed_by": admin_id,
        "changed_at": datetime.utcnow().isoformat() + "Z",
    }

    await db.sentiment_training.update_one(
        {"_id": oid},
        {
            "$set": {
                "ai_label": new_ai_label,
                "ai_confidence": new_ai_confidence,
                "final_label": new_final_label,
                "updated_at": datetime.utcnow(),
            },
            "$push": {"sentiment_history": history_entry},
        },
    )

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="reanalyze_sentiment_feedback",
        resource_type="sentiment_feedback",
        resource_id=feedback_id,
        details={
            "previous_ai_label": previous_ai_label,
            "new_ai_label": new_ai_label,
            "previous_final_label": previous_final_label,
            "new_final_label": new_final_label,
            "previous_ai_confidence": previous_ai_confidence,
            "new_ai_confidence": new_ai_confidence,
        },
        success=True,
    )

    return {
        "message": "Feedback re-analyzed",
        "id": feedback_id,
        "previous_ai_label": previous_ai_label,
        "new_ai_label": new_ai_label,
        "previous_ai_confidence": previous_ai_confidence,
        "new_ai_confidence": new_ai_confidence,
        "new_final_label": new_final_label,
        "sentiment_history": history_entry,
    }


def _default_anomaly_config() -> dict:
    return {
        "window_hours": 24,
        "negative_threshold": 50,
        "minimum_samples": 20,
    }


async def _get_anomaly_config(db) -> dict:
    config = _default_anomaly_config()
    doc = await db.admin_settings.find_one({"key": "sentiment_anomaly_config"})
    if doc and isinstance(doc.get("value"), dict):
        value = doc["value"]
        if isinstance(value.get("window_hours"), int):
            config["window_hours"] = value["window_hours"]
        if isinstance(value.get("negative_threshold"), (int, float)):
            config["negative_threshold"] = value["negative_threshold"]
        if isinstance(value.get("minimum_samples"), int):
            config["minimum_samples"] = value["minimum_samples"]
    return config


@router.get("/sentiment/anomaly-config")
async def get_sentiment_anomaly_config(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Return the current sentiment anomaly detection settings."""
    return await _get_anomaly_config(db)


@router.put("/sentiment/anomaly-config")
async def update_sentiment_anomaly_config(
    payload: dict = Body(...),
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Persist sentiment anomaly detection settings."""
    admin_id = get_user_id(user)
    current = await _get_anomaly_config(db)

    window_hours = int(payload.get("window_hours", current["window_hours"]))
    negative_threshold = float(payload.get("negative_threshold", current["negative_threshold"]))
    minimum_samples = int(payload.get("minimum_samples", current["minimum_samples"]))

    if window_hours < 1 or window_hours > 168:
        raise HTTPException(status_code=400, detail="window_hours must be between 1 and 168")
    if negative_threshold < 0 or negative_threshold > 100:
        raise HTTPException(status_code=400, detail="negative_threshold must be between 0 and 100")
    if minimum_samples < 1 or minimum_samples > 1000:
        raise HTTPException(status_code=400, detail="minimum_samples must be between 1 and 1000")

    new_config = {
        "window_hours": window_hours,
        "negative_threshold": negative_threshold,
        "minimum_samples": minimum_samples,
    }

    await db.admin_settings.update_one(
        {"key": "sentiment_anomaly_config"},
        {
            "$set": {
                "key": "sentiment_anomaly_config",
                "value": new_config,
                "updated_at": datetime.utcnow(),
                "updated_by": admin_id,
            },
            "$setOnInsert": {"created_at": datetime.utcnow()},
        },
        upsert=True,
    )

    await AdminAuditService.log_action(
        db=db,
        admin_user_id=admin_id,
        action="update_sentiment_anomaly_config",
        resource_type="sentiment_feedback",
        details=new_config,
        success=True,
    )

    return new_config


@router.get("/sentiment/anomalies")
async def get_sentiment_anomalies(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Detect whether negative sentiment spikes above the configured threshold."""
    config = await _get_anomaly_config(db)
    window_hours = int(config["window_hours"])
    since = datetime.utcnow() - timedelta(hours=window_hours)

    cursor = db.sentiment_training.find({"created_at": {"$gte": since}})
    total = 0
    negative = 0
    positive = 0
    neutral = 0
    samples = []

    async for doc in cursor:
      total += 1
      label = str(doc.get("final_label") or doc.get("ai_label") or "neutral").lower()
      if "neg" in label:
          negative += 1
      elif "pos" in label:
          positive += 1
      else:
          neutral += 1
      samples.append({
          "id": str(doc.get("_id")),
          "article_id": doc.get("article_id"),
          "label": doc.get("final_label") or doc.get("ai_label"),
          "source": doc.get("source"),
          "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
      })

    negative_ratio = round((negative / total) * 100, 1) if total else 0
    alert = total >= config["minimum_samples"] and negative_ratio >= config["negative_threshold"]

    return {
        "window_hours": window_hours,
        "minimum_samples": config["minimum_samples"],
        "negative_threshold": config["negative_threshold"],
        "total": total,
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "negative_ratio": negative_ratio,
        "alert": alert,
        "message": (
            f"Negative sentiment is {negative_ratio}% over the last {window_hours}h, which is above the {config['negative_threshold']}% threshold."
            if alert else
            "No negative sentiment anomaly detected."
        ),
        "samples": samples[:10],
    }


# --------------------------------------------------
# AUDIT LOG
# --------------------------------------------------
@router.get("/audit/logs")
async def get_audit_logs(
    limit: int = 100,
    admin_user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Retrieve admin audit log entries.
    
    Args:
        limit: Maximum records to return
        admin_user_id: Filter by admin user
        action: Filter by action type
        resource_type: Filter by resource type
    """
    logs = await AdminAuditService.get_audit_log(
        db=db,
        limit=limit,
        admin_user_id=admin_user_id,
        action=action,
        resource_type=resource_type,
    )
    
    return {
        "count": len(logs),
        "logs": logs,
    }


@router.get("/audit/activity-summary")
async def get_admin_activity_summary(
    admin_user_id: Optional[str] = None,
    days: int = 7,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get a summary of admin activity.
    
    Args:
        admin_user_id: Admin user ID (if None, defaults to current user)
        days: Number of days to look back
    """
    # If no admin_user_id provided, use current user
    target_admin_id = admin_user_id or get_user_id(user)
    
    summary = await AdminAuditService.get_admin_activity_summary(
        db=db,
        admin_user_id=target_admin_id,
        days=days,
    )
    
    return summary


# --------------------------------------------------
# ADMIN OVERVIEW / METRICS
# --------------------------------------------------
@router.get("/metrics")
async def get_admin_metrics(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Return aggregated admin dashboard metrics:
    - total_users: count of persisted users (if any)
    - active_this_week: distinct users active in last 7 days (bookmarks/read_later/summary_logs)
    - articles_indexed: sum of cached articles across categories
    - avg_sentiment: average sentiment score from cached articles (pos=1, neutral=0, neg=-1)
    """
    now = datetime.utcnow()
    start_week = now - timedelta(days=7)

    # total users: prefer authoritative Clerk count when available
    total_users = 0
    try:
        clerk_count = await get_clerk_user_count()
        if clerk_count is not None:
            total_users = clerk_count
        else:
            total_users = await db.users.count_documents({})
    except Exception:
        # fallback to DB count if Clerk fails
        try:
            total_users = await db.users.count_documents({})
        except Exception:
            total_users = 0

    # active this week (distinct user_ids across collections)
    active_ids = set()
    try:
        bookmarks_ids = await db.bookmarks.distinct("user_id", {"created_at": {"$gte": start_week}})
        readlater_ids = await db.read_later.distinct("user_id", {"created_at": {"$gte": start_week}})
        summary_ids = await db.summary_logs.distinct("user_id", {"created_at": {"$gte": start_week}})

        for _id in (bookmarks_ids or []):
            if _id:
                active_ids.add(_id)
        for _id in (readlater_ids or []):
            if _id:
                active_ids.add(_id)
        for _id in (summary_ids or []):
            if _id:
                active_ids.add(_id)
    except Exception:
        active_ids = set()

    active_this_week = len(active_ids)

    # articles indexed: sum cached articles for known categories
    # Prefer DB-backed articles if available; fall back to cache if DB is empty
    articles_indexed = 0
    sentiment_score_total = 0.0
    sentiment_count = 0

    try:
        # Try DB first
        try:
            articles_indexed = await db.articles.count_documents({})
        except Exception:
            articles_indexed = 0

        if articles_indexed and articles_indexed > 0:
            # compute avg sentiment from DB-stored sentiment field
            cursor = db.articles.find({"sentiment": {"$exists": True}})
            async for doc in cursor:
                sent = doc.get("sentiment")
                if sent and isinstance(sent, dict):
                    label = sent.get("label")
                    if label and isinstance(label, str):
                        l = label.lower()
                        if "pos" in l:
                            sentiment_score_total += 1
                            sentiment_count += 1
                        elif "neg" in l:
                            sentiment_score_total += -1
                            sentiment_count += 1
                        elif "neu" in l:
                            sentiment_score_total += 0
                            sentiment_count += 1
        else:
            # Fallback to cache-based calculation
            for cat in NEWS_CATEGORIES:
                cache_key = gnews_cache_key(cat)
                cached = await get_from_cache(cache_key)
                if cached and isinstance(cached, list):
                    articles_indexed += len(cached)
                    for article in cached:
                        sent = article.get("sentiment")
                        if sent and isinstance(sent, dict):
                            label = sent.get("label")
                            if label == "positive" or label == "Positive":
                                sentiment_score_total += 1
                                sentiment_count += 1
                            elif label == "negative" or label == "Negative":
                                sentiment_score_total += -1
                                sentiment_count += 1
                            elif label == "neutral" or label == "Neutral":
                                sentiment_score_total += 0
                                sentiment_count += 1
    except Exception:
        articles_indexed = articles_indexed or 0

    avg_sentiment = None
    if sentiment_count > 0:
        avg = sentiment_score_total / sentiment_count
        # convert to a simple positive ratio (0..1) for display: (avg +1)/2
        avg_sentiment = (avg + 1) / 2

    return {
        "total_users": total_users,
        "active_this_week": active_this_week,
        "articles_indexed": articles_indexed,
        "avg_sentiment": avg_sentiment,
    }


@router.get("/clerk-user-count")
async def get_clerk_user_count_endpoint(
    user=Depends(require_admin),
):
    """Return authoritative user count from Clerk (server-side)."""
    try:
        count = await get_clerk_user_count()
        if count is None:
            raise Exception("Clerk API not configured or failed")
        return {"total_users": count, "source": "clerk"}
    except Exception:
        # Fallback response when Clerk not available
        return {"total_users": None, "source": "clerk_unavailable"}


# --------------------------------------------------
# SYSTEM STATUS (Redis)
# --------------------------------------------------
@router.get("/system/status")
async def get_system_status(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Return simple system status including Redis INFO and GNews quota.
    """
    logger.info("[ADMIN] Fetching system status")
    redis_client = await get_redis()
    redis_info = {}
    total_keys = None
    try:
        if redis_client is None:
            redis_info = {"connected": False}
        else:
            info = await redis_client.info()
            # compute hit rate if possible
            hits = info.get("keyspace_hits", 0) or 0
            misses = info.get("keyspace_misses", 0) or 0
            hit_rate = None
            try:
                total = int(hits) + int(misses)
                hit_rate = (int(hits) / total) * 100 if total > 0 else None
            except Exception:
                hit_rate = None

            redis_info = {
                "connected": True,
                "used_memory_human": info.get("used_memory_human"),
                "uptime_in_seconds": info.get("uptime_in_seconds"),
                "keyspace_hits": hits,
                "keyspace_misses": misses,
                "hit_rate": hit_rate,
            }
            try:
                total_keys = await redis_client.dbsize()
            except Exception:
                total_keys = None
    except Exception:
        redis_info = {"connected": False}

    # include GNews hit status
    try:
        hits = await GNewsCounter.get_hit_status()
    except Exception:
        hits = None

    # Database ping + collections
    db_status = {"connected": False, "latency_ms": None, "collections": None}
    try:
        start = time.time()
        await db.command({"ping": 1})
        latency = (time.time() - start) * 1000
        cols = await db.list_collection_names()
        db_status = {
            "connected": True,
            "latency_ms": latency,
            "collections": len(cols) if cols is not None else None,
        }
    except Exception:
        db_status = {"connected": False}

    # Build normalized gnews info
    gnews_info = None
    try:
        if hits:
            reset_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            gnews_info = {
                "today_hits": hits.get("today_hits") if isinstance(hits, dict) else None,
                "remaining": hits.get("remaining_hits") if isinstance(hits, dict) else None,
                "limit": hits.get("max_hits") if isinstance(hits, dict) else None,
                "reset_time": reset_time.isoformat() + "Z",
            }
    except Exception:
        gnews_info = None

    return {
        "database": db_status,
        "redis": {
            "connected": redis_info.get("connected", False),
            "hit_rate": redis_info.get("hit_rate"),
            "memory_usage": redis_info.get("used_memory_human"),
        },
        "gnews": gnews_info,
    }


# --------------------------------------------------
# SENTIMENT STATS
# --------------------------------------------------
@router.get("/sentiment/stats")
async def get_sentiment_stats(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Aggregate sentiment distribution counts and percentages.
    """
    logger.info("[ADMIN] Fetching sentiment stats")
    pipeline = [
        {"$group": {"_id": "$final_label", "count": {"$sum": 1}}}
    ]

    counts = {"positive": 0, "neutral": 0, "negative": 0}
    total = 0
    try:
        cursor = db.sentiment_training.aggregate(pipeline)
        async for doc in cursor:
            label = (doc.get("_id") or "").lower()
            c = int(doc.get("count", 0))
            total += c
            if "pos" in label:
                counts["positive"] = c
            elif "neu" in label:
                counts["neutral"] = c
            elif "neg" in label:
                counts["negative"] = c
            else:
                # try mapping explicit labels
                if label == "positive":
                    counts["positive"] = c
                elif label == "neutral":
                    counts["neutral"] = c
                elif label == "negative":
                    counts["negative"] = c
    except Exception:
        # fallback to simple counts
        try:
            counts["positive"] = await db.sentiment_training.count_documents({"final_label": {"$in": ["positive", "Positive"]}})
            counts["neutral"] = await db.sentiment_training.count_documents({"final_label": {"$in": ["neutral", "Neutral"]}})
            counts["negative"] = await db.sentiment_training.count_documents({"final_label": {"$in": ["negative", "Negative"]}})
            total = counts["positive"] + counts["neutral"] + counts["negative"]
        except Exception:
            total = 0

    # compute percentages
    percentages = {"positive": 0, "neutral": 0, "negative": 0}
    if total > 0:
        percentages = {
            k: round((v / total) * 100, 1) for k, v in counts.items()
        }

    return {
        "counts": counts,
        "total": total,
        "percentages": percentages,
    }


@router.get("/metrics/hits")
async def get_hit_history(
    days: int = 7,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Return daily hit counts for the past `days` days (default 7).
    Each entry contains: { date: YYYY-MM-DD, count: int, hours: {HH: count, ...} }
    """
    if days < 1 or days > 30:
        raise HTTPException(status_code=400, detail="days must be between 1 and 30")

    results = []
    try:
        now = datetime.utcnow()
        for i in range(days - 1, -1, -1):
            d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            doc = await MetricsService.get_daily_hits(d)
            if doc:
                results.append({
                    "date": d,
                    "count": int(doc.get("count", 0)),
                    "hours": doc.get("hours", {}),
                })
            else:
                results.append({"date": d, "count": 0, "hours": {}})
    except Exception:
        logger.exception("Failed to retrieve GNews hit history", extra={"days": days})
        raise HTTPException(status_code=500, detail="Failed to retrieve hit history")

    return {"days": days, "history": results}
