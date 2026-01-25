from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.auth import get_current_user_optional
from app.models.comment import CommentModel

router = APIRouter()


@router.post("/")
async def add_comment(
    comment: CommentModel,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    data = comment.dict()
    data["user_id"] = user["user_id"]
    data["user_email"] = user.get("email")

    result = await db.comments.insert_one(data)

    return {
        "message": "Comment added successfully",
        "comment_id": str(result.inserted_id),
    }


@router.get("/{article_id}")
async def get_comments(article_id: str, db=Depends(get_db)):
    comments = []
    cursor = db.comments.find(
        {"article_id": article_id}
    ).sort("created_at", -1)

    async for comment in cursor:
        comments.append(CommentModel(**comment))

    return {
        "count": len(comments),
        "comments": comments,
    }


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
