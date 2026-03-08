import asyncio
from app.core.database import MongoDB, get_db
from app.core.gnews_counter import GNewsCounter


async def run():
    MongoDB.connect()
    db = MongoDB.get_database()

    # Call increment_hit twice
    res1 = await GNewsCounter.increment_hit()
    print("increment 1:", res1)
    res2 = await GNewsCounter.increment_hit()
    print("increment 2:", res2)

    # Check DB record
    from datetime import datetime
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    doc = await db.gnews_hits.find_one({"date": date_str})
    print("gnews_hits doc:", doc)


if __name__ == "__main__":
    asyncio.run(run())
