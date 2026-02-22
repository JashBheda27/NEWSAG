"""
NewsAura AI Chatbot Router
--------------------------
Context-aware personal news assistant that uses ONLY user's saved data.
NO external news calls. NO hallucinations.

Uses Ollama LLM for natural conversational responses with safe fallbacks.
"""

import logging
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user_optional
from app.core.cache import get_from_cache
from app.services.summarizer import TextSummarizer
from app.services.chat_llm import chat_llm, get_fallback_message

# Categories matching the news feed cache keys
NEWS_CATEGORIES = ["general", "nation", "business", "technology", "sports", "entertainment", "health"]

router = APIRouter()
logger = logging.getLogger(__name__)
summarizer = TextSummarizer()


# --------------------------------------------------
# Request / Response Models
# --------------------------------------------------
class ChatMessageRequest(BaseModel):
    message: str
    context: Optional[dict] = None  # e.g., {"article_id": "..."}


class ChatMessageResponse(BaseModel):
    reply: str
    intent: str
    sources: list[str] = []


# --------------------------------------------------
# Intent Detection (Rule-Based)
# --------------------------------------------------
INTENT_PATTERNS = {
    "summarize_saved": [
        r"summarize.*saved",
        r"summarize.*bookmarks?",
        r"summarize.*articles?",
        r"what.*saved",
        r"my.*saved.*articles?",
    ],
    "daily_briefing": [
        r"today.*briefing",
        r"daily.*briefing",
        r"news.*today",
        r"what.*happening",
        r"catch.*up",
        r"brief.*me",
    ],
    "article_qa": [
        r"about.*this.*article",
        r"what.*this.*article",
        r"explain.*article",
        r"tell.*me.*about",
        r"what.*does.*say",
    ],
    "top_topics": [
        r"what.*topics?.*read",
        r"top.*categor",
        r"favorite.*topics?",
        r"most.*read",
        r"reading.*habits?",
    ],
    "sentiment_insight": [
        r"why.*negative",
        r"why.*positive",
        r"sentiment",
        r"mood.*feed",
        r"tone.*articles?",
    ],
    "read_recommendation": [
        r"what.*should.*read",
        r"recommend",
        r"suggest.*article",
        r"read.*first",
        r"priority",
    ],
    "explain_simple": [
        r"explain.*like.*[0-9]",
        r"simple.*terms",
        r"eli5",
        r"simplify",
        r"dumb.*down",
    ],
    "compare_articles": [
        r"compare",
        r"difference.*between",
        r"similar.*articles?",
    ],
    "similar_read": [
        r"read.*similar",
        r"something.*like",
        r"related.*articles?",
    ],
    "greeting": [
        r"^hi$",
        r"^hello",
        r"^hey",
        r"^good\s",
    ],
    "help": [
        r"help",
        r"what.*can.*you",
        r"capabilities",
    ],
    "news_feed": [
        r"latest.*news",
        r"current.*news",
        r"today.*news",
        r"trending",
        r"what.*news",
        r"any.*news.*about",
        r"tell.*about.*news",
        r"feed",
        r"headlines?",
    ],
}



def detect_intent(message: str) -> str:
    """Detect user intent from message using keyword patterns."""
    message_lower = message.lower().strip()
    
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, message_lower):
                return intent
    
    return "general_query"


# --------------------------------------------------
# Context Aggregation Helpers
# --------------------------------------------------
async def get_user_bookmarks(db, user_id: str, limit: int = 20) -> list:
    """Fetch user's recent bookmarks."""
    cursor = db.bookmarks.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit)
    
    return [doc async for doc in cursor]


async def get_user_read_later(db, user_id: str, limit: int = 20) -> list:
    """Fetch user's read later items."""
    cursor = db.read_later.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit)
    
    return [doc async for doc in cursor]


async def get_user_summaries(db, user_id: str, limit: int = 10) -> list:
    """Fetch user's summary logs."""
    cursor = db.summary_logs.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit)
    
    return [doc async for doc in cursor]


async def get_cached_news_articles(limit_per_category: int = 10) -> list:
    """Fetch cached news articles from Redis (the actual news feed)."""
    all_articles = []
    seen_ids = set()
    for category in NEWS_CATEGORIES:
        cache_key = f"gnews:{category}"
        cached = await get_from_cache(cache_key)
        if not cached:
            continue
        for article in cached[:limit_per_category]:
            article_id = article.get("id") or article.get("url")
            if article_id and article_id not in seen_ids:
                seen_ids.add(article_id)
                all_articles.append(article)
    return all_articles


async def find_article_in_cache(article_id: str) -> Optional[dict]:
    """Find a specific article in the Redis news cache."""
    logger.info("[CHATBOT] Searching cache for article_id=%s", article_id)
    for category in NEWS_CATEGORIES:
        cache_key = f"gnews:{category}"
        cached = await get_from_cache(cache_key)
        if not cached:
            continue
        logger.debug("[CHATBOT] Searching category %s (has %d articles)", category, len(cached))
        for article in cached:
            article_lookup_id = article.get("id")
            article_lookup_url = article.get("url")
            if article_lookup_id == article_id or article_lookup_url == article_id:
                logger.info("[CHATBOT] ✓ Found article in cache: id=%s title=%s", 
                           article_id, article.get('title', 'N/A')[:50])
                return article
    logger.warning("[CHATBOT] ✗ Article not found in any cache category: id=%s", article_id)
    return None


def is_article_content_complete(article: dict) -> bool:
    """Heuristic to detect whether cached content looks complete."""
    content = article.get("content")
    if not content or not isinstance(content, str):
        return False
    content_stripped = content.strip()
    if not content_stripped:
        return False
    lowered = content_stripped.lower()
    truncation_markers = ["[+", "read more", "continue reading", "...", "…"]
    if any(marker in lowered for marker in truncation_markers):
        return False
    if content_stripped.endswith(("...", "…")):
        return False
    return True


async def get_user_analytics(db, user_id: str) -> dict:
    """Get analytics data for the user."""
    bookmarks_count = await db.bookmarks.count_documents({"user_id": user_id})
    read_later_count = await db.read_later.count_documents({"user_id": user_id})
    articles_read = await db.summary_logs.count_documents({"user_id": user_id})
    
    # Category breakdown
    category_counts = {}
    for collection in (db.bookmarks, db.read_later):
        pipeline = [
            {"$match": {"user_id": user_id, "category": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        ]
        async for row in collection.aggregate(pipeline):
            cat = row.get("_id")
            if cat:
                category_counts[cat] = category_counts.get(cat, 0) + row.get("count", 0)
    
    top_category = max(category_counts.items(), key=lambda x: x[1])[0] if category_counts else None
    
    # Sentiment breakdown
    sentiment_counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
    for collection in (db.bookmarks, db.read_later):
        cursor = collection.find(
            {"user_id": user_id, "sentiment": {"$exists": True}},
            projection={"sentiment": 1}
        )
        async for row in cursor:
            sentiment = row.get("sentiment")
            if isinstance(sentiment, dict):
                label = sentiment.get("label")
                if label in sentiment_counts:
                    sentiment_counts[label] += 1
    
    return {
        "bookmarks_count": bookmarks_count,
        "read_later_count": read_later_count,
        "articles_read": articles_read,
        "total_saved": bookmarks_count + read_later_count,
        "top_category": top_category,
        "category_breakdown": category_counts,
        "sentiment_breakdown": sentiment_counts,
    }


async def get_article_by_id(db, user_id: str, article_id: str) -> Optional[dict]:
    """Find a specific article in user's saved items."""
    # Check bookmarks first
    article = await db.bookmarks.find_one({
        "user_id": user_id,
        "$or": [
            {"article_id": article_id},
            {"_id": article_id},
            {"url": {"$regex": article_id, "$options": "i"}},
        ]
    })
    
    if not article:
        # Check read later
        article = await db.read_later.find_one({
            "user_id": user_id,
            "$or": [
                {"article_id": article_id},
                {"_id": article_id},
                {"url": {"$regex": article_id, "$options": "i"}},
            ]
        })
    
    return article


# --------------------------------------------------
# Context Builder for LLM
# --------------------------------------------------
def build_llm_context(
    bookmarks: list,
    read_later: list,
    analytics: dict,
    article: Optional[dict] = None,
    intent: str = "general",
    cached_articles: Optional[list] = None,
) -> str:
    """
    Build a context string from user data for the LLM.
    This ensures the LLM ONLY has access to user's saved data.
    """
    context_parts = []

    if intent == "news_feed":
        if cached_articles:
            context_parts.append("=== CURRENT NEWS FEED ===")
            for i, item in enumerate(cached_articles[:8], 1):
                title = item.get("title", "Untitled")[:80]
                source = item.get("source", "Unknown")
                if isinstance(source, dict):
                    source = source.get("name", "Unknown")
                cat = item.get("category", "general")
                context_parts.append(f"{i}. [{cat.upper()}] {title} — {source}")
            context_parts.append("")
        return "\n".join(context_parts)

    if intent in ("article_qa", "explain_simple"):
        if article:
            context_parts.append("=== CURRENT ARTICLE ===")
            context_parts.append(f"Title: {article.get('title', 'Untitled')}")
            source = article.get('source', 'Unknown')
            if isinstance(source, dict):
                source = source.get('name', 'Unknown')
            context_parts.append(f"Source: {source}")
            context_parts.append(f"Category: {article.get('category', 'general')}")
            
            # Include content with fallback to description
            content = article.get('content')
            description = article.get('description')
            
            if content and content.strip():
                context_parts.append(f"Content: {content}")
            elif description and description.strip():
                context_parts.append(f"Description: {description}")
            else:
                # If no content or description, include URL as fallback
                url = article.get('url', '')
                if url:
                    context_parts.append(f"URL: {url}")
                    context_parts.append(f"Description: [Article details available at source]")
            
            if isinstance(article.get('sentiment'), dict):
                sentiment = article['sentiment']
                context_parts.append(f"Sentiment: {sentiment.get('label', 'Unknown')}")
            context_parts.append("")
        return "\n".join(context_parts)
    
    # Add specific article context if provided
    if article:
        context_parts.append("=== CURRENT ARTICLE ===")
        context_parts.append(f"Title: {article.get('title', 'Untitled')}")
        source = article.get('source', 'Unknown')
        if isinstance(source, dict):
            source = source.get('name', 'Unknown')
        context_parts.append(f"Source: {source}")
        context_parts.append(f"Category: {article.get('category', 'general')}")
        if article.get('content'):
            context_parts.append(f"Content: {article.get('content')}")
        elif article.get('description'):
            context_parts.append(f"Description: {article.get('description')}")
        if isinstance(article.get('sentiment'), dict):
            sentiment = article['sentiment']
            context_parts.append(f"Sentiment: {sentiment.get('label', 'Unknown')}")
        context_parts.append("")
    
    # Add analytics summary
    context_parts.append("=== USER ANALYTICS ===")
    context_parts.append(f"Total saved articles: {analytics.get('total_saved', 0)}")
    context_parts.append(f"Bookmarks: {analytics.get('bookmarks_count', 0)}")
    context_parts.append(f"Read later items: {analytics.get('read_later_count', 0)}")
    context_parts.append(f"Articles summarized: {analytics.get('articles_read', 0)}")
    
    if analytics.get('top_category'):
        context_parts.append(f"Top category: {analytics['top_category']}")
    
    if analytics.get('category_breakdown'):
        cats = analytics['category_breakdown']
        context_parts.append(f"Category breakdown: {', '.join(f'{k}: {v}' for k, v in cats.items())}")
    
    if analytics.get('sentiment_breakdown'):
        sentiment = analytics['sentiment_breakdown']
        context_parts.append(f"Sentiment distribution: Positive={sentiment.get('Positive', 0)}, Neutral={sentiment.get('Neutral', 0)}, Negative={sentiment.get('Negative', 0)}")
    context_parts.append("")
    
    # Add recent bookmarks
    if bookmarks:
        context_parts.append("=== RECENT BOOKMARKS ===")
        for i, item in enumerate(bookmarks[:10], 1):
            title = item.get('title', 'Untitled')[:80]
            source = item.get('source', 'Unknown')
            cat = item.get('category', 'general')
            sentiment_info = ""
            if isinstance(item.get('sentiment'), dict):
                sentiment_info = f" [{item['sentiment'].get('label', '')}]"
            context_parts.append(f"{i}. {title} — {source} ({cat}){sentiment_info}")
        context_parts.append("")
    
    # Add read later items
    if read_later:
        context_parts.append("=== READ LATER ITEMS ===")
        for i, item in enumerate(read_later[:10], 1):
            title = item.get('title', 'Untitled')[:80]
            source = item.get('source', 'Unknown')
            cat = item.get('category', 'general')
            context_parts.append(f"{i}. {title} — {source} ({cat})")
        context_parts.append("")

    return "\n".join(context_parts)


# --------------------------------------------------
# Response Generators (Context-Bound) - FALLBACK
# --------------------------------------------------
SAFETY_PREFIX = """Answer ONLY using the provided context below.
If information is missing or insufficient, respond with:
"I don't have enough information to answer that based on your saved articles."

CONTEXT:
"""


def generate_summarize_saved_response(bookmarks: list, read_later: list) -> str:
    """Generate summary of user's saved articles."""
    all_items = bookmarks + read_later
    
    if not all_items:
        return "You don't have any saved articles yet. Start bookmarking articles you find interesting, and I'll help you summarize them!"
    
    # Group by category
    by_category = {}
    for item in all_items[:15]:  # Limit to recent 15
        cat = item.get("category", "general")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item.get("title", "Untitled"))
    
    response = f"📚 **Your Saved Articles Summary** ({len(all_items)} total)\n\n"
    
    for cat, titles in by_category.items():
        response += f"**{cat.title()}** ({len(titles)} articles):\n"
        for title in titles[:3]:
            response += f"  • {title[:60]}{'...' if len(title) > 60 else ''}\n"
        if len(titles) > 3:
            response += f"  • ...and {len(titles) - 3} more\n"
        response += "\n"
    
    return response.strip()


def generate_daily_briefing(bookmarks: list, read_later: list, analytics: dict) -> str:
    """Generate a daily briefing based on user's interests."""
    top_cat = analytics.get("top_category")
    all_items = bookmarks + read_later
    
    if not all_items:
        return "Good morning! You don't have any saved articles yet. Browse the news feed and save articles that interest you for personalized briefings."
    
    response = "📰 **Your Daily Briefing**\n\n"
    
    if top_cat:
        response += f"Based on your reading habits, you're most interested in **{top_cat}** news.\n\n"
    
    response += "**Recent Headlines from Your Saves:**\n"
    
    for item in all_items[:5]:
        title = item.get("title", "Untitled")
        source = item.get("source", "Unknown")
        sentiment = item.get("sentiment", {})
        sentiment_label = sentiment.get("label", "") if isinstance(sentiment, dict) else ""
        emoji = {"Positive": "🟢", "Negative": "🔴", "Neutral": "🟡"}.get(sentiment_label, "")
        
        response += f"• {emoji} **{title[:50]}{'...' if len(title) > 50 else ''}** — {source}\n"
    
    return response.strip()


def generate_article_qa_response(article: Optional[dict], question: str) -> str:
    """Answer questions about a specific article."""
    if not article:
        return "I don't have enough information to answer that based on the available articles."
    
    title = article.get("title", "Unknown title")
    source = article.get("source", "Unknown source")
    url = article.get("url", "")
    sentiment = article.get("sentiment", {})
    category = article.get("category", "general")
    
    response = f"📄 **About this article:**\n\n"
    response += f"**Title:** {title}\n"
    response += f"**Source:** {source}\n"
    response += f"**Category:** {category.title()}\n"
    
    if isinstance(sentiment, dict) and sentiment.get("label"):
        confidence = sentiment.get("confidence", 0)
        response += f"**Sentiment:** {sentiment['label']} ({int(confidence * 100)}% confidence)\n"

    summary_text = (
        article.get("summary")
        or article.get("description")
        or article.get("content")
    )
    if summary_text:
        summary_snippet = summary_text.strip().replace("\n", " ")
        response += f"\n**Summary:** {summary_snippet[:500]}"
    
    if url:
        response += f"\n[Read the full article]({url})"
    
    return response


def generate_top_topics_response(analytics: dict) -> str:
    """Explain user's reading patterns."""
    category_breakdown = analytics.get("category_breakdown", {})
    top_cat = analytics.get("top_category")
    total = analytics.get("total_saved", 0)
    
    if not category_breakdown:
        return "I don't have enough data about your reading patterns yet. Save more articles and I'll be able to tell you your favorite topics!"
    
    response = "📊 **Your Reading Patterns**\n\n"
    
    if top_cat:
        response += f"Your top category is **{top_cat.title()}**!\n\n"
    
    response += "**Category Breakdown:**\n"
    sorted_cats = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)
    
    for cat, count in sorted_cats[:5]:
        percentage = (count / total * 100) if total > 0 else 0
        bar = "█" * int(percentage / 10) + "░" * (10 - int(percentage / 10))
        response += f"• {cat.title()}: {bar} {count} ({percentage:.0f}%)\n"
    
    return response.strip()


def generate_sentiment_insight(analytics: dict) -> str:
    """Explain sentiment distribution in saved articles."""
    sentiment = analytics.get("sentiment_breakdown", {})
    total = sum(sentiment.values())
    
    if total == 0:
        return "I don't have sentiment data for your saved articles yet. The more articles you save, the better I can analyze the tone of your feed."
    
    positive = sentiment.get("Positive", 0)
    negative = sentiment.get("Negative", 0)
    neutral = sentiment.get("Neutral", 0)
    
    dominant = max(sentiment.items(), key=lambda x: x[1])[0]
    
    response = "💭 **Sentiment Analysis of Your Saved Articles**\n\n"
    response += f"• 🟢 Positive: {positive} articles ({positive/total*100:.0f}%)\n"
    response += f"• 🟡 Neutral: {neutral} articles ({neutral/total*100:.0f}%)\n"
    response += f"• 🔴 Negative: {negative} articles ({negative/total*100:.0f}%)\n\n"
    
    if dominant == "Negative" and negative > positive:
        response += "Your feed leans **negative**. This might be due to current events coverage. Consider balancing with uplifting stories from entertainment or technology sections."
    elif dominant == "Positive":
        response += "Your feed has a **positive** tone! You tend to save uplifting or optimistic news stories."
    else:
        response += "Your feed is **balanced**. You save a healthy mix of different news tones."
    
    return response


def generate_read_recommendation(bookmarks: list, read_later: list, analytics: dict) -> str:
    """Recommend what to read next."""
    # Prioritize read-later items
    if read_later:
        top_item = read_later[0]  # Most recent
        title = top_item.get("title", "Untitled")
        source = top_item.get("source", "Unknown")
        
        response = "📖 **My Recommendation**\n\n"
        response += f"Start with: **{title}** from {source}\n\n"
        response += f"_This is at the top of your Read Later list. You have {len(read_later)} items waiting!_"
        return response
    
    if bookmarks:
        # Recommend based on top category
        top_cat = analytics.get("top_category")
        for item in bookmarks:
            if item.get("category") == top_cat:
                title = item.get("title", "Untitled")
                response = f"📖 Based on your interest in **{top_cat}**, I recommend:\n\n"
                response += f"**{title}**"
                return response
        
        # Fallback to most recent
        title = bookmarks[0].get("title", "Untitled")
        return f"📖 Check out your most recent bookmark: **{title}**"
    
    return "You don't have any saved articles yet! Browse the feed and bookmark articles you'd like to read later."


def generate_explain_simple(article: Optional[dict]) -> str:
    """Simplify article explanation."""
    if not article:
        return "Please select an article first by clicking 'Ask AI about this article' on a news card."
    
    title = article.get("title", "")
    
    return f"🧒 **Simple Explanation**\n\nThe article '{title[:40]}...' talks about something happening in the news. To give you a kid-friendly explanation, I'd need the full article content. Try asking me after viewing the AI summary of this article!"


def generate_compare_articles(bookmarks: list, read_later: list) -> str:
    """Compare saved articles."""
    all_items = bookmarks + read_later
    
    if len(all_items) < 2:
        return "You need at least 2 saved articles to compare. Save more articles and try again!"
    
    item1, item2 = all_items[0], all_items[1]
    
    response = "⚖️ **Comparing Your Two Most Recent Saves**\n\n"
    response += f"**Article 1:** {item1.get('title', 'Untitled')[:50]}\n"
    response += f"  • Source: {item1.get('source', 'Unknown')}\n"
    response += f"  • Category: {item1.get('category', 'general')}\n\n"
    response += f"**Article 2:** {item2.get('title', 'Untitled')[:50]}\n"
    response += f"  • Source: {item2.get('source', 'Unknown')}\n"
    response += f"  • Category: {item2.get('category', 'general')}\n\n"
    
    if item1.get("category") == item2.get("category"):
        response += f"_Both articles are about **{item1.get('category', 'general')}**._"
    else:
        response += "_These articles cover different topics._"
    
    return response


def generate_similar_read(bookmarks: list, read_later: list, analytics: dict) -> str:
    """Find similar articles based on category."""
    top_cat = analytics.get("top_category")
    all_items = bookmarks + read_later
    
    if not top_cat or not all_items:
        return "I need more data about your reading patterns. Save more articles and I'll find similar ones for you!"
    
    similar = [item for item in all_items if item.get("category") == top_cat]
    
    if len(similar) < 2:
        return f"You only have {len(similar)} article(s) in your top category ({top_cat}). Save more from this category!"
    
    response = f"📎 **Similar Articles in {top_cat.title()}**\n\n"
    for item in similar[:5]:
        response += f"• {item.get('title', 'Untitled')[:50]}\n"
    
    return response


def generate_greeting_response(analytics: dict) -> str:
    """Friendly greeting with context."""
    total = analytics.get("total_saved", 0)
    articles_read = analytics.get("articles_read", 0)
    
    response = "👋 **Hello! I'm your NewsAura AI assistant.**\n\n"
    response += "I can help you with:\n"
    response += "• Summarizing your saved articles\n"
    response += "• Giving you a daily briefing\n"
    response += "• Answering questions about specific articles\n"
    response += "• Analyzing your reading patterns\n"
    response += "• Recommending what to read next\n\n"
    
    if total > 0:
        response += f"_You have **{total}** saved articles and have read **{articles_read}** summaries._"
    else:
        response += "_Start saving articles to get personalized insights!_"
    
    return response


def generate_help_response() -> str:
    """List chatbot capabilities."""
    return """🤖 **NewsAura AI Capabilities**

**What I can do:**
• "Summarize my saved articles" — Get an overview of all your bookmarks
• "Give me today's briefing" — Quick headlines from your interests
• "What topics do I read the most?" — Your reading pattern analysis
• "Why is my feed negative?" — Sentiment breakdown
• "What should I read first?" — Personalized recommendations
• "Compare two saved articles" — Side-by-side comparison
• "Have I read something similar?" — Find related articles

**Contextual questions:**
Click "Ask AI" on any article card to ask questions about specific articles.

_I only use your saved articles and reading history — no external lookups!_"""


def generate_fallback_response(message: str) -> str:
    """Fallback for unrecognized intents."""
    return f"""I'm not sure how to help with that specific request.

**Try asking me things like:**
• "Summarize my saved articles"
• "Give me a daily briefing"
• "What topics do I read the most?"
• "What should I read next?"

Or click "Ask AI" on an article card for article-specific questions!"""


# --------------------------------------------------
# Response Formatting Helpers (Backend-Controlled)
# --------------------------------------------------
def format_article_response(article: dict, llm_text: str) -> str:
    """
    Format LLM response with structured article metadata.
    Backend controls formatting, not the LLM.
    
    Args:
        article: Article dict with title, category, sentiment, etc.
        llm_text: Raw LLM response text
    
    Returns:
        Formatted response string with article overview + explanation
    """
    # Extract article metadata with defaults
    title = article.get("title", "Untitled Article")
    category = article.get("category", "General")
    if not category:
        category = "General"
    category = category.title()
    
    # Extract sentiment with proper handling
    sentiment = article.get("sentiment", {})
    sentiment_label = "Unknown"
    sentiment_confidence = 0
    
    if isinstance(sentiment, dict):
        sentiment_label = sentiment.get("label", "Unknown")
        confidence_raw = sentiment.get("confidence", 0)
        # Convert to percentage (handle both 0-1 float and already-percentage values)
        if isinstance(confidence_raw, (int, float)):
            if confidence_raw <= 1.0:
                sentiment_confidence = int(confidence_raw * 100)
            else:
                sentiment_confidence = int(confidence_raw)
    
    # Sentiment emoji mapping
    sentiment_emoji = {
        "Positive": "😊",
        "Negative": "😞",
        "Neutral": "😐",
        "Unknown": "❓"
    }.get(sentiment_label, "❓")
    
    # Clean up LLM text
    llm_text_clean = llm_text.strip() if llm_text else ""
    
    # Remove any accidental markdown headings from LLM
    llm_text_clean = re.sub(r'^#+\s+', '', llm_text_clean, flags=re.MULTILINE)
    
    # Remove excessive whitespace and line breaks
    llm_text_clean = re.sub(r'\n{3,}', '\n\n', llm_text_clean)
    llm_text_clean = re.sub(r' {2,}', ' ', llm_text_clean)
    
    # Limit response length (~200 words max)
    words = llm_text_clean.split()
    if len(words) > 200:
        llm_text_clean = ' '.join(words[:200]) + "..."
    
    # Build formatted response
    response_parts = []
    
    # Article overview section
    response_parts.append("📄 ARTICLE OVERVIEW")
    response_parts.append("")
    response_parts.append(f"📰 Title: {title}")
    response_parts.append(f"🏷 Category: {category}")
    
    # Only include sentiment if we have valid data
    if sentiment_label != "Unknown":
        response_parts.append(f"{sentiment_emoji} Sentiment: {sentiment_label} ({sentiment_confidence}%)")
    else:
        response_parts.append(f"{sentiment_emoji} Sentiment: Not analyzed")
    
    response_parts.append("")
    response_parts.append("📝 Explanation:")
    response_parts.append(llm_text_clean)
    
    # Join with single newlines, trim final result
    formatted_response = "\n".join(response_parts).strip()
    
    return formatted_response


# --------------------------------------------------
# Main Chat Endpoint
# --------------------------------------------------
@router.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    request: ChatMessageRequest,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """
    Process a chat message and return a context-aware response.
    
    Flow:
    1. Detect intent from message
    2. Fetch relevant context (bookmarks, read-later, analytics)
    3. Try LLM response first (Ollama)
    4. Fallback to rule-based generators if LLM unavailable
    """
    user_id = user["user_id"]
    message = request.message.strip()
    context = request.context or {}
    
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    logger.info("[CHATBOT] user_id=%s message=%s", user_id, message[:50])
    
    # Detect intent
    intent = detect_intent(message)
    
    # Article context override
    article_id = context.get("article_id")
    
    logger.info("[CHATBOT] Processing request: intent=%s article_id=%s", intent, article_id)

    if intent == "article_qa" and not article_id:
        return ChatMessageResponse(
            reply=(
                "Please select an article first. Use the article card's Ask AI option so I can answer about a specific article."
            ),
            intent=intent,
            sources=[],
        )
    
    # Fetch user data + cached news
    if intent == "news_feed":
        bookmarks = []
        read_later = []
        analytics = {}
        cached_articles = await get_cached_news_articles(limit_per_category=3)
    else:
        bookmarks = await get_user_bookmarks(db, user_id)
        read_later = await get_user_read_later(db, user_id)
        analytics = await get_user_analytics(db, user_id)
        cached_articles = await get_cached_news_articles(limit_per_category=3)
    
    # Fetch specific article if referenced
    article = None
    article_from_cache = False
    if article_id:
        # Check user's saved items first, then fall back to cache
        article = await get_article_by_id(db, user_id, article_id)
        if article:
            logger.info("[CHATBOT] Article found in user saved items - id=%s title=%s", 
                       article_id, article.get('title', 'N/A')[:50])
        else:
            article = await find_article_in_cache(article_id)
            if article:
                article_from_cache = True
                logger.info("[CHATBOT] Article found in cache - id=%s title=%s", 
                           article_id, article.get('title', 'N/A')[:50])
            else:
                logger.warning("[CHATBOT] Article NOT found - id=%s (not in saved items or cache)", article_id)
    
    sources = []
    reply = ""
    used_llm = False
    
    # Determine data sources based on intent
    if intent in ("summarize_saved", "article_qa", "explain_simple", "compare_articles"):
        sources = ["bookmarks", "read_later", "news_cache"]
    elif intent in ("daily_briefing", "read_recommendation", "similar_read"):
        sources = ["bookmarks", "read_later", "analytics", "news_cache"]
    elif intent == "news_feed":
        sources = ["news_cache"]
    elif intent in ("top_topics", "sentiment_insight", "greeting"):
        sources = ["analytics"]
    elif intent == "help":
        sources = []
    else:
        sources = ["bookmarks", "read_later", "analytics", "news_cache"]
    
    # Build context for LLM
    llm_context = build_llm_context(
        bookmarks=bookmarks,
        read_later=read_later,
        analytics=analytics,
        article=article,
        intent=intent,
        cached_articles=cached_articles,
    )
    
    # Debug: log the context being sent to LLM
    has_article_section = "=== CURRENT ARTICLE ===" in llm_context
    llm_context_preview = llm_context[:300] + ("..." if len(llm_context) > 300 else "")
    logger.info("[CHATBOT] LLM Context has ARTICLE: %s | context_len=%d | preview=%s", 
               has_article_section, len(llm_context), llm_context_preview.replace('\n', ' ')[:100])
    
    # Safety check: if article_qa intent but no context, log warning
    if intent == "article_qa" and (not llm_context or llm_context.strip() == ""):
        logger.warning("[CHATBOT] article_qa intent but empty context - article_id=%s, article=%s", 
                      article_id, "found" if article else "not_found")
    
    llm_response = await chat_llm.send_prompt(
        context=llm_context,
        user_message=message,
        intent=intent
    )

    if llm_response:
        reply = llm_response
        used_llm = True
        logger.info("[CHATBOT] Using LLM response for intent=%s", intent)
        
        # Apply backend-controlled formatting for article_qa intent
        if intent == "article_qa" and article:
            reply = format_article_response(article, llm_response)
            logger.info("[CHATBOT] Applied article formatting to response")
    else:
        reply = get_fallback_message()
    
    if article_from_cache and article:
        content_complete = is_article_content_complete(article)
        availability_note = "full" if content_complete else "partial"
        reply = f"{reply}\n\nCached article text: {availability_note}."

    # Optional: Store chat message
    try:
        await db.chat_messages.insert_one({
            "user_id": user_id,
            "role": "user",
            "content": message,
            "created_at": datetime.utcnow(),
        })
        await db.chat_messages.insert_one({
            "user_id": user_id,
            "role": "assistant",
            "content": reply,
            "intent": intent,
            "used_llm": used_llm,
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        logger.warning("[CHATBOT] Failed to store chat: %s", e)
    
    logger.info("[CHATBOT] intent=%s sources=%s used_llm=%s", intent, sources, used_llm)
    
    return ChatMessageResponse(
        reply=reply,
        intent=intent,
        sources=sources,
    )


# --------------------------------------------------
# Chat History Endpoint
# --------------------------------------------------
@router.get("/history")
async def get_chat_history(
    limit: int = 20,
    user=Depends(get_current_user_optional),
    db=Depends(get_db),
):
    """Get recent chat history for the user."""
    user_id = user["user_id"]
    
    cursor = db.chat_messages.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit)
    
    messages = []
    async for doc in cursor:
        messages.append({
            "role": doc.get("role"),
            "content": doc.get("content"),
            "intent": doc.get("intent"),
            "created_at": doc.get("created_at"),
        })
    
    # Reverse to show oldest first
    messages.reverse()
    
    return {"messages": messages, "count": len(messages)}
