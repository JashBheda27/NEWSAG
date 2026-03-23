"""
Badge policy module for engagement badge distribution.

Defines strictness rules, scoring weights, tier thresholds, and 30-day rolling gates.
Provides pure functions for badge tier resolution with hybrid gating logic.
"""

from typing import Optional, Dict, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta


# ============================================================================
# POLICY CONFIGURATION: Moderate Strictness with Hybrid Gating
# ============================================================================

# Engagement score weights (rebalanced for moderate strictness)
SCORE_WEIGHTS = {
    "articles_read": 1.0,       # 1x multiplier
    "bookmarks": 1.5,           # 1.5x multiplier (reduced from 2x for strictness)
    "read_later": 0.75,         # 0.75x multiplier (reduced from 1x)
}

# Tier definitions: (tier_name, min_score, max_score)
# New thresholds for moderate strictness
BADGE_TIERS = [
    ("Curious Reader", 0, 14),
    ("Regular", 15, 34),
    ("Power Reader", 35, 69),
    ("News Addict", 70, None),  # None = no upper bound
]

# 30-day rolling activity gates for higher tiers (hybrid gating)
# Users must meet BOTH score threshold AND gate requirements for upper tiers
HYBRID_GATES = {
    "Power Reader": {
        "min_articles_read": 12,     # At least 12 articles in rolling 30 days
        "min_bookmarks": 4,          # At least 4 bookmarks in rolling 30 days
        "min_active_days": 6,        # Activity on at least 6 distinct days
    },
    "News Addict": {
        "min_articles_read": 24,     # At least 24 articles in rolling 30 days
        "min_bookmarks": 8,          # At least 8 bookmarks in rolling 30 days
        "min_active_days": 12,       # Activity on at least 12 distinct days
    },
}


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class RollingActivityStats:
    """30-day rolling activity metrics."""
    articles_read: int
    bookmarks: int
    read_later: int
    active_days: int  # Number of distinct days with activity


@dataclass
class BadgeResolution:
    """Result of badge tier resolution."""
    current_tier: str
    next_tier: Optional[str]
    progress_to_next: int  # 0-100 percentage
    reason: Optional[str] = None  # Debug info: why tier changed or was gated


# ============================================================================
# PURE FUNCTIONS: Scoring and Resolution
# ============================================================================

def compute_engagement_score(
    articles_read: int,
    bookmarks: int,
    read_later: int,
) -> int:
    """
    Compute engagement score from activity metrics using rebalanced weights.
    
    Args:
        articles_read: Number of articles summarized
        bookmarks: Number of articles bookmarked
        read_later: Number of articles added to read-later list
    
    Returns:
        Integer engagement score
    """
    score = (
        int(articles_read * SCORE_WEIGHTS["articles_read"]) +
        int(bookmarks * SCORE_WEIGHTS["bookmarks"]) +
        int(read_later * SCORE_WEIGHTS["read_later"])
    )
    return max(0, score)


def get_tier_by_score(engagement_score: int) -> str:
    """
    Get the tier name by its score range, ignoring hybrid gates.
    Used for baseline tier assignment before gate checks.
    
    Args:
        engagement_score: User's computed engagement score
    
    Returns:
        Tier name string
    """
    for tier_name, min_score, max_score in BADGE_TIERS:
        if max_score is None:  # Top tier (no upper bound)
            if engagement_score >= min_score:
                return tier_name
        else:
            if min_score <= engagement_score <= max_score:
                return tier_name
    
    # Fallback (should not reach here if BADGE_TIERS is properly configured)
    return "Curious Reader"


def check_hybrid_gate(
    tier_name: str,
    rolling_stats: RollingActivityStats,
) -> bool:
    """
    Check if user meets the 30-day rolling activity gate for a tier.
    
    Args:
        tier_name: The tier to check gate requirements for
        rolling_stats: 30-day rolling activity metrics
    
    Returns:
        True if tier has no gate OR user meets all gate requirements; False if gated out
    """
    if tier_name not in HYBRID_GATES:
        # Tier has no gate requirement (e.g., "Curious Reader", "Regular")
        return True
    
    gate = HYBRID_GATES[tier_name]
    
    # All gates must be met
    if rolling_stats.articles_read < gate["min_articles_read"]:
        return False
    if rolling_stats.bookmarks < gate["min_bookmarks"]:
        return False
    if rolling_stats.active_days < gate["min_active_days"]:
        return False
    
    return True


def resolve_badge_tier(
    engagement_score: int,
    rolling_stats: RollingActivityStats,
) -> BadgeResolution:
    """
    Resolve user's current badge tier using hybrid scoring and gating.
    
    This function applies BOTH thresholds:
    1. All-time engagement score (for base tier assignment)
    2. 30-day rolling gates (for upper tier unlock)
    
    A user can reach a tier only if they meet BOTH its score threshold
    and its rolling activity gate (if one exists).
    
    Args:
        engagement_score: User's all-time engagement score
        rolling_stats: User's 30-day rolling activity metrics
    
    Returns:
        BadgeResolution with current_tier, next_tier, progress_to_next, and reason
    """
    # Find highest tier the user qualifies for (checking both score and gate)
    baseline_tier = get_tier_by_score(engagement_score)
    
    # Walk through tiers from lowest to highest, applying gates
    current_tier = None
    for idx, (tier_name, min_score, max_score) in enumerate(BADGE_TIERS):
        # User must meet score threshold
        if max_score is None:
            if engagement_score < min_score:
                break  # User doesn't reach this tier by score
        else:
            if engagement_score < min_score or engagement_score > max_score:
                continue  # Not in this tier's score range
        
        # User meets score threshold; now check gate
        if not check_hybrid_gate(tier_name, rolling_stats):
            # User is gated out; stay at previous tier
            break
        
        # User meets both score and gate; advance tier
        current_tier = tier_name
    
    # If no tier was assigned, default to first tier
    if current_tier is None:
        current_tier = "Curious Reader"
    
    # Find current tier's index for progress calculation
    current_idx = next(
        (i for i, (name, _, _) in enumerate(BADGE_TIERS) if name == current_tier),
        0
    )
    current_tier_name, min_score, max_score = BADGE_TIERS[current_idx]
    
    # Compute progress within current tier
    if max_score is None:
        # Top tier: always 100% progress
        progress = 100
        next_tier = None
    else:
        # Within a tier: progress as percentage of range
        span = max(max_score - min_score + 1, 1)
        raw_progress = int(((engagement_score - min_score + 1) / span) * 100)
        progress = max(0, min(raw_progress, 100))
        next_tier = BADGE_TIERS[current_idx + 1][0] if current_idx + 1 < len(BADGE_TIERS) else None
    
    return BadgeResolution(
        current_tier=current_tier,
        next_tier=next_tier,
        progress_to_next=progress,
        reason=f"Score {engagement_score}, baseline tier: {baseline_tier}"
    )


def compute_rolling_30day_stats(
    articles_count_30d: int,
    bookmarks_count_30d: int,
    read_later_count_30d: int,
    active_days_set: set,  # Set of distinct date objects in last 30 days
) -> RollingActivityStats:
    """
    Build rolling 30-day activity metrics for gate checking.
    
    Args:
        articles_count_30d: Number of articles read in rolling 30 days
        bookmarks_count_30d: Number of bookmarks in rolling 30 days
        read_later_count_30d: Number of read-later items in rolling 30 days
        active_days_set: Set of distinct dates with activity in rolling 30 days
    
    Returns:
        RollingActivityStats object
    """
    return RollingActivityStats(
        articles_read=articles_count_30d,
        bookmarks=bookmarks_count_30d,
        read_later=read_later_count_30d,
        active_days=len(active_days_set) if active_days_set else 0,
    )


# ============================================================================
# UTILITY: Tier Metadata
# ============================================================================

def get_all_tier_names() -> list[str]:
    """
    Get list of all available tier names (e.g., for frontend initialization).
    
    Returns:
        List of tier name strings in order from lowest to highest
    """
    return [name for name, _, _ in BADGE_TIERS]


def get_tier_requirements_description(tier_name: str) -> Dict:
    """
    Get human-readable description of requirements for a tier.
    Used for UI tooltips or documentation.
    
    Args:
        tier_name: Name of the tier
    
    Returns:
        Dict with score_range and gate requirements (if any)
    """
    tier_info = next((item for item in BADGE_TIERS if item[0] == tier_name), None)
    if not tier_info:
        return {}
    
    name, min_score, max_score = tier_info
    score_text = f"{min_score}–{max_score}" if max_score else f"{min_score}+"
    
    result = {"tier_name": name, "score_range": score_text}
    
    if tier_name in HYBRID_GATES:
        gate = HYBRID_GATES[tier_name]
        result["gate_requirements"] = {
            "articles_read_30d": gate["min_articles_read"],
            "bookmarks_30d": gate["min_bookmarks"],
            "active_days_30d": gate["min_active_days"],
        }
    
    return result
