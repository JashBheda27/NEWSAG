import hashlib
from fastapi import APIRouter, HTTPException
from app.core.cache import get_from_cache, set_in_cache
from app.services.summarizer import TextSummarizer
from app.services.text_utils import extract_article_text

router = APIRouter()
summarizer = TextSummarizer()


@router.post("/")
async def generate_summary(payload: dict):
    """
    Summary rules:
    - News card → description (frontend)
    - AI summary → NLP ONLY
    - Paywall / failure → fallback to same description
    """

    article_url = payload.get("url")
    gnews_content = payload.get("content")
    gnews_description = payload.get("description")

    if not article_url:
        raise HTTPException(status_code=400, detail="Article URL is required")

    cache_key = "summary:" + hashlib.md5(article_url.encode()).hexdigest()

    cached = await get_from_cache(cache_key)
    if cached:
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

    response = {
        "summary": summary,
        "source": source,
        "is_fallback": source != "generated",
    }

    await set_in_cache(cache_key, response)

    return response
