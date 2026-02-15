import hashlib
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from app.core.cache import get_from_cache, set_in_cache
from app.services.summarizer import TextSummarizer
from app.services.text_utils import extract_article_text, translate_text, get_supported_languages
from app.core.auth import get_current_user_optional
from app.core.database import get_db

router = APIRouter()
summarizer = TextSummarizer()


@router.get("/languages")
async def list_supported_languages():
    """Return list of supported translation languages."""
    languages = get_supported_languages()
    return {"languages": [{"code": k, "name": v} for k, v in languages.items()]}


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

    # --------------------------------------------------
    # 1️⃣ Prefer full article text (scrape)
    # --------------------------------------------------
    try:
        article_text = await extract_article_text(article_url)
    except Exception:
        article_text = None

    # --------------------------------------------------
    # 2️⃣ Fallback to GNews content
    # --------------------------------------------------
    if not article_text and gnews_content:
        article_text = gnews_content

    # --------------------------------------------------
    # 3️⃣ NLP summary ONLY if enough text
    # --------------------------------------------------
    if article_text and len(article_text.split()) >= 200:
        try:
            summary = summarizer.summarize(
                article_text,
                min_words=100,
                max_words=120
            )
        except Exception:
            summary = None

    # --------------------------------------------------
    # 4️⃣ PAYWALL / FAILURE → USE DESCRIPTION
    # --------------------------------------------------
    if not summary and gnews_description:
        summary = gnews_description.strip()
        source = "description"

    # --------------------------------------------------
    # 5️⃣ LAST RESORT
    # --------------------------------------------------
    if not summary:
        summary = (
            "This article could not be summarized due to publisher restrictions. "
            "Please open the full article to read more."
        )
        source = "placeholder"

    # --------------------------------------------------
    # 6️⃣ TRANSLATE if target language is not English
    # --------------------------------------------------
    translated = False
    if target_lang and target_lang != "en" and summary:
        summary = translate_text(summary, target_lang)
        translated = True

    response = {
        "summary": summary,
        "source": source,
        "is_fallback": source != "generated",
        "language": target_lang,
        "translated": translated,
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

    await set_in_cache(cache_key, response)

    return response
