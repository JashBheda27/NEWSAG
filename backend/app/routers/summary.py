import hashlib
from fastapi import APIRouter, HTTPException
from app.core.cache import summary_cache, get_from_cache, set_in_cache
from app.services.summarizer import TextSummarizer
from app.services.text_utils import extract_article_text

router = APIRouter()
summarizer = TextSummarizer()

@router.post("/")
async def generate_summary(payload: dict):
    """
    Generate summary using:
    1. GNews content (preferred)
    2. Scraped article text (fallback)
    """

    article_url = payload.get("url")
    gnews_content = payload.get("content")

    if not article_url:
        raise HTTPException(status_code=400, detail="Article URL is required")

    cache_key = "summary:" + hashlib.md5(article_url.encode()).hexdigest()

    # -----------------------------
    # CACHE CHECK
    # -----------------------------
    cached = get_from_cache(summary_cache, cache_key)
    if cached:
        return {
            "source": "cache",
            "summary": cached,
        }

    article_text = None

    # -----------------------------
    # 1️⃣ USE GNEWS CONTENT FIRST
    # -----------------------------
    if gnews_content and len(gnews_content.strip()) > 120:
        article_text = gnews_content

    # -----------------------------
    # 2️⃣ FALLBACK TO SCRAPING
    # -----------------------------
    if not article_text:
        try:
            article_text = await extract_article_text(article_url)
        except Exception as exc:
            print(f"[SUMMARY] Scrape failed: {exc}")
            article_text = None

    # -----------------------------
    # 3️⃣ FINAL VALIDATION
    # -----------------------------
    if not article_text or len(article_text) < 120:
        placeholder = (
            "Summary not available for this article. "
            "This may be due to publisher restrictions or limited content access. "
            "Please open the full article to read more."
        )

        set_in_cache(summary_cache, cache_key, placeholder)

        return {
            "source": "placeholder",
            "summary": placeholder,
        }

    # -----------------------------
    # 4️⃣ GENERATE SUMMARY
    # -----------------------------
    summary = summarizer.summarize(article_text)

    set_in_cache(summary_cache, cache_key, summary)

    return {
        "source": "generated",
        "summary": summary,
    }
