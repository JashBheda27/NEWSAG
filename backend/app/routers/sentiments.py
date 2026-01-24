import hashlib
from fastapi import APIRouter, HTTPException
from app.core.cache import sentiment_cache, get_from_cache, set_in_cache
from app.services.sentiment import SentimentAnalyzer

router = APIRouter()
analyzer = SentimentAnalyzer()


@router.post("/")
async def analyze_sentiment(payload: dict):
    """
    Analyze sentiment of input text.
    Rule-based NLP, no AI.
    """

    text = payload.get("text")

    if not text or len(text.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Text is too short for sentiment analysis"
        )

    cache_key = f"sentiment:{hashlib.md5(text.encode()).hexdigest()}"

    # --------------------------------------------------
    # Cache check
    # --------------------------------------------------
    cached = get_from_cache(sentiment_cache, cache_key)
    if cached:
        return {
            "source": "cache",
            "result": cached
        }

    # --------------------------------------------------
    # Analyze sentiment
    # --------------------------------------------------
    result = analyzer.analyze(text)

    # --------------------------------------------------
    # Cache result
    # --------------------------------------------------
    set_in_cache(sentiment_cache, cache_key, result)

    return {
        "source": "computed",
        "result": result
    }
