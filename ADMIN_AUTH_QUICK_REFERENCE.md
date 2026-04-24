# Quick Testing Guide - Clerk Admin Auth Fix

## What Was Fixed
✅ Backend now prioritizes Clerk metadata.admin instead of env allowlist  
✅ Frontend blocks non-admin users at UI layer instead of showing broken pages  
✅ Clear logging shows which auth method was used  
✅ Hybrid fallback to ADMIN_USER_IDS still works for emergencies  

---

## Automated Tests (Run These First)

### Backend Tests
```bash
cd backend
python -m pytest tests/test_admin_authorization.py -v
# Expected: 15 passed ✅
```

### Frontend Tests (when test infrastructure is ready)
```bash
cd frontend
npm test -- AdminRoute.test.tsx
# Expected: All tests pass ✅
```

---

## Manual Testing Matrix

### Test 1: Admin User (metadata.admin=true)
**Setup:** Create/configure Clerk user with `publicMetadata.admin = true`

```
✓ Frontend: AdminRoute shows admin content (no modal)
✓ Frontend: Admin Dashboard page loads without errors
✓ Backend: GET /api/admin/metrics returns 200 OK
✓ Backend: GET /api/admin/audit/logs?limit=100 returns 200 OK
✓ Logs: "[AUTH] Admin detected for user_XXX via Clerk metadata (admin=true)"
```

### Test 2: Non-Admin User (metadata.admin=false or missing)
**Setup:** Create Clerk user without admin flag or metadata.admin=false

```
✓ Frontend: AdminRoute shows permission denied modal
✓ Frontend: Button to "Continue with General News"
✓ Backend: GET /api/admin/metrics returns 403 Forbidden
✓ Backend: GET /api/admin/audit/logs returns 403 Forbidden
✓ Logs: "[AUTH] Access denied: non-admin user_YYY attempted admin access"
```

### Test 3: Env Allowlist Fallback (metadata.admin missing but ADMIN_USER_IDS set)
**Setup:** 
- Clerk user WITHOUT metadata.admin
- User ID IS in ADMIN_USER_IDS env var

```
✓ Frontend: AdminRoute should show admin content
✓ Backend: GET /api/admin/metrics returns 200 OK
✓ Logs: "[AUTH] Admin detected for user_ZZZ via ADMIN_USER_IDS allowlist (env-fallback)"
```

### Test 4: Org Role Fallback (metadata.admin missing, org_role set)
**Setup:**
- Clerk user WITHOUT metadata.admin
- User has org_role="admin" or "owner" in JWT

```
✓ Frontend: AdminRoute shows admin content
✓ Backend: GET /api/admin/metrics returns 200 OK
✓ Logs: "[AUTH] Admin detected for user_WWW via Clerk org_role (admin)"
```

---

## Log Examples

### Success Logs (Debug Level)
```
[AUTH] Admin detected for user_3AU7QmEpFfqNSnRnfAODAA4NwGj via Clerk metadata (admin=true)
[AUTH] Admin detected for user_abc123 via Clerk org_role (admin)
[AUTH] Admin detected for user_xyz789 via ADMIN_USER_IDS allowlist (env-fallback)
```

### Denial Logs (Warning Level)
```
[AUTH] Access denied: non-admin user_regular123 attempted admin access
```

---

## Troubleshooting

### Issue: Signed-in admin user sees "Access Denied" modal

**Check:**
1. Is `user.publicMetadata.admin === true` in Clerk?
2. Run: `python -c "from app.core.config import settings; print(f'Metadata key: {settings.CLERK_ADMIN_METADATA_KEY}')"` — Verify it's "admin" (default)
3. Check backend logs for auth strategy used

**Fix:** 
- Update Clerk user metadata: `publicMetadata: { admin: true }`

---

### Issue: Non-admin user can still access /api/admin/metrics

**Check:**
1. Is user in ADMIN_USER_IDS env var? (fallback might be granting access)
2. Does user have org_role in JWT? (secondary check might be matching)
3. Check backend logs for which strategy granted access

**Fix:**
- Remove from ADMIN_USER_IDS if not supposed to be admin
- Check Clerk org_role settings

---

### Issue: Backend logs don't show admin detection method

**Check:**
1. Is logging level set to DEBUG or lower?
2. Check `.env`: Verify `LOG_LEVEL=debug` or similar

**Fix:**
- Temporarily set log level to DEBUG to see detection strategy
- `export LOG_LEVEL=debug` (on Unix) or set in .env

---

## Config Quick Reference

| Setting | Default | Purpose |
|---------|---------|---------|
| `CLERK_ADMIN_METADATA_KEY` | `admin` | Metadata key name for admin flag |
| `CLERK_ADMIN_ORG_ROLES` | `admin,owner` | Comma-separated org roles granting admin |
| `ADMIN_USER_IDS` | `` | Comma-separated user IDs (fallback) |

**To override in .env:**
```bash
CLERK_ADMIN_METADATA_KEY=is_admin
CLERK_ADMIN_ORG_ROLES=admin,superuser,operator
ADMIN_USER_IDS=user_abc123,user_def456
```

---

## Key Files Reference

| File | Purpose | Key Changes |
|------|---------|--------|
| `backend/app/core/auth.py` | Admin detection logic | Config import, _parse_admin_org_roles helper, priority order |
| `frontend/src/components/AdminRoute.tsx` | Frontend pre-gating | Metadata check, permission denied modal |
| `frontend/src/components/ui/LoginRequiredModal.tsx` | Modal updates | message and showFeatures props |
| `backend/tests/test_admin_authorization.py` | NEW: 15 tests | Complete test file |
| `frontend/src/components/AdminRoute.test.tsx` | NEW: Component tests | Complete test file |

---

## Success Criteria Checklist

```
Pre-Deployment:
[ ] Backend tests pass: 15/15 ✅
[ ] Frontend component imports without errors
[ ] No TypeScript compilation errors in frontend

Manual Testing:
[ ] Admin user can access admin pages and APIs
[ ] Non-admin user blocked at frontend + gets 403 at backend
[ ] Env allowlist still works (backward compatibility)
[ ] Logs show auth strategy for each access

Post-Deployment:
[ ] Monitor logs for "[AUTH]" messages
[ ] Check admin metric endpoints return data
[ ] Verify non-admin users see permission denied, not 403 errors
```
