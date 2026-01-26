# ⚡ Quick Reference Checklist

## 🚀 Get Started in 3 Steps

### Step 1: Start Backend
```bash
cd backend
uvicorn app.main:app --reload
```
✅ Wait for: "Application startup complete"

### Step 2: Start Frontend  
```bash
cd frontend
npm run dev
```
✅ Wait for: "ready in XXms"

### Step 3: Open Browser
```
http://localhost:5173
```
✅ Click categories → Articles load

---

## ✅ Configuration Status

| Component | Status | Details |
|-----------|--------|---------|
| **GNews API Key** | ✅ | Set in `.env` |
| **Cache Objects** | ✅ | news_cache, summary_cache, sentiment_cache |
| **Backend Routes** | ✅ | `/api/news/topic/{category}` |
| **Frontend Types** | ✅ | Topic type updated (7 categories) |
| **Article Interface** | ✅ | Matches GNews response format |
| **Category Sync** | ✅ | Frontend & Backend aligned |
| **CORS Settings** | ✅ | Allows localhost:5173 |
| **MongoDB** | ✅ | Connected |

---

## 📋 7 Categories Supported

```
1. general      → 🇮🇳 General
2. nation       → 🏛️ Nation
3. business     → 💼 Business
4. technology   → 🚀 Technology
5. sports       → ⚽ Sports
6. entertainment → 🎬 Entertainment
7. health       → 🏥 Health
```

---

## 🧪 Quick Test Commands

### Test Backend Directly
```bash
# General news
curl http://localhost:8000/api/news/topic/general

# Technology news
curl http://localhost:8000/api/news/topic/technology

# Refresh all
curl -X POST http://localhost:8000/api/news/refresh-all
```

### Test Frontend
1. Open http://localhost:5173
2. Click "🚀 Technology"
3. Articles should load
4. Click another category
5. Verify articles update

---

## 🔍 Verification Points

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] No import errors in console
- [ ] Category buttons appear
- [ ] Click category → Articles load
- [ ] Images display
- [ ] Source name shows
- [ ] Published date appears
- [ ] Bookmark button works
- [ ] Read Later button works

---

## 📊 Response Times

| Scenario | Time |
|----------|------|
| First load (API) | 2-5s |
| Cached load | 50-200ms |
| Category switch | Instant |
| Summary generation | 3-10s |

---

## 🐛 If Something's Wrong

### "Cannot connect to backend"
```bash
# Check if backend is running
curl http://localhost:8000/
# Should return 200 OK
```

### "No articles found"
```bash
# Check if API key is valid
echo $GNEWS_API_KEY
# Should show your key

# Check category name
curl http://localhost:8000/api/news/topic/general
# Check response
```

### "Type errors in console"
```bash
# Types should be:
# Topic = 'general' | 'nation' | 'business' | ...
# Article.source = string (not object)

# Verify:
grep "export type Topic" frontend/src/types.ts
grep "source: string" frontend/src/types.ts
```

---

## 📁 Key Files to Know

```
Backend
├── app/routers/news.py ............. GET /api/news/topic/{category}
├── app/services/news_service.py .... GNews API integration
├── app/core/cache.py ............... Cache objects
└── .env ....................... GNews API key

Frontend
├── src/pages/Home.tsx .............. Category buttons
├── src/types.ts .................... Topic type (7 categories)
├── src/services/news.service.ts .... API calls
└── src/components/news/NewsCard.tsx  Article display
```

---

## 🎯 Expected Flow

```
User clicks "Technology"
    ↓
Frontend: setCategory('technology')
    ↓
Frontend: newsService.getNewsByTopic('technology')
    ↓
Backend: GET /api/news/topic/technology
    ↓
Check cache → Miss → Call GNews API
    ↓
Parse articles → Store in cache
    ↓
Return to frontend
    ↓
NewsGrid displays articles
    ↓
User sees news articles
```

---

## 💾 Cache Behavior

### First Load of Category
```
1. Frontend requests /api/news/topic/general
2. Backend checks cache → MISS
3. Calls GNews API → Takes 2-5 seconds
4. Stores in cache
5. Returns articles
```

### Second Load (same category)
```
1. Frontend requests /api/news/topic/general
2. Backend checks cache → HIT
3. Returns cached articles → 50-200ms
```

### Cache Duration
```
Expires after: 15 minutes (900 seconds)
Auto refresh: Every 15 minutes
Manual refresh: POST /api/news/refresh/{category}
```

---

## 🚀 Performance Tips

### Optimize Load Time
- Cache is automatic (don't need to do anything)
- First request takes time, subsequent are fast
- Batch category refreshes: `POST /api/news/refresh-all`

### Monitor Usage
- Free tier: 100 requests/day
- Recommended: 50 requests/day (safe margin)
- Current strategy: 12 requests/day (~2 hour intervals)

---

## 📱 Testing Checklist

### Frontend Tests
- [ ] Page loads without errors
- [ ] 7 category buttons visible
- [ ] Each button loads different articles
- [ ] "General" is default
- [ ] Articles show image, title, description
- [ ] Source name displays
- [ ] Published date shows
- [ ] Buttons work (bookmark, read later)
- [ ] Summary button works (if sentiment service up)

### Backend Tests
- [ ] All categories return articles
- [ ] Response includes required fields
- [ ] Cache working (second load faster)
- [ ] Error handling works (invalid category)
- [ ] Refresh endpoints work
- [ ] API key is valid

### Integration Tests
- [ ] Frontend → Backend requests work
- [ ] Response format matches frontend expectations
- [ ] Caching layer functional
- [ ] No CORS errors
- [ ] No 502 errors

---

## 🔗 Useful Links

### Local Testing
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

### External
- GNews API: https://gnews.io
- GNews Docs: https://gnews.io/docs
- GNews Dashboard: https://gnews.io/dashboard

---

## 📞 Support

### Documentation
- **Complete Setup**: GNEWS_INTEGRATION_GUIDE.md
- **Testing Guide**: TESTING_GUIDE.md
- **Changes Made**: INTEGRATION_SUMMARY.md
- **This Quick Ref**: README_GNEWS.md

### Diagnostics
```bash
python diagnose.py
```
Checks all configuration automatically

---

## 🎓 Key Concepts

### REST API
- GET returns data
- POST performs actions (like refresh)
- 200 OK = success
- 502 Bad Gateway = backend error

### Caching
- First request = slow (API call)
- Subsequent requests = fast (cached)
- Cache expires = backend refreshes automatically

### Frontend-Backend Contract
- Frontend sends: request to `/api/news/topic/{category}`
- Backend returns: `{ source, count, articles }`
- Frontend displays: NewsGrid with articles

---

## ✨ Success Indicators

✅ Backend running on 8000
✅ Frontend running on 5173
✅ No import errors
✅ Categories load articles
✅ Cache working (fast on repeat)
✅ Error handling works
✅ Articles display correctly

**When all ✅ → You're Ready! 🎉**

---

## 🚀 Next: Deployment

1. Update CORS for production domain
2. Use environment-specific .env
3. Monitor API usage
4. Set up error logging
5. Document for team

---

**Last Updated**: January 26, 2026
**Status**: ✅ Complete & Ready
**Integration Version**: 1.0 Final
