"""
Authentication Module
---------------------
Provides JWT validation using Clerk and role-based access control.

Dependencies:
- get_current_user: Validates token, raises 401 if invalid
- require_auth: Alias for get_current_user (semantic clarity)
- require_admin: Requires valid token + admin role
- get_current_user_optional: Returns demo user if no token (for public features)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncio
import jwt
import os
import httpx
import json
import logging
from datetime import datetime
import time

from app.core.database import get_db
from app.core.config import settings
from app.services.clerk_service import get_clerk_user_metadata

logger = logging.getLogger(__name__)

security = HTTPBearer()

CLERK_ISSUER = os.getenv("CLERK_ISSUER")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE")

_jwks_suffix = "/.well-known/jwks.json"
if CLERK_ISSUER:
    issuer = CLERK_ISSUER.rstrip("/")
    if issuer.endswith(_jwks_suffix):
        CLERK_JWKS_URL = issuer
    else:
        CLERK_JWKS_URL = f"{issuer}{_jwks_suffix}"
else:
    CLERK_JWKS_URL = None

# Admin user IDs (comma-separated in env)
ADMIN_USER_IDS = [
    uid.strip() 
    for uid in os.getenv("ADMIN_USER_IDS", "").split(",") 
    if uid.strip()
]

_jwks_cache = None
_jwks_lock = asyncio.Lock()
_jwks_retry_after_ts = 0.0
_jwks_last_error = ""
_jwks_failure_cooldown_seconds = int(os.getenv("JWKS_FAILURE_COOLDOWN_SECONDS", "30"))
_missing_aud_warning_logged = False


async def get_jwks():
    global _jwks_cache, _jwks_retry_after_ts, _jwks_last_error
    if _jwks_cache:
        return _jwks_cache

    now = time.time()
    if _jwks_retry_after_ts > now:
        wait_seconds = int(_jwks_retry_after_ts - now)
        logger.debug(f"[AUTH] Skipping JWKS fetch during cooldown ({wait_seconds}s remaining)")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider temporarily unavailable",
        )

    # Defensive checks and logging for JWKS fetch
    if not CLERK_JWKS_URL:
        logger.error("[AUTH] CLERK_JWKS_URL is not configured (CLERK_ISSUER missing)")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Clerk issuer not configured")

    async with _jwks_lock:
        if _jwks_cache:
            return _jwks_cache

        now = time.time()
        if _jwks_retry_after_ts > now:
            wait_seconds = int(_jwks_retry_after_ts - now)
            logger.debug(f"[AUTH] Skipping JWKS fetch during cooldown ({wait_seconds}s remaining)")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication provider temporarily unavailable",
            )

        logger.debug(f"[AUTH] Fetching JWKS from {CLERK_JWKS_URL}")
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(CLERK_JWKS_URL, timeout=10)
                res.raise_for_status()
                _jwks_cache = res.json()
                _jwks_last_error = ""
                _jwks_retry_after_ts = 0.0
                return _jwks_cache
        except Exception as e:
            _jwks_last_error = str(e) or e.__class__.__name__
            _jwks_retry_after_ts = time.time() + max(_jwks_failure_cooldown_seconds, 1)
            logger.warning(f"[AUTH] Failed to fetch JWKS from {CLERK_JWKS_URL}: {_jwks_last_error}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication provider temporarily unavailable",
            )


def _parse_admin_org_roles() -> list:
    """
    Parse configured admin org roles from settings.
    Expects comma-separated string (e.g., 'admin,owner').
    Returns list of role strings.
    """
    roles_str = settings.CLERK_ADMIN_ORG_ROLES or "admin,owner"
    return [role.strip() for role in roles_str.split(",") if role.strip()]


async def _validate_token(token: str) -> dict:
    """
    Internal: Validate JWT token and return user payload.
    Hybrid admin detection (in priority order):
    1. Check Clerk metadata for admin key (primary: metadata.admin=true)
    2. Check Clerk org_role against configured roles (settings.CLERK_ADMIN_ORG_ROLES)
    3. Fallback: check ADMIN_USER_IDS allowlist (env-based)
    Logs which method granted admin access for transparency.
    Raises HTTPException on failure.
    """
    global _missing_aud_warning_logged
    try:
        jwks = await get_jwks()
        header = jwt.get_unverified_header(token)

        jwk = next(
            k for k in jwks["keys"] if k["kid"] == header["kid"]
        )
        rs256_alg = jwt.algorithms.get_default_algorithms().get("RS256")
        if not rs256_alg:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="RS256 algorithm support is not available",
            )
        key = rs256_alg.from_jwk(json.dumps(jwk))

        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=CLERK_AUDIENCE,
                issuer=CLERK_ISSUER,
            )
        except jwt.MissingRequiredClaimError as exc:
            if getattr(exc, "claim", None) != "aud":
                raise
            if not _missing_aud_warning_logged:
                logger.warning("[AUTH] Token missing aud claim; decoding without audience check")
                _missing_aud_warning_logged = True
            else:
                logger.debug("[AUTH] Token missing aud claim; decoding without audience check")
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=CLERK_ISSUER,
                options={"verify_aud": False},
            )

        user_id = payload["sub"]
        email = payload.get("email")

        username = (
            payload.get("username")
            or payload.get("preferred_username")
            or payload.get("user_name")
        )
        display_name = payload.get("name")
        if not display_name:
            first_name = payload.get("first_name") or payload.get("given_name")
            last_name = payload.get("last_name") or payload.get("family_name")
            full_name = " ".join(part for part in [first_name, last_name] if part)
            display_name = full_name or username
        
        # Hybrid admin detection (priority order with diagnostic logging)
        is_admin = False
        admin_detection_method = None
        
        # Strategy 1: Check Clerk metadata (PRIMARY)
        # JWT often does not include user metadata by default, so try both:
        # 1) token claims (metadata/public_metadata/unsafe_metadata)
        # 2) Clerk Admin API by user_id
        admin_metadata_key = settings.CLERK_ADMIN_METADATA_KEY or "admin"
        metadata_candidates = []

        for claim_key in ("metadata", "public_metadata", "unsafe_metadata"):
            claim_value = payload.get(claim_key)
            if isinstance(claim_value, dict):
                metadata_candidates.append((f"jwt.{claim_key}", claim_value))

        clerk_user_metadata = await get_clerk_user_metadata(user_id)
        if isinstance(clerk_user_metadata, dict):
            public_md = clerk_user_metadata.get("public_metadata")
            private_md = clerk_user_metadata.get("private_metadata")
            unsafe_md = clerk_user_metadata.get("unsafe_metadata")

            # Fill identity fields from Clerk Admin API when token lacks them.
            if not email:
                email = clerk_user_metadata.get("email") or email
            if not username:
                username = clerk_user_metadata.get("username") or username
            if not display_name:
                display_name = clerk_user_metadata.get("name") or username

            if isinstance(public_md, dict):
                metadata_candidates.append(("clerk.public_metadata", public_md))
            if isinstance(private_md, dict):
                metadata_candidates.append(("clerk.private_metadata", private_md))
            if isinstance(unsafe_md, dict):
                metadata_candidates.append(("clerk.unsafe_metadata", unsafe_md))

        for source, metadata in metadata_candidates:
            metadata_value = metadata.get(admin_metadata_key)
            if metadata_value is True or metadata_value in ["admin", "owner"]:
                is_admin = True
                admin_detection_method = (
                    f"Clerk metadata ({source}.{admin_metadata_key}={repr(metadata_value)})"
                )
                break
        
        # Strategy 2: Check org_role against configured roles
        if not is_admin and "org_role" in payload:
            admin_org_roles = _parse_admin_org_roles()
            user_org_role = payload.get("org_role")
            if user_org_role in admin_org_roles:
                is_admin = True
                admin_detection_method = f"Clerk org_role ({user_org_role})"
        
        # Strategy 3: Fallback to ADMIN_USER_IDS allowlist (ENV-BASED)
        if not is_admin and user_id in ADMIN_USER_IDS:
            is_admin = True
            admin_detection_method = "ADMIN_USER_IDS allowlist (env-fallback)"

        actor_label = username or display_name or email or user_id
        
        # Log only non-admin decision here.
        # Admin grant logging is centralized in require_admin() to avoid duplicates.
        if not is_admin:
            logger.info(f"[AUTH] Non-admin user {actor_label} (no metadata/org_role/allowlist match)")
        
        return {
            "user_id": user_id,
            "email": email,
            "username": username,
            "name": display_name,
            "is_admin": is_admin,
            "admin_detection_method": admin_detection_method,
        }

    except StopIteration:
        logger.warning("[AUTH] Token key ID not found in JWKS")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: key not found",
        )
    except jwt.ExpiredSignatureError:
        logger.warning("[AUTH] Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidAudienceError:
        logger.warning("[AUTH] Token audience mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )
    except jwt.InvalidIssuerError:
        logger.warning("[AUTH] Token issuer mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[AUTH] Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
) -> dict:
    """
    REQUIRED authentication - raises 401 if not authenticated.
    Use this for endpoints that require a real user.
    
    Returns:
        dict: {"user_id": str, "email": str, "is_admin": bool}
    """
    user = await _validate_token(credentials.credentials)

    # Upsert user record into db.users for dashboard counts + profile display.
    try:
        doc = {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "name": user.get("name"),
            "last_seen": datetime.utcnow(),
        }
        # Set created_at only on insert
        await db.users.update_one({"user_id": doc["user_id"]}, {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)
    except Exception as e:
        logger.warning(f"[AUTH] Failed to upsert user to DB: {e}")

    return user


# Semantic alias for clarity
require_auth = get_current_user


async def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
) -> dict:
    """
    REQUIRED authentication + ADMIN role.
    Raises 401 if not authenticated, 403 if not admin.
    
    Returns:
        dict: {"user_id": str, "email": str, "is_admin": True}
    """
    user = await _validate_token(credentials.credentials)
    actor_label = user.get("username") or user.get("name") or user.get("email") or user.get("user_id")
    
    if not user.get("is_admin"):
        logger.warning(f"[AUTH] Access denied: non-admin user {actor_label} attempted admin access")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    # Log successful admin access once, with explicit strategy for traceability
    admin_detection_method = user.get("admin_detection_method") or "unknown"
    logger.info(f"[AUTH] Admin access granted to {actor_label} via {admin_detection_method}")
    
    # Upsert admin user into DB (ensure admin presence is tracked)
    try:
        doc = {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "name": user.get("name"),
            "last_seen": datetime.utcnow(),
        }
        await db.users.update_one({"user_id": doc["user_id"]}, {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)
    except Exception as e:
        logger.warning(f"[AUTH] Failed to upsert admin user to DB: {e}")

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
) -> dict:
    """
    OPTIONAL authentication - returns demo user if not authenticated.
    Use this ONLY for features that should work without login (e.g., public chatbot demo).
    
    WARNING: Do NOT use for write operations or user-specific data.
    
    Returns:
        dict: {"user_id": str, "email": str, "is_admin": bool, "is_demo": bool}
    """
    if not credentials:
        return {
            "user_id": "demo_user",
            "email": "demo@example.com",
            "is_admin": False,
            "is_demo": True,
        }
    
    try:
        user = await _validate_token(credentials.credentials)
        user["is_demo"] = False

        # Upsert user on optional auth as well
        try:
            db = await get_db()
            doc = {
                "user_id": user.get("user_id"),
                "email": user.get("email"),
                "username": user.get("username"),
                "name": user.get("name"),
                "last_seen": datetime.utcnow(),
            }
            await db.users.update_one({"user_id": doc["user_id"]}, {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)
        except Exception:
            # best-effort only
            pass

        return user
    except HTTPException:
        # Token invalid - fall back to demo user
        return {
            "user_id": "demo_user",
            "email": "demo@example.com",
            "is_admin": False,
            "is_demo": True,
        }


def get_user_id(user: dict) -> str:
    """Extract user_id from auth context, raising 401 if missing."""
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user context")
    return user_id
