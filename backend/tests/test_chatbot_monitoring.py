import pytest

from app.routers.admin import _infer_deployment_mode
from app.routers.chatbot import _record_chatbot_daily_telemetry, CHATBOT_TELEMETRY_DAILY_COLLECTION


class _FakeCollection:
    def __init__(self):
        self.calls = []

    async def update_one(self, query, update, upsert=False):
        self.calls.append({"query": query, "update": update, "upsert": upsert})


class _FakeDb:
    def __init__(self):
        self.collection = _FakeCollection()

    def __getitem__(self, key):
        assert key == CHATBOT_TELEMETRY_DAILY_COLLECTION
        return self.collection


@pytest.mark.parametrize(
    "url,expected",
    [
        ("http://localhost:11434", "local"),
        ("http://127.0.0.1:11434", "local"),
        ("http://10.0.0.20:11434", "local"),
        ("http://192.168.1.12:11434", "local"),
        ("https://ollama.example.com", "cloud"),
    ],
)
def test_infer_deployment_mode(url, expected):
    assert _infer_deployment_mode(url) == expected


@pytest.mark.asyncio
async def test_record_chatbot_daily_telemetry_upserts_metrics():
    db = _FakeDb()
    metrics = {
        "success": True,
        "provider": "ollama",
        "model": "llama3.2:1b",
        "prompt_tokens": 40,
        "completion_tokens": 25,
        "total_tokens": 65,
        "token_source": "estimated",
        "latency_ms": 123.4,
        "error": None,
    }

    await _record_chatbot_daily_telemetry(db, metrics)

    assert len(db.collection.calls) == 1
    call = db.collection.calls[0]
    assert call["upsert"] is True
    assert call["query"]["date_utc"]

    inc = call["update"]["$inc"]
    assert inc["request_count"] == 1
    assert inc["success_count"] == 1
    assert inc["failure_count"] == 0
    assert inc["prompt_tokens_total"] == 40
    assert inc["completion_tokens_total"] == 25
    assert inc["tokens_total"] == 65
    assert inc["estimated_token_requests"] == 1

    set_values = call["update"]["$set"]
    assert set_values["provider"] == "ollama"
    assert set_values["model_name"] == "llama3.2:1b"
    assert set_values["last_error"] is None
