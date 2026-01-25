from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.models.bookmark import BookmarkModel
from bson import ObjectId
from app.core.auth import get_current_user_optional


router = APIRouter()


# --------------------------------------------------
# ADD BOOKMARK
# --------------------------------------------------
@router.post("/")
async def add_bookmark(
    bookmark: BookmarkModel,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    user_id = user["user_id"]

    existing = await db.bookmarks.find_one({
        "user_id": user_id,
        "article_id": bookmark.article_id
    })

    if existing:
        raise HTTPException(status_code=400, detail="Already bookmarked")

    data = bookmark.dict()
    data["user_id"] = user_id

    result = await db.bookmarks.insert_one(data)

    return {
        "message": "Bookmark added",
        "bookmark_id": str(result.inserted_id)
    }



# --------------------------------------------------
# GET USER BOOKMARKS
# --------------------------------------------------
@router.get("/")
async def get_bookmarks(
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    user_id = user["user_id"]

    bookmarks = []
    cursor = db.bookmarks.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    async for item in cursor:
        item["_id"] = str(item["_id"])
        bookmarks.append(BookmarkModel(**item))

    return {
        "count": len(bookmarks),
        "bookmarks": bookmarks
    }



# --------------------------------------------------
# REMOVE BOOKMARK
# --------------------------------------------------
@router.delete("/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: str,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    user_id = user["user_id"]

    result = await db.bookmarks.delete_one({
        "_id": ObjectId(bookmark_id),
        "user_id": user_id
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Bookmark not found or not authorized"
        )

    return {"message": "Bookmark removed"}

