from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.auth import get_current_user_optional
from app.core.cache import get_from_cache, set_in_cache, delete_from_cache
from app.models.comment import CommentModel, CommentCreateRequest

router = APIRouter()

# Cache configuration
COMMENTS_CACHE_TTL = 300  # 5 minutes


@router.post("/")
async def add_comment(
    comment: CommentCreateRequest,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    data = comment.dict()
    data["user_id"] = user["user_id"]
    data["user_email"] = user.get("email")
    # Extract username from user email (part before @) or use user_id as fallback
    data["username"] = user.get("name") or user.get("email", "").split("@")[0] or user["user_id"]

    result = await db.comments.insert_one(data)
    
    # Invalidate cache for this article
    cache_key = f"comments:{data['article_id']}"
    await delete_from_cache(cache_key)

    # Return the full comment object
    from datetime import datetime
    now = datetime.utcnow()
    return {
        "id": str(result.inserted_id),
        "_id": str(result.inserted_id),
        "article_id": data["article_id"],
        "article_title": data["article_title"],
        "text": data["text"],
        "user_id": data["user_id"],
        "username": data["username"],
        "created_at": now.isoformat(),
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

    async for comment in cursor:
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
            "created_at": comment_model.created_at.isoformat() if hasattr(comment_model.created_at, 'isoformat') else str(comment_model.created_at),
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
    user=Depends(get_current_user_optional),
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
