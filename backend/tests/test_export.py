from __future__ import annotations

import csv
import io
import json

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_csv(content: str) -> list[list[str]]:
    """Parse CSV content, skipping BOM."""
    if content.startswith("\ufeff"):
        content = content[1:]
    reader = csv.reader(io.StringIO(content))
    return list(reader)


async def _create_transaction(
    client: AsyncClient,
    headers: dict,
    **overrides: object,
) -> object:
    data = {
        "amount": 1000,
        "type": "income",
        "date": "2026-02-01",
        **overrides,
    }
    return await client.post("/api/v1/transactions", json=data, headers=headers)


async def _get_regular_user_headers(client: AsyncClient) -> dict:
    """Register a non-admin user and return its auth headers."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "username": "exportuser",
            "email": "export@test.com",
            "password": "TestPass1",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "exportuser", "password": "TestPass1"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Export transactions CSV — empty (headers + BOM only)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_transactions_csv_empty(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.get(
        "/api/v1/export/transactions?format=csv", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.text

    # Must start with BOM
    assert body.startswith("\ufeff"), "CSV should begin with a UTF-8 BOM"

    rows = _parse_csv(body)
    # Header row exists
    assert len(rows) == 1, "Empty export should contain only the header row"
    assert "date" in rows[0]
    assert "amount" in rows[0]
    assert "type" in rows[0]


# ---------------------------------------------------------------------------
# 2. Export transactions CSV — with data
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_transactions_csv_with_data(
    client: AsyncClient, auth_headers: dict
):
    create_resp = await _create_transaction(
        client,
        auth_headers,
        amount=2500.75,
        type="expense",
        description="Office supplies",
        date="2026-03-15",
    )
    assert create_resp.status_code == 201

    resp = await client.get(
        "/api/v1/export/transactions?format=csv", headers=auth_headers
    )
    assert resp.status_code == 200

    rows = _parse_csv(resp.text)
    assert len(rows) >= 2, "CSV should have header + at least 1 data row"

    header = rows[0]
    data_row = rows[1]

    # Verify header column names
    assert "date" in header
    assert "amount" in header

    # Verify data values appear in the correct columns
    amount_idx = header.index("amount")
    desc_idx = header.index("description")
    assert data_row[amount_idx] == "2500.75"
    assert data_row[desc_idx] == "Office supplies"


# ---------------------------------------------------------------------------
# 3. Export transactions JSON
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_transactions_json(
    client: AsyncClient, auth_headers: dict
):
    await _create_transaction(
        client,
        auth_headers,
        amount=800,
        type="income",
        description="Consulting fee",
        date="2026-04-01",
    )

    resp = await client.get(
        "/api/v1/export/transactions?format=json", headers=auth_headers
    )
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    entry = data[0]
    # Check expected fields are present
    for field in ("date", "amount", "type", "description", "currency"):
        assert field in entry, f"Missing field '{field}' in JSON export"

    assert entry["amount"] == "800.00"
    assert entry["type"] == "income"
    assert entry["description"] == "Consulting fee"


# ---------------------------------------------------------------------------
# 4. Export transactions — date filter
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_transactions_date_filter(
    client: AsyncClient, auth_headers: dict
):
    # Create two transactions on different dates
    await _create_transaction(
        client,
        auth_headers,
        amount=100,
        type="income",
        description="January sale",
        date="2026-01-10",
    )
    await _create_transaction(
        client,
        auth_headers,
        amount=200,
        type="expense",
        description="March purchase",
        date="2026-03-20",
    )

    # Filter to January only
    resp = await client.get(
        "/api/v1/export/transactions?format=json&start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert len(data) == 1, "Date filter should return only the January transaction"
    assert data[0]["description"] == "January sale"
    assert data[0]["amount"] == "100.00"


# ---------------------------------------------------------------------------
# 5. Full JSON backup — /export/all
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_all_json_backup(
    client: AsyncClient, auth_headers: dict
):
    # Create a transaction
    tx_resp = await _create_transaction(
        client,
        auth_headers,
        amount=5000,
        type="income",
        description="Backup test tx",
    )
    assert tx_resp.status_code == 201

    # Create a balance entry
    bal_resp = await client.post(
        "/api/v1/balance",
        json={"balance": 12345.67, "effective_date": "2026-02-01"},
        headers=auth_headers,
    )
    assert bal_resp.status_code == 201

    # Export all
    resp = await client.get("/api/v1/export/all", headers=auth_headers)
    assert resp.status_code == 200

    backup = resp.json()

    # Top-level sections exist
    for section in (
        "exported_at",
        "user",
        "settings",
        "categories",
        "transactions",
        "balance_history",
    ):
        assert section in backup, f"Backup missing '{section}' section"

    # Transaction is in the backup
    assert len(backup["transactions"]) >= 1
    tx_descs = [t["description"] for t in backup["transactions"]]
    assert "Backup test tx" in tx_descs

    # Balance is in the backup
    assert len(backup["balance_history"]) >= 1
    bal_values = [b["balance"] for b in backup["balance_history"]]
    assert "12345.67" in bal_values


# ---------------------------------------------------------------------------
# 6. Decimal precision in export
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_all_decimal_precision(
    client: AsyncClient, auth_headers: dict
):
    await _create_transaction(
        client,
        auth_headers,
        amount=1234.56,
        type="expense",
        description="Precision test",
    )

    resp = await client.get("/api/v1/export/all", headers=auth_headers)
    assert resp.status_code == 200

    backup = resp.json()
    amounts = [t["amount"] for t in backup["transactions"]]
    assert "1234.56" in amounts, (
        "Decimal amount should appear as '1234.56', not a float representation"
    )

    # Verify it is a string, not a float
    for t in backup["transactions"]:
        assert isinstance(t["amount"], str), (
            "Transaction amount must be serialized as a string to preserve precision"
        )


# ---------------------------------------------------------------------------
# 7. /export/users — admin-only access
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_users_admin_only(
    client: AsyncClient, auth_headers: dict
):
    # Regular (non-admin) user should get 403
    regular_headers = await _get_regular_user_headers(client)
    resp_forbidden = await client.get(
        "/api/v1/export/users", headers=regular_headers
    )
    assert resp_forbidden.status_code == 403

    # Admin should get 200 with CSV content
    resp_admin = await client.get(
        "/api/v1/export/users", headers=auth_headers
    )
    assert resp_admin.status_code == 200

    rows = _parse_csv(resp_admin.text)
    assert len(rows) >= 2, "Admin CSV should have header + at least 1 user row"

    header = rows[0]
    assert "username" in header
    assert "email" in header
    assert "is_admin" in header

    # Admin user should appear in the exported data
    username_idx = header.index("username")
    usernames = [r[username_idx] for r in rows[1:]]
    assert "admin" in usernames


# ---------------------------------------------------------------------------
# 8. CSV formula injection protection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_csv_formula_injection(
    client: AsyncClient, auth_headers: dict
):
    # Create a transaction whose description starts with '=' (Excel formula)
    await _create_transaction(
        client,
        auth_headers,
        amount=100,
        type="expense",
        description="=CMD('calc')",
        date="2026-02-10",
    )

    resp = await client.get(
        "/api/v1/export/transactions?format=csv", headers=auth_headers
    )
    assert resp.status_code == 200

    rows = _parse_csv(resp.text)
    header = rows[0]
    desc_idx = header.index("description")

    # Find the row with our injected description
    data_rows = rows[1:]
    assert len(data_rows) >= 1

    injected_desc = data_rows[0][desc_idx]
    # The description must be sanitized with a leading single quote
    assert injected_desc.startswith("'"), (
        f"Dangerous CSV value should be prefixed with single quote, got: {injected_desc!r}"
    )
    assert "=CMD" in injected_desc, (
        "Original content should be preserved after the single-quote prefix"
    )
