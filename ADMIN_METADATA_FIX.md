# Admin Metadata Fix - String Role Support ✅

## Problem Found
Your Clerk user has metadata with **string role** value:
```json
{
  "role": "admin"  // ← String value, not boolean
}
```

But the code was checking for:
```javascript
metadata.admin === true  // ← Boolean flag with specific key name
```

**Result:** Non-admin users were incorrectly denied access even when they should have admin permissions.

---

## Fix Applied ✅

### Backend ([backend/app/core/auth.py](backend/app/core/auth.py))
Updated admin detection to handle **BOTH** cases:
```python
metadata_value = metadata.get(admin_metadata_key)

# Check if metadata indicates admin (boolean true OR string "admin"/"owner")
if metadata_value is True or metadata_value in ["admin", "owner"]:
    is_admin = True
```

### Frontend ([frontend/src/components/AdminRoute.tsx](frontend/src/components/AdminRoute.tsx))
Updated frontend check to match:
```typescript
const adminValue = metadata?.[adminMetadataKey];

// Check if metadata indicates admin (boolean true OR string "admin"/"owner")
const isAdmin = adminValue === true || adminValue === 'admin' || adminValue === 'owner';
```

---

## Configuration Required

Choose **ONE** of these two options:

### Option A: Use "role" Metadata Key (Recommended if already using "role")
Keep your current Clerk metadata as-is (`"role": "admin"`), but configure backend to read the "role" key:

**In `.env` or environment:**
```bash
CLERK_ADMIN_METADATA_KEY=role
```

Then the code will check:
```
metadata.role === "admin" ✓ (matches your Clerk metadata)
metadata.role === "owner" ✓ (alternative role)
```

### Option B: Use "admin" Metadata Key (Recommended for new setups)
Change your Clerk user metadata to use the standard "admin" key:

**In Clerk Dashboard (for user om@gmail.com):**
- Click **Edit** under "Public" metadata
- Change from:
  ```json
  {
    "role": "admin"
  }
  ```
  To:
  ```json
  {
    "admin": true
  }
  ```
- Click **Save**

Then the default config will work:
```
CLERK_ADMIN_METADATA_KEY=admin  (default)
metadata.admin === true ✓
```

---

## Testing the Fix

### After applying Option A (CLERK_ADMIN_METADATA_KEY=role):

1. **Restart backend** to load new env var:
   ```bash
   # Kill current uvicorn process, then restart
   uvicorn app.main:app --reload
   ```

2. **Restart frontend** (if needed):
   ```bash
   npm run dev
   ```

3. **Test in browser:**
   - Go to `http://localhost:5173/admin`
   - You should see the admin dashboard (not "Access Denied" modal) ✅
   - Backend logs should show: `[AUTH] Admin detected for user_XXX via Clerk metadata (role=admin)`

### After applying Option B (update Clerk metadata):

1. **Wait ~10 seconds** for Clerk to propagate the metadata change
2. **Hard refresh browser** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Sign in again** (new JWT needed with updated metadata)
4. **Go to admin page** — should now show admin dashboard ✅

---

## Supported Admin Values

### String Values (works with any metadata key):
```
"admin"   ✓ Admin user
"owner"   ✓ Owner user
```

### Boolean Values (works with any metadata key):
```
true      ✓ Admin user
false/0   ✗ Not admin
```

---

## Troubleshooting

### Still seeing "Access Denied" modal after fix?

1. **Check environment variable is set:**
   ```bash
   echo $CLERK_ADMIN_METADATA_KEY  # Should output: role (or your key name)
   ```

2. **Verify backend restarted with new env:**
   - Restart uvicorn process
   - Check logs for: `[AUTH] Admin detected...` messages

3. **Verify Clerk metadata value:**
   - Go to Clerk Dashboard > Users > om@gmail.com
   - Check "Public" metadata section
   - Should see `"role": "admin"` (if using Option A)

4. **Clear Clerk cache:**
   - Sign out completely
   - Clear browser cookies/cache for localhost
   - Sign back in with fresh JWT

### Backend logs don't show auth decision?

Check that logging is enabled at DEBUG level:
```bash
# In .env
LOG_LEVEL=debug
```

Then restart backend and check logs again.

---

## Key Settings Reference

| Setting | Default | Your Setup | Purpose |
|---------|---------|-----------|---------|
| `CLERK_ADMIN_METADATA_KEY` | `admin` | Should be `role` (Option A) or `admin` (Option B) | Which metadata key to check |
| `CLERK_ADMIN_ORG_ROLES` | `admin,owner` | No change needed | Supported org role values |
| `ADMIN_USER_IDS` | `` | No change needed | Fallback: env allowlist |

---

## Summary

✅ **Code fixed** to handle string role values  
✅ **Frontend fixed** to match backend logic  
⏳ **Next: Configure** — Choose Option A or Option B above  
⏳ **Then: Test** — Verify admin access works

**Recommended:** Use **Option A** since you already have `"role": "admin"` set in Clerk.
