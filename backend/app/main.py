import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import MongoDB
from app.core.logging import configure_logging
from app.core.indexes import create_indexes
from app.core.cache import get_redis, close_redis
from app.services.sentiment_ml import SentimentService, _load_model
from app.services.chat_llm import chat_llm


from app.routers import (
    news,
    summary,
    sentiments,
    comments,
    bookmarks,
    read_laters,
    feedbacks,
    profile,
    chatbot,
    admin,
    tts,
)

# --------------------------------------------------
# FastAPI Application Instance
# --------------------------------------------------
app = FastAPI(
    title="NewsAura Backend",
    description="News Aggregation & NLP Backend ",
    version="1.0.0",
)

# --------------------------------------------------
# CORS Configuration
# --------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Frontend (Vite / React)
        "http://localhost:5174",   # Frontend (Vite / React - alternate port)
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Health Check Route
# --------------------------------------------------
@app.get("/", tags=["Health"])
async def health_check():
    """
    Simple health check endpoint.
    Used to verify that the backend is running.
    """
    return {
        "status": "running",
        "message": "NewsAura FastAPI backend is live"
    }

# --------------------------------------------------
# API Routers
# --------------------------------------------------
app.include_router(news.router, prefix="/api/news", tags=["News"])
app.include_router(summary.router, prefix="/api/summary", tags=["Summary"])
app.include_router(sentiments.router, prefix="/api/sentiment", tags=["Sentiment"])
app.include_router(comments.router, prefix="/api/comments", tags=["Comments"])
app.include_router(bookmarks.router, prefix="/api/bookmarks", tags=["Bookmarks"])
app.include_router(read_laters.router, prefix="/api/read-later", tags=["Read Later"])
app.include_router(feedbacks.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(chatbot.router, prefix="/api/chat", tags=["Chatbot"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(tts.router, prefix="/api/tts", tags=["TTS"])

logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    configure_logging()
    MongoDB.connect()
    await create_indexes()
    # ✅ Initialize Redis connection on startup without blocking app availability
    try:
        await get_redis()
        print("[REDIS] Connected to Redis cache")
    except Exception as exc:
        logger.warning("[REDIS] Startup connection failed; continuing without cache: %s", exc)
    # ✅ Preload sentiment model to avoid first-request latency; do not block on failure
    try:
        _load_model()
        print("[SENTIMENT] ML model loaded successfully at startup")
    except Exception as exc:
        logger.warning("[SENTIMENT] Model preload failed; will use neutral fallback: %s", exc)
    # ✅ Warm up Ollama so llama3.1:8b loads into memory (avoids cold-start on first chat)
    try:
        available = await chat_llm.is_available()
        if available:
            print(f"[OLLAMA] Connected to Ollama — model: {chat_llm.model}")
        else:
            print("[OLLAMA] Ollama not available; chatbot will use rule-based fallbacks")
    except Exception as exc:
        logger.warning("[OLLAMA] Warmup check failed; chatbot will use fallbacks: %s", exc)

@app.on_event("shutdown")
async def shutdown_event():
    MongoDB.close()
    # ✅ Close Redis connection on shutdown
    try:
        await close_redis()
        print("[REDIS] Disconnected from Redis cache")
    except Exception as exc:
        logger.warning("[REDIS] Shutdown cleanup failed: %s", exc)
