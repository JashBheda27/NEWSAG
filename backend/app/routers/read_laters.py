from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.auth import get_current_user_optional
from app.models.read_later import ReadLaterModel

router = APIRouter()


@router.post("/")
async def add_read_later(
    item: ReadLaterModel,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    user_id = user["user_id"]

    exists = await db.read_later.find_one({
        "user_id": user_id,
        "article_id": item.article_id,
    })

    if exists:
        raise HTTPException(status_code=400, detail="Already in Read Later")

    data = item.dict()
    data["user_id"] = user_id

    result = await db.read_later.insert_one(data)
    
    # fetch the inserted document to return created_at
    inserted = await db.read_later.find_one({"_id": result.inserted_id})
    if inserted:
        inserted_id = str(inserted.get("_id"))
        created_at = inserted.get("created_at")
    else:
        inserted_id = str(result.inserted_id)
        created_at = None

    return {
        "message": "Added to Read Later",
        "id": inserted_id,
        "created_at": created_at,
    }


@router.get("/")
async def get_read_later(
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    user_id = user["user_id"]

    items = []
    cursor = db.read_later.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(ReadLaterModel(**item))

    return {
        "count": len(items),
        "items": items,
    }


@router.delete("/{item_id}")
async def remove_read_later(
    item_id: str,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    user_id = user["user_id"]

    result = await db.read_later.delete_one({
        "_id": ObjectId(item_id),
        "user_id": user_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Item not found or unauthorized",
        )

    return {"message": "Removed from Read Later"}
