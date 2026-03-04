# NewsAura Admin Dashboard Guide

## Overview

The **Admin Dashboard** (`/admin`) is a comprehensive management interface for NewsAura administrators. It provides tools for:
- **Credibility Quality Control**: Review and verify reports on misleading articles
- **Sentiment Model Training**: Manage user feedback and fine-tune sentiment models
- **Cache Management**: Refresh news data and manage API quotas
- **Model Tuning**: Trigger fine-tuning jobs for sentiment and credibility models
- **Audit Logging**: Track all admin actions for compliance and troubleshooting

---

## 1. Role Assignment & Access Control

### Setting Up Admin Users

**Option A: Environment Variable (Allowlist)**
The fastest way to assign admins during initial setup.

1. Set the `ADMIN_USER_IDS` environment variable in your `.env`:
   ```bash
   ADMIN_USER_IDS=clerk_user_id_1,clerk_user_id_2,clerk_user_id_3
   ```

2. Find Clerk user IDs via [Clerk Dashboard](https://dashboard.clerk.com):
   - Navigate to **Users**
   - Click a user and copy the **User ID** field

3. Restart the backend to apply changes.

**Option B: Clerk Metadata (Dynamic)**
For production environments where you need to add/remove admins without redeployment.

1. Create a custom claim in Clerk:
   - In Clerk Dashboard, go to **JWT Templates**
   - Edit the default template
   - Add custom claim: `"admin": true` (or configure in organization metadata)

2. The backend will check:
   - First: `payload.metadata.admin` (custom metadata key)
   - Second: `payload.org_role` (organization role like "owner", "admin")
   - Fallback: `ADMIN_USER_IDS` allowlist

3. Update `.env` if using non-default keys:
   ```bash
   CLERK_ADMIN_METADATA_KEY=admin
   CLERK_ADMIN_ORG_ROLES=admin,owner
   ```

### Verification

Test admin access:
```bash
# Option 1: Check the browser console
# When logged in as admin, the admin routes become available

# Option 2: Test API endpoint directly
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/api/admin/training/stats
```

Expected response (200 OK):
```json
{
  "training_data": {
    "sentiment_total": 145,
    "sentiment_with_feedback": 82,
    "credibility_total": 312,
    "credibility_verified": 125,
    "credibility_pending": 18
  },
  "models": {
    "sentiment": { "name": "sentiment-v1", "status": "ready" },
    "credibility": { "name": "credibility-v2", "status": "ready" }
  }
}
```

---

## 2. Daily Operations

### 2.1 Credibility Queue

**Purpose**: Review user reports on articles suspected of containing misinformation.

**Steps**:
1. Navigate to **Credibility Queue** in the sidebar
2. Click a report to expand details:
   - Article title and source
   - AI credibility score (0-1, lower = less credible)
   - User reason for report
   - Number of similar reports
3. Choose:
   - **✓ Verify**: Confirm the article is misleading (improves model)
   - **✗ Reject**: Dismiss the report (trains negative examples)

**Best Practices**:
- Prioritize reports with high `report_count` (multiple users flagged it)
- Verify reports help train the credibility model; aim for 50+ verified per week
- Use consistent criteria across verifications for model quality

---

### 2.2 Sentiment Feedback Review

**Purpose**: Monitor and curate sentiment analysis training data.

**Steps**:
1. Navigate to **Sentiment Feedback**
2. Filter by:
   - **Sentiment**: All, Positive, Neutral, Negative
   - **Source**: Explicit (user-rated), Implicit (bookmark/read-later inferred)
3. Review samples:
   - Text excerpt (first 200 chars)
   - AI prediction vs. user label
   - Confidence score
4. Export feedback as CSV for analysis

**Best Practices**:
- Check "Positive Feedback" first (most users interact with articles they like)
- Use CSV export for training data evaluation
- Target 200+ sentiment samples for fine-tuning (see Model Tuning section)

---

### 2.3 Cache & Quota Management (System Ops)

**Purpose**: Keep news data fresh and monitor API rate limits.

**Daily Tasks**:

1. **Refresh News Cache**
   - Click **Refresh All** to update all 7 news categories in parallel (~8-10 sec)
   - Or refresh individual categories (e.g., just "Technology") for faster updates
   - Uses 7 API hits (one per category)

2. **Monitor GNews Quota**
   - View current hit count in the **GNews API Status** box
   - Daily limit: 100 hits
   - Refresh all categories uses 7 hits; refresh one uses 1 hit
   - **Warning**: Quota resets at UTC 00:00; plan refreshes accordingly

3. **Reset Quota (Testing Only)**
   - Click **Reset GNews Quota** to set counter to 0
   - ⚠️ **Use in testing/development only**
   - Resets are logged in audit trail; production resets require approval

---

### 2.4 Model Tuning

**Purpose**: Improve model accuracy by retraining with new feedback.

**Sentiment Model Fine-Tuning**:
1. Navigate to **Model Tuning**
2. Ensure at least 50 sentiment samples (check **Sentiment Feedback**)
3. Click **Start Fine-Tune (Sentiment)**
   - Min Samples: 50 (default)
   - Epochs: 3 (default; higher = more training)
4. Wait for job to complete (~2-5 minutes)
5. New model is automatically deployed if accuracy improves

**Credibility Model Fine-Tuning**:
1. Ensure at least 30 verified credibility reports (check **Credibility Queue**)
2. Click **Start Fine-Tune (Credibility)**
   - Min Samples: 30 (default)
   - Epochs: 3 (default)
3. Wait for job to complete (~3-7 minutes)
4. New model is deployed if accuracy threshold is met

**Best Practices**:
- Run fine-tuning weekly (Friday evening)
- Start sentiment tuning after 200+ feedback samples
- Start credibility tuning after 50+ verified reports
- Monitor job status in audit log after starting

---

## 3. Incident Response

### Incident: Quota Exhausted (100 hits reached)

**Symptoms**:
- News categories show stale data (>12 hours old)
- `/api/news/*` endpoints return 429 errors
- GNews Status shows hit count = 100

**Response**:
1. **Immediate Action** (same day):
   - Notify development team
   - Pause automatic refresh jobs
   - Review audit log for refresh patterns

2. **Root Cause Analysis**:
   - Check **Audit Log** → filter by `refresh_cache` action
   - Count refresh hits used in past 24 hours
   - Compare against expected usage (7 hits/full refresh, 1 hit/category)

3. **Recovery**:
   - If over-refreshed by mistake: Acknowledge and log in audit trail
   - Quota resets daily at UTC 00:00; wait for automatic reset
   - ⚠️ Do **NOT** use "Reset Quota" in production without approval

4. **Prevention**:
   - Schedule automatic refreshes for off-peak hours
   - Use category-specific refreshes (1 hit) instead of refresh-all (7 hits)
   - Document refresh strategy in deployment docs

---

### Incident: Model Training Failure

**Symptoms**:
- Fine-tune job appears to hang or fails silently
- New model not deployed after tuning
- Audit log shows failed `fine_tune` action

**Response**:
1. **Check Audit Log**:
   - Filter by `action: fine_tune`
   - Note the error message and timestamp
   - Common errors:
     - `"Insufficient training samples"` → Collect more feedback before tuning
     - `"Model accuracy below threshold"` → Review training data quality
     - `"Timeout during training"` → Re-run with smaller epoch count

2. **Verify Training Data Quality**:
   - Go to **Sentiment/Credibility Feedback**
   - Spot-check samples for data errors
   - Ensure labels are accurate and consistent

3. **Recovery**:
   - Increase min_samples and retry
   - Or reduce epochs to speed up training
   - Monitor fine-tune process via audit log

4. **Escalation**:
   - If multiple failures: contact development team
   - May indicate data quality issues or model degradation

---

### Incident: High False Positives in Credibility Reports

**Symptoms**:
- Users report false positives (legitimate articles marked misleading)
- Credibility model accuracy declining
- Many rejected reports in audit log

**Response**:
1. **Review Recent Verifications**:
   - Go to **Audit Log** → filter by `verify_report`
   - Sample rejected reports and check if rejections are correct

2. **Retrain with Corrected Data**:
   - Increase emphasis on negative examples (rejections) in fine-tuning
   - Consider manual review of high-confidence-but-wrong predictions

3. **Rollback (if necessary)**:
   - Previous model checkpoint available (contact dev)
   - Deploy prior version while collecting better training data

---

## 4. Authentication & Security

### Backend Dependency: `require_admin()`

All admin endpoints are protected by the `require_admin()` dependency:
```python
@router.post("/fine-tune/sentiment", dependencies=[Depends(require_admin)])
async def fine_tune(...):
    ...
```

**Flow**:
1. Frontend sends JWT token in `Authorization: Bearer` header
2. Backend validates token via Clerk JWKS endpoint
3. Token payload checked against admin criteria (see Section 1)
4. If not admin → returns **403 Forbidden**
5. If admin → endpoint executes, action logged to audit trail

### Frontend Protection: `AdminRoute`

All `/admin/*` routes require the user to be signed in via Clerk:
```tsx
<Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
```

- Non-signed-in users → see Clerk sign-in modal
- Signed-in non-admins → routes load, but API calls return 403

---

## 5. Audit Log

### Purpose
The audit log (`/admin/audit`) tracks all admin actions for:
- **Compliance**: Document who did what and when
- **Troubleshooting**: Investigate issues by reviewing actions
- **Performance**: Identify patterns in admin usage

### Actions Logged

| Action | Resource | Details | When |
|--------|----------|---------|------|
| `verify_report` | credibility_report | status (verified/rejected) | Admin verifies a credibility report |
| `reject_report` | credibility_report | status | Admin rejects a credibility report |
| `fine_tune` | sentiment_model / credibility_model | min_samples, epochs | Admin starts model tuning |
| `refresh_cache` | news_category / all_categories | articles_count, error_count | Admin refreshes news cache |
| `reset_quota` | gnews_hits | reset_to (usually 0) | Admin resets GNews hit counter |

### Filtering & Export

1. **Filter by**:
   - Action: Verify, Reject, Fine-Tune, Refresh, Reset
   - Resource Type: Reports, Models, Categories, API Quotas
   - Date range (via timestamp)

2. **Export as CSV**:
   - Click **Export CSV** for analysis in spreadsheets
   - Includes timestamp, admin user, action, resource, status, error messages

### Example Queries

**"How many times did someone refresh all categories today?"**
- Filter: `action: refresh_cache`, `resource_type: all_categories`
- Sort by timestamp

**"Did model tuning succeed last Friday?"**
- Filter: `action: fine_tune`
- Check `success` column and error messages

**"Who reset the quota?"**
- Filter: `action: reset_quota`
- See admin_user_id for each reset

---

## 6. Troubleshooting

### ❌ "401 Unauthorized" on Admin API Calls

**Cause**: JWT token missing or invalid

**Fix**:
- Ensure you're signed in (check **Home** page)
- Check browser DevTools → Network → inspect Authorization header
- Reload page and try again

---

### ❌ "403 Forbidden" on Admin API Calls

**Cause**: Signed in but not in admin role

**Fix**:
- Verify your user ID is in `ADMIN_USER_IDS` (see Section 1)
- Or verify Clerk metadata has `admin: true` claim
- Ask deployment team to add you to admin list
- Restart backend after env change

---

### ❌ Admin Routes Not Appearing

**Cause**: Routes loaded before admin auth was established

**Fix**:
- Hard refresh page (`Ctrl+Shift+R` or `Cmd+Shift+R`)
- Clear browser cookies and reload
- Check browser console for JavaScript errors

---

### ❌ "Insufficient training samples" on Fine-Tune

**Cause**: Not enough training data collected

**Fix**:
- For sentiment: collect 200+ samples (go to **Sentiment Feedback**)
- For credibility: collect 50+ verified reports (go to **Credibility Queue**)
- Wait for users to provide feedback, or create test data

---

## 7. Integration Checklist

### Before Production Deployment

- [ ] Set `ADMIN_USER_IDS` with at least 2 admin users (redundancy)
- [ ] Test `/admin/training/stats` endpoint works (auth + DB)
- [ ] Verify Clerk JWKS endpoint is reachable
- [ ] Confirm MongoDB `admin_audit_logs` collection exists and is indexed
- [ ] Review `CLERK_ADMIN_METADATA_KEY` and `CLERK_ADMIN_ORG_ROLES` config
- [ ] Test audit log entry creation (do a refresh, check audit log)
- [ ] Add admin link to main navbar or user menu (optional)
- [ ] Document admin on-boarding process for team

### Maintenance Tasks

**Weekly**:
- Review **Credibility Queue** → approve 10+ reports
- Check **Sentiment Feedback** for data quality issues
- Run fine-tuning if 50+ new samples collected

**Monthly**:
- Audit log review for anomalies (unusual patterns, failed operations)
- Model accuracy check (compare fine-tune results)
- GNews quota usage analysis

**Quarterly**:
- Admin team training / documentation review
- Security audit (who has access, when)
- Performance tuning (optimize index query times)

---

## 8. API Endpoints Reference

All endpoints require authentication (`require_admin` dependency).

### Training & Models

```
GET  /api/admin/training/stats
POST /api/admin/fine-tune/sentiment?min_samples=50&epochs=3
POST /api/admin/fine-tune/credibility?min_samples=30&epochs=3
POST /api/admin/fine-tune/all
```

### Credibility Reports

```
GET  /api/admin/reports/pending?limit=50
POST /api/admin/reports/{report_id}/verify?verified=true
```

### Sentiment Feedback

```
GET  /api/admin/feedback/sentiment?limit=100&source=explicit
```

### Audit Log

```
GET  /api/admin/audit/logs?limit=100&action=verify_report&resource_type=credibility_report
GET  /api/admin/audit/activity-summary?admin_user_id=USER_ID&days=7
```

### News Cache & Quota

```
POST /api/news/refresh-all
POST /api/news/refresh/{category}
GET  /api/news/status/hits
POST /api/news/admin/reset-hits
```

---

## 9. Questions & Support

For questions or issues:
1. Check this guide (Ctrl+F to search)
2. Review audit log for error details
3. Check backend logs: `docker logs newsaura-backend`
4. Contact development team with:
   - What you were trying to do
   - Error message from audit log or browser console
   - Timestamp of the issue
   - Your admin user ID

---

**Last Updated**: 2024  
**Admin Dashboard Version**: 1.0  
**Status**: Production Ready ✅  
