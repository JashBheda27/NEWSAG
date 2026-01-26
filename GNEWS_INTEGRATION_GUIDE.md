# GNews API Integration - Complete Setup Guide

## ✅ Backend Configuration

### 1. **GNews Service** (`app/services/news_service.py`)
- **API Base URL**: `https://gnews.io/api/v4`
- **Region**: India (`country: "in"`)
- **Language**: English (`lang: "en"`)
- **Max Articles**: 20 per category

### 2. **Supported Categories**
```
- general
- nation
- business
- technology
- sports
- entertainment
- health
```

### 3. **API Endpoints**

#### Get News by Category
```
GET /api/news/topic/{category}
```
**Parameters**:
- `category`: One of the supported categories above

**Response**:
```json
{
  "source": "api" | "cache",
  "count": 15,
  "articles": [
    {
      "id": "hash_of_url",
      "title": "Article Title",
      "description": "Article summary",
      "image_url": "https://...",
      "source": "Source Name",
      "url": "https://...",
      "published_at": "2024-01-26T10:30:00Z",
      "category": "technology"
    }
  ]
}
```

#### Refresh Single Category
```
POST /api/news/refresh/{category}
```

#### Refresh All Categories
```
POST /api/news/refresh-all
```

### 4. **Environment Variables**
Add to your `.env` file:
```
GNEWS_API_KEY=your_gnews_api_key_here
MONGO_URI=your_mongodb_connection_string
HOST=127.0.0.1
PORT=8000
```

### 5. **Caching Configuration**
- **Cache Type**: TTLCache (Time-To-Live)
- **TTL Duration**: 15 minutes (900 seconds)
- **Max Size per Cache**: 
  - News Cache: 50 items
  - Summary Cache: 100 items
  - Sentiment Cache: 100 items

---

## ✅ Frontend Configuration

### 1. **Updated Types** (`src/types.ts`)
```typescript
export type Topic = 
  | 'general'
  | 'nation'
  | 'business'
  | 'technology'
  | 'sports'
  | 'entertainment'
  | 'health';

export interface Article {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  source: string;  // Direct string, not object
  url: string;
  published_at?: string;
  category?: Topic;
  sentiment?: SentimentData;
}
```

### 2. **Category Mapping** (`src/pages/Home.tsx`)
```
General → 🇮🇳 General
Nation → 🏛️ Nation
Business → 💼 Business
Technology → 🚀 Technology
Sports → ⚽ Sports
Entertainment → 🎬 Entertainment
Health → 🏥 Health
```

### 3. **API Integration** (`src/services/news.service.ts`)
```typescript
await newsService.getNewsByTopic('general')
// Calls: GET /api/news/topic/general
```

### 4. **Environment Configuration**
```
VITE_API_URL=http://localhost:8000
```

---

## 🔧 Setup Checklist

### Backend
- [x] GNews API service configured with India region
- [x] Cache layer implemented (15-minute TTL)
- [x] All 7 categories supported
- [x] Error handling with proper HTTP status codes
- [x] Routes: `/api/news/topic/{category}`, `/api/news/refresh/{category}`, `/api/news/refresh-all`

### Frontend
- [x] Topic types updated to match backend categories
- [x] Article interface updated for GNews response format
- [x] NewsCard component handles string source field
- [x] Home page category buttons linked to correct categories
- [x] API service using correct endpoint paths

### Connection Flow
```
Frontend (Home.tsx)
    ↓
newsService.getNewsByTopic('general')
    ↓
api.get('/api/news/topic/general')
    ↓
Backend (app/routers/news.py)
    ↓
GNewsService.fetch_category('general')
    ↓
GNews API (https://gnews.io/api/v4/top-headlines)
    ↓
Parse & Cache Response
    ↓
Return to Frontend
```

---

## 🚀 Testing Instructions

### 1. Start Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Test Endpoints
```bash
# Get General News
curl http://localhost:8000/api/news/topic/general

# Get Technology News
curl http://localhost:8000/api/news/topic/technology

# Refresh All Categories
curl -X POST http://localhost:8000/api/news/refresh-all
```

### 4. Verify in Browser
- Open `http://localhost:5173`
- Click on category buttons
- Verify articles load from backend
- Check console for API calls

---

## 📊 GNews API Details

### Rate Limits
- Free Tier: 100 requests per day
- Premium: Higher limits available

### Response Fields
Each article includes:
- `title`: Article headline
- `description`: Short summary
- `content`: Full article body
- `image`: Featured image URL
- `url`: Link to original article
- `source.name`: News source
- `publishedAt`: Publication timestamp

---

## 🐛 Troubleshooting

### Issue: 404 Not Found
**Solution**: Ensure category name matches exactly (case-sensitive)

### Issue: Cache Miss / Slow Load
**Solution**: Cache refreshes every 15 minutes automatically, or use refresh endpoints

### Issue: No Articles Returned
**Solution**: 
1. Verify GNEWS_API_KEY is set correctly
2. Check internet connection
3. Verify India region code is correct (`country: "in"`)

### Issue: Frontend Can't Connect
**Solution**:
1. Ensure backend is running on `http://localhost:8000`
2. Check VITE_API_URL environment variable
3. Verify CORS is configured in backend

---

## 📝 API Documentation

For more details on GNews API:
- Website: https://gnews.io
- Docs: https://gnews.io/docs

---

**Last Updated**: January 26, 2026
**Status**: ✅ Ready for Production
