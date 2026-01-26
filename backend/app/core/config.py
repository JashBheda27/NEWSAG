import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME: str = "NewsAura Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 8000))

    # Mongo
    MONGO_URI: str = os.getenv("MONGO_URI", "")

    # -----------------------------
    # GNEWS CONFIG (ONLY SOURCE)
    # -----------------------------
    GNEWS_API_KEY: str = os.getenv("GNEWS_API_KEY", "")
    GNEWS_BASE_URL: str = "https://gnews.io/api/v4"

    # -----------------------------
    # CACHE TTL (STRICT)
    # -----------------------------
    CACHE_TTL_NEWS: int = 60 * 15  # 15 minutes (DO NOT LOWER)

settings = Settings()
