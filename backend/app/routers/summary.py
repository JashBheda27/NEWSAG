import hashlib
from fastapi import APIRouter, HTTPException
from app.core.cache import summary_cache, get_from_cache, set_in_cache
from app.services.summarizer import TextSummarizer
from app.services.text_utils import extract_article_text

router = APIRouter()

summarizer = TextSummarizer()


@router.get("/")
async def generate_summary(article_url: str):
    """
    Generate summary for a given article URL.
    Uses extractive NLP-based summarization (no AI).
    """

    cache_key = "summary:" + hashlib.md5(article_url.encode()).hexdigest()

    # --------------------------------------------------
    # 1. Cache check
    # --------------------------------------------------
    cached = get_from_cache(summary_cache, cache_key)
    if cached:
        return {
            "source": "cache",
            "summary": cached,
        }

    # --------------------------------------------------
    # 2. Fetch article content
    # --------------------------------------------------
    try:
        article_text = await extract_article_text(article_url)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to extract article text: {exc}"
        )

    if len(article_text) < 300:
        raise HTTPException(
            status_code=400,
            detail="Article content too short to summarize"
        )

    # --------------------------------------------------
    # 3. Generate summary
    # --------------------------------------------------
    summary = summarizer.summarize(article_text)

    # --------------------------------------------------
    # 4. Cache result
    # --------------------------------------------------
    set_in_cache(summary_cache, cache_key, summary)

    return {
        "source": "generated",
        "summary": summary,
    }
