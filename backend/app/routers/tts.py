"""
TTS Router - Text-to-Speech endpoints using Amazon Polly.
Provides on-demand audio generation for article summaries.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.auth import require_auth, require_admin
from app.core.database import get_db
from app.core.cache import get_from_cache, set_in_cache
from app.core.tts_config import (
    is_language_supported,
    get_supported_tts_languages,
    TTS_CACHE_TTL,
)
from app.services.tts_service import (
    tts_service,
    log_tts_usage,
    get_monthly_usage,
    get_usage_by_language,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    """Request body for TTS generation."""
    text: str = Field(..., min_length=1, max_length=3000, description="Text to convert to speech")
    language: str = Field(default="en", description="Language code (e.g., 'en', 'es', 'hi')")


class TTSLanguagesResponse(BaseModel):
    """Response for supported languages endpoint."""
    languages: list


@router.get("/languages")
async def list_tts_languages():
    """
    Get list of supported TTS languages with their Polly voice IDs.
    """
    languages = get_supported_tts_languages()
    return {"languages": languages}


@router.post("/generate")
async def generate_tts(
    request: TTSRequest,
    user=Depends(require_auth),
    db=Depends(get_db),
):
    """
    Generate audio from text using Amazon Polly.
    Returns MP3 audio stream.
    
    - Caches audio for 30 days to avoid redundant API calls
    - Logs usage for free tier monitoring
    - Supports 12 languages (falls back to English if unsupported)
    """
    text = request.text.strip()
    language = request.language

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    # Check language support (will fallback to English internally)
    if not is_language_supported(language):
        logger.warning("[TTS] Unsupported language %s, falling back to English", language)
        language = "en"

    # Check cache first
    cache_key = tts_service.generate_cache_key(text, language)
    cached_audio = await get_from_cache(cache_key, raw=True)
    
    if cached_audio:
        logger.info("[TTS] Cache hit for key: %s", cache_key[:16])
        return Response(
            content=cached_audio,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=summary.mp3",
                "X-TTS-Cache": "hit",
            },
        )

    # Generate audio
    audio_bytes, char_count = await tts_service.synthesize_speech(
        text=text,
        language=language,
        output_format="mp3",
    )

    if not audio_bytes:
        raise HTTPException(
            status_code=503,
            detail="TTS service unavailable. Please try again later.",
        )

    # Log usage for tracking
    user_id = user.get("user_id", "anonymous") if user else "anonymous"
    await log_tts_usage(db, user_id, char_count, language)

    # Cache the audio
    await set_in_cache(cache_key, audio_bytes, ttl=TTS_CACHE_TTL, raw=True)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=summary.mp3",
            "X-TTS-Cache": "miss",
            "X-TTS-Characters": str(char_count),
        },
    )


@router.get("/usage")
async def get_tts_usage(
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """
    Get current month's TTS usage statistics.
    Shows character count, percentage of free tier, and alert if approaching limit.
    """
    usage = await get_monthly_usage(db)
    language_breakdown = await get_usage_by_language(db)

    return {
        **usage,
        "by_language": language_breakdown,
    }


@router.get("/health")
async def tts_health():
    """
    Check if TTS service (Amazon Polly) is available.
    """
    available = await tts_service.is_available()
    return {
        "service": "Amazon Polly",
        "status": "available" if available else "unavailable",
        "engine": "standard",
    }
