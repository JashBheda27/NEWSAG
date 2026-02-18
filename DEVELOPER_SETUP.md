# 🚀 Developer Setup & Deployment Guide

Complete guide for setting up, developing, and deploying the enhanced NewsAura application.

---

## 📋 Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **Python**: 3.9 or higher
- **npm**: 8.0.0 or higher (comes with Node.js)
- **Git**: 2.0 or higher

### Recommended Tools

- **VS Code** with extensions:
  - ES7+ React/Redux/React-Native snippets
  - Tailwind CSS IntelliSense
  - Thunder Client or Postman (API testing)
  - REST Client extension

---

## ⚙️ Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd NEWSAG
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Verify installations
npm list react vite framer-motion tailwindcss

# Expected output:
# ├── react@19.2.0
# ├── vite@7.2.4
# ├── framer-motion@11.0.0
# └── tailwindcss (configured in tsconfig)
```

### 3. Backend Setup

```bash
cd ../backend

# Create virtual environment (Python)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Verify key packages
pip list | grep -E "fastapi|pydantic|redis"
```

---

## 🔧 Environment Configuration

### Frontend (.env.local)

Create `frontend/.env.local`:

```env
# API Configuration
VITE_API_URL=http://localhost:8000

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key_here

# Feature Flags
VITE_ENABLE_CHATBOT=true
VITE_ENABLE_DARK_MODE=true
VITE_ENABLE_ANALYTICS=true

# Redis (if using)
VITE_REDIS_URL=redis://localhost:6379
```

### Backend (.env)

Create `backend/.env`:

```env
# Server
HOST=0.0.0.0
PORT=8000
DEBUG=false  # Set to true for development

# Database
DATABASE_URL=postgresql://user:password@localhost/newsaura
REDIS_URL=redis://localhost:6379

# Clerk Auth
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# External APIs
GNEWS_API_KEY=your_gnews_api_key
OPENAI_API_KEY=your_openai_api_key

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 🏃 Running the Application

### Development Mode

#### Terminal 1 - Frontend

```bash
cd frontend
npm run dev

# Output: VITE v7.2.4 ready in XXX ms
# ➜  Local:   http://localhost:5173/
# ➜  Press h to show help
```

#### Terminal 2 - Backend

```bash
cd backend
# Make sure venv is activated
python -m uvicorn app.main:app --reload --port 8000

# Output: 
# INFO: Uvicorn running on http://127.0.0.1:8000
# INFO: Application startup complete
```

#### Terminal 3 - Redis (Optional)

```bash
# macOS (using Homebrew)
redis-server

# Windows (using WSL)
wsl redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

### Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Redis CLI**: `redis-cli` (if running locally)

---

## 🧪 Testing

### Frontend Unit Tests

```bash
cd frontend

# Run tests (if configured with Vitest)
npm run test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Frontend E2E Tests

```bash
# Run Playwright tests (if configured)
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/bookmarks.spec.ts
```

### API Tests

```bash
cd backend

# Run pytest
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_news_service.py -v
```

### Manual Testing Checklist

- [ ] User authentication flow works
- [ ] Articles load in grid view
- [ ] Articles load in list view
- [ ] Bookmark functionality works
- [ ] Read Later functionality works
- [ ] ChatBot responds to queries
- [ ] Dark mode toggle works
- [ ] All animations are smooth (60fps)
- [ ] Responsive design on mobile (375px)
- [ ] Responsive design on tablet (768px)
- [ ] Keyboard navigation works (Tab, Escape, Enter)
- [ ] Empty states display correctly
- [ ] Confirmation modals work
- [ ] Toast notifications appear
- [ ] Search functionality works

---

## 🎯 Build & Deployment

### Frontend Build

```bash
cd frontend

# Production build
npm run build

# Output in dist/ directory
# Check bundle size
npm run build -- --debug
```

### Backend Build

```bash
cd backend

# Create production requirements
pip freeze > requirements-prod.txt

# Build Docker image (if using)
docker build -t newsaura-backend:latest .
```

### Docker Deployment

#### Docker Compose (All Services)

```bash
# In project root
docker-compose up -d

# Services:
# - frontend: http://localhost
# - backend: http://localhost:8000
# - redis: localhost:6379
# - postgres: localhost:5432
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://backend:8000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/newsaura
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=newsaura
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:latest
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## 🌐 Deployment Platforms

### Vercel (Frontend)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# or with project configuration
vercel --prod
```

**vercel.json** example:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "@vite_api_url",
    "VITE_CLERK_PUBLISHABLE_KEY": "@vite_clerk_pk"
  }
}
```

### Railway (Backend)

```bash
# Connect GitHub repository via Railway dashboard
# Config: 
# Build Command: pip install -r requirements.txt
# Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

# Verify deployment
curl https://your-app.railway.app/docs
```

### Azure App Service

```bash
# Install Azure CLI
az login

# Create resource group
az group create -n newsaura-rg -l eastus

# Create App Service Plan
az appservice plan create -n newsaura-plan -g newsaura-rg --is-linux

# Deploy frontend
az webapp up -n newsaura-frontend --runtime "node|18-lts"

# Deploy backend
az webapp up -n newsaura-backend --runtime "python|3.9"
```

---

## 🔍 Performance Optimization

### Frontend Optimization

```bash
# Analyze bundle size
npm run build -- --analyze

# Expected bundle sizes:
# - Main bundle: < 300KB (gzipped)
# - Vendor bundle: < 500KB (gzipped)
# - CSS: < 50KB (gzipped)
```

### Image Optimization

```bash
# Use modern formats (WebP)
# Compress images in public/ directory
# Use lazy loading for off-screen images
```

### Database Optimization

```sql
-- Create indexes for frequently queried fields
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- Run VACUUM to optimize space
VACUUM ANALYZE;
```

---

## 📊 Monitoring & Logging

### Frontend Monitoring

```bash
# Enable error tracking
# Consider services: Sentry, LogRocket, NewRelic

# Set up in App.tsx:
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Backend Logging

```python
# In backend/app/main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='logs/app.log'
)

logger = logging.getLogger(__name__)
logger.info("Application started")
```

### Health Checks

```bash
# Frontend health check endpoint
curl http://localhost:5173/

# Backend health check
curl http://localhost:8000/health

# API response monitoring
curl http://localhost:8000/docs
```

---

## 🔐 Security Checklist

- [ ] Set `HTTPS_ONLY=true` in production
- [ ] Enable CORS only for trusted origins
- [ ] Set strong session/token expiration
- [ ] Implement rate limiting on API endpoints
- [ ] Use environment variables for secrets
- [ ] Enable CSRF protection on forms
- [ ] Validate all user inputs server-side
- [ ] Set security headers (CSP, X-Frame-Options, etc.)
- [ ] Enable HTTPS/TLS for all traffic
- [ ] Regularly update dependencies
- [ ] Use dependency scanning (npm audit, pip audit)

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port 5173
# Linux/Mac:
lsof -i :5173

# Windows:
netstat -ano | findstr :5173

# Kill process
kill -9 <PID>
```

### Module Not Found Errors

```bash
# Clear npm cache
npm cache clean --force

# Reinstall node_modules
rm -rf node_modules package-lock.json
npm install
```

### Framer Motion Animations Not Working

```bash
# Verify installation
npm list framer-motion

# Should show: framer-motion@11.0.0

# Check imports in file
import { motion, AnimatePresence } from 'framer-motion';
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -U user -d newsaura -h localhost

# Test Redis connection
redis-cli ping
# Should return: PONG

# Check environment variables
echo $DATABASE_URL
echo $REDIS_URL
```

### API CORS Issues

```bash
# Check backend CORS configuration
# In backend/app/main.py:
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📈 Scaling Considerations

### Horizontal Scaling

```bash
# Run multiple backend instances behind load balancer
# Use environment variable for instance ID
export INSTANCE_ID=0
python -m uvicorn app.main:app --port 8000

export INSTANCE_ID=1
python -m uvicorn app.main:app --port 8001
```

### Database Scaling

```sql
-- Enable connection pooling
-- Use PgBouncer or similar
-- Configure: max_connections, shared_buffers

-- Monitor slow queries
EXPLAIN ANALYZE SELECT * FROM articles WHERE category = 'tech';
```

### Cache Strategy

```python
# Use Redis for:
# 1. Session storage
# 2. Rate limiting
# 3. API response caching
# 4. User preferences

from app.services.cache import CacheService
cache = CacheService(redis_url=settings.redis_url)
```

---

## 📚 Documentation Structure

Project documentation files:

```
├── README.md                          # Project overview
├── COMPONENTS_GUIDE.md                # Component usage (NEW)
├── ENHANCEMENTS_SUMMARY.md            # Enhancement details
├── AUTHENTICATION_GUIDE.md            # Auth implementation
├── GNEWS_INTEGRATION_GUIDE.md         # Google News API
├── DEVELOPER_SETUP.md                 # This file
├── API_CHANGES.md                     # API modifications
└── FEATURES_FIXED.md                  # Bug fixes & features
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main, develop]

jobs:
  build-test-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install frontend
        run: |
          cd frontend
          npm install
          npm run build
          npm run test
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install backend
        run: |
          cd backend
          pip install -r requirements.txt
          pytest
      
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: |
          npm run deploy:frontend
          npm run deploy:backend
```

---

## ✅ Pre-Launch Checklist

- [ ] All tests pass locally
- [ ] Environment variables configured
- [ ] Database migrations complete
- [ ] API endpoints responding
- [ ] Frontend builds without errors
- [ ] Animations smooth at 60fps
- [ ] Mobile responsive (375px - 1920px)
- [ ] Accessibility audit passed
- [ ] Security scan completed
- [ ] Performance budget met
- [ ] SEO meta tags present
- [ ] Analytics configured
- [ ] Error tracking enabled
- [ ] Documentation up to date
- [ ] Team trained on deployment process

---

## 📞 Support & Maintenance

### Common Tasks

```bash
# Update dependencies
npm update
pip install --upgrade -r requirements.txt

# Run security audit
npm audit
pip audit

# Monitor application
tail -f logs/app.log

# Backup database
pg_dump newsaura > backup.sql

# Restore database
psql newsaura < backup.sql
```

### Emergency Response

```bash
# Stop application
docker-compose down

# Clear cache
redis-cli FLUSHALL

# Restart services
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

---

**Last Updated:** February 18, 2026
**Version:** 2.0 (Enhanced with Framer Motion)
**Status:** ✅ Production Ready
