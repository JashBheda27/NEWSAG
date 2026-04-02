import asyncio

from app.core.gnews_counter import GNewsCounter
from app.services.metrics_service import MetricsService
from app.routers.admin import get_hit_history


class _FakeHitsCollection:
    async def update_one(self, *args, **kwargs):
        return None


class _FakeDb:
    gnews_hits = _FakeHitsCollection()


def test_record_gnews_hit_returns_false_on_db_error(monkeypatch):
    async def _bad_get_db():
        raise RuntimeError("db down")

    monkeypatch.setattr("app.services.metrics_service.get_db", _bad_get_db)

    result = asyncio.run(MetricsService.record_gnews_hit(1))

    assert result is False


def test_record_gnews_hit_returns_true_when_count_non_positive():
    result = asyncio.run(MetricsService.record_gnews_hit(0))

    assert result is True


def test_increment_hit_keeps_working_when_metrics_persist_fails(monkeypatch):
    async def _fake_get_from_cache(key):
        return 2

    async def _fake_set_in_cache(key, value, ttl=0):
        return None

    async def _fake_record(_count=1):
        return False

    monkeypatch.setattr("app.core.gnews_counter.get_from_cache", _fake_get_from_cache)
    monkeypatch.setattr("app.core.gnews_counter.set_in_cache", _fake_set_in_cache)
    monkeypatch.setattr("app.core.gnews_counter.MetricsService.record_gnews_hit", _fake_record)

    result = asyncio.run(GNewsCounter.increment_hit())

    assert result["today_hits"] == 3
    assert result["remaining_hits"] == 97
    assert result["max_hits"] == 100


def test_reset_counter_deletes_cache_without_metrics_write(monkeypatch):
    calls = {"deleted": False, "record_called": False}

    async def _fake_get_from_cache(key):
        return 5

    async def _fake_delete_from_cache(key):
        calls["deleted"] = True

    async def _fake_record(_count=1):
        calls["record_called"] = True
        return True

    monkeypatch.setattr("app.core.gnews_counter.get_from_cache", _fake_get_from_cache)
    monkeypatch.setattr("app.core.gnews_counter.delete_from_cache", _fake_delete_from_cache)
    monkeypatch.setattr("app.core.gnews_counter.MetricsService.record_gnews_hit", _fake_record)

    result = asyncio.run(GNewsCounter.reset_counter())

    assert result["status"] == "reset"
    assert calls["deleted"] is True
    assert calls["record_called"] is False


def test_get_hit_history_validates_days_range():
    try:
        asyncio.run(get_hit_history(days=0, user={}))
        assert False, "Expected an exception"
    except Exception as exc:
        # FastAPI HTTPException carries status_code/detail attributes
        assert getattr(exc, "status_code", None) == 400


def test_get_hit_history_returns_expected_shape(monkeypatch):
    async def _fake_get_daily_hits(date_str):
        return {"count": 4, "hours": {"10": 2, "11": 2}}

    monkeypatch.setattr("app.routers.admin.MetricsService.get_daily_hits", _fake_get_daily_hits)

    result = asyncio.run(get_hit_history(days=2, user={}))

    assert result["days"] == 2
    assert len(result["history"]) == 2
    assert all("date" in item and "count" in item and "hours" in item for item in result["history"])
