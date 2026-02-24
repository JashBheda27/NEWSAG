import hashlib
import logging
import re
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from app.core.cache import get_from_cache, set_in_cache
from app.core.constants import SUPPORTED_LANGUAGES
from app.services.summarizer import TextSummarizer
from app.services.text_utils import extract_article_text, translate_text
from app.core.auth import get_current_user_optional
from app.core.database import get_db
from app.core.tts_config import is_language_supported as is_tts_supported, get_voice_for_language

logger = logging.getLogger(__name__)

router = APIRouter()
summarizer = TextSummarizer()

# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

_STOP_WORDS = frozenset({
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "and",
    "is", "it", "by", "as", "or", "be", "was", "are", "with", "from",
    "has", "had", "have", "not", "but", "this", "that", "its", "his",
    "her", "he", "she", "they", "we", "you", "i", "s", "t", "do",
    "does", "did", "will", "would", "can", "could", "been", "being",
    "about", "after", "before", "between", "into", "than", "what",
    "who", "how", "when", "where", "which", "no", "more", "most",
    "over", "under", "up", "down", "out", "if", "so", "just", "also",
})


def _extract_keywords(text: str) -> set:
    """Return meaningful lowercase keywords from text."""
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return {w for w in words if w not in _STOP_WORDS}


def _description_matches_title(title: str, description: str) -> bool:
    """
    Check if the description is relevant to the article title
    using keyword overlap.  Threshold ≥ 30 %.
    """
    if not title or not description:
        return False
    title_kw = _extract_keywords(title)
    desc_kw = _extract_keywords(description)
    if not title_kw:
        return False
    overlap = len(title_kw & desc_kw) / len(title_kw)
    return overlap >= 0.30


def _extract_first_sentences(text: str, max_words: int = 120) -> str:
    """
    Simple fallback: take the first N complete sentences from
    *article_text* up to *max_words* words.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text)
    result = []
    word_count = 0
    for s in sentences:
        s = s.strip()
        if not s or len(s) < 30:
            continue
        result.append(s)
        word_count += len(s.split())
        if word_count >= max_words:
            break
    return " ".join(result) if result else text[:500]


@router.get("/languages")
async def list_supported_languages():
    """Return list of supported translation languages."""
    return {"languages": [{"code": k, "name": v} for k, v in SUPPORTED_LANGUAGES.items()]}


@router.post("/")
async def generate_summary(
    payload: dict,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """
    Summary rules:
    - News card → description (frontend)
    - AI summary → NLP ONLY
    - Paywall / failure → fallback to same description
    - Optional: translate summary to target language
    """

    article_url = payload.get("url")
    gnews_content = payload.get("content")
    gnews_description = payload.get("description")
    target_lang = payload.get("lang", "en")

    if not article_url:
        raise HTTPException(status_code=400, detail="Article URL is required")

    cache_key = "summary:" + hashlib.md5((article_url + ":" + target_lang).encode()).hexdigest()

    cached = await get_from_cache(cache_key)
    if cached:
        try:
            await db.summary_logs.insert_one({
                "user_id": user["user_id"],
                "url": article_url,
                "source": "cache",
                "created_at": datetime.utcnow(),
            })
        except Exception:
            pass
        return cached

    article_text = None
    summary = None
    source = "generated"
    article_title = payload.get("title", "")
    failure_reason = None

    # --------------------------------------------------
    # 1️⃣ Prefer full article text (scrape)
    # --------------------------------------------------
    try:
        scraped = await extract_article_text(article_url)
        scraped_wc = len(scraped.split()) if scraped else 0
        if scraped and scraped_wc >= 50:
            article_text = scraped
            logger.info("[SUMMARY] Scraped OK | words=%d | url=%s", scraped_wc, article_url)
        else:
            logger.warning(
                "[SUMMARY] Scrape returned too little text | words=%d | url=%s",
                scraped_wc, article_url,
            )
    except Exception as exc:
        logger.warning("[SUMMARY] Scrape FAILED | url=%s | err=%s", article_url, exc)

    # --------------------------------------------------
    # 2️⃣ Fallback to GNews content
    # --------------------------------------------------
    if not article_text and gnews_content:
        gnews_wc = len(gnews_content.split())
        article_text = gnews_content
        logger.info("[SUMMARY] Using GNews content | words=%d | url=%s", gnews_wc, article_url)

    # --------------------------------------------------
    # 3️⃣ NLP summary — lowered threshold to 50 words
    # --------------------------------------------------
    text_wc = len(article_text.split()) if article_text else 0
    if article_text and text_wc >= 50:
        try:
            summary = await summarizer.summarize_async(
                article_text,
                min_words=80,
                max_words=120
            )
            if summary:
                logger.info(
                    "[SUMMARY] NLP generated | input_words=%d | summary_words=%d | url=%s",
                    text_wc, len(summary.split()), article_url,
                )
        except Exception as exc:
            logger.error("[SUMMARY] NLP error | url=%s | err=%s", article_url, exc)
            summary = None

    # --------------------------------------------------
    # 3.5️⃣ If NLP failed but we have article text,
    #       extract leading sentences instead of using description
    # --------------------------------------------------
    if not summary and article_text and text_wc >= 30:
        summary = _extract_first_sentences(article_text, max_words=120)
        source = "extracted"
        logger.info(
            "[SUMMARY] Extracted first sentences | words=%d | url=%s",
            len(summary.split()), article_url,
        )

    # --------------------------------------------------
    # 4️⃣ PAYWALL / FAILURE → USE DESCRIPTION
    #    BUT validate it matches the article title first
    # --------------------------------------------------
    if not summary and gnews_description:
        desc_text = gnews_description.strip()
        if article_title and not _description_matches_title(article_title, desc_text):
            logger.warning(
                "[SUMMARY] Description MISMATCH — skipping | title=%.60s | desc=%.80s",
                article_title, desc_text,
            )
            failure_reason = "description_mismatch"
            # Don't use mismatched description
        else:
            summary = desc_text
            source = "description"
            logger.info("[SUMMARY] Using description fallback | url=%s", article_url)

    # --------------------------------------------------
    # 5️⃣ LAST RESORT
    # --------------------------------------------------
    if not summary:
        summary = (
            "This article could not be summarized due to publisher restrictions. "
            "Please open the full article to read more."
        )
        source = "placeholder"
        if not failure_reason:
            failure_reason = "no_content"
        logger.warning("[SUMMARY] Placeholder used | reason=%s | url=%s", failure_reason, article_url)

    # --------------------------------------------------
    # 6️⃣ TRANSLATE if target language is not English
    # --------------------------------------------------
    translated = False
    if target_lang and target_lang != "en" and summary:
        summary = await translate_text(summary, target_lang)  # ✅ Now async-safe
        translated = True

    # --------------------------------------------------
    # 7️⃣ TTS availability check
    # --------------------------------------------------
    audio_available = is_tts_supported(target_lang)
    voice_config = get_voice_for_language(target_lang) if audio_available else None

    response = {
        "summary": summary,
        "source": source,
        "is_fallback": source in ("description", "placeholder"),
        "language": target_lang,
        "translated": translated,
        "audio_available": audio_available,
        "tts_voice": voice_config["voice_id"] if voice_config else None,
    }

    try:
        await db.summary_logs.insert_one({
            "user_id": user["user_id"],
            "url": article_url,
            "source": source,
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass

    # Track failures for source quality analysis
    if failure_reason:
        try:
            await db.summary_failures.insert_one({
                "url": article_url,
                "source": payload.get("article_source", "unknown"),
                "failure_reason": failure_reason,
                "content_length": text_wc,
                "has_description": bool(gnews_description),
                "has_content": bool(gnews_content),
                "created_at": datetime.utcnow(),
            })
        except Exception:
            pass

    await set_in_cache(cache_key, response)

    return response
