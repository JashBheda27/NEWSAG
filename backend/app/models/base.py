from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class MongoBase(BaseModel):
    """
    Base model for MongoDB documents.
    Handles automatic _id to id conversion.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(None, alias="_id")

    def dict(self, **kwargs):
        """Override dict to exclude None id values."""
        data = super().model_dump(**kwargs)
        if data.get("id") is None:
            data.pop("id", None)
        return data
