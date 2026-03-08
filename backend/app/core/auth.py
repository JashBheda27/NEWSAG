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
import jwt
import os
import httpx
import json
import logging
from datetime import datetime

from app.core.database import get_db

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


async def get_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    async with httpx.AsyncClient() as client:
        res = await client.get(CLERK_JWKS_URL)
        res.raise_for_status()
        _jwks_cache = res.json()
        return _jwks_cache


async def _validate_token(token: str) -> dict:
    """
    Internal: Validate JWT token and return user payload.
    Hybrid admin detection:
    - Primary: check ADMIN_USER_IDS allowlist (env-based, fast)
    - Fallback: check Clerk metadata/custom claims for admin role
    Raises HTTPException on failure.
    """
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
            logger.warning("[AUTH] Token missing aud claim; decoding without audience check")
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=CLERK_ISSUER,
                options={"verify_aud": False},
            )

        user_id = payload["sub"]
        email = payload.get("email")
        
        # Hybrid admin detection
        is_admin = user_id in ADMIN_USER_IDS
        
        # Fallback to Clerk metadata if not in allowlist
        # Check for admin role in custom claims or org metadata
        if not is_admin:
            # Option 1: Check custom metadata (if using Clerk metadata API)
            custom_claims = payload.get("metadata", {})
            is_admin = custom_claims.get("admin", False)
            
            # Option 2: Check org roles (if using Clerk organizations)
            if not is_admin and "org_role" in payload:
                is_admin = payload.get("org_role") in ["admin", "owner"]
        
        return {
            "user_id": user_id,
            "email": email,
            "is_admin": is_admin,
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

    # Upsert minimal user record into db.users for admin dashboard counts
    try:
        doc = {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
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
    
    if not user.get("is_admin"):
        logger.warning(f"[AUTH] Non-admin user {user['user_id']} attempted admin access")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    # Upsert admin user into DB (ensure admin presence is tracked)
    try:
        doc = {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "last_seen": datetime.utcnow(),
        }
        await db.users.update_one({"user_id": doc["user_id"]}, {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}}, upsert=True)
    except Exception as e:
        logger.warning(f"[AUTH] Failed to upsert admin user to DB: {e}")

    logger.info(f"[AUTH] Admin access granted to {user['user_id']}")
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
