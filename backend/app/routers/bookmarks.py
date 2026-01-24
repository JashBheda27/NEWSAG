from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.models.bookmark import BookmarkModel
from bson import ObjectId

router = APIRouter()


# --------------------------------------------------
# ADD BOOKMARK
# --------------------------------------------------
@router.post("/")
async def add_bookmark(bookmark: BookmarkModel, db=Depends(get_db)):
    """
    Save an article to user's bookmarks.
    """

    existing = await db.bookmarks.find_one({
        "user_id": bookmark.user_id,
        "article_id": bookmark.article_id
    })

    if existing:
        raise HTTPException(status_code=400, detail="Already bookmarked")

    result = await db.bookmarks.insert_one(bookmark.dict())
    return {
        "message": "Bookmark added",
        "bookmark_id": str(result.inserted_id)
    }


# --------------------------------------------------
# GET USER BOOKMARKS
# --------------------------------------------------
@router.get("/{user_id}")
async def get_bookmarks(user_id: str, db=Depends(get_db)):
    """
    Fetch all bookmarks for a user.
    """

    bookmarks = []
    cursor = db.bookmarks.find({"user_id": user_id}).sort("created_at", -1)

    async for item in cursor:
        item["_id"] = str(item["_id"])
        bookmarks.append(item)

    return {
        "count": len(bookmarks),
        "bookmarks": bookmarks
    }


# --------------------------------------------------
# REMOVE BOOKMARK
# --------------------------------------------------
@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, db=Depends(get_db)):
    """
    Remove a bookmark by ID.
    """

    result = await db.bookmarks.delete_one({"_id": ObjectId(bookmark_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    return {"message": "Bookmark removed"}
