from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

# --------------------------------------------------
# MongoDB Client (Async)
# --------------------------------------------------
class MongoDB:
    """
    MongoDB connection handler using Motor (async).
    """

    client: AsyncIOMotorClient = None

    @classmethod
    def connect(cls):
        """
        Create a MongoDB client instance.
        Called once at application startup.
        """
        if not settings.MONGO_URI:
            raise ValueError("MONGO_URI is not set. Please configure it in the .env file.")

        if cls.client is None:
            cls.client = AsyncIOMotorClient(settings.MONGO_URI)
            print("[OK] MongoDB connected (async)")

    @classmethod
    def close(cls):
        """
        Close MongoDB connection.
        Called during application shutdown.
        """
        if cls.client:
            cls.client.close()
            print("[CLOSED] MongoDB connection closed")

    @classmethod
    def get_database(cls):
        """
        Return database instance.
        """
        if cls.client is None:
            raise RuntimeError("MongoDB client is not initialized. Call MongoDB.connect() first.")

        return cls.client.get_default_database()


# --------------------------------------------------
# Dependency for FastAPI routes
# --------------------------------------------------
async def get_db():
    """
    FastAPI dependency to access database.
    """
    db = MongoDB.get_database()
    return db
