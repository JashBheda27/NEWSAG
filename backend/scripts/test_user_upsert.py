import asyncio
from app.core.database import MongoDB, get_db
from datetime import datetime


async def run():
    MongoDB.connect()
    db = MongoDB.get_database()

    user_id = "test_user_123"
    doc = {
        "user_id": user_id,
        "email": "tester@example.com",
        "last_seen": datetime.utcnow(),
    }

    res = await db.users.update_one({"user_id": user_id}, {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)
    print("Upsert result matched_count", getattr(res, 'matched_count', None), "modified_count", getattr(res, 'modified_count', None))

    found = await db.users.find_one({"user_id": user_id})
    print("Found user:", found)


if __name__ == "__main__":
    asyncio.run(run())
