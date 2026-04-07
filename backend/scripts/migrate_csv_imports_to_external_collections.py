"""
One-time migration script.

Moves legacy CSV-imported rows from internal training collections
into dedicated external training collections.

Usage:
  python backend/scripts/migrate_csv_imports_to_external_collections.py

Env:
  MONGODB_URL or MONGO_URI or DATABASE_URL
  MONGODB_DB_NAME or MONGO_DB_NAME or DB_NAME (optional, defaults to 'newsaura')
"""

import asyncio
import os
from datetime import datetime
from typing import Any, Dict, List

from motor.motor_asyncio import AsyncIOMotorClient


def _get_mongo_uri() -> str:
    for key in ["MONGODB_URL", "MONGO_URI", "DATABASE_URL"]:
        value = os.getenv(key)
        if value:
            return value
    return "mongodb://localhost:27017"


def _get_db_name() -> str:
    for key in ["MONGODB_DB_NAME", "MONGO_DB_NAME", "DB_NAME"]:
        value = os.getenv(key)
        if value:
            return value
    return "newsaura"


async def _move_documents(
    db,
    source_collection: str,
    target_collection: str,
    query: Dict[str, Any],
    batch_size: int = 500,
) -> int:
    moved = 0

    while True:
        cursor = db[source_collection].find(query).limit(batch_size)
        docs: List[Dict[str, Any]] = []
        async for doc in cursor:
            docs.append(doc)

        if not docs:
            break

        ids = [doc["_id"] for doc in docs]

        # Idempotency: upsert by _id into target collection.
        for doc in docs:
            doc["migrated_to_external_at"] = datetime.utcnow()
            await db[target_collection].replace_one({"_id": doc["_id"]}, doc, upsert=True)

        delete_result = await db[source_collection].delete_many({"_id": {"$in": ids}})
        moved += int(delete_result.deleted_count)

    return moved


async def main() -> None:
    client = AsyncIOMotorClient(_get_mongo_uri())
    db = client[_get_db_name()]

    sentiment_moved = await _move_documents(
        db,
        source_collection="sentiment_training",
        target_collection="sentiment_training_external",
        query={"import_source": "csv"},
    )

    credibility_moved = await _move_documents(
        db,
        source_collection="credibility_training",
        target_collection="credibility_training_external",
        query={"import_source": "csv"},
    )

    print(
        {
            "sentiment_moved": sentiment_moved,
            "credibility_moved": credibility_moved,
        }
    )

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
