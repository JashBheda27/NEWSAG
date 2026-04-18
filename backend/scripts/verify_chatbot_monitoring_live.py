from __future__ import annotations

import json
from datetime import datetime

import httpx
from pymongo import MongoClient

from app.core.config import settings

BASE_URL = "http://127.0.0.1:8000"


def post_chat_message(text: str) -> int:
    payload = {"message": text, "context": {}}
    try:
        with httpx.Client(timeout=180.0) as client:
            resp = client.post(f"{BASE_URL}/api/chat/message", json=payload)
            return resp.status_code
    except httpx.HTTPError:
        return 0


def load_today_telemetry() -> dict:
    client = MongoClient(settings.MONGO_URI)
    db = client.get_default_database()
    day = datetime.utcnow().strftime("%Y-%m-%d")
    doc = db["chatbot_telemetry_daily"].find_one({"date_utc": day}, {"_id": 0})
    client.close()
    return doc or {}


def main() -> None:
    before = load_today_telemetry()

    status_codes = [
        post_chat_message("Hi"),
        post_chat_message("Help"),
    ]

    after = load_today_telemetry()

    result = {
        "date_utc": datetime.utcnow().strftime("%Y-%m-%d"),
        "chat_status_codes": status_codes,
        "before": {
            "request_count": before.get("request_count", 0),
            "tokens_total": before.get("tokens_total", 0),
            "success_count": before.get("success_count", 0),
            "failure_count": before.get("failure_count", 0),
        },
        "after": {
            "request_count": after.get("request_count", 0),
            "tokens_total": after.get("tokens_total", 0),
            "success_count": after.get("success_count", 0),
            "failure_count": after.get("failure_count", 0),
            "provider": after.get("provider"),
            "llm_name": after.get("llm_name"),
            "model_name": after.get("model_name"),
            "deployment_mode": after.get("deployment_mode"),
            "last_error": after.get("last_error"),
        },
    }

    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
