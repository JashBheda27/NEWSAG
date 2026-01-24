from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.models.read_later import ReadLaterModel
from bson import ObjectId

router = APIRouter()


# --------------------------------------------------
# ADD TO READ LATER
# --------------------------------------------------
@router.post("/")
async def add_read_later(item: ReadLaterModel, db=Depends(get_db)):
    """
    Save article to Read Later list.
    """

    existing = await db.read_later.find_one({
        "user_id": item.user_id,
        "article_id": item.article_id
    })

    if existing:
        raise HTTPException(status_code=400, detail="Already in Read Later")

    result = await db.read_later.insert_one(item.dict())
    return {
        "message": "Added to Read Later",
        "id": str(result.inserted_id)
    }


# --------------------------------------------------
# GET READ LATER ARTICLES
# --------------------------------------------------
@router.get("/{user_id}")
async def get_read_later(user_id: str, db=Depends(get_db)):
    """
    Fetch Read Later list for a user.
    """

    items = []
    cursor = db.read_later.find({"user_id": user_id}).sort("created_at", -1)

    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return {
        "count": len(items),
        "items": items
    }


# --------------------------------------------------
# REMOVE FROM READ LATER
# --------------------------------------------------
@router.delete("/{item_id}")
async def remove_read_later(item_id: str, db=Depends(get_db)):
    """
    Remove article from Read Later list.
    """

    result = await db.read_later.delete_one({"_id": ObjectId(item_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"message": "Removed from Read Later"}
