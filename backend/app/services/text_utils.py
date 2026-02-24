import asyncio
import httpx
import re
import logging
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator
from app.core.constants import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

# Thread pool for blocking I/O operations
_TRANSLATE_EXECUTOR = ThreadPoolExecutor(max_workers=4)


def _translate_sync(text: str, target_lang: str) -> str:
    """Synchronous translation (runs in thread pool)."""
    try:
        translated = GoogleTranslator(source="en", target=target_lang).translate(text)
        return translated or text
    except Exception as e:
        logger.error("[TRANSLATE] Translation failed for lang=%s: %s", target_lang, e)
        return text


async def translate_text(text: str, target_lang: str) -> str:
    """
    Translate text to the target language using Google Translate.
    
    OPTIMIZED: Runs in thread pool to avoid blocking event loop.
    """
    if not text or target_lang == "en":
        return text

    if target_lang not in SUPPORTED_LANGUAGES:
        logger.warning("[TRANSLATE] Unsupported language: %s", target_lang)
        return text

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_TRANSLATE_EXECUTOR, _translate_sync, text, target_lang)


async def extract_article_text(url: str) -> str:
    """
    Fetch and extract readable text from a news article URL.
    Uses simple paragraph-based extraction with retry logic.
    """

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
    }

    max_retries = 2
    last_error = None

    for attempt in range(max_retries + 1):
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            try:
                response = await client.get(url, headers=headers)
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    logger.warning(
                        "[SCRAPE] Retry %d/%d | url=%s | err=%s",
                        attempt + 1, max_retries, url, e,
                    )
                    import asyncio
                    await asyncio.sleep(1.0 * (attempt + 1))  # backoff
                    continue
                raise Exception(f"Failed to fetch URL after {max_retries + 1} attempts: {last_error}")

        if response.status_code != 200:
            logger.warning("[SCRAPE] HTTP %d | url=%s", response.status_code, url)
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(1.0 * (attempt + 1))
                continue
            raise Exception(f"HTTP {response.status_code}: Failed to fetch article content")

        # Successful response — break out of retry loop
        break

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove non-content elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    # Try multiple strategies to find content
    paragraphs = soup.find_all("p")
    
    if not paragraphs:
        # Fallback: look for divs with text content
        paragraphs = soup.find_all("div", {"class": re.compile(r"(content|article|post|story|text)", re.I)})
    
    if not paragraphs:
        # Last resort: get all text
        text = soup.get_text()
    else:
        text = " ".join(p.get_text() for p in paragraphs)

    # Clean excessive whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Validate: reject if too short (likely paywall / cookie wall)
    word_count = len(text.split())
    if word_count < 30:
        logger.warning(
            "[SCRAPE] Extracted text too short | words=%d | url=%s", word_count, url
        )
        return ""

    return text
