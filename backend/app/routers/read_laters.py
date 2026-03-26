from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from app.core.database import get_db
from app.core.auth import get_user_id, require_auth
from app.models.read_later import ReadLaterModel
from app.services.training_data_service import TrainingDataService
from app.core.cache import (
    get_from_cache,
    set_in_cache,
    user_read_later_cache_key,
    invalidate_user_action_cache,
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/")
async def add_read_later(
    item: ReadLaterModel,
    user=Depends(require_auth),
    db=Depends(get_db),
):
    user_id = get_user_id(user)

    exists = await db.read_later.find_one({
        "user_id": user_id,
        "article_id": item.article_id,
    })

    if exists:
        return {
            "message": "Already in Read Later",
            "id": str(exists.get("_id")),
            "created_at": exists.get("created_at"),
        }

    data = item.dict()
    data["user_id"] = user_id

    result = await db.read_later.insert_one(data)
    await invalidate_user_action_cache(user_id, "read_later")
    
    # fetch the inserted document to return created_at
    inserted = await db.read_later.find_one({"_id": result.inserted_id})
    if inserted:
        inserted_id = str(inserted.get("_id"))
        created_at = inserted.get("created_at")
    else:
        inserted_id = str(result.inserted_id)
        created_at = None
    
    # ✅ Collect implicit sentiment feedback (read later = positive signal)
    try:
        text = item.title  # ReadLaterModel doesn't have description
        
        # Try to get sentiment from cache
        from app.core.cache import get_from_cache
        cache_key = f"gnews:{item.category}" if item.category else None
        
        ai_label = "Neutral"
        ai_confidence = 0.5
        
        if cache_key:
            cached_articles = await get_from_cache(cache_key)
            if cached_articles:
                for article in cached_articles:
                    if article.get("id") == item.article_id or article.get("url") == item.url:
                        sentiment = article.get("sentiment", {})
                        ai_label = sentiment.get("label", "Neutral")
                        ai_confidence = sentiment.get("confidence", 0.5)
                        # Also grab description if available
                        if article.get("description"):
                            text += " " + article["description"]
                        break
        
        await TrainingDataService.add_sentiment_feedback(
            db=db,
            article_id=item.article_id,
            text=text,
            ai_label=ai_label,
            ai_confidence=ai_confidence,
            user_id=user_id,
            source="implicit_read_later",
            user_label=None,
            article_url=item.url,
        )
        logger.info(f"[IMPLICIT] Read Later feedback collected for article={item.article_id}")
    except Exception as e:
        logger.warning(f"[IMPLICIT] Failed to collect read_later feedback: {str(e)}")

    return {
        "message": "Added to Read Later",
        "id": inserted_id,
        "created_at": created_at,
    }


@router.get("/")
async def get_read_later(
    user=Depends(require_auth),
    db=Depends(get_db),
):
    user_id = get_user_id(user)
    cache_key = user_read_later_cache_key(user_id)

    cached = await get_from_cache(cache_key)
    if cached:
        logger.info("[READ_LATER CACHE HIT] user_id=%s count=%s", user_id, len(cached))
        return {
            "count": len(cached),
            "items": cached,
        }

    items = []
    cursor = db.read_later.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    async for item in cursor:
        item["_id"] = str(item["_id"])
        read_later_item = ReadLaterModel(**item)
        items.append(read_later_item.model_dump(mode="json"))

    logger.info("[READ_LATER] user_id=%s count=%s", user_id, len(items))

    await set_in_cache(cache_key, items, ttl=60 * 30)

    return {
        "count": len(items),
        "items": items,
    }


@router.delete("/{item_id}")
async def remove_read_later(
    item_id: str,
    user=Depends(require_auth),
    db=Depends(get_db),
):
    user_id = get_user_id(user)

    result = await db.read_later.delete_one({
        "_id": ObjectId(item_id),
        "user_id": user_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Item not found or unauthorized",
        )

    await invalidate_user_action_cache(user_id, "read_later")

    return {"message": "Removed from Read Later"}


@router.delete("/")
async def remove_read_later_by_article(
    article_id: str = Query(..., min_length=1),
    user=Depends(require_auth),
    db=Depends(get_db),
):
    """
    Remove read-later entry by logical article identifier (article_id/url).
    This keeps frontend toggles stable when item ObjectId is not available in card state.
    """
    user_id = get_user_id(user)

    result = await db.read_later.delete_one({
        "user_id": user_id,
        "$or": [
            {"article_id": article_id},
            {"url": article_id},
        ],
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Item not found or unauthorized",
        )

    await invalidate_user_action_cache(user_id, "read_later")

    return {"message": "Removed from Read Later"}
