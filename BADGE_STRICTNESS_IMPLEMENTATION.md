# Badge Strictness Implementation & Validation Guide

## Overview

This document provides a comprehensive guide to the stricter engagement badge distribution system implemented in NewsAura. The new system uses **hybrid scoring** (all-time score + rolling 30-day activity gates) to make badges more meaningful and harder to acquire.

---

## What Changed

### 1. **Scoring Weights (Rebalanced)**

**Before:**
```
engagement_score = articles_read + (bookmarks × 2) + read_later
```

**After:**
```
engagement_score = (articles_read × 1.0) + (bookmarks × 1.5) + (read_later × 0.75)
```

**Rationale:**
- Bookmarks weighted **reduced from 2x to 1.5x** — still encourages curation but less dominant
- Read-later weighted **reduced from 1x to 0.75x** — lower weight for passive bookmarking
- Articles read weight **unchanged at 1x** — reading remains the core engagement metric

---

### 2. **Tier Thresholds (Increased)**

| Tier | **Before** | **After** | **Change** |
|------|-----------|----------|-----------|
| **Curious Reader** | 0–9 | 0–14 | +5 points (easier for new users) |
| **Regular** | 10–24 | 15–34 | +5 minimum, +10 maximum (harder to reach) |
| **Power Reader** | 25–49 | 35–69 | +10 minimum, +20 maximum (≈ 33% harder) |
| **News Addict** | 50+ | 70+ | +20 minimum (significantly harder) |

**Example:**
- An old "Power Reader" at score 35 now needs score 35 to stay at Power Reader ✓
- But an old user with score 50 who doesn't engage now drops to Regular (if 30-day activity insufficient)

---

### 3. **Hybrid Gating (NEW): All-Time Score + Rolling 30-Day Activity**

**New Rule:** Upper tiers require BOTH:
1. All-time engagement score in the tier's range
2. Recent activity gate requirements (last 30 days)

#### **Tier 1 & 2 (Curious Reader, Regular): No Gates**
- Any user with sufficient all-time score qualifies immediately
- No recency requirement

#### **Tier 3 (Power Reader): 30-Day Gate**
Requires these metrics within rolling 30 days:
- **Minimum 12 articles read**
- **Minimum 4 bookmarks**
- **Activity on at least 6 distinct days**

#### **Tier 4 (News Addict): 30-Day Gate**
Requires these metrics within rolling 30 days:
- **Minimum 24 articles read**
- **Minimum 8 bookmarks**
- **Activity on at least 12 distinct days**

**Why?** Prevents one-time credit spikes from granting permanent high-tier badges.

---

### 4. **Demotion Policy (Fully Dynamic)**

**NEW:** Users can now lose tier levels if 30-day activity drops.

**Example:**
- User reaches "News Addict" with high engagement
- If activity drops below rolling 30-day gates for News Addict
- They automatically demote to "Power Reader" on next profile load
- They can achieve it again by resuming high engagement patterns

---

## Backend Changes

### File: `backend/app/services/badge_policy.py` (NEW)

Encapsulates all badge business logic:
- `compute_engagement_score()` — Uses rebalanced weights
- `resolve_badge_tier()` — Hybrid scoring + gating logic
- `check_hybrid_gate()` — Validates 30-day activity requirements
- Policy constants (thresholds, gates, weights)

### File: `backend/app/routers/profile.py` (UPDATED)

- Added `_compute_rolling_30day_stats()` — Calculates 30-day rolling metrics
- Replaced old `_get_badge_progress()` with `_get_badge_progress_dict()` — Uses new policy
- Updated engagement score calculation with new weights
- Synchronized `tier3.engagement_label` with new tier names (fallback compatibility)

### File: `backend/tests/test_badge_policy.py` (NEW)

Comprehensive test suite covering:
- Engagement score computation with rebalanced weights
- Tier assignment by score ranges
- Hybrid gate checking (pass/fail scenarios)
- Full badge resolution (score + gates combined)
- Progress percentage calculation
- Demotion scenarios
- Edge cases and boundary values

**Run tests:**
```bash
pytest backend/tests/test_badge_policy.py -v
```

---

## Frontend Changes

### File: `frontend/src/pages/Profile.tsx` (UPDATED)

**Changes:**
- Added `getCurrentBadgeTier()` helper — Safe tier extraction with fallback chain:
  1. `tier4.badge.current_tier` (new policy)
  2. `tier3.engagement_label` (legacy fallback)
  3. `"Curious Reader"` (default)
- Added `normalizeTierName()` helper — Handles name discrepancies gracefully
- Updated badge chip rendering to use helpers instead of direct property access
- Badge UI now handles missing/malformed tier4 data without crashing

**Resilience:**
- If backend doesn't return `tier4`, falls back to `tier3.engagement_label`
- If both missing, defaults to `"Curious Reader"`
- Progress bar defaults to 0% if data missing
- No hard dependencies on specific API response shape

### File: `frontend/src/pages/Profile.test.tsx` (NEW)

Test coverage for:
- Badge display from tier4.badge.current_tier
- Fallback chain (tier4 → tier3 → default)
- Active badge chip highlighting
- Progress bar and percentage display
- Next tier text and "Top tier reached" message
- Malformed data handling (missing fields, empty strings, invalid percentages)
- Loading states and placeholders

**Run tests:**
```bash
npm test -- Profile.test.tsx
```

---

## Validation & Migration

### Pre-Deployment Validation

#### 1. **Backend Tests**

```bash
cd backend
# Run badge policy tests
pytest tests/test_badge_policy.py -v

# Run all profile-related tests
pytest tests/ -k profile -v
```

**Expected:** All tests pass ✓

#### 2. **Sample User Profiling**

Compare old vs. new badge assignments on test users:

```python
# backend/tests/test_badge_policy.py provides sample scenarios

# Low engagement user
Old: Curious Reader (score 8)
New: Curious Reader (score 8) — unchanged ✓

# Moderate engagement user
Old: Regular (score 22)
New: Regular (score 16.5 with new weights) — may drop or stay ✓

# High engagement, inactive recently
Old: Power Reader (score 50 all-time)
New: Regular (score 50 all-time, but fails 30-day gate) — **DEMOTION** ✓

# Consistent high engagement user
Old: News Addict (score 75 all-time)
New: News Addict (score 75 all-time + meets 30-day gates) — unchanged ✓
```

#### 3. **Frontend Tests**

```bash
cd frontend
npm test -- Profile.test.tsx
```

**Expected:** All badge display tests pass ✓

#### 4. **API Contract Validation**

Verify `/api/profile/analytics` response includes:
```json
{
  "tier4": {
    "badge": {
      "current_tier": "string",       // e.g., "Power Reader"
      "next_tier": "string | null",   // e.g., "News Addict" or null
      "progress_to_next": number      // 0–100
    },
    ...
  }
}
```

**Fallback shape** (if tier4 missing):
```json
{
  "tier3": {
    "engagement_label": "string",     // e.g., "Regular"
    ...
  }
}
```

#### 5. **Production Health Checks**

After deployment, monitor:

1. **Badge Distribution Shift**
   - Count users per tier (before vs. after)
   - Expect: Fewer users in Power Reader & News Addict
   - Investigate: If > 50% drop, may indicate issue

2. **Query Performance**
   - Monitor `/api/profile/analytics` latency
   - New rolling 30-day queries may add ~20–100ms
   - Investigate: If exceeds 500ms, add database indexes

3. **User Complaints**
   - "My badge went down" — expected (30-day tracking)
   - "I see no badge" — check dataflow
   - "Progress bar wrong" — check progress_to_next calculation

---

## Migration Runbook

### Step 1: Deploy Backend

1. Copy `badge_policy.py` to `backend/app/services/`
2. Update `backend/app/routers/profile.py` with new code
3. Ensure database has `created_at` timestamps on:
   - `summary_logs` (articles read)
   - `bookmarks`
   - `read_later`
4. Run migrations if needed
5. Restart backend service

### Step 2: Run Backend Tests

```bash
pytest backend/tests/test_badge_policy.py -v
pytest backend/tests/ -k profile -v
```

**If tests fail:** Check imports, database state, or Python version.

### Step 3: Deploy Frontend

1. Update `frontend/src/pages/Profile.tsx` with new code
2. Replace or update `frontend/src/pages/Profile.test.tsx`
3. Verify TypeScript compilation

```bash
npm run build
```

### Step 4: Run Frontend Tests

```bash
npm test -- Profile.test.tsx --coverage
```

### Step 5: Canary Release (Recommended)

Deploy to 10% of users first:
- Monitor badge display accuracy
- Check for API errors in logs
- Verify no console errors in browser dev tools

### Step 6: Full Release

Roll out to 100% of users.

### Step 7: Monitor & Iterate

- Track user badge transitions in analytics
- Collect feedback on difficulty (is it too strict?)
- Adjust gates/weights if needed (no code change required for policy constants)

---

## Troubleshooting

### Issue: All users showing "Curious Reader"

**Cause:** `_compute_rolling_30day_stats()` failing or returning zeros.

**Fix:**
1. Check `summary_logs`, `bookmarks`, `read_later` have `created_at` timestamps
2. Verify MongoDB aggregation pipelines in `_compute_rolling_30day_stats()`
3. Check application logs for database errors

### Issue: Users keep demoting unexpectedly

**Cause:** 30-day window is too aggressive, or user activity naturally drops.

**Fix:**
1. Adjust gate minimums in `badge_policy.py` (e.g., 12 → 10 articles)
2. Consider extending window from 30 days → 45 days
3. Communicate change to users in release notes

### Issue: Frontend not updating badge after backend change

**Cause:** Browser caching or stale data.

**Fix:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Check `/api/profile/analytics` response in Network tab
3. Verify `tier4.badge.current_tier` is present

### Issue: Progress bar shows wrong percentage

**Cause:** Progress calculation off-by-one or float rounding.

**Fix:**
1. Check `progress_to_next` value in API response
2. Verify span calculation in `_get_badge_progress_dict()`:
   ```python
   span = max(max_score - min_score + 1, 1)
   progress = int(((score - min_score + 1) / span) * 100)
   ```

---

## Feature Flags & Rollback

### Option A: Immediate Rollout
- Pros: Clean cutover, no code path duplication
- Cons: Users see badge changes immediately; complaints possible

### Option B: Feature Flag (Recommended)
```python
# backend/app/routers/profile.py
if settings.BADGE_POLICY_V2_ENABLED:
    badge = _get_badge_progress_dict(engagement_score, rolling_stats)
else:
    badge = _get_badge_progress_old(engagement_score)  # Fallback
```

- Pros: Can enable for subset of users, quick rollback
- Cons: Requires conditional code

### Rollback Plan

If severe issue discovered:
1. Disable feature flag or revert `profile.py`
2. Clear edge caches
3. Notify users of revert
4. Investigate root cause and re-deploy

---

## Key Metrics to Track

| Metric | Baseline | Target | Alert Threshold |
|--------|----------|--------|-----------------|
| % Users in Curious Reader | 30% | 35% | > 50% |
| % Users in Regular | 40% | 38% | > 60% |
| % Users in Power Reader | 25% | 22% | < 10% |
| % Users in News Addict | 5% | 5% | < 1% |
| /api/profile/analytics latency | 200ms | < 250ms | > 500ms |
| 30-day badge demotion rate | N/A | ~5–10% | > 30% |

---

## FAQ

### Q: Will existing users lose badges?

**A:** Possibly, if their recent 30-day activity doesn't meet gate requirements. This is intentional to prevent stale high-tier badges. Users can regain tiers by re-engaging.

### Q: Can this be configured without code changes?

**A:** Yes. Modify these constants in `badge_policy.py`:
- `SCORE_WEIGHTS` — Change multipliers
- `BADGE_TIERS` — Change score ranges
- `HYBRID_GATES` — Change 30-day requirements

No backend restart needed if using environment variables or config files.

### Q: What if a user reaches Power Reader but immediately drops below gates?

**A:** They stay at Power Reader until the next profile analytics call (usually within seconds). On refresh, they'll see Regular if gates no longer met. This is **intentional dynamic behavior**.

### Q: How does this affect API clients?

**A:** No breaking changes. The API still returns `tier4.badge` with same fields. Fallback to `tier3.engagement_label` still works. Clients can ignore new gating logic.

---

## Performance Notes

### New Queries Added

1. **30-day articles count:** Single collection count with date filter
   - Expected time: 10–50ms (with index on `created_at`)

2. **30-day bookmarks/read-later counts:** Two count queries
   - Expected time: 10–50ms each

3. **30-day active days:** Aggregation pipeline on `summary_logs`
   - Expected time: 20–100ms (depends on dataset size)

**Total added latency:** ~50–300ms

**Optimization:**
- Index on `(user_id, created_at)` for bookmarks, read_later, summary_logs
- Cache rolling stats for 5 minutes per user
- Use MongoDB `$dateToString` for day grouping

---

## Next Steps

1. ✅ **Implement** badge policy module
2. ✅ **Integrate** into profile.py
3. ✅ **Update** Profile.tsx for resilience
4. ✅ **Test** backend and frontend
5. 🔲 **Validate** with staging users
6. 🔲 **Deploy** with feature flag
7. 🔲 **Monitor** metrics and health
8. 🔲 **Collect** user feedback
9. 🔲 **Iterate** on gates/weights if needed

---

## Contact & Support

- **Badge Logic Questions:** Review `backend/app/services/badge_policy.py` docstrings
- **Integration Questions:** Review `backend/app/routers/profile.py` usage
- **UI Issues:** Review `frontend/src/pages/Profile.tsx` helpers
- **Tests:** Run test suites with `-v` flag for detailed output
