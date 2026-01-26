# 🧪 GNews Integration Testing & Verification

## Quick Test Checklist

### Prerequisites
- ✅ GNews API Key configured in `.env`
- ✅ Backend running on `localhost:8000`
- ✅ Frontend running on `localhost:5173`
- ✅ MongoDB connected
- ✅ Redis running (for optional caching)

---

## Test Case 1: Direct Backend API Test

### Endpoint
```
GET http://localhost:8000/api/news/topic/general
```

### Expected Response
```json
{
  "source": "api",
  "count": 15,
  "articles": [
    {
      "id": "md5_hash_of_url",
      "title": "Article Title",
      "description": "Article description",
      "image_url": "https://example.com/image.jpg",
      "source": "Source Name",
      "url": "https://example.com/article",
      "published_at": "2024-01-26T10:30:00Z",
      "category": "general"
    },
    ...
  ]
}
```

### Test All Categories

```bash
# Using curl
curl -X GET http://localhost:8000/api/news/topic/general
curl -X GET http://localhost:8000/api/news/topic/nation
curl -X GET http://localhost:8000/api/news/topic/business
curl -X GET http://localhost:8000/api/news/topic/technology
curl -X GET http://localhost:8000/api/news/topic/sports
curl -X GET http://localhost:8000/api/news/topic/entertainment
curl -X GET http://localhost:8000/api/news/topic/health
```

---

## Test Case 2: Cache Testing

### First Call (API Hit)
```bash
curl -X GET http://localhost:8000/api/news/topic/technology
# Response should show: "source": "api"
```

### Second Call (Cache Hit)
```bash
curl -X GET http://localhost:8000/api/news/topic/technology
# Response should show: "source": "cache"
# Should be much faster
```

### Manual Refresh
```bash
curl -X POST http://localhost:8000/api/news/refresh/technology
# Clears cache and fetches fresh data
```

### Refresh All Categories
```bash
curl -X POST http://localhost:8000/api/news/refresh-all
# Response: 
# {
#   "message": "All categories refreshed",
#   "categories_refreshed": 7,
#   "total_articles": 100+
# }
```

---

## Test Case 3: Frontend Integration

### Step 1: Navigate to Home Page
- Open `http://localhost:5173`
- Check browser console for errors (F12)

### Step 2: Verify Category Buttons
The following buttons should appear:
- 🇮🇳 General
- 🏛️ Nation
- 💼 Business
- 🚀 Technology
- ⚽ Sports
- 🎬 Entertainment
- 🏥 Health

### Step 3: Click Each Category
1. Click "🇮🇳 General"
   - ✅ Articles should load
   - ✅ Network tab should show: `GET /api/news/topic/general`
   - ✅ Cards should display with image, title, description

2. Click "🚀 Technology"
   - ✅ Articles should load quickly (from cache if just refreshed)
   - ✅ Should show technology-related news

3. Verify Article Card Features
   - ✅ Image loads
   - ✅ Title is visible
   - ✅ Description shows
   - ✅ Source name displays
   - ✅ Published date appears
   - ✅ Bookmark button works
   - ✅ Read Later button works
   - ✅ AI Summary button (if sentiment service working)

### Step 4: Browser DevTools Network Tab
Look for successful requests:
```
GET /api/news/topic/general - Status 200
GET /api/news/topic/technology - Status 200
GET /api/sentiment/ - Status 200 (for summary)
```

---

## Test Case 4: Error Handling

### Scenario 1: Invalid Category
```bash
curl -X GET http://localhost:8000/api/news/topic/invalid-category
# Should return 502 or process with fallback to 'general'
```

### Scenario 2: Backend Offline
- Stop backend server
- Refresh frontend
- Should show error message: "Unable to reach the server"

### Scenario 3: Invalid API Key
- Modify GNEWS_API_KEY in `.env`
- Refresh category on frontend
- Should show error message from backend

---

## Debugging Checklist

### Backend Logs
Check for messages like:
```
INFO:     127.0.0.1:64132 - "GET /api/news/topic/general HTTP/1.1" 200 OK
INFO:     [CACHE HIT] general
INFO:     [GNEWS HIT] technology
WARNING:  [MANUAL REFRESH] business
```

### Frontend Console (DevTools)
Should NOT show:
- ❌ `Cannot import name 'summary_cache'` 
- ❌ `Cannot import name 'sentiment_cache'`
- ❌ Type errors related to Article interface
- ❌ CORS errors

### Network Tab (DevTools)
Should show:
- ✅ `/api/news/topic/...` returning 200 with article data
- ✅ Requests should be ~1-2 seconds on API hit, <100ms on cache hit
- ✅ Response size ~50-100KB per request

---

## Endpoint Summary

| Method | Endpoint | Purpose | Time |
|--------|----------|---------|------|
| GET | `/api/news/topic/{category}` | Fetch news (cached) | 50-1000ms |
| POST | `/api/news/refresh/{category}` | Force refresh one | ~2-5s |
| POST | `/api/news/refresh-all` | Refresh all 7 categories | ~15-30s |
| GET | `/{category}` | Backward compatible alias | 50-1000ms |

---

## Performance Metrics

### Typical Load Times
- **First load (API)**: 2-5 seconds
- **Cached load**: 50-200ms
- **Summary generation**: 3-10 seconds
- **Sentiment analysis**: 1-3 seconds

### Cache Duration
- News Cache: 15 minutes (900 seconds)
- Summary Cache: 15 minutes
- Sentiment Cache: 15 minutes

### Data Limits
- Max articles per category: 20
- Max categories: 7
- Total possible articles: 140 (without pagination)

---

## Common Issues & Solutions

### 1️⃣ "Cannot import name 'summary_cache'"
**Status**: ✅ FIXED
**Solution**: Added summary_cache and sentiment_cache to cache.py

### 2️⃣ 404 Not Found - `/api/news/topic/latest`
**Status**: ✅ FIXED
**Solution**: Updated category names to match backend (general, nation, etc.)

### 3️⃣ Article source is object, not string
**Status**: ✅ FIXED
**Solution**: Updated Article interface and NewsCard component

### 4️⃣ Frontend categories don't match backend
**Status**: ✅ FIXED
**Solution**: Synchronized category lists across frontend and backend

### 5️⃣ GNEWS_API_KEY not found
**Status**: ✅ CONFIGURED
**Solution**: API key is set in `.env` file

---

## Verification Workflow

```
1. Start Backend
   └─ Wait for "Application startup complete"
   
2. Start Frontend
   └─ Wait for "ready in XXms"
   
3. Open http://localhost:5173
   └─ Page loads without errors
   
4. Click "General" category
   └─ Articles load with images and text
   └─ Check Network tab shows 200 response
   
5. Click "Technology" category
   └─ Articles load
   └─ Should be cached (very fast)
   
6. Click "Refresh All" (admin function)
   └─ All categories refresh
   └─ Counter shows total articles loaded
   
7. Test Sentiment/Summary
   └─ Click "AI Summary" on any article
   └─ Summary should appear in modal
   
✅ ALL TESTS PASSED = Integration Complete!
```

---

## API Rate Limits

- **GNews Free Tier**: 100 requests per day
- **Recommended**: Refresh-all every 2 hours = 12 requests/day
- **Safe Usage**: 50-80% of daily limit

---

## Next Steps

1. ✅ Verify all endpoints work
2. ✅ Test frontend-backend integration
3. ✅ Monitor backend logs for errors
4. ✅ Deploy to production
5. ✅ Monitor API usage

---

**Last Verified**: January 26, 2026
**Status**: Ready for Testing ✅
