from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import MongoDB
from app.core.logging import configure_logging
from app.core.indexes import create_indexes


from app.routers import (
    news,
    summary,
    sentiments,
    comments,
    bookmarks,
    read_laters,
    feedbacks,
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

@app.on_event("startup")
async def startup_event():
    configure_logging()
    MongoDB.connect()
    await create_indexes()

@app.on_event("shutdown")
async def shutdown_event():
    MongoDB.close()
