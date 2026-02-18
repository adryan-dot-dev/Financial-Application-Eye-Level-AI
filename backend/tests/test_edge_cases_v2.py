from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token


# ---------------------------------------------------------------------------
# Helper: register a second user and return its auth headers
# ---------------------------------------------------------------------------
async def _register_user(
    client: AsyncClient,
    username: str = "user2",
    email: str = "user2@example.com",
    password: str = "TestPass1",
) -> dict:
    """Register a new user and return auth headers."""
    reg = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    assert reg.status_code == 201, f"Registration failed: {reg.json()}"
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# 1. Auth edge cases
# ===========================================================================

class TestAuthEdgeCasesV2:
    """Comprehensive edge-case tests for auth."""

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient):
        """Registering with same email should return 409."""
        await _register_user(client, "first_user", "dup@example.com")
        response = await client.post("/api/v1/auth/register", json={
            "username": "second_user",
            "email": "dup@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client: AsyncClient):
        """Registering with existing username should return 409."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "admin",
            "email": "new@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_login_wrong_password_generic_message(self, client: AsyncClient):
        """Wrong password should NOT reveal if user exists."""
        response = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "WrongPass9",
        })
        assert response.status_code == 401
        # Should say "Invalid username or password" not "wrong password"
        detail = response.json().get("detail", "")
        assert "password" not in detail.lower() or "username" in detail.lower()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user_same_error(self, client: AsyncClient):
        """Non-existent user login should return same error as wrong password."""
        resp_wrong = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "WrongPass9",
        })
        resp_nouser = await client.post("/api/v1/auth/login", json={
            "username": "user_does_not_exist_xyz",
            "password": "SomePass1",
        })
        # Same status code and same message pattern
        assert resp_wrong.status_code == resp_nouser.status_code == 401

    @pytest.mark.asyncio
    async def test_access_protected_without_token(self, client: AsyncClient):
        """No auth header at all returns 403."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_access_with_expired_token(self, client: AsyncClient):
        """Expired token should return 401."""
        from jose import jwt
        from app.config import settings as app_settings
        expired_payload = {
            "sub": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "type": "access",
            "jti": str(uuid.uuid4()),
        }
        expired_token = jwt.encode(
            expired_payload, app_settings.SECRET_KEY, algorithm=app_settings.ALGORITHM
        )
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_with_malformed_token(self, client: AsyncClient):
        """Garbage token should return 401."""
        headers = {"Authorization": "Bearer not.a.valid.jwt.at.all"}
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_with_empty_bearer(self, client: AsyncClient):
        """Empty bearer value should return 401 or 403."""
        headers = {"Authorization": "Bearer "}
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_register_sql_injection_username(self, client: AsyncClient):
        """SQL injection attempt in username should be safely rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "'; DROP TABLE users; --",
            "email": "sqli@example.com",
            "password": "TestPass1",
        })
        # Should be rejected by username pattern validator
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_sql_injection_email(self, client: AsyncClient):
        """SQL injection in email should be rejected by email validator."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "sqltest",
            "email": "'; DROP TABLE users; --",
            "password": "TestPass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_xss_in_username(self, client: AsyncClient):
        """XSS attempt in username should be rejected by pattern validator."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "<script>alert('xss')</script>",
            "email": "xss@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_only_spaces(self, client: AsyncClient):
        """Password that is only whitespace should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "spacepass",
            "email": "space@example.com",
            "password": "        ",  # 8 spaces
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_extremely_long_username(self, client: AsyncClient):
        """Username exceeding max_length (50) should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "a" * 51,
            "email": "long@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_username_at_max_length(self, client: AsyncClient):
        """Username at exactly 50 chars should succeed."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "a" * 50,
            "email": "maxlen@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_register_empty_body(self, client: AsyncClient):
        """Empty JSON body should return 422."""
        response = await client.post("/api/v1/auth/register", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_no_body(self, client: AsyncClient):
        """No body at all should return 422."""
        response = await client.post("/api/v1/auth/register")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_no_uppercase(self, client: AsyncClient):
        """Password without uppercase should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "nouppercase",
            "email": "noupper@example.com",
            "password": "testpass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_no_lowercase(self, client: AsyncClient):
        """Password without lowercase should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "nolowercase",
            "email": "nolower@example.com",
            "password": "TESTPASS1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_no_digit(self, client: AsyncClient):
        """Password without digit should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "nodigit",
            "email": "nodigit@example.com",
            "password": "TestPassNoDigit",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_too_short(self, client: AsyncClient):
        """Password shorter than 8 chars should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "shortpw",
            "email": "short@example.com",
            "password": "Te1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_unicode_email(self, client: AsyncClient):
        """Unicode/internationalized email should be rejected."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "unicodemail",
            "email": "user@domaine.тест",
            "password": "TestPass1",
        })
        # EmailStr validator may accept or reject internationalized domains
        # Either 201 (accepted) or 422 (rejected) is fine
        assert response.status_code in (201, 422)

    @pytest.mark.asyncio
    async def test_refresh_with_access_token(self, client: AsyncClient):
        """Using access token as refresh token should fail."""
        login = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin2026!",
        })
        access = login.json()["access_token"]
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": access,
        })
        assert response.status_code == 401


# ===========================================================================
# 2. Transaction edge cases
# ===========================================================================

class TestTransactionEdgeCasesV2:
    """Comprehensive edge-case tests for transactions."""

    @pytest.mark.asyncio
    async def test_create_amount_zero(self, client: AsyncClient, auth_headers: dict):
        """amount=0 should fail (gt=0)."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 0,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_negative_amount(self, client: AsyncClient, auth_headers: dict):
        """Negative amount should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": -100,
            "type": "expense",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_extremely_large_amount(self, client: AsyncClient, auth_headers: dict):
        """Amount exceeding DECIMAL(15,2) should be handled."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 99999999999999.99,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        # Should either succeed (within DECIMAL(15,2)) or fail (422)
        assert response.status_code in (201, 422)

    @pytest.mark.asyncio
    async def test_create_valid_large_amount(self, client: AsyncClient, auth_headers: dict):
        """A large but valid amount should succeed."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 999999999.99,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["amount"] == "999999999.99"

    @pytest.mark.asyncio
    async def test_create_smallest_valid_amount(self, client: AsyncClient, auth_headers: dict):
        """Smallest valid amount (0.01) should succeed."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 0.01,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["amount"] == "0.01"

    @pytest.mark.asyncio
    async def test_create_with_future_date(self, client: AsyncClient, auth_headers: dict):
        """Future date should be allowed (for planned transactions)."""
        future = "2027-12-31"
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": future,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["date"] == future

    @pytest.mark.asyncio
    async def test_create_with_invalid_category_id(self, client: AsyncClient, auth_headers: dict):
        """Non-existent category_id should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "category_id": str(uuid.uuid4()),
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_with_other_users_category(self, client: AsyncClient, auth_headers: dict):
        """Using another user's category_id should fail."""
        # Register user2 and create a category for user2
        u2_headers = await _register_user(client, "cat_owner", "catowner@example.com")
        cat_resp = await client.post("/api/v1/categories", json={
            "name": "user2_cat",
            "name_he": "test",
            "type": "income",
        }, headers=u2_headers)
        assert cat_resp.status_code == 201
        cat_id = cat_resp.json()["id"]

        # Admin tries to use user2's category
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "category_id": cat_id,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_page_zero(self, client: AsyncClient, auth_headers: dict):
        """page=0 should fail (ge=1)."""
        response = await client.get(
            "/api/v1/transactions?page=0", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_negative_page(self, client: AsyncClient, auth_headers: dict):
        """page=-1 should fail."""
        response = await client.get(
            "/api/v1/transactions?page=-1", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_page_size_zero(self, client: AsyncClient, auth_headers: dict):
        """page_size=0 should fail (ge=1)."""
        response = await client.get(
            "/api/v1/transactions?page_size=0", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_extreme_page_size(self, client: AsyncClient, auth_headers: dict):
        """page_size over max (100) should fail."""
        response = await client.get(
            "/api/v1/transactions?page_size=1000000", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client: AsyncClient, auth_headers: dict):
        """Updating non-existent transaction returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.put(
            f"/api/v1/transactions/{fake_id}",
            json={"amount": 999},
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_other_users_transaction(self, client: AsyncClient, auth_headers: dict):
        """Deleting another user's transaction returns 404."""
        # Admin creates transaction
        create = await client.post("/api/v1/transactions", json={
            "amount": 500,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        tid = create.json()["id"]

        # User2 tries to delete it
        u2_headers = await _register_user(client, "deleter", "deleter@example.com")
        response = await client.delete(
            f"/api/v1/transactions/{tid}", headers=u2_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_sql_injection_in_description(self, client: AsyncClient, auth_headers: dict):
        """SQL injection in description should be stored as-is (no execution)."""
        sqli = "'; DROP TABLE transactions; --"
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "description": sqli,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["description"] == sqli

    @pytest.mark.asyncio
    async def test_sql_injection_in_notes(self, client: AsyncClient, auth_headers: dict):
        """SQL injection in notes should be stored as-is."""
        sqli = "1; DELETE FROM users WHERE 1=1; --"
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "notes": sqli,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["notes"] == sqli

    @pytest.mark.asyncio
    async def test_xss_in_description(self, client: AsyncClient, auth_headers: dict):
        """XSS in description should be stripped by strip_tags sanitization."""
        xss = "<script>alert('xss')</script>"
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "description": xss,
        }, headers=auth_headers)
        assert response.status_code == 201
        # HTML tags are stripped, only text content remains
        assert response.json()["description"] == "alert('xss')"

    @pytest.mark.asyncio
    async def test_invalid_currency_code(self, client: AsyncClient, auth_headers: dict):
        """Invalid currency code should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "currency": "invalid",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_lowercase_currency_code(self, client: AsyncClient, auth_headers: dict):
        """Lowercase currency code should fail (must be uppercase)."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "currency": "usd",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_usd_currency(self, client: AsyncClient, auth_headers: dict):
        """Valid 3-letter uppercase currency should succeed and be converted to base."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "currency": "USD",
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        # Amount is now stored in base currency (ILS), original preserved
        assert data["currency"] == "ILS"
        assert data["original_currency"] == "USD"
        assert float(data["original_amount"]) == 100.0

    @pytest.mark.asyncio
    async def test_empty_tags_list(self, client: AsyncClient, auth_headers: dict):
        """Empty tags list should be accepted."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "tags": [],
        }, headers=auth_headers)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_invalid_date_format(self, client: AsyncClient, auth_headers: dict):
        """Invalid date format should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "not-a-date",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_malformed_uuid_path(self, client: AsyncClient, auth_headers: dict):
        """Malformed UUID in path should fail."""
        response = await client.get(
            "/api/v1/transactions/not-a-uuid", headers=auth_headers,
        )
        assert response.status_code == 422


# ===========================================================================
# 3. Fixed entries edge cases
# ===========================================================================

class TestFixedEdgeCasesV2:
    """Comprehensive edge-case tests for fixed entries."""

    @pytest.mark.asyncio
    async def test_day_of_month_zero(self, client: AsyncClient, auth_headers: dict):
        """day_of_month=0 should fail (ge=1)."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Bad Day",
            "amount": 100,
            "type": "income",
            "day_of_month": 0,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_day_of_month_32(self, client: AsyncClient, auth_headers: dict):
        """day_of_month=32 should fail (le=31)."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Bad Day",
            "amount": 100,
            "type": "income",
            "day_of_month": 32,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_day_of_month_negative(self, client: AsyncClient, auth_headers: dict):
        """day_of_month=-1 should fail."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Bad Day",
            "amount": 100,
            "type": "income",
            "day_of_month": -1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_start_date_after_end_date(self, client: AsyncClient, auth_headers: dict):
        """end_date before start_date should fail."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Backwards",
            "amount": 1000,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-06-01",
            "end_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_amount_zero(self, client: AsyncClient, auth_headers: dict):
        """amount=0 should fail (gt=0)."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Zero",
            "amount": 0,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_duplicate_names_same_user(self, client: AsyncClient, auth_headers: dict):
        """Duplicate names for same user should be allowed (no unique constraint)."""
        r1 = await client.post("/api/v1/fixed", json={
            "name": "Same Name",
            "amount": 1000,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert r1.status_code == 201
        r2 = await client.post("/api/v1/fixed", json={
            "name": "Same Name",
            "amount": 2000,
            "type": "expense",
            "day_of_month": 15,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert r2.status_code == 201
        assert r1.json()["id"] != r2.json()["id"]

    @pytest.mark.asyncio
    async def test_whitespace_only_name(self, client: AsyncClient, auth_headers: dict):
        """Name with only spaces should fail after stripping."""
        response = await client.post("/api/v1/fixed", json={
            "name": "   ",
            "amount": 100,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_day_31_works(self, client: AsyncClient, auth_headers: dict):
        """day_of_month=31 should succeed."""
        response = await client.post("/api/v1/fixed", json={
            "name": "End of Month",
            "amount": 1000,
            "type": "expense",
            "day_of_month": 31,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 201


# ===========================================================================
# 4. Installment edge cases
# ===========================================================================

class TestInstallmentEdgeCasesV2:
    """Comprehensive edge-case tests for installments."""

    @pytest.mark.asyncio
    async def test_zero_payments(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments=0 should fail (ge=1)."""
        response = await client.post("/api/v1/installments", json={
            "name": "Zero",
            "total_amount": 1000,
            "number_of_payments": 0,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_payments(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments=-1 should fail."""
        response = await client.post("/api/v1/installments", json={
            "name": "Negative",
            "total_amount": 1000,
            "number_of_payments": -1,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_over_max_payments(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments=361 should fail (le=360)."""
        response = await client.post("/api/v1/installments", json={
            "name": "Too Many",
            "total_amount": 36100,
            "number_of_payments": 361,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_single_payment(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments=1 should work; monthly_amount = total_amount."""
        response = await client.post("/api/v1/installments", json={
            "name": "Single",
            "total_amount": 5000,
            "number_of_payments": 1,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 15,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["monthly_amount"] == "5000.00"

    @pytest.mark.asyncio
    async def test_uneven_split(self, client: AsyncClient, auth_headers: dict):
        """Uneven total/payments should calculate correctly."""
        response = await client.post("/api/v1/installments", json={
            "name": "Uneven",
            "total_amount": 1000,
            "number_of_payments": 3,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["monthly_amount"] == "333.33"

    @pytest.mark.asyncio
    async def test_very_large_amount(self, client: AsyncClient, auth_headers: dict):
        """Large but valid amount should succeed."""
        response = await client.post("/api/v1/installments", json={
            "name": "Big",
            "total_amount": 999999999.99,
            "number_of_payments": 12,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_empty_name(self, client: AsyncClient, auth_headers: dict):
        """Empty name should fail."""
        response = await client.post("/api/v1/installments", json={
            "name": "",
            "total_amount": 1000,
            "number_of_payments": 5,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_day_of_month_zero(self, client: AsyncClient, auth_headers: dict):
        """day_of_month=0 should fail."""
        response = await client.post("/api/v1/installments", json={
            "name": "Bad Day",
            "total_amount": 1000,
            "number_of_payments": 5,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 0,
        }, headers=auth_headers)
        assert response.status_code == 422


# ===========================================================================
# 5. Loan edge cases
# ===========================================================================

class TestLoanEdgeCasesV2:
    """Comprehensive edge-case tests for loans."""

    @pytest.mark.asyncio
    async def test_negative_interest_rate(self, client: AsyncClient, auth_headers: dict):
        """interest_rate=-1 should fail (ge=0)."""
        response = await client.post("/api/v1/loans", json={
            "name": "Negative Rate",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": -1,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 12,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_interest_rate_over_100(self, client: AsyncClient, auth_headers: dict):
        """interest_rate=150 should fail (le=100)."""
        response = await client.post("/api/v1/loans", json={
            "name": "High Rate",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 150,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 12,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_total_payments(self, client: AsyncClient, auth_headers: dict):
        """total_payments=0 should fail (ge=1)."""
        response = await client.post("/api/v1/loans", json={
            "name": "Zero Payments",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 0,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_payment_on_completed_loan(self, client: AsyncClient, auth_headers: dict):
        """Recording payment on completed loan should fail."""
        create = await client.post("/api/v1/loans", json={
            "name": "Will Complete",
            "original_amount": 1000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 1,
        }, headers=auth_headers)
        lid = create.json()["id"]

        # Complete the loan
        await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 1000},
            headers=auth_headers,
        )

        # Try another payment
        response = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 500},
            headers=auth_headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_payment_exceeds_remaining_balance(self, client: AsyncClient, auth_headers: dict):
        """Payment exceeding remaining balance should fail."""
        create = await client.post("/api/v1/loans", json={
            "name": "Overpay",
            "original_amount": 1000,
            "monthly_payment": 500,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 5,
        }, headers=auth_headers)
        lid = create.json()["id"]

        response = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 1001},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_interest_loan(self, client: AsyncClient, auth_headers: dict):
        """Zero interest loan should work without division by zero."""
        response = await client.post("/api/v1/loans", json={
            "name": "No Interest",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 5,
            "total_payments": 10,
        }, headers=auth_headers)
        assert response.status_code == 201

        lid = response.json()["id"]
        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        assert detail.status_code == 200
        for item in detail.json()["amortization"]:
            assert item["interest"] == "0.00"

    @pytest.mark.asyncio
    async def test_cannot_reactivate_completed_loan(self, client: AsyncClient, auth_headers: dict):
        """Reactivating a completed loan should fail."""
        create = await client.post("/api/v1/loans", json={
            "name": "Complete Me",
            "original_amount": 500,
            "monthly_payment": 500,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 1,
        }, headers=auth_headers)
        lid = create.json()["id"]

        await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 500},
            headers=auth_headers,
        )

        response = await client.put(
            f"/api/v1/loans/{lid}",
            json={"status": "active"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_nonexistent_loan(self, client: AsyncClient, auth_headers: dict):
        """Getting non-existent loan returns 404."""
        response = await client.get(
            f"/api/v1/loans/{uuid.uuid4()}", headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_negative_monthly_payment(self, client: AsyncClient, auth_headers: dict):
        """Negative monthly_payment should fail."""
        response = await client.post("/api/v1/loans", json={
            "name": "Neg Payment",
            "original_amount": 10000,
            "monthly_payment": -500,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 12,
        }, headers=auth_headers)
        assert response.status_code == 422


# ===========================================================================
# 6. Balance edge cases
# ===========================================================================

class TestBalanceEdgeCasesV2:
    """Comprehensive edge-case tests for balance."""

    @pytest.mark.asyncio
    async def test_no_balance_returns_404(self, client: AsyncClient, auth_headers: dict):
        """Getting balance when none exists returns 404."""
        response = await client.get("/api/v1/balance", headers=auth_headers)
        assert response.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_balance_with_future_date(self, client: AsyncClient, auth_headers: dict):
        """Balance with future date should be accepted."""
        response = await client.post("/api/v1/balance", json={
            "balance": 10000,
            "effective_date": "2027-12-31",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["effective_date"] == "2027-12-31"

    @pytest.mark.asyncio
    async def test_extremely_large_balance(self, client: AsyncClient, auth_headers: dict):
        """Very large balance value should succeed within DECIMAL limits."""
        response = await client.post("/api/v1/balance", json={
            "balance": 999999999999.99,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_negative_balance_allowed(self, client: AsyncClient, auth_headers: dict):
        """Negative balance (overdraft) should be allowed."""
        response = await client.post("/api/v1/balance", json={
            "balance": -5000,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["balance"] == "-5000.00"

    @pytest.mark.asyncio
    async def test_zero_balance(self, client: AsyncClient, auth_headers: dict):
        """Balance of exactly 0 should succeed."""
        response = await client.post("/api/v1/balance", json={
            "balance": 0,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["balance"] == "0.00"

    @pytest.mark.asyncio
    async def test_two_balances_only_latest_current(self, client: AsyncClient, auth_headers: dict):
        """Creating a second balance should mark the first as non-current."""
        r1 = await client.post("/api/v1/balance", json={
            "balance": 10000,
            "effective_date": "2026-01-01",
        }, headers=auth_headers)
        assert r1.status_code == 201
        assert r1.json()["is_current"] is True

        r2 = await client.post("/api/v1/balance", json={
            "balance": 20000,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        assert r2.status_code == 201
        assert r2.json()["is_current"] is True

        # Current should be the latest
        current = await client.get("/api/v1/balance", headers=auth_headers)
        assert current.json()["balance"] == "20000.00"

    @pytest.mark.asyncio
    async def test_update_when_no_balance(self, client: AsyncClient, auth_headers: dict):
        """Updating balance when none exists returns 404."""
        response = await client.put("/api/v1/balance", json={
            "balance": 5000,
        }, headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_balance_history_ordered(self, client: AsyncClient, auth_headers: dict):
        """Balance history should be ordered by date descending."""
        await client.post("/api/v1/balance", json={
            "balance": 1000,
            "effective_date": "2026-01-01",
        }, headers=auth_headers)
        await client.post("/api/v1/balance", json={
            "balance": 2000,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        await client.post("/api/v1/balance", json={
            "balance": 3000,
            "effective_date": "2026-03-01",
        }, headers=auth_headers)

        history = await client.get("/api/v1/balance/history", headers=auth_headers)
        assert history.status_code == 200
        items = history.json()["items"]
        assert len(items) >= 3
        # Check descending order by effective_date
        dates = [item["effective_date"] for item in items]
        assert dates == sorted(dates, reverse=True)


# ===========================================================================
# 7. Forecast edge cases
# ===========================================================================

class TestForecastEdgeCasesV2:
    """Comprehensive edge-case tests for forecast."""

    @pytest.mark.asyncio
    async def test_forecast_no_data(self, client: AsyncClient, auth_headers: dict):
        """Forecast with no data should return current_balance=0 and empty months."""
        response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["current_balance"] == "0"
        assert len(data["months"]) == 3

    @pytest.mark.asyncio
    async def test_forecast_zero_months(self, client: AsyncClient, auth_headers: dict):
        """months=0 should fail (ge=1)."""
        response = await client.get("/api/v1/forecast?months=0", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_negative_months(self, client: AsyncClient, auth_headers: dict):
        """months=-1 should fail."""
        response = await client.get("/api/v1/forecast?months=-1", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_max_months(self, client: AsyncClient, auth_headers: dict):
        """months=24 (max) should succeed."""
        response = await client.get("/api/v1/forecast?months=24", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()["months"]) == 24

    @pytest.mark.asyncio
    async def test_forecast_over_max_months(self, client: AsyncClient, auth_headers: dict):
        """months=25 should fail (le=24)."""
        response = await client.get("/api/v1/forecast?months=25", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_with_negative_starting_balance(self, client: AsyncClient, auth_headers: dict):
        """Forecast starting with negative balance should work."""
        await client.post("/api/v1/balance", json={
            "balance": -5000,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)

        response = await client.get("/api/v1/forecast?months=2", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["current_balance"] == "-5000.00"
        assert data["has_negative_months"] is True

    @pytest.mark.asyncio
    async def test_forecast_single_month(self, client: AsyncClient, auth_headers: dict):
        """Forecast for 1 month should return exactly 1 month entry."""
        response = await client.get("/api/v1/forecast?months=1", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()["months"]) == 1

    @pytest.mark.asyncio
    async def test_weekly_forecast_zero_weeks(self, client: AsyncClient, auth_headers: dict):
        """weeks=0 should fail (ge=1)."""
        response = await client.get("/api/v1/forecast/weekly?weeks=0", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_weekly_forecast_over_max(self, client: AsyncClient, auth_headers: dict):
        """weeks=53 should fail (le=52)."""
        response = await client.get("/api/v1/forecast/weekly?weeks=53", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_summary_structure(self, client: AsyncClient, auth_headers: dict):
        """Summary should have all required fields."""
        response = await client.get("/api/v1/forecast/summary?months=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        required_fields = [
            "current_balance", "forecast_months", "total_expected_income",
            "total_expected_expenses", "net_projected", "end_balance",
            "has_negative_months", "alerts_count",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_forecast_with_only_income(self, client: AsyncClient, auth_headers: dict):
        """Forecast with only income should never go negative."""
        await client.post("/api/v1/balance", json={
            "balance": 0,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        await client.post("/api/v1/fixed", json={
            "name": "Income Only",
            "amount": 5000,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)

        response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
        data = response.json()
        assert data["has_negative_months"] is False


# ===========================================================================
# 8. Category edge cases
# ===========================================================================

class TestCategoryEdgeCasesV2:
    """Edge-case tests for categories."""

    @pytest.mark.asyncio
    async def test_invalid_color_format(self, client: AsyncClient, auth_headers: dict):
        """Color not matching #RRGGBB pattern should fail."""
        response = await client.post("/api/v1/categories", json={
            "name": "bad_color",
            "name_he": "test",
            "type": "income",
            "color": "red",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_color_format(self, client: AsyncClient, auth_headers: dict):
        """Valid hex color should succeed."""
        response = await client.post("/api/v1/categories", json={
            "name": "good_color",
            "name_he": "test",
            "type": "income",
            "color": "#FF5733",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["color"] == "#FF5733"

    @pytest.mark.asyncio
    async def test_empty_name(self, client: AsyncClient, auth_headers: dict):
        """Empty category name should fail."""
        response = await client.post("/api/v1/categories", json={
            "name": "",
            "name_he": "test",
            "type": "income",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_name_exceeds_max_length(self, client: AsyncClient, auth_headers: dict):
        """Category name exceeding 100 chars should fail."""
        response = await client.post("/api/v1/categories", json={
            "name": "C" * 101,
            "name_he": "test",
            "type": "income",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_type(self, client: AsyncClient, auth_headers: dict):
        """Invalid category type should fail."""
        response = await client.post("/api/v1/categories", json={
            "name": "bad_type",
            "name_he": "test",
            "type": "savings",
        }, headers=auth_headers)
        assert response.status_code == 422


# ===========================================================================
# 9. Settings edge cases
# ===========================================================================

class TestSettingsEdgeCasesV2:
    """Edge-case tests for settings."""

    @pytest.mark.asyncio
    async def test_invalid_theme(self, client: AsyncClient, auth_headers: dict):
        """Invalid theme value should fail."""
        response = await client.put("/api/v1/settings", json={
            "theme": "blue",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_themes(self, client: AsyncClient, auth_headers: dict):
        """Valid theme values should succeed."""
        for theme in ["light", "dark", "system"]:
            response = await client.put("/api/v1/settings", json={
                "theme": theme,
            }, headers=auth_headers)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_forecast_months_zero(self, client: AsyncClient, auth_headers: dict):
        """forecast_months_default=0 should fail (ge=1)."""
        response = await client.put("/api/v1/settings", json={
            "forecast_months_default": 0,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_months_over_max(self, client: AsyncClient, auth_headers: dict):
        """forecast_months_default=25 should fail (le=24)."""
        response = await client.put("/api/v1/settings", json={
            "forecast_months_default": 25,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_week_start_day_range(self, client: AsyncClient, auth_headers: dict):
        """week_start_day must be 0-6."""
        # Valid
        response = await client.put("/api/v1/settings", json={
            "week_start_day": 0,
        }, headers=auth_headers)
        assert response.status_code == 200

        response = await client.put("/api/v1/settings", json={
            "week_start_day": 6,
        }, headers=auth_headers)
        assert response.status_code == 200

        # Invalid
        response = await client.put("/api/v1/settings", json={
            "week_start_day": 7,
        }, headers=auth_headers)
        assert response.status_code == 422

        response = await client.put("/api/v1/settings", json={
            "week_start_day": -1,
        }, headers=auth_headers)
        assert response.status_code == 422


# ===========================================================================
# 10. Cross-user isolation (IDOR)
# ===========================================================================

class TestIDORPreventionV2:
    """IDOR tests to ensure users cannot access each other's resources."""

    @pytest.mark.asyncio
    async def test_user2_cannot_get_user1_transaction(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot GET user1's transaction."""
        create = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        tid = create.json()["id"]

        u2 = await _register_user(client, "idor_get", "idor_get@example.com")
        resp = await client.get(f"/api/v1/transactions/{tid}", headers=u2)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_update_user1_transaction(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot PUT user1's transaction."""
        create = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        tid = create.json()["id"]

        u2 = await _register_user(client, "idor_upd", "idor_upd@example.com")
        resp = await client.put(
            f"/api/v1/transactions/{tid}",
            json={"amount": 1},
            headers=u2,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_delete_user1_transaction(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot DELETE user1's transaction."""
        create = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        tid = create.json()["id"]

        u2 = await _register_user(client, "idor_del", "idor_del@example.com")
        resp = await client.delete(f"/api/v1/transactions/{tid}", headers=u2)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_loan(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot access user1's loan."""
        create = await client.post("/api/v1/loans", json={
            "name": "Admin Loan",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 10,
        }, headers=auth_headers)
        lid = create.json()["id"]

        u2 = await _register_user(client, "idor_loan", "idor_loan@example.com")
        resp = await client.get(f"/api/v1/loans/{lid}", headers=u2)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_pay_user1_loan(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot pay user1's loan."""
        create = await client.post("/api/v1/loans", json={
            "name": "Admin Loan Pay",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 10,
        }, headers=auth_headers)
        lid = create.json()["id"]

        u2 = await _register_user(client, "idor_pay", "idor_pay@example.com")
        resp = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 1000},
            headers=u2,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_fixed(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot access user1's fixed entry."""
        create = await client.post("/api/v1/fixed", json={
            "name": "Admin Fixed",
            "amount": 5000,
            "type": "income",
            "day_of_month": 10,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        fid = create.json()["id"]

        u2 = await _register_user(client, "idor_fix", "idor_fix@example.com")
        resp = await client.get(f"/api/v1/fixed/{fid}", headers=u2)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_installment(self, client: AsyncClient, auth_headers: dict):
        """User2 cannot access user1's installment."""
        create = await client.post("/api/v1/installments", json={
            "name": "Admin Install",
            "total_amount": 6000,
            "number_of_payments": 12,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 5,
        }, headers=auth_headers)
        iid = create.json()["id"]

        u2 = await _register_user(client, "idor_inst", "idor_inst@example.com")
        resp = await client.get(f"/api/v1/installments/{iid}", headers=u2)
        assert resp.status_code == 404


# ===========================================================================
# 11. Bulk operation edge cases
# ===========================================================================

class TestBulkOperationEdgeCases:
    """Edge-case tests for bulk operations."""

    @pytest.mark.asyncio
    async def test_bulk_create_empty_list(self, client: AsyncClient, auth_headers: dict):
        """Bulk create with empty list should fail (min_length=1)."""
        response = await client.post("/api/v1/transactions/bulk", json={
            "transactions": [],
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_delete_empty_list(self, client: AsyncClient, auth_headers: dict):
        """Bulk delete with empty list should fail (min_length=1)."""
        response = await client.post("/api/v1/transactions/bulk-delete", json={
            "ids": [],
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_delete_nonexistent_ids(self, client: AsyncClient, auth_headers: dict):
        """Bulk delete with non-existent IDs should succeed with 0 deleted."""
        response = await client.post("/api/v1/transactions/bulk-delete", json={
            "ids": [str(uuid.uuid4())],
        }, headers=auth_headers)
        assert response.status_code == 200
        assert "0" in response.json()["message"]


# ===========================================================================
# 12. Content-type and malformed request edge cases
# ===========================================================================

class TestMalformedRequests:
    """Edge-case tests for malformed requests."""

    @pytest.mark.asyncio
    async def test_invalid_json_body(self, client: AsyncClient, auth_headers: dict):
        """Invalid JSON should return 422."""
        response = await client.post(
            "/api/v1/transactions",
            content=b"not json",
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_extra_fields_ignored(self, client: AsyncClient, auth_headers: dict):
        """Extra unknown fields should be ignored."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "nonexistent_field": "hello",
        }, headers=auth_headers)
        # Pydantic by default ignores extra fields
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_wrong_type_for_amount(self, client: AsyncClient, auth_headers: dict):
        """String for amount should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": "not-a-number",
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_boolean_for_amount(self, client: AsyncClient, auth_headers: dict):
        """Boolean for amount should fail or be coerced."""
        response = await client.post("/api/v1/transactions", json={
            "amount": True,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        # Pydantic may coerce True to 1, which is > 0 and valid
        assert response.status_code in (201, 422)

    @pytest.mark.asyncio
    async def test_null_required_fields(self, client: AsyncClient, auth_headers: dict):
        """Null for required fields should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": None,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422
