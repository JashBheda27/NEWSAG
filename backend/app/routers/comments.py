from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.models.comment import CommentModel
from bson import ObjectId

router = APIRouter()


# --------------------------------------------------
# CREATE COMMENT
# --------------------------------------------------
@router.post("/")
async def add_comment(comment: CommentModel, db=Depends(get_db)):
    """
    Add a new comment to an article.
    """

    result = await db.comments.insert_one(comment.dict())
    return {
        "message": "Comment added successfully",
        "comment_id": str(result.inserted_id),
    }


# --------------------------------------------------
# READ COMMENTS (by article)
# --------------------------------------------------
@router.get("/{article_id}")
async def get_comments(article_id: str, db=Depends(get_db)):
    """
    Fetch all comments for a specific article.
    """

    comments = []
    cursor = db.comments.find({"article_id": article_id}).sort("created_at", -1)

    async for comment in cursor:
        comments.append(CommentModel(**comment))

    return {
        "count": len(comments),
        "comments": comments,
    }


# --------------------------------------------------
# DELETE COMMENT
# --------------------------------------------------
@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, db=Depends(get_db)):
    """
    Delete a comment by ID.
    """
    
    # Validate ObjectId format
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID format")
    
    result = await db.comments.delete_one({"_id": ObjectId(comment_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")

    return {"message": "Comment deleted successfully"}
