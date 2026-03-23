"""
Tests for badge_policy module.

Tests ensure correctness of:
- Engagement score computation with rebalanced weights
- Tier resolution by score ranges
- Hybrid 30-day rolling activity gating
- Progress percentage calculation within tiers
- Promotion and demotion based on score and gates
"""

import pytest
from app.services.badge_policy import (
    compute_engagement_score,
    get_tier_by_score,
    check_hybrid_gate,
    resolve_badge_tier,
    compute_rolling_30day_stats,
    get_all_tier_names,
    get_tier_requirements_description,
    RollingActivityStats,
    BadgeResolution,
    SCORE_WEIGHTS,
    BADGE_TIERS,
    HYBRID_GATES,
)


# ============================================================================
# Test: Engagement Score Computation
# ============================================================================

class TestEngagementScore:
    """Test new weighted engagement score formula."""

    def test_zero_activity(self):
        """Zero activity should return 0."""
        score = compute_engagement_score(0, 0, 0)
        assert score == 0

    def test_articles_only(self):
        """Articles read at 1x weight."""
        score = compute_engagement_score(articles_read=10, bookmarks=0, read_later=0)
        assert score == 10

    def test_bookmarks_weight(self):
        """Bookmarks at 1.5x weight (rebalanced from 2x)."""
        score = compute_engagement_score(articles_read=0, bookmarks=10, read_later=0)
        assert score == 15  # 10 * 1.5

    def test_read_later_weight(self):
        """Read-later at 0.75x weight (rebalanced from 1x)."""
        score = compute_engagement_score(articles_read=0, bookmarks=0, read_later=10)
        assert score == 7   # 10 * 0.75

    def test_combined_weights(self):
        """Test combined scoring with all metrics."""
        # 5 articles + 4 bookmarks + 8 read-later
        # = (5 * 1.0) + (4 * 1.5) + (8 * 0.75)
        # = 5 + 6 + 6 = 17
        score = compute_engagement_score(
            articles_read=5,
            bookmarks=4,
            read_later=8
        )
        assert score == 17

    def test_high_engagement(self):
        """Test high engagement score."""
        # 50 articles + 30 bookmarks + 40 read-later
        # = (50 * 1.0) + (30 * 1.5) + (40 * 0.75)
        # = 50 + 45 + 30 = 125
        score = compute_engagement_score(
            articles_read=50,
            bookmarks=30,
            read_later=40
        )
        assert score == 125


# ============================================================================
# Test: Tier Assignment by Score
# ============================================================================

class TestTierByScore:
    """Test tier assignment using only score thresholds."""

    def test_tier1_lower_bound(self):
        """Score 0 is Curious Reader."""
        tier = get_tier_by_score(0)
        assert tier == "Curious Reader"

    def test_tier1_upper_bound(self):
        """Score 14 is Curious Reader."""
        tier = get_tier_by_score(14)
        assert tier == "Curious Reader"

    def test_tier2_lower_bound(self):
        """Score 15 is Regular."""
        tier = get_tier_by_score(15)
        assert tier == "Regular"

    def test_tier2_upper_bound(self):
        """Score 34 is Regular."""
        tier = get_tier_by_score(34)
        assert tier == "Regular"

    def test_tier3_lower_bound(self):
        """Score 35 is Power Reader."""
        tier = get_tier_by_score(35)
        assert tier == "Power Reader"

    def test_tier3_upper_bound(self):
        """Score 69 is Power Reader."""
        tier = get_tier_by_score(69)
        assert tier == "Power Reader"

    def test_tier4_lower_bound(self):
        """Score 70 is News Addict (top tier)."""
        tier = get_tier_by_score(70)
        assert tier == "News Addict"

    def test_tier4_high_score(self):
        """Score 1000 is still News Addict."""
        tier = get_tier_by_score(1000)
        assert tier == "News Addict"


# ============================================================================
# Test: Hybrid Gate Checking
# ============================================================================

class TestHybridGate:
    """Test 30-day rolling activity gates."""

    def test_tier1_has_no_gate(self):
        """Curious Reader has no gate."""
        stats = RollingActivityStats(
            articles_read=0,
            bookmarks=0,
            read_later=0,
            active_days=0
        )
        assert check_hybrid_gate("Curious Reader", stats) is True

    def test_tier2_has_no_gate(self):
        """Regular tier has no gate."""
        stats = RollingActivityStats(
            articles_read=0,
            bookmarks=0,
            read_later=0,
            active_days=0
        )
        assert check_hybrid_gate("Regular", stats) is True

    def test_tier3_gate_articles_pass(self):
        """Power Reader: sufficient articles."""
        stats = RollingActivityStats(
            articles_read=12,
            bookmarks=4,
            read_later=0,
            active_days=6
        )
        assert check_hybrid_gate("Power Reader", stats) is True

    def test_tier3_gate_articles_fail(self):
        """Power Reader: insufficient articles (11 < 12)."""
        stats = RollingActivityStats(
            articles_read=11,
            bookmarks=4,
            read_later=0,
            active_days=6
        )
        assert check_hybrid_gate("Power Reader", stats) is False

    def test_tier3_gate_bookmarks_fail(self):
        """Power Reader: insufficient bookmarks (3 < 4)."""
        stats = RollingActivityStats(
            articles_read=12,
            bookmarks=3,
            read_later=0,
            active_days=6
        )
        assert check_hybrid_gate("Power Reader", stats) is False

    def test_tier3_gate_days_fail(self):
        """Power Reader: insufficient active days (5 < 6)."""
        stats = RollingActivityStats(
            articles_read=12,
            bookmarks=4,
            read_later=0,
            active_days=5
        )
        assert check_hybrid_gate("Power Reader", stats) is False

    def test_tier4_gate_articles_pass(self):
        """News Addict: sufficient articles."""
        stats = RollingActivityStats(
            articles_read=24,
            bookmarks=8,
            read_later=0,
            active_days=12
        )
        assert check_hybrid_gate("News Addict", stats) is True

    def test_tier4_gate_articles_fail(self):
        """News Addict: insufficient articles (23 < 24)."""
        stats = RollingActivityStats(
            articles_read=23,
            bookmarks=8,
            read_later=0,
            active_days=12
        )
        assert check_hybrid_gate("News Addict", stats) is False

    def test_tier4_gate_bookmarks_fail(self):
        """News Addict: insufficient bookmarks (7 < 8)."""
        stats = RollingActivityStats(
            articles_read=24,
            bookmarks=7,
            read_later=0,
            active_days=12
        )
        assert check_hybrid_gate("News Addict", stats) is False

    def test_tier4_gate_days_fail(self):
        """News Addict: insufficient active days (11 < 12)."""
        stats = RollingActivityStats(
            articles_read=24,
            bookmarks=8,
            read_later=0,
            active_days=11
        )
        assert check_hybrid_gate("News Addict", stats) is False


# ============================================================================
# Test: Full Badge Resolution (Score + Gates)
# ============================================================================

class TestBadgeResolution:
    """Test complete badge tier resolution with hybrid logic."""

    def test_new_user_zero_activity(self):
        """New user with no activity is Curious Reader."""
        rolling_stats = RollingActivityStats(0, 0, 0, 0)
        resolution = resolve_badge_tier(0, rolling_stats)
        assert resolution.current_tier == "Curious Reader"
        assert resolution.next_tier == "Regular"
        assert 0 <= resolution.progress_to_next <= 100

    def test_casual_user_tier1(self):
        """Casual user (score 10) is Curious Reader."""
        rolling_stats = RollingActivityStats(0, 0, 0, 0)
        resolution = resolve_badge_tier(10, rolling_stats)
        assert resolution.current_tier == "Curious Reader"

    def test_active_user_tier2(self):
        """Active user (score 25) is Regular (no gate required)."""
        rolling_stats = RollingActivityStats(0, 0, 0, 0)  # No 30-day activity needed for tier2
        resolution = resolve_badge_tier(25, rolling_stats)
        assert resolution.current_tier == "Regular"
        assert resolution.next_tier == "Power Reader"

    def test_power_reader_with_gate_pass(self):
        """Power Reader: score 50 + sufficient 30-day activity."""
        rolling_stats = RollingActivityStats(
            articles_read=15,
            bookmarks=5,
            read_later=0,
            active_days=8
        )
        resolution = resolve_badge_tier(50, rolling_stats)
        assert resolution.current_tier == "Power Reader"
        assert resolution.next_tier == "News Addict"

    def test_power_reader_score_but_gated(self):
        """Score qualifies for Power Reader (50), but insufficient 30-day activity."""
        rolling_stats = RollingActivityStats(
            articles_read=5,      # < 12 required
            bookmarks=5,
            read_later=0,
            active_days=8
        )
        resolution = resolve_badge_tier(50, rolling_stats)
        # User stays at Regular because gate for Power Reader is not met
        assert resolution.current_tier == "Regular"
        assert resolution.next_tier == "Power Reader"

    def test_news_addict_with_gate_pass(self):
        """News Addict: score 100 + sufficient 30-day activity."""
        rolling_stats = RollingActivityStats(
            articles_read=30,
            bookmarks=10,
            read_later=0,
            active_days=15
        )
        resolution = resolve_badge_tier(100, rolling_stats)
        assert resolution.current_tier == "News Addict"
        assert resolution.next_tier is None  # Top tier
        assert resolution.progress_to_next == 100

    def test_news_addict_score_but_gated(self):
        """Score qualifies for News Addict (75), but insufficient 30-day activity."""
        rolling_stats = RollingActivityStats(
            articles_read=10,     # < 24 required
            bookmarks=5,
            read_later=0,
            active_days=6
        )
        resolution = resolve_badge_tier(75, rolling_stats)
        # User drops to Power Reader (if eligible) or Regular
        assert resolution.current_tier in ["Regular", "Power Reader"]

    def test_demotion_on_activity_drop(self):
        """User loses tier if 30-day activity drops."""
        # Initially qualifies as Power Reader
        rolling_stats_good = RollingActivityStats(12, 4, 0, 6)
        resolution_good = resolve_badge_tier(50, rolling_stats_good)
        assert resolution_good.current_tier == "Power Reader"

        # Activity drops below requirement
        rolling_stats_bad = RollingActivityStats(5, 2, 0, 3)
        resolution_bad = resolve_badge_tier(50, rolling_stats_bad)
        # Should demote to Regular (score still qualifies for Power Reader, but gate fails)
        assert resolution_bad.current_tier == "Regular"


# ============================================================================
# Test: Progress Percentage
# ============================================================================

class TestProgressPercentage:
    """Test progress percentage calculation within tiers."""

    def test_tier1_progress_at_start(self):
        """Progress at score 0 is 0%."""
        rolling_stats = RollingActivityStats(0, 0, 0, 0)
        resolution = resolve_badge_tier(0, rolling_stats)
        assert resolution.progress_to_next <= 25  # Early in tier

    def test_tier1_progress_at_end(self):
        """Progress at score 14 should be near 100%."""
        rolling_stats = RollingActivityStats(0, 0, 0, 0)
        resolution = resolve_badge_tier(14, rolling_stats)
        assert resolution.progress_to_next >= 80  # Near end of tier

    def test_tier2_progress_mid_range(self):
        """Progress in middle of tier2 (score 24 in range 15-34)."""
        rolling_stats = RollingActivityStats(0, 0, 0, 0)
        resolution = resolve_badge_tier(24, rolling_stats)
        # Score 24 in range [15, 34]: (24-15+1)/(34-15+1) = 10/20 = 50%
        assert 40 <= resolution.progress_to_next <= 60

    def test_top_tier_always_100(self):
        """Top tier (News Addict) with sufficient gate always 100%."""
        rolling_stats = RollingActivityStats(30, 10, 0, 15)
        resolution = resolve_badge_tier(100, rolling_stats)
        assert resolution.progress_to_next == 100


# ============================================================================
# Test: Utility Functions
# ============================================================================

class TestUtilityFunctions:
    """Test helper and metadata functions."""

    def test_get_all_tier_names(self):
        """Get list of all tier names."""
        tiers = get_all_tier_names()
        assert len(tiers) == 4
        assert tiers == ["Curious Reader", "Regular", "Power Reader", "News Addict"]

    def test_get_tier_requirements_tier1(self):
        """Get Curious Reader requirements (no gate)."""
        req = get_tier_requirements_description("Curious Reader")
        assert req["tier_name"] == "Curious Reader"
        assert req["score_range"] == "0–14"
        assert "gate_requirements" not in req

    def test_get_tier_requirements_tier3(self):
        """Get Power Reader requirements (with gate)."""
        req = get_tier_requirements_description("Power Reader")
        assert req["tier_name"] == "Power Reader"
        assert req["score_range"] == "35–69"
        assert "gate_requirements" in req
        assert req["gate_requirements"]["articles_read_30d"] == 12
        assert req["gate_requirements"]["bookmarks_30d"] == 4
        assert req["gate_requirements"]["active_days_30d"] == 6

    def test_compute_rolling_stats(self):
        """Wrap raw counts into RollingActivityStats."""
        stats = compute_rolling_30day_stats(
            articles_count_30d=20,
            bookmarks_count_30d=8,
            read_later_count_30d=5,
            active_days_set=set()
        )
        assert stats.articles_read == 20
        assert stats.bookmarks == 8
        assert stats.read_later == 5
        assert stats.active_days == 0


# ============================================================================
# Test: Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test boundary and edge case scenarios."""

    def test_negative_score_clamped_to_zero(self):
        """Negative scores are clamped to 0."""
        score = compute_engagement_score(-10, -5, -3)
        assert score == 0

    def test_floating_point_weights_rounded(self):
        """Floating-point weights are rounded to int."""
        # 1 article * 1.0 + 1 bookmark * 1.5 + 1 read_later * 0.75
        # = 1 + 1 (0.5 truncated) + 0 (0.75 truncated) = 2
        score = compute_engagement_score(1, 1, 1)
        assert score >= 2  # At least 2 due to rounding

    def test_exact_gate_boundaries_pass(self):
        """Users at exact gate minimums should pass."""
        stats_power = RollingActivityStats(12, 4, 0, 6)
        assert check_hybrid_gate("Power Reader", stats_power) is True

        stats_addict = RollingActivityStats(24, 8, 0, 12)
        assert check_hybrid_gate("News Addict", stats_addict) is True

    def test_one_below_gate_fails(self):
        """One point below gate minimum should fail."""
        stats_power = RollingActivityStats(11, 4, 0, 6)
        assert check_hybrid_gate("Power Reader", stats_power) is False

        stats_addict = RollingActivityStats(24, 7, 0, 12)
        assert check_hybrid_gate("News Addict", stats_addict) is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
