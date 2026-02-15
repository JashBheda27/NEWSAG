"""
Amazon Polly TTS Service
Handles text-to-speech conversion using AWS Polly Standard voices.
Includes usage tracking to monitor free tier consumption.
"""

import os
import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Tuple
import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.tts_config import (
    get_voice_for_language,
    is_language_supported,
    FREE_TIER_LIMIT,
    WARNING_THRESHOLD,
)

logger = logging.getLogger(__name__)


class TTSService:
    """Amazon Polly TTS Service with usage tracking."""

    def __init__(self):
        self._client = None
        self._initialized = False

    def _get_client(self):
        """Lazy initialization of Polly client."""
        if self._client is None:
            try:
                self._client = boto3.client(
                    "polly",
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                    region_name=os.getenv("AWS_REGION", "ap-south-1"),
                )
                self._initialized = True
                logger.info("[TTS] Amazon Polly client initialized")
            except Exception as e:
                logger.error("[TTS] Failed to initialize Polly client: %s", e)
                raise
        return self._client

    async def synthesize_speech(
        self,
        text: str,
        language: str = "en",
        output_format: str = "mp3",
    ) -> Tuple[Optional[bytes], int]:
        """
        Convert text to speech using Amazon Polly.

        Args:
            text: Text to convert (max 3000 characters for Standard voices)
            language: Language code (e.g., 'en', 'es', 'hi')
            output_format: Audio format ('mp3', 'ogg_vorbis', 'pcm')

        Returns:
            Tuple of (audio_bytes, character_count)
        """
        if not text or not text.strip():
            logger.warning("[TTS] Empty text provided")
            return None, 0

        # Truncate to Polly's limit (3000 chars for synthesize_speech)
        text = text[:3000]
        char_count = len(text)

        voice_config = get_voice_for_language(language)
        voice_id = voice_config["voice_id"]

        try:
            # Run boto3 call in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._get_client().synthesize_speech(
                    Text=text,
                    OutputFormat=output_format,
                    VoiceId=voice_id,
                    Engine="standard",  # Use Standard for free tier
                ),
            )

            # Read audio stream
            audio_stream = response.get("AudioStream")
            if audio_stream:
                audio_bytes = audio_stream.read()
                logger.info(
                    "[TTS] Generated audio: %d bytes, %d chars, voice=%s",
                    len(audio_bytes),
                    char_count,
                    voice_id,
                )
                return audio_bytes, char_count
            else:
                logger.error("[TTS] No audio stream in response")
                return None, 0

        except (BotoCoreError, ClientError) as e:
            logger.error("[TTS] Polly API error: %s", e)
            return None, 0
        except Exception as e:
            logger.error("[TTS] Unexpected error: %s", e)
            return None, 0

    def generate_cache_key(self, text: str, language: str) -> str:
        """Generate a unique cache key for TTS audio."""
        content = f"{text}:{language}"
        return "tts:" + hashlib.sha256(content.encode()).hexdigest()[:32]

    async def is_available(self) -> bool:
        """Check if Polly service is available."""
        try:
            self._get_client()
            return True
        except Exception:
            return False


# Singleton instance
tts_service = TTSService()


async def log_tts_usage(db, user_id: str, char_count: int, language: str):
    """
    Log TTS usage to MongoDB for tracking free tier consumption.
    """
    try:
        await db.polly_usage_logs.insert_one({
            "user_id": user_id,
            "char_count": char_count,
            "language": language,
            "created_at": datetime.now(timezone.utc),
            "month": datetime.now(timezone.utc).strftime("%Y-%m"),
        })
    except Exception as e:
        logger.error("[TTS] Failed to log usage: %s", e)


async def get_monthly_usage(db) -> dict:
    """
    Get current month's Polly usage statistics.
    Returns dict with total chars, limit, percentage, and alert flag.
    """
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    try:
        pipeline = [
            {"$match": {"month": current_month}},
            {"$group": {"_id": None, "total_chars": {"$sum": "$char_count"}}},
        ]
        result = await db.polly_usage_logs.aggregate(pipeline).to_list(1)

        total_chars = result[0]["total_chars"] if result else 0
        percentage = (total_chars / FREE_TIER_LIMIT) * 100

        return {
            "month": current_month,
            "total_characters": total_chars,
            "free_tier_limit": FREE_TIER_LIMIT,
            "usage_percentage": round(percentage, 2),
            "alert": total_chars >= WARNING_THRESHOLD,
            "warning_message": (
                f"⚠️ Approaching free tier limit! {total_chars:,}/{FREE_TIER_LIMIT:,} characters used."
                if total_chars >= WARNING_THRESHOLD
                else None
            ),
        }
    except Exception as e:
        logger.error("[TTS] Failed to get usage stats: %s", e)
        return {
            "month": current_month,
            "total_characters": 0,
            "free_tier_limit": FREE_TIER_LIMIT,
            "usage_percentage": 0,
            "alert": False,
            "error": str(e),
        }


async def get_usage_by_language(db) -> list:
    """
    Get usage breakdown by language for the current month.
    """
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    try:
        pipeline = [
            {"$match": {"month": current_month}},
            {
                "$group": {
                    "_id": "$language",
                    "total_chars": {"$sum": "$char_count"},
                    "request_count": {"$sum": 1},
                }
            },
            {"$sort": {"total_chars": -1}},
        ]
        results = await db.polly_usage_logs.aggregate(pipeline).to_list(100)

        return [
            {
                "language": r["_id"],
                "total_characters": r["total_chars"],
                "request_count": r["request_count"],
            }
            for r in results
        ]
    except Exception as e:
        logger.error("[TTS] Failed to get language stats: %s", e)
        return []
