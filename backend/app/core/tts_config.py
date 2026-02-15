"""
Amazon Polly TTS Configuration
Maps supported languages to optimal Polly voices.
Uses Standard voices (free tier: 5M chars/month).
"""

# Language code → Polly Voice ID mapping
# All voices are Standard (not Neural) to stay within free tier
POLLY_VOICE_MAP = {
    "en": {"voice_id": "Joanna", "language_code": "en-US", "name": "English (US)"},
    "es": {"voice_id": "Lucia", "language_code": "es-ES", "name": "Spanish"},
    "fr": {"voice_id": "Celine", "language_code": "fr-FR", "name": "French"},
    "de": {"voice_id": "Marlene", "language_code": "de-DE", "name": "German"},
    "hi": {"voice_id": "Aditi", "language_code": "hi-IN", "name": "Hindi"},
    "zh-CN": {"voice_id": "Zhiyu", "language_code": "cmn-CN", "name": "Chinese (Mandarin)"},
    "ja": {"voice_id": "Mizuki", "language_code": "ja-JP", "name": "Japanese"},
    "ar": {"voice_id": "Zeina", "language_code": "arb", "name": "Arabic"},
    "pt": {"voice_id": "Vitoria", "language_code": "pt-BR", "name": "Portuguese (Brazilian)"},
    "ru": {"voice_id": "Maxim", "language_code": "ru-RU", "name": "Russian"},
    "ko": {"voice_id": "Seoyeon", "language_code": "ko-KR", "name": "Korean"},
    "it": {"voice_id": "Carla", "language_code": "it-IT", "name": "Italian"},
}

# Free tier limits
FREE_TIER_LIMIT = 5_000_000  # 5 million characters per month
WARNING_THRESHOLD = 4_000_000  # Alert at 4 million (80%)

# Cache TTL for audio (30 days in seconds)
TTS_CACHE_TTL = 60 * 60 * 24 * 30


def get_voice_for_language(lang_code: str) -> dict:
    """
    Get Polly voice configuration for a language.
    Falls back to English if language is not supported.
    """
    return POLLY_VOICE_MAP.get(lang_code, POLLY_VOICE_MAP["en"])


def is_language_supported(lang_code: str) -> bool:
    """Check if a language is supported for TTS."""
    return lang_code in POLLY_VOICE_MAP


def get_supported_tts_languages() -> list:
    """Return list of supported TTS languages."""
    return [
        {"code": code, "name": config["name"], "voice_id": config["voice_id"]}
        for code, config in POLLY_VOICE_MAP.items()
    ]
