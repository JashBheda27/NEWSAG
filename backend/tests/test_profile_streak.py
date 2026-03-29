from datetime import datetime, timedelta

from app.routers.profile import _compute_streaks


def test_compute_streaks_empty_returns_zeroes():
    assert _compute_streaks(set()) == (0, 0)


def test_compute_streaks_requires_today_for_current_streak():
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)

    current, best = _compute_streaks({yesterday})

    assert current == 0
    assert best == 1


def test_compute_streaks_counts_consecutive_days_when_latest_is_today():
    today = datetime.utcnow().date()
    day_set = {today, today - timedelta(days=1), today - timedelta(days=2)}

    current, best = _compute_streaks(day_set)

    assert current == 3
    assert best == 3


def test_compute_streaks_best_preserved_when_current_shorter():
    today = datetime.utcnow().date()
    day_set = {
        today,
        today - timedelta(days=3),
        today - timedelta(days=4),
        today - timedelta(days=5),
    }

    current, best = _compute_streaks(day_set)

    assert current == 1
    assert best == 3
