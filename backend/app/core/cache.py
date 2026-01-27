import json
import redis.asyncio as redis
from typing import Any, Optional
from app.core.config import settings

# -----------------------------
# REDIS CLIENT (SINGLETON)
# -----------------------------
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get Redis client singleton"""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        except Exception as e:
            print(f"[REDIS INIT ERROR] {e}")
            return None
    return _redis_client


async def close_redis():
    """Close Redis connection"""
    global _redis_client
    if _redis_client:
        try:
            await _redis_client.close()
        except Exception as e:
            print(f"[REDIS CLOSE ERROR] {e}")
        finally:
            _redis_client = None


# -----------------------------
# CACHE HELPERS (REDIS-BACKED)
# -----------------------------
async def get_from_cache(key: str) -> Optional[Any]:
    """
    Retrieve value from Redis cache
    Returns: Deserialized value or None
    """
    try:
        client = await get_redis()
        if client is None:
            return None
        value = await client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        print(f"[REDIS GET ERROR] {key}: {e}")
        return None


async def set_in_cache(key: str, value: Any, ttl: int = None):
    """
    Store value in Redis cache with optional TTL
    :param key: cache key
    :param value: value to cache (will be JSON-serialized)
    :param ttl: time-to-live in seconds (default: CACHE_TTL_NEWS)
    """
    try:
        client = await get_redis()
        if client is None:
            return
        serialized = json.dumps(value)
        
        if ttl is None:
            ttl = settings.CACHE_TTL_NEWS
        
        await client.setex(key, ttl, serialized)
    except Exception as e:
        print(f"[REDIS SET ERROR] {key}: {e}")


async def delete_from_cache(key: str):
    """Delete key from Redis cache"""
    try:
        client = await get_redis()
        if client is None:
            return
        await client.delete(key)
    except Exception as e:
        print(f"[REDIS DELETE ERROR] {key}: {e}")


async def clear_pattern(pattern: str):
    """Delete all keys matching a pattern"""
    try:
        client = await get_redis()
        if client is None:
            return
        keys = await client.keys(pattern)
        if keys:
            await client.delete(*keys)
    except Exception as e:
        print(f"[REDIS CLEAR ERROR] {pattern}: {e}")

