from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import require_auth
from app.core.cache import get_from_cache, set_in_cache, delete_from_cache
from app.models.comment import CommentModel, CommentCreateRequest

router = APIRouter()

# Cache configuration
COMMENTS_CACHE_TTL = 300  # 5 minutes


def _to_utc_iso(value: datetime) -> str:
    dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@router.post("/")
async def add_comment(
    comment: CommentCreateRequest,
    user=Depends(require_auth),
    db=Depends(get_db),
):
    data = comment.dict()
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    data["user_id"] = user_id
    data["user_email"] = user.get("email")

    # Resolve username from stored profile first, then auth claims/email, then user_id.
    profile_doc = await db.users.find_one(
        {"user_id": user_id},
        projection={"name": 1, "username": 1, "email": 1},
    )
    profile_name = (profile_doc or {}).get("name")
    profile_username = (profile_doc or {}).get("username")
    profile_email = (profile_doc or {}).get("email")

    user_name = user.get("name")
    claim_username = user.get("username")
    user_email = user.get("email")

    email_source = profile_email or user_email
    email_local_part = email_source.split("@", 1)[0] if isinstance(email_source, str) and email_source else ""

    client_username = comment.username.strip() if isinstance(comment.username, str) and comment.username.strip() else ""
    if client_username.startswith("user_"):
        client_username = ""

    data["username"] = profile_name or profile_username or user_name or claim_username or client_username or email_local_part or data["user_id"]

    created_at = datetime.now(timezone.utc)
    data["created_at"] = created_at

    result = await db.comments.insert_one(data)
    
    # Invalidate cache for this article
    cache_key = f"comments:{data['article_id']}"
    await delete_from_cache(cache_key)

    # Return the full comment object
    return {
        "id": str(result.inserted_id),
        "_id": str(result.inserted_id),
        "article_id": data["article_id"],
        "article_title": data["article_title"],
        "text": data["text"],
        "user_id": data["user_id"],
        "username": data["username"],
        "created_at": _to_utc_iso(created_at),
    }


@router.get("/{article_id}")
async def get_comments(article_id: str, db=Depends(get_db)):
    cache_key = f"comments:{article_id}"
    
    # Try to get from cache first
    cached_data = await get_from_cache(cache_key)
    if cached_data:
        return cached_data
    
    comments = []
    cursor = db.comments.find(
        {"article_id": article_id}
    ).sort("created_at", -1)

    profile_cache: dict[str, str] = {}

    async for comment in cursor:
        comment_user_id = comment.get("user_id")
        comment_username = comment.get("username")

        # Upgrade display name for legacy comments that stored Clerk IDs as username.
        needs_profile_lookup = (
            isinstance(comment_user_id, str)
            and (
                not comment_username
                or (isinstance(comment_username, str) and comment_username.startswith("user_"))
            )
        )
        if needs_profile_lookup:
            if comment_user_id in profile_cache:
                comment["username"] = profile_cache[comment_user_id]
            else:
                profile_doc = await db.users.find_one(
                    {"user_id": comment_user_id},
                    projection={"name": 1, "username": 1, "email": 1},
                )
                resolved_username = None
                if profile_doc:
                    profile_email = profile_doc.get("email")
                    email_local_part = profile_email.split("@", 1)[0] if isinstance(profile_email, str) and profile_email else None
                    resolved_username = profile_doc.get("name") or profile_doc.get("username") or email_local_part
                if resolved_username:
                    profile_cache[comment_user_id] = resolved_username
                    comment["username"] = resolved_username

        if not comment.get("created_at") and isinstance(comment.get("_id"), ObjectId):
            # Legacy documents may not have created_at; derive from ObjectId timestamp.
            comment["created_at"] = comment["_id"].generation_time

        # Convert ObjectId to string for Pydantic validation
        comment["_id"] = str(comment["_id"])
        comment_model = CommentModel(**comment)
        # Convert to dict and ensure proper serialization
        comment_dict = {
            "id": comment_model.id or str(comment["_id"]),
            "article_id": comment_model.article_id,
            "article_title": comment_model.article_title,
            "text": comment_model.text,
            "user_id": comment_model.user_id,
            "username": comment_model.username,
            "created_at": _to_utc_iso(comment_model.created_at) if isinstance(comment_model.created_at, datetime) else str(comment_model.created_at),
        }
        comments.append(comment_dict)

    result = {
        "count": len(comments),
        "comments": comments,
    }
    
    # Cache the result
    await set_in_cache(cache_key, result, ttl=COMMENTS_CACHE_TTL)
    
    return result


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: str,
    user=Depends(require_auth),
    db=Depends(get_db),
):
    result = await db.comments.delete_one({
        "_id": ObjectId(comment_id),
        "user_id": user["user_id"],
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Comment not found or unauthorized",
        )

    return {"message": "Comment deleted successfully"}
