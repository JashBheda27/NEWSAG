# Redis Cache Migration - Complete

## Overview

Replaced in-memory TTLCache with Redis-backed caching for production reliability, scalability, and persistence across server restarts.

## Changes Summary

### 1. **Configuration** (`app/core/config.py`)
- Added `REDIS_URL` setting with default: `redis://localhost:6379`
- Environment variable: `REDIS_URL`

### 2. **Cache Layer** (`app/core/cache.py`)
**Removed:**
- `cachetools.TTLCache` instances (news_cache, summary_cache, sentiment_cache)
- Synchronous cache operations

**Added:**
- Async Redis client with connection pooling
- JSON serialization/deserialization
- Helper functions (all async):
  - `get_redis()` - Get singleton Redis connection
  - `get_from_cache(key)` - Retrieve cached value
  - `set_in_cache(key, value, ttl=CACHE_TTL_NEWS)` - Store with TTL
  - `delete_from_cache(key)` - Delete specific key
  - `clear_pattern(pattern)` - Delete keys by pattern

### 3. **News Router** (`app/routers/news.py`)
**Changes:**
- Removed `news_cache` object import
- Made `get_news_by_topic()` fully async with `await` on cache calls
- Updated `refresh_category()` to use `delete_from_cache()`
- Updated `refresh_all()` to use async deletion
- All endpoints maintain cache-first policy

### 4. **Summary Router** (`app/routers/summary.py`)
**Changes:**
- Removed `summary_cache` object import
- Made summary generation fully async
- Cache operations use `await`
- Same fallback strategy preserved (NLP → Description → Placeholder)

### 5. **Sentiment Router** (`app/routers/sentiments.py`)
**Changes:**
- Removed `sentiment_cache` object import
- Made cache operations async
- Preserved cache-first logic

### 6. **Hit Counter** (`app/core/gnews_counter.py`)
**Changes:**
- Removed direct `news_cache` access
- Made all methods async:
  - `increment_hit()` - Increment counter with 24h TTL
  - `get_hit_status()` - Get status without increment
  - `check_limit()` - Check API quota
  - `reset_counter()` - Reset for testing
- Counter stored in Redis with daily key: `gnews:hits:today:YYYY-MM-DD`

### 7. **Application Lifecycle** (`app/main.py`)
**Added:**
- Import Redis cache management functions
- `startup_event()` - Initialize Redis connection
- `shutdown_event()` - Close Redis connection gracefully

### 8. **Dependencies** (`requirements.txt`)
**Changed:**
- Removed: `cachetools`
- Added: `redis` (async-compatible)

## Key Design Decisions

### Async-First
All cache operations are async (`redis.asyncio`) for compatibility with FastAPI's async event loop.

### Singleton Pattern
Redis client is created once on startup and reused across all requests, preventing connection pooling issues.

### JSON Serialization
All cached values are JSON-serialized for:
- Database compatibility
- Cross-language support
- Easy inspection in Redis CLI

### TTL Management
- Uses Redis `SETEX` command (atomic set + expire)
- Hit counter uses 24-hour TTL to span daily window
- Other caches use `CACHE_TTL_NEWS` (15 minutes by default)

### Key Naming Convention
```
gnews:{category}              # News articles by category
summary:{article_hash}        # Article summaries
sentiment:{text_hash}         # Sentiment analysis results
gnews:hits:today:{YYYY-MM-DD} # Daily hit counter
```

### Cache-First Policy
1. Check Redis cache first (no API call)
2. On cache miss: call GNews API exactly once
3. Store result in Redis with TTL
4. Increment hit counter only on API call (not cache hit)

## Configuration

### Environment Variables

```bash
# Redis connection (required for production)
REDIS_URL=redis://user:password@redis-host:6379/0

# Alternative formats:
# redis://localhost:6379              (local dev)
# rediss://host:6379                  (TLS)
# unix:///path/to/redis.sock          (Unix socket)
```

### Default Values
- `REDIS_URL`: `redis://localhost:6379` (local development)
- `CACHE_TTL_NEWS`: `900` seconds (15 minutes)

## Testing

### Local Development

1. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis:latest
   ```

2. **Set environment (optional):**
   ```bash
   export REDIS_URL=redis://localhost:6379
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run backend:**
   ```bash
   uvicorn app.main:app --reload
   ```

### Verify Redis Connection
```bash
# Check Redis logs
curl http://localhost:8000/api/news/topic/general

# Inspect cache in Redis CLI
redis-cli
> KEYS *
> GET gnews:general
> TTL gnews:general
```

## Migration Checklist

- [x] Replaced TTLCache with Redis
- [x] Made all cache operations async
- [x] Updated hit counter to use Redis
- [x] Updated all routers (news, summary, sentiment)
- [x] Added Redis lifecycle management (startup/shutdown)
- [x] Updated requirements.txt
- [x] Preserved all cache keys and TTL semantics
- [x] Maintained GNews quota protection
- [x] No breaking changes to API responses

## Backward Compatibility

✅ **Fully backward compatible:**
- Same cache keys
- Same TTL behavior
- Same API response shapes
- Same cache-first policy
- No frontend changes required

## Performance Impact

- **Startup time**: +100-200ms (Redis connection)
- **Cache lookup**: ~1-5ms (vs <1ms in-memory, but network-bound anyway)
- **Scalability**: Multi-worker support ✅
- **Persistence**: Survives restarts ✅
- **GNews quota protection**: Stricter (no duplicate calls) ✅

## Troubleshooting

### "redis.ConnectionError: Connection refused"
- Redis server not running
- `REDIS_URL` incorrect
- Firewall blocking port 6379

### "json.JSONDecodeError: Expecting value"
- Corrupted cache data in Redis
- Solution: `redis-cli FLUSHALL` (clears all cache)

### Hit counter not incrementing
- Check: `redis-cli KEYS gnews:hits:*`
- Verify: `redis-cli TTL gnews:hits:today:*` (should be ~86400)

## Production Deployment

### Recommended Setup
```
REDIS_URL=rediss://redis-cluster-host:6379
  ↓
  TLS enabled
  Connection pooling enabled
  High availability (Redis Sentinel/Cluster)
```

### Environment Variables (Production)
```bash
export REDIS_URL=rediss://user:password@redis.prod.com:6379/0
export MONGO_URI=mongodb+srv://user:pass@mongo.prod.com/newsaura
export GNEWS_API_KEY=your_api_key
```

## Rollback (if needed)

To revert to TTLCache:
1. Restore `requirements.txt` (add `cachetools`)
2. Restore `app/core/cache.py` (TTLCache version)
3. Remove `async`/`await` from cache calls
4. Remove Redis lifecycle from `app/main.py`

Not recommended - Redis is superior for production.
