"""
NewsAura Chat LLM Service
-------------------------
Wraps Ollama HTTP calls for chatbot responses ONLY.
Does NOT replace summarizer or sentiment_ml services.
"""

import logging
import httpx
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatLLMService:
    """
    Service for generating chatbot responses using Ollama.
    
    IMPORTANT: This service is ONLY for conversational chatbot responses.
    Summarization and sentiment analysis use separate services.
    """
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT
        self._available: Optional[bool] = None
    
    async def is_available(self) -> bool:
        """Check if Ollama server is running."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                self._available = response.status_code == 200
                return self._available
        except Exception as e:
            logger.warning("[CHAT_LLM] Ollama not available: %s", e)
            self._available = False
            return False
    
    def _build_safe_prompt(self, context: str, user_message: str) -> str:
        """
        Build a safe prompt that constrains the LLM to ONLY use provided context.
        This prevents hallucinations and ensures answers are data-bound.
        """
    def _build_safe_prompt(self, context: str, user_message: str) -> str:
        """
        Build a safe prompt that constrains the LLM to ONLY use provided context.
        This prevents hallucinations and ensures answers are data-bound.
        """
        return f"""Answer the question using ONLY the information below. Do not use any outside knowledge.

=== INFORMATION ===
{context}

=== QUESTION ===
{user_message}

=== YOUR ANSWER ===
"""

    async def send_prompt(
        self,
        context: str,
        user_message: str,
        intent: str = "general"
    ) -> Optional[str]:
        """
        Send a prompt to Ollama and return the response.
        
        Args:
            context: Aggregated context from user's data (bookmarks, read-later, analytics)
            user_message: The user's question/message
            intent: Detected intent (for logging)
        
        Returns:
            LLM response string, or None if unavailable/error
        """
        # Log context details for debugging
        has_article_context = "=== CURRENT ARTICLE ===" in context
        has_news_feed_context = "=== CURRENT NEWS FEED ===" in context
        logger.info("[CHAT_LLM] Sending prompt: intent=%s has_article=%s has_feed=%s context_len=%d",
                   intent, has_article_context, has_news_feed_context, len(context))
        
        # Build constrained prompt
        prompt = self._build_safe_prompt(context, user_message)
        
        # Use separate connect (10s) and read (full timeout) limits
        timeout = httpx.Timeout(self.timeout, connect=10.0)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "top_p": 0.9,
                            "num_predict": 550,  # Allow longer responses
                            "num_ctx": 3072,     # More room for article context
                        }
                    }
                )
                
                if response.status_code != 200:
                    logger.error("[CHAT_LLM] Ollama returned %d: %s", 
                                response.status_code, response.text[:200])
                    return None
                
                data = response.json()
                generated_text = data.get("response", "").strip()
                
                if not generated_text:
                    logger.warning("[CHAT_LLM] Empty response from Ollama")
                    return None
                
                # Check if this looks like a fallback/refusal response
                is_fallback = "don't have enough information" in generated_text.lower()
                logger.info("[CHAT_LLM] Generated response for intent=%s (len=%d) is_fallback=%s",
                           intent, len(generated_text), is_fallback)
                
                return generated_text
                
        except httpx.TimeoutException:
            logger.error("[CHAT_LLM] Ollama request timed out after %ds", self.timeout)
            return None
        except httpx.ConnectError:
            logger.error("[CHAT_LLM] Cannot connect to Ollama at %s — is 'ollama serve' running?", self.base_url)
            return None
        except Exception as e:
            logger.error("[CHAT_LLM] Unexpected error: %s", e)
            return None
    
    async def explain_like_five(self, article_title: str, article_content: str) -> Optional[str]:
        """
        Generate an ELI5 (Explain Like I'm 5) explanation of an article.
        """
        prompt = f"""You are NewsAura AI Assistant.

Explain the following news article in very simple terms that a 5-year-old could understand.
Use simple words, short sentences, and fun analogies.

ARTICLE TITLE: {article_title}

ARTICLE CONTENT:
{article_content[:1500]}

ELI5 EXPLANATION:"""
        
        timeout = httpx.Timeout(self.timeout, connect=10.0)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.8,
                            "num_predict": 300,
                        }
                    }
                )
                
                if response.status_code == 200:
                    return response.json().get("response", "").strip()
                return None
                
        except Exception as e:
            logger.error("[CHAT_LLM] ELI5 error: %s", e)
            return None
    
    async def explain_trend(self, trend_data: dict) -> Optional[str]:
        """
        Generate a natural language explanation of a trend in user's reading.
        """
        prompt = f"""You are NewsAura AI Assistant.

Based on the following analytics data, explain to the user what trends you notice in their reading habits.
Be insightful but concise.

ANALYTICS DATA:
{trend_data}

TREND EXPLANATION:"""
        
        try:
            timeout = httpx.Timeout(self.timeout, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 250,
                        }
                    }
                )
                
                if response.status_code == 200:
                    return response.json().get("response", "").strip()
                return None
                
        except Exception as e:
            logger.error("[CHAT_LLM] Trend explanation error: %s", e)
            return None


# Singleton instance
chat_llm = ChatLLMService()


# Convenience function for fallback message
FALLBACK_MESSAGE = "AI assistant is temporarily unavailable. Please try again in a moment."


def get_fallback_message() -> str:
    """Return the standard fallback message when LLM is unavailable."""
    return FALLBACK_MESSAGE
