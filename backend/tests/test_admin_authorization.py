"""
Tests for Admin Authorization and Authentication

Tests cover:
- Clerk metadata.admin claim detection
- Clerk org_role detection against configured roles
- ADMIN_USER_IDS fallback (env allowlist)
- Admin access grant/deny on require_admin() dependency
- Diagnostic logging of admin detection strategy
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, status

from app.core.auth import _validate_token, _parse_admin_org_roles, require_admin
from app.core.config import settings


class TestAdminOrgRolesParsing:
    """Test _parse_admin_org_roles config parsing."""

    def test_parse_default_admin_org_roles(self):
        """Default org roles should be 'admin,owner'."""
        roles = _parse_admin_org_roles()
        assert set(roles) == {"admin", "owner"}

    def test_parse_custom_admin_org_roles(self, monkeypatch):
        """Should parse custom comma-separated org roles."""
        monkeypatch.setattr("app.core.auth.settings.CLERK_ADMIN_ORG_ROLES", "admin,operator,superuser")
        roles = _parse_admin_org_roles()
        assert set(roles) == {"admin", "operator", "superuser"}

    def test_parse_strips_whitespace(self, monkeypatch):
        """Should strip whitespace from role names."""
        monkeypatch.setattr("app.core.auth.settings.CLERK_ADMIN_ORG_ROLES", " admin , owner , viewer ")
        roles = _parse_admin_org_roles()
        assert set(roles) == {"admin", "owner", "viewer"}

    def test_parse_empty_string_falls_back_to_default(self, monkeypatch):
        """Empty CLERK_ADMIN_ORG_ROLES should use default."""
        monkeypatch.setattr("app.core.auth.settings.CLERK_ADMIN_ORG_ROLES", "")
        roles = _parse_admin_org_roles()
        assert set(roles) == {"admin", "owner"}


class TestAdminDetectionStrategy:
    """Test hybrid admin detection with priority ordering."""

    @pytest.mark.asyncio
    async def test_admin_via_metadata_admin_primary(self, monkeypatch):
        """Metadata.admin=true should mark user as admin (PRIMARY strategy)."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_123",
            "email": "admin@example.com",
            "metadata": {"admin": True},  # Primary admin flag
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)

        user = await _validate_token(mock_token)

        assert user["is_admin"] is True
        assert user["user_id"] == "user_123"

    @pytest.mark.asyncio
    async def test_admin_via_org_role_secondary(self, monkeypatch):
        """org_role='admin' should mark as admin (SECONDARY strategy)."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_456",
            "email": "operator@example.com",
            "metadata": {"admin": False},  # Not in metadata
            "org_role": "admin",  # But has admin org role
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)

        user = await _validate_token(mock_token)

        assert user["is_admin"] is True
        assert user["user_id"] == "user_456"

    @pytest.mark.asyncio
    async def test_admin_via_allowlist_tertiary(self, monkeypatch):
        """User in ADMIN_USER_IDS should be admin (TERTIARY fallback)."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_789_allowlisted",
            "email": "allowlist@example.com",
            "metadata": {"admin": False},  # Not in metadata
            # No org_role
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)
        monkeypatch.setattr("app.core.auth.ADMIN_USER_IDS", ["user_789_allowlisted"])

        user = await _validate_token(mock_token)

        assert user["is_admin"] is True

    @pytest.mark.asyncio
    async def test_metadata_admin_takes_precedence_over_allowlist(self, monkeypatch):
        """metadata.admin=True should be checked before allowlist."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_priority_test",
            "email": "priority@example.com",
            "metadata": {"admin": True},  # Metadata has admin
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)
        # Notably NOT in allowlist
        monkeypatch.setattr("app.core.auth.ADMIN_USER_IDS", [])

        user = await _validate_token(mock_token)

        assert user["is_admin"] is True

    @pytest.mark.asyncio
    async def test_non_admin_when_no_claims_present(self, monkeypatch):
        """User without metadata.admin, org_role, or allowlist should not be admin."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_regular",
            "email": "regular@example.com",
            # No metadata.admin
            # No org_role
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)
        monkeypatch.setattr("app.core.auth.ADMIN_USER_IDS", [])

        user = await _validate_token(mock_token)

        assert user["is_admin"] is False

    @pytest.mark.asyncio
    async def test_custom_metadata_key_from_config(self, monkeypatch):
        """Should use configured CLERK_ADMIN_METADATA_KEY instead of hardcoded 'admin'."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_custom_key",
            "email": "custom@example.com",
            "metadata": {"is_admin": True},  # Custom key, not 'admin'
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)
        monkeypatch.setattr("app.core.auth.settings.CLERK_ADMIN_METADATA_KEY", "is_admin")
        monkeypatch.setattr("app.core.auth.ADMIN_USER_IDS", [])

        user = await _validate_token(mock_token)

        assert user["is_admin"] is True

    @pytest.mark.asyncio
    async def test_org_role_owner_is_admin(self, monkeypatch):
        """org_role='owner' should also grant admin access."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_owner",
            "email": "owner@example.com",
            "org_role": "owner",
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)

        user = await _validate_token(mock_token)

        assert user["is_admin"] is True

    @pytest.mark.asyncio
    async def test_org_role_viewer_is_not_admin(self, monkeypatch):
        """org_role='viewer' should NOT grant admin access."""
        mock_jwks = {"keys": [{"kid": "test_kid", "kty": "RSA", "use": "sig", "n": "test", "e": "AQAB"}]}
        
        async def mock_get_jwks():
            return mock_jwks

        mock_token = "test.token.here"
        payload = {
            "sub": "user_viewer",
            "email": "viewer@example.com",
            "org_role": "viewer",
        }

        monkeypatch.setattr("app.core.auth.get_jwks", mock_get_jwks)
        monkeypatch.setattr("app.core.auth.jwt.get_unverified_header", lambda t: {"kid": "test_kid"})
        monkeypatch.setattr("app.core.auth.jwt.decode", lambda t, k, **kw: payload)

        user = await _validate_token(mock_token)

        assert user["is_admin"] is False


class TestRequireAdminDependency:
    """Test require_admin() FastAPI dependency behavior."""

    @pytest.mark.asyncio
    async def test_require_admin_allows_admin_user(self, monkeypatch):
        """require_admin() should allow admin users."""
        mock_db = AsyncMock()
        mock_db.users.update_one = AsyncMock()
        
        async def mock_get_db():
            return mock_db

        mock_credentials = MagicMock()
        mock_credentials.credentials = "admin.token.here"

        async def mock_validate_token(token):
            return {
                "user_id": "admin_user_123",
                "email": "admin@test.com",
                "username": "adminuser",
                "name": "Admin User",
                "is_admin": True,
            }

        monkeypatch.setattr("app.core.auth.get_db", mock_get_db)
        monkeypatch.setattr("app.core.auth._validate_token", mock_validate_token)

        user = await require_admin(credentials=mock_credentials, db=mock_db)

        assert user["is_admin"] is True
        assert user["user_id"] == "admin_user_123"

    @pytest.mark.asyncio
    async def test_require_admin_denies_non_admin_user(self, monkeypatch):
        """require_admin() should raise 403 for non-admin users."""
        mock_db = AsyncMock()
        
        mock_credentials = MagicMock()
        mock_credentials.credentials = "user.token.here"

        async def mock_validate_token(token):
            return {
                "user_id": "regular_user_456",
                "email": "user@test.com",
                "username": "regularuser",
                "name": "Regular User",
                "is_admin": False,
            }

        monkeypatch.setattr("app.core.auth._validate_token", mock_validate_token)

        with pytest.raises(HTTPException) as exc_info:
            await require_admin(credentials=mock_credentials, db=mock_db)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_admin_logs_denial(self, monkeypatch, caplog):
        """require_admin() should log when denying non-admin access."""
        import logging
        caplog.set_level(logging.WARNING)

        mock_db = AsyncMock()
        
        mock_credentials = MagicMock()
        mock_credentials.credentials = "user.token.here"

        async def mock_validate_token(token):
            return {
                "user_id": "denied_user_789",
                "email": "denied@test.com",
                "username": "denieduser",
                "name": "Denied User",
                "is_admin": False,
            }

        monkeypatch.setattr("app.core.auth._validate_token", mock_validate_token)

        with pytest.raises(HTTPException):
            await require_admin(credentials=mock_credentials, db=mock_db)

        assert "Access denied" in caplog.text
        assert "denied_user_789" in caplog.text
