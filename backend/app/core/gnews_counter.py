"""
GNews API Hit Counter
Tracks API calls for rate limiting (100 requests/day free tier)
"""

from datetime import datetime
from typing import Dict
from app.core.cache import get_from_cache, set_in_cache, delete_from_cache

class GNewsCounter:
    """
    Central counter for GNews API hits
    Uses cache to persist across requests
    Resets daily at midnight UTC
    """
    
    CACHE_KEY = "gnews:hits:today"
    MAX_HITS_PER_DAY = 100
    WARNING_THRESHOLD = 80  # Warn at 80% usage
    
    @staticmethod
    def get_today_key() -> str:
        """Get cache key for today"""
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        return f"{GNewsCounter.CACHE_KEY}:{date_str}"
    
    @staticmethod
    async def increment_hit() -> Dict[str, int]:
        """
        Increment hit counter for today
        Returns: {"today_hits": int, "remaining_hits": int, "warning": bool}
        """
        cache_key = GNewsCounter.get_today_key()
        
        # Get current count (default 0 if not set)
        current_hits = await get_from_cache(cache_key) or 0
        
        # Increment
        new_hits = current_hits + 1
        
        # Store back in cache with 24-hour TTL
        await set_in_cache(cache_key, new_hits, ttl=86400)
        
        remaining = max(0, GNewsCounter.MAX_HITS_PER_DAY - new_hits)
        is_warning = new_hits >= GNewsCounter.WARNING_THRESHOLD
        
        return {
            "today_hits": new_hits,
            "remaining_hits": remaining,
            "warning": is_warning,
            "max_hits": GNewsCounter.MAX_HITS_PER_DAY,
        }
    
    @staticmethod
    async def get_hit_status() -> Dict[str, int]:
        """
        Get current hit status without incrementing
        Returns: {"today_hits": int, "remaining_hits": int}
        """
        cache_key = GNewsCounter.get_today_key()
        
        # Get current count (default 0 if not set)
        current_hits = await get_from_cache(cache_key) or 0
        remaining = max(0, GNewsCounter.MAX_HITS_PER_DAY - current_hits)
        is_warning = current_hits >= GNewsCounter.WARNING_THRESHOLD
        
        return {
            "today_hits": current_hits,
            "remaining_hits": remaining,
            "warning": is_warning,
            "max_hits": GNewsCounter.MAX_HITS_PER_DAY,
        }
    
    @staticmethod
    async def check_limit() -> tuple[bool, str]:
        """
        Check if we can make another API call
        Returns: (can_call: bool, message: str)
        """
        cache_key = GNewsCounter.get_today_key()
        current_hits = await get_from_cache(cache_key) or 0
        
        if current_hits >= GNewsCounter.MAX_HITS_PER_DAY:
            return (
                False,
                f"GNews API limit reached ({GNewsCounter.MAX_HITS_PER_DAY}/day). Reset at midnight UTC."
            )
        
        if current_hits >= GNewsCounter.WARNING_THRESHOLD:
            remaining = GNewsCounter.MAX_HITS_PER_DAY - current_hits
            return (
                True,
                f"⚠️ WARNING: Only {remaining} API hits remaining today"
            )
        
        return (True, "OK")
    
    @staticmethod
    async def reset_counter() -> Dict[str, int]:
        """
        Manually reset counter (for testing/admin)
        Returns: reset status
        """
        cache_key = GNewsCounter.get_today_key()
        await delete_from_cache(cache_key)
        
        return {
            "status": "reset",
            "today_hits": 0,
            "remaining_hits": GNewsCounter.MAX_HITS_PER_DAY,
        }
