#!/usr/bin/env python3
"""
GNews Integration Diagnostic Script
Verifies all components are properly configured
"""

import os
import sys
import httpx
import json
from pathlib import Path

def print_status(message: str, status: bool):
    """Print formatted status message"""
    symbol = "✅" if status else "❌"
    print(f"{symbol} {message}")

def check_env_file():
    """Check if .env file exists and has required keys"""
    print("\n📋 Environment Check:")
    env_file = Path("backend/.env")
    
    if not env_file.exists():
        print_status("Environment file found", False)
        return False
    
    print_status("Environment file found", True)
    
    env_content = env_file.read_text()
    
    required_keys = [
        "GNEWS_API_KEY",
        "MONGO_URI",
        "PORT"
    ]
    
    for key in required_keys:
        has_key = key in env_content
        print_status(f"  - {key} configured", has_key)
    
    return all(key in env_content for key in required_keys)

def check_backend_imports():
    """Check if backend imports are correct"""
    print("\n📦 Backend Imports Check:")
    
    files_to_check = [
        ("backend/app/core/cache.py", [
            "news_cache",
            "summary_cache", 
            "sentiment_cache",
            "get_from_cache",
            "set_in_cache"
        ]),
        ("backend/app/routers/news.py", [
            "GNewsService",
            "get_news_by_topic",
            "refresh_category",
            "refresh_all"
        ]),
        ("backend/app/services/news_service.py", [
            "GNewsService",
            "fetch_category",
            "ALLOWED_CATEGORIES"
        ])
    ]
    
    all_ok = True
    for file_path, required_items in files_to_check:
        if not Path(file_path).exists():
            print_status(f"  - {file_path}", False)
            all_ok = False
            continue
        
        content = Path(file_path).read_text()
        has_all = all(item in content for item in required_items)
        print_status(f"  - {file_path}", has_all)
        if not has_all:
            all_ok = False
    
    return all_ok

def check_frontend_types():
    """Check if frontend types are updated"""
    print("\n🎨 Frontend Types Check:")
    
    types_file = Path("frontend/src/types.ts")
    if not types_file.exists():
        print_status("types.ts found", False)
        return False
    
    print_status("types.ts found", True)
    
    content = types_file.read_text()
    
    required_topics = [
        "general",
        "nation",
        "business",
        "technology",
        "sports",
        "entertainment",
        "health"
    ]
    
    for topic in required_topics:
        has_topic = f"'{topic}'" in content
        print_status(f"  - {topic} in Topic type", has_topic)
    
    has_source_string = "source: string" in content
    print_status("  - source as string in Article", has_source_string)
    
    return all(f"'{t}'" in content for t in required_topics) and has_source_string

def check_api_connectivity():
    """Check if backend API is running"""
    print("\n🌐 Backend Connectivity Check:")
    
    try:
        response = httpx.get("http://localhost:8000/", timeout=5)
        print_status("Backend running on localhost:8000", response.status_code == 200)
        return response.status_code == 200
    except Exception as e:
        print_status("Backend running on localhost:8000", False)
        print(f"   Error: {str(e)}")
        return False

async def test_gnews_endpoint():
    """Test GNews endpoint"""
    print("\n📰 GNews Endpoint Test:")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get("http://localhost:8000/api/news/topic/general")
            
            if response.status_code == 200:
                print_status("GET /api/news/topic/general", True)
                data = response.json()
                print(f"   - Source: {data.get('source')}")
                print(f"   - Articles: {data.get('count')}")
                return True
            else:
                print_status("GET /api/news/topic/general", False)
                print(f"   Status: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
    except Exception as e:
        print_status("GET /api/news/topic/general", False)
        print(f"   Error: {str(e)}")
        return False

def main():
    """Run all diagnostic checks"""
    print("\n" + "="*50)
    print("🔍 GNews Integration Diagnostic")
    print("="*50)
    
    results = []
    
    # Check environment
    results.append(("Environment", check_env_file()))
    
    # Check backend imports
    results.append(("Backend Imports", check_backend_imports()))
    
    # Check frontend types
    results.append(("Frontend Types", check_frontend_types()))
    
    # Check API connectivity
    results.append(("API Connectivity", check_api_connectivity()))
    
    # Summary
    print("\n" + "="*50)
    print("📊 Summary:")
    print("="*50)
    
    for name, status in results:
        symbol = "✅" if status else "❌"
        print(f"{symbol} {name}")
    
    all_passed = all(status for _, status in results)
    
    print("\n" + "="*50)
    if all_passed:
        print("🎉 All checks passed! Integration is ready.")
    else:
        print("⚠️  Some checks failed. Review the output above.")
    print("="*50 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    import asyncio
    sys.exit(main())
