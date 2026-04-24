import os
import time
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

CLERK_API_KEY = os.getenv("CLERK_API_KEY")
CLERK_API_BASE = os.getenv("CLERK_API_BASE", "https://api.clerk.com/v1")
_cache = {"total_users": None, "timestamp": 0}
CACHE_TTL = int(os.getenv("CLERK_COUNT_CACHE_TTL", "30"))  # seconds


async def get_clerk_user_metadata(user_id: str) -> Optional[dict]:
    """Fetch Clerk user metadata for a given user id.

    Returns a dict containing public/private/unsafe metadata and basic identity
    fields when available,
    or None when Clerk API is unavailable.
    """
    if not CLERK_API_KEY or not user_id:
        return None

    headers = {"Authorization": f"Bearer {CLERK_API_KEY}"}

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{CLERK_API_BASE}/users/{user_id}", headers=headers, timeout=15)
            res.raise_for_status()
            payload = res.json()
            data = payload if isinstance(payload, dict) else {}

            public_metadata = data.get("public_metadata") or {}
            private_metadata = data.get("private_metadata") or {}
            unsafe_metadata = data.get("unsafe_metadata") or {}

            username = data.get("username")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            full_name = " ".join(part for part in [first_name, last_name] if part).strip()
            name = data.get("full_name") or full_name or data.get("name")

            primary_email = None
            email_addresses = data.get("email_addresses")
            primary_email_id = data.get("primary_email_address_id")
            if isinstance(email_addresses, list):
                if primary_email_id:
                    for email_obj in email_addresses:
                        if isinstance(email_obj, dict) and email_obj.get("id") == primary_email_id:
                            primary_email = email_obj.get("email_address")
                            break
                if not primary_email:
                    for email_obj in email_addresses:
                        if isinstance(email_obj, dict) and email_obj.get("email_address"):
                            primary_email = email_obj.get("email_address")
                            break

            return {
                "public_metadata": public_metadata if isinstance(public_metadata, dict) else {},
                "private_metadata": private_metadata if isinstance(private_metadata, dict) else {},
                "unsafe_metadata": unsafe_metadata if isinstance(unsafe_metadata, dict) else {},
                "username": username,
                "name": name,
                "email": primary_email,
            }
    except Exception as e:
        logger.debug(f"[CLERK] Failed to fetch metadata for user {user_id}: {e}")
        return None


async def get_clerk_user_count(force_refresh: bool = False) -> Optional[int]:
    """Return total number of users from Clerk Admin API.

    Returns None if Clerk API key is not configured or the call fails.
    Caches result for `CACHE_TTL` seconds.
    """
    if not CLERK_API_KEY:
        logger.debug("[CLERK] CLERK_API_KEY not set; skipping Clerk user count")
        return None

    now = time.time()
    if not force_refresh and _cache["total_users"] is not None and (now - _cache["timestamp"]) < CACHE_TTL:
        return _cache["total_users"]

    headers = {"Authorization": f"Bearer {CLERK_API_KEY}"}
    total = 0
    limit = 100
    cursor = None

    try:
        async with httpx.AsyncClient() as client:
            while True:
                params = {"limit": limit}
                if cursor:
                    params["starting_after"] = cursor
                res = await client.get(f"{CLERK_API_BASE}/users", headers=headers, params=params, timeout=15)
                res.raise_for_status()
                data = res.json()

                # Support multiple shapes: list, dict with 'data', dict with 'users'
                if isinstance(data, dict):
                    items = data.get("data") or data.get("users") or []
                    total += len(items)
                    # Clerk may expose has_more/next_cursor
                    has_more = data.get("has_more", False)
                    next_cursor = data.get("next_cursor") or data.get("cursor")
                    if next_cursor:
                        cursor = next_cursor
                    elif not has_more:
                        break
                    else:
                        # fallback: if no cursor but has_more true, try to stop to avoid infinite loop
                        break
                elif isinstance(data, list):
                    items = data
                    total += len(items)
                    if len(items) < limit:
                        break
                    cursor = items[-1].get("id") if items and isinstance(items[-1], dict) else None
                    if not cursor:
                        break
                else:
                    break

                if not cursor and not isinstance(data, dict):
                    break

        _cache["total_users"] = total
        _cache["timestamp"] = time.time()
        logger.info(f"[CLERK] Retrieved total users={total}")
        return total
    except Exception as e:
        logger.warning(f"[CLERK] Failed to retrieve user list: {e}")
        return None
