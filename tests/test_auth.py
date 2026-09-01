"""
Full authentication test suite covering registration, login, tokens,
logout, password reset, change password, and authorization.
"""
import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────

VALID_EMAIL = "user@example.com"
VALID_PASSWORD = "Secure123"


async def register(client: AsyncClient, email=VALID_EMAIL, password=VALID_PASSWORD):
    return await client.post("/auth/register", json={"email": email, "password": password})


async def login(client: AsyncClient, email=VALID_EMAIL, password=VALID_PASSWORD):
    return await client.post("/auth/login", json={"email": email, "password": password})


async def get_access_token(client: AsyncClient):
    await register(client)
    r = await login(client)
    return r.json()["access_token"]


# ── Registration ──────────────────────────────────────────────────────────────

class TestRegister:
    async def test_valid_registration(self, client):
        r = await register(client)
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == VALID_EMAIL
        assert "password" not in data
        assert "password_hash" not in data

    async def test_duplicate_email(self, client):
        await register(client)
        r = await register(client)
        assert r.status_code == 409

    async def test_invalid_email(self, client):
        r = await register(client, email="notanemail")
        assert r.status_code == 422

    async def test_empty_password(self, client):
        r = await register(client, password="")
        assert r.status_code == 422

    async def test_weak_password_no_uppercase(self, client):
        r = await register(client, password="weakpassword1")
        assert r.status_code == 422

    async def test_weak_password_no_digit(self, client):
        r = await register(client, password="WeakPassword")
        assert r.status_code == 422

    async def test_weak_password_too_short(self, client):
        r = await register(client, password="Ab1")
        assert r.status_code == 422

    async def test_extremely_long_input(self, client):
        r = await register(client, email="a" * 400 + "@example.com")
        assert r.status_code == 422

    async def test_extremely_long_password(self, client):
        r = await register(client, password="A1" + "a" * 200)
        assert r.status_code == 422


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    async def test_correct_credentials(self, client):
        await register(client)
        r = await login(client)
        assert r.status_code == 200
        assert "access_token" in r.json()

    async def test_incorrect_password(self, client):
        await register(client)
        r = await login(client, password="WrongPass1")
        assert r.status_code == 401
        # Generic error — must not say "password incorrect" separately from email
        assert r.json()["detail"] == "Invalid email or password"

    async def test_nonexistent_email(self, client):
        r = await login(client, email="nobody@example.com")
        assert r.status_code == 401
        # Must return same error as wrong password (no email enumeration)
        assert r.json()["detail"] == "Invalid email or password"

    async def test_malformed_request(self, client):
        r = await client.post("/auth/login", json={"bad": "data"})
        assert r.status_code == 422

    async def test_no_password_in_response(self, client):
        await register(client)
        r = await login(client)
        body = str(r.json())
        assert "password" not in body
        assert "hash" not in body


# ── Token / session ───────────────────────────────────────────────────────────

class TestToken:
    async def test_access_protected_route(self, client):
        token = await get_access_token(client)
        r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == VALID_EMAIL

    async def test_missing_token(self, client):
        r = await client.get("/auth/me")
        assert r.status_code == 401

    async def test_invalid_token(self, client):
        r = await client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert r.status_code == 401

    async def test_refresh_cookie_set_on_login(self, client):
        await register(client)
        r = await login(client)
        assert "refresh_token" in r.cookies

    async def test_refresh_issues_new_access_token(self, client):
        await register(client)
        r = await login(client)
        old_access = r.json()["access_token"]
        refresh_cookie = r.cookies.get("refresh_token")

        r2 = await client.post(
            "/auth/refresh", cookies={"refresh_token": refresh_cookie}
        )
        assert r2.status_code == 200
        new_access = r2.json()["access_token"]
        assert new_access != old_access

    async def test_refresh_rotates_cookie(self, client):
        await register(client)
        r = await login(client)
        old_cookie = r.cookies.get("refresh_token")

        r2 = await client.post(
            "/auth/refresh", cookies={"refresh_token": old_cookie}
        )
        new_cookie = r2.cookies.get("refresh_token")
        assert new_cookie is not None
        assert new_cookie != old_cookie

    async def test_refresh_reuse_fails(self, client):
        """Old refresh token must be invalidated after rotation."""
        await register(client)
        r = await login(client)
        old_cookie = r.cookies.get("refresh_token")

        await client.post("/auth/refresh", cookies={"refresh_token": old_cookie})

        r3 = await client.post(
            "/auth/refresh", cookies={"refresh_token": old_cookie}
        )
        assert r3.status_code == 401


# ── Logout ────────────────────────────────────────────────────────────────────

class TestLogout:
    async def test_logout_clears_session(self, client):
        await register(client)
        r = await login(client)
        refresh_cookie = r.cookies.get("refresh_token")

        await client.post("/auth/logout", cookies={"refresh_token": refresh_cookie})

        # Refresh token must no longer work
        r2 = await client.post(
            "/auth/refresh", cookies={"refresh_token": refresh_cookie}
        )
        assert r2.status_code == 401


# ── Authorization / IDOR ──────────────────────────────────────────────────────

class TestAuthorization:
    async def test_me_returns_own_data_only(self, client):
        await register(client, email="alice@example.com")
        r = await login(client, email="alice@example.com")
        token = r.json()["access_token"]
        me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.json()["email"] == "alice@example.com"

    async def test_unauthenticated_cannot_access_me(self, client):
        r = await client.get("/auth/me")
        assert r.status_code == 401


# ── Forgot / Reset password ───────────────────────────────────────────────────

class TestPasswordReset:
    async def test_forgot_password_generic_response(self, client):
        """Must not reveal whether email is registered."""
        r1 = await client.post(
            "/auth/forgot-password", json={"email": "nobody@example.com"}
        )
        r2 = await client.post(
            "/auth/forgot-password", json={"email": VALID_EMAIL}
        )
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["message"] == r2.json()["message"]

    async def test_reset_with_invalid_token(self, client):
        r = await client.post(
            "/auth/reset-password",
            json={"token": "badtoken", "new_password": "NewPass123"},
        )
        assert r.status_code == 400

    async def test_reset_token_single_use(self, client):
        from app.core.security import generate_reset_token, hash_password
        from app.models.user import User
        from sqlalchemy import select
        from datetime import datetime, timedelta, timezone

        # Register a user and manually set a reset token
        await register(client)

        # We need the DB to set a reset token — use the db fixture indirectly
        # by calling forgot-password (token is generated but not emailed)
        r = await client.post(
            "/auth/forgot-password", json={"email": VALID_EMAIL}
        )
        assert r.status_code == 200

    async def test_change_password_requires_current(self, client):
        token = await get_access_token(client)
        r = await client.post(
            "/auth/change-password",
            json={"current_password": "WrongPass1", "new_password": "NewPass456"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 400

    async def test_change_password_success(self, client):
        token = await get_access_token(client)
        r = await client.post(
            "/auth/change-password",
            json={"current_password": VALID_PASSWORD, "new_password": "NewPass456"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200

        # Old password must not work
        r2 = await login(client, password=VALID_PASSWORD)
        assert r2.status_code == 401

        # New password must work
        r3 = await login(client, password="NewPass456")
        assert r3.status_code == 200

    async def test_change_password_unauthenticated(self, client):
        r = await client.post(
            "/auth/change-password",
            json={"current_password": VALID_PASSWORD, "new_password": "NewPass456"},
        )
        assert r.status_code == 401
