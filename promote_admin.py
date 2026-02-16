#!/usr/bin/env python3
"""Promote admin_test2 to admin and run remaining tests"""
import json
import subprocess
import sys

BASE = "http://localhost:8000/api/v1"

PASS = 0
FAIL = 0
TOTAL = 0
FAILURES = []
BUGS = []

def curl(method, path, data=None, token=None, expected=None, test_name=""):
    global PASS, FAIL, TOTAL
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method, f"{BASE}{path}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if data is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    output = result.stdout.strip()
    lines = output.rsplit("\n", 1)
    body_str, status = (lines[0], lines[1].strip()) if len(lines) == 2 else (output, "000")
    try:
        body = json.loads(body_str)
    except:
        body = {"raw": body_str[:300]}

    TOTAL += 1
    if expected:
        exp_list = expected if isinstance(expected, list) else [expected]
        if status in [str(e) for e in exp_list]:
            PASS += 1
            print(f"  PASS: {test_name} (HTTP {status})")
        else:
            FAIL += 1
            msg = f"FAIL: {test_name} - Expected HTTP {expected}, got HTTP {status}"
            FAILURES.append(msg)
            print(f"  {msg}")
            detail = body.get("detail", body.get("raw", ""))
            if detail:
                print(f"        Response: {str(detail)[:200]}")
    return status, body

# Step 1: Promote admin via docker (use correct user: cashflow)
print("=" * 60)
print("  ADMIN PROMOTION & REMAINING TESTS")
print("=" * 60)
print()
print("--- Promoting admin_test2 to admin ---")
result = subprocess.run(
    ["docker", "exec", "cashflow-db", "psql", "-U", "cashflow", "-d", "cashflow",
     "-c", "UPDATE users SET is_admin = true WHERE username = 'admin_test2';"],
    capture_output=True, text=True, timeout=10
)
print(f"  Result: {result.stdout.strip()} {result.stderr.strip()}")
print(f"  Return code: {result.returncode}")

# Verify
result2 = subprocess.run(
    ["docker", "exec", "cashflow-db", "psql", "-U", "cashflow", "-d", "cashflow",
     "-c", "SELECT username, is_admin, email FROM users;"],
    capture_output=True, text=True, timeout=10
)
print(f"\n  Users in DB:\n{result2.stdout}")

# Step 2: Login with fresh token
print("--- Login and verify admin ---")
status, body = curl("POST", "/auth/login",
    data={"username": "admin_test2", "password": "Admin1234"},
    expected=200, test_name="Login as admin_test2")
TOKEN = body.get("access_token", "")

status, body = curl("GET", "/auth/me", token=TOKEN,
    expected=200, test_name="Verify token via /auth/me")
IS_ADMIN = body.get("is_admin", False)
print(f"  is_admin: {IS_ADMIN}")

print()

# Step 3: Admin endpoints
if IS_ADMIN:
    print("--- User Management (Admin) ---")

    # GET /users
    status, body = curl("GET", "/users", token=TOKEN,
        expected=200, test_name="GET /users - List all users (admin)")
    if isinstance(body, list):
        print(f"    Found {len(body)} users")
        for u in body:
            print(f"    - {u.get('username')} (admin={u.get('is_admin')}, active={u.get('is_active')})")
    elif isinstance(body, dict):
        items = body.get("items", body.get("users", []))
        if isinstance(items, list):
            print(f"    Found {len(items)} users")

    # POST /users - Create a user
    status, body = curl("POST", "/users", token=TOKEN,
        data={"username": "admin_created_user", "email": "admcreated@test.com", "password": "Test1234", "is_admin": False},
        expected=[201, 409], test_name="POST /users - Create user via admin")
    new_id = body.get("id", "")

    if new_id and status == "201":
        # PUT /users/{id}
        status, body = curl("PUT", f"/users/{new_id}", token=TOKEN,
            data={"email": "updated_via_admin@test.com"},
            expected=200, test_name="PUT /users/{id} - Update user email")

        # GET updated user
        status, body = curl("GET", "/users", token=TOKEN,
            expected=200, test_name="GET /users - Verify user updated")

        # DELETE /users/{id}
        status, body = curl("DELETE", f"/users/{new_id}", token=TOKEN,
            expected=[200, 204], test_name="DELETE /users/{id} - Delete admin-created user")

        # Verify deletion
        status, body = curl("GET", "/users", token=TOKEN,
            expected=200, test_name="GET /users - Verify user deleted")
else:
    print("--- User Management (Admin) - SKIPPED (not admin) ---")
    BUGS.append("ISSUE: Could not promote user to admin via docker exec")

print()

# Step 4: Fix the SQL injection test
print("--- Additional Edge Cases ---")

# SQL injection - use URL-encoded special chars
status, body = curl("GET", "/transactions?search=%27%20OR%201%3D1%20--", token=TOKEN,
    expected=200, test_name="SQL injection in search (URL-encoded)")
if isinstance(body, dict):
    txn_count = body.get("total", len(body.get("items", [])))
    print(f"    SQL injection returned {txn_count} results (expected: 0)")

# Double login with admin_test2
status, body = curl("POST", "/auth/login",
    data={"username": "admin_test2", "password": "Admin1234"},
    expected=200, test_name="Double login (second session)")

# Test accessing deleted transaction
status, body = curl("GET", "/transactions/00000000-0000-0000-0000-000000000001", token=TOKEN,
    expected=404, test_name="Access non-existent transaction")

# Test very large offset pagination
status, body = curl("GET", "/transactions?limit=10&offset=99999", token=TOKEN,
    expected=200, test_name="Pagination with very large offset")
if isinstance(body, dict):
    items = body.get("items", [])
    print(f"    Large offset returned {len(items)} items (expected: 0)")

# Test combined filters
status, body = curl("GET", "/transactions?type=income&amount_min=5000&sort_by=amount&sort_order=desc", token=TOKEN,
    expected=200, test_name="Combined filters (type+amount+sort)")

# Test creating fixed with end_date
status, body = curl("POST", "/fixed", token=TOKEN,
    data={"name": "Temp Contract", "type": "income", "amount": 3000,
          "day_of_month": 1, "start_date": "2025-03-01", "end_date": "2025-06-01",
          "description": "3-month temp contract"},
    expected=201, test_name="POST /fixed - Create with end_date")

# Test creating installment with 1 payment
status, body = curl("POST", "/installments", token=TOKEN,
    data={"name": "One-time Split", "type": "expense", "total_amount": 500,
          "number_of_payments": 1, "start_date": "2025-03-01", "day_of_month": 15},
    expected=[201, 422], test_name="POST /installments - Single payment installment")

# Delete a fixed entry
status, body = curl("GET", "/fixed", token=TOKEN,
    expected=200, test_name="GET /fixed - Get list for delete test")
fixed_list = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
if fixed_list:
    last_fixed_id = fixed_list[-1].get("id", "")
    if last_fixed_id:
        status, body = curl("DELETE", f"/fixed/{last_fixed_id}", token=TOKEN,
            expected=[200, 204], test_name="DELETE /fixed/{id} - Delete fixed entry")

# Delete a loan
status, body = curl("GET", "/loans", token=TOKEN,
    expected=200, test_name="GET /loans - Get list for status test")
loan_list = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
if len(loan_list) >= 2:
    last_loan = loan_list[-1]
    lid = last_loan.get("id", "")
    if lid:
        # Update loan status
        status, body = curl("PUT", f"/loans/{lid}", token=TOKEN,
            data={"status": "paused"},
            expected=200, test_name="PUT /loans/{id} - Pause loan")

        status, body = curl("PUT", f"/loans/{lid}", token=TOKEN,
            data={"status": "active"},
            expected=200, test_name="PUT /loans/{id} - Resume loan")

# Delete an installment
status, body = curl("GET", "/installments", token=TOKEN,
    expected=200, test_name="GET /installments - Get list for delete test")
inst_list = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
if inst_list:
    last_inst = inst_list[-1]
    iid = last_inst.get("id", "")
    if iid:
        status, body = curl("DELETE", f"/installments/{iid}", token=TOKEN,
            expected=[200, 204], test_name="DELETE /installments/{id} - Delete installment")

# Test category reorder
status, body = curl("GET", "/categories", token=TOKEN, expected=200,
    test_name="GET /categories - Get for reorder test")
cat_list = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
if len(cat_list) >= 2:
    ordered_ids = [c["id"] for c in cat_list[:3] if "id" in c]
    ordered_ids.reverse()
    status, body = curl("POST", "/categories/reorder", token=TOKEN,
        data={"ordered_ids": ordered_ids},
        expected=[200, 204], test_name="POST /categories/reorder - Reorder categories")

print()

# Summary
print("=" * 60)
print("  ADDITIONAL TEST RESULTS")
print("=" * 60)
print()
print(f"  Total tests:  {TOTAL}")
print(f"  Passed:       {PASS}")
print(f"  Failed:       {FAIL}")
if TOTAL > 0:
    print(f"  Pass rate:    {PASS/TOTAL*100:.1f}%")
print()

if FAILURES:
    print("  FAILURES:")
    for f in FAILURES:
        print(f"    - {f}")
    print()

if BUGS:
    print("  BUGS/NOTES:")
    for b in BUGS:
        print(f"    - {b}")
    print()

print("=" * 60)
