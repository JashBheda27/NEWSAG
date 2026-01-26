# 🎯 GNews Hit Counter - Implementation Complete

## Overview
Central hit counter to track API calls and manage the 100 requests/day limit on GNews free tier.

---

## 🏗️ Architecture

### Counter Service
**File**: `backend/app/core/gnews_counter.py`

```python
GNewsCounter.increment_hit()      # Called after API call
GNewsCounter.get_hit_status()     # Get current status
GNewsCounter.check_limit()        # Check if can call API
GNewsCounter.reset_counter()      # Admin reset
```

### How It Works
1. **Track Hits**: Every GNews API call increments counter
2. **Cache Storage**: Counter stored in TTLCache with 24+ hour TTL
3. **Daily Reset**: New key per day (UTC), auto-resets daily
4. **Rate Limiting**: Returns 502 error if limit exceeded
5. **Warnings**: Alerts at 80% usage threshold

---

## 📊 Response Format

### News Endpoint Response
```json
GET /api/news/topic/general
{
  "source": "api",
  "count": 15,
  "articles": [...],
  "hits": {
    "today_hits": 3,
    "remaining_hits": 97,
    "warning": false,
    "max_hits": 100
  }
}
```

### Hit Status Endpoint
```json
GET /api/news/status/hits
{
  "status": "ok",
  "hits": {
    "today_hits": 3,
    "remaining_hits": 97,
    "warning": false,
    "max_hits": 100
  },
  "message": "GNews API hit counter"
}
```

---

## 🔗 API Endpoints

### 1. Get Hit Status
```
GET /api/news/status/hits
```
**Returns**: Current hit count without incrementing

**Response**:
```json
{
  "hits": {
    "today_hits": 3,
    "remaining_hits": 97,
    "warning": false
  }
}
```

### 2. Reset Counter (Admin)
```
POST /api/news/admin/reset-hits
```
**Purpose**: Reset counter for testing (use sparingly!)

**Response**:
```json
{
  "status": "reset",
  "hits": {
    "today_hits": 0,
    "remaining_hits": 100
  }
}
```

---

## 📈 Limits & Thresholds

| Setting | Value |
|---------|-------|
| Max hits/day | 100 |
| Warning threshold | 80 (80%) |
| Cache TTL | 24+ hours |
| Reset frequency | Daily (UTC midnight) |

---

## 🔄 Flow Diagram

```
User clicks category
  ↓
GET /api/news/topic/general
  ↓
GNewsService.fetch_category()
  ↓
Check GNewsCounter.check_limit()
  ↓
Can call? YES
  ↓
Make API call to GNews
  ↓
GNewsCounter.increment_hit()  ← Counter += 1
  ↓
Return articles + hit status
  ↓
{
  articles: [...],
  hits: {
    today_hits: 3,
    remaining_hits: 97,
    warning: false
  }
}
```

---

## 💾 Storage

### Cache Key Format
```
gnews:hits:today:YYYY-MM-DD
```

### Example Keys
```
gnews:hits:today:2026-01-26  (3 hits stored)
gnews:hits:today:2026-01-27  (0 hits, new day)
```

### TTL
- Each day's counter has TTL of 24+ hours
- Auto-expires after daily reset
- No manual cleanup needed

---

## ⚙️ Configuration

### Limits
**File**: `backend/app/core/gnews_counter.py`

```python
MAX_HITS_PER_DAY = 100          # GNews free tier limit
WARNING_THRESHOLD = 80          # Alert at 80%
```

### Cache
**File**: `backend/app/core/cache.py`

```python
news_cache = TTLCache(maxsize=50, ttl=15*60)
```

---

## 🚨 Error Handling

### Limit Exceeded
```
Status: 502 Bad Gateway
Message: "GNews API limit reached (100/day). Reset at midnight UTC."
```

### Warning Message
```
Status: 200 OK
hits: {
  "warning": true,
  "remaining_hits": 5
}
```

---

## 📝 Implementation Details

### Hit Increment
**When**: After successful API response (200 OK)
**Where**: `GNewsService.fetch_category()`
**Method**: `GNewsCounter.increment_hit()`

### Counter Check
**When**: Before making API call
**Where**: `GNewsService.fetch_category()`
**Method**: `GNewsCounter.check_limit()`

### Status Return
**When**: After every news request
**Where**: `get_news_by_topic()` endpoint
**Data**: Full hit status object

---

## 🧪 Testing

### Test 1: Check Current Status
```bash
curl http://localhost:8000/api/news/status/hits
```

Expected output shows today's hits and remaining hits.

### Test 2: Make API Call & Track
```bash
curl http://localhost:8000/api/news/topic/general
```

Response includes `hits` field showing updated count.

### Test 3: Reset Counter
```bash
curl -X POST http://localhost:8000/api/news/admin/reset-hits
```

Counter resets to 0 (use for testing only).

---

## 📊 Sample Hit Progression

```
Day 1 (2026-01-26)
  - First news request: hits = 1/100
  - Refresh all (7 categories): hits = 8/100
  - User clicks 5 categories: hits = 13/100
  - Total today: 13 API calls

Day 2 (2026-01-27) - AUTO RESET
  - New day key created: gnews:hits:today:2026-01-27
  - Counter starts at: 0/100
  - Old day's key expires after 24+ hours
```

---

## 🔐 Security Notes

### Admin Endpoint
- `POST /api/news/admin/reset-hits` - Reset counter
- ⚠️ Should be protected with authentication in production
- Currently unprotected (for testing)

### Rate Limiting
- Happens at API call level (GNews service)
- Returns 502 error if limit exceeded
- Graceful degradation (cached data still available)

---

## 🚀 Production Deployment

### Before Going Live
1. Protect `/admin/reset-hits` with authentication
2. Monitor daily hit usage
3. Set up alerts at 80%+ threshold
4. Log all API calls for auditing

### Monitoring
```python
# Check daily
curl http://localhost:8000/api/news/status/hits

# Should show:
# - today_hits: number of calls made
# - remaining_hits: safe margin
# - warning: if nearing limit
```

---

## 📋 API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/news/topic/{category}` | GET | News with hit counter |
| `/api/news/status/hits` | GET | Check hit count |
| `/api/news/admin/reset-hits` | POST | Reset counter |

---

## ✅ Implementation Checklist

- [x] Created `gnews_counter.py` service
- [x] Integrated counter into `GNewsService`
- [x] Added hit tracking on successful API calls
- [x] Added hit status to news responses
- [x] Created `/status/hits` endpoint
- [x] Created `/admin/reset-hits` endpoint
- [x] Implemented warning threshold
- [x] Added daily auto-reset via cache TTL
- [x] Graceful error handling
- [x] Documentation complete

---

## 🎯 Design Goals Achieved

✅ **Track every real API call** - Counter increments on 200 response
✅ **Persist in cache** - TTLCache with 24+ hour TTL per day
✅ **Return hit status** - Included in all news responses
✅ **Safe rate limiting** - 100/day limit enforced, errors on overflow
✅ **Automatic daily reset** - New cache key per day
✅ **Easy monitoring** - Dedicated status endpoint

---

**Status**: ✅ Implementation Complete
**Date**: January 26, 2026
**Files**: gnews_counter.py (new), news_service.py (updated), news.py (updated)
