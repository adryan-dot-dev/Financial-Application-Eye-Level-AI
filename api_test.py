#!/usr/bin/env python3
"""Comprehensive API Test Script for Cash Flow Management App
Uses correct field names from OpenAPI spec."""
import json
import subprocess
import sys

BASE = "http://localhost:8000/api/v1"
PASS_COUNT = 0
FAIL_COUNT = 0
TOTAL = 0
FAILURES = []
BUGS = []

def curl(method, path, data=None, token=None, expected=None, test_name=""):
    """Execute curl and return (status_code, body_dict)"""
    global PASS_COUNT, FAIL_COUNT, TOTAL

    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method, f"{BASE}{path}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if data is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        output = result.stdout.strip()
        lines = output.rsplit("\n", 1)
        if len(lines) == 2:
            body_str, status = lines
        else:
            body_str, status = output, "000"

        status = status.strip()
        try:
            body = json.loads(body_str)
        except:
            body = {"raw": body_str[:300]}
    except Exception as e:
        status = "ERR"
        body = {"error": str(e)}

    TOTAL += 1
    if expected:
        if isinstance(expected, list):
            passed = status in [str(e) for e in expected]
        else:
            passed = status == str(expected)

        if passed:
            PASS_COUNT += 1
            print(f"  PASS: {test_name} (HTTP {status})")
        else:
            FAIL_COUNT += 1
            exp_str = str(expected)
            msg = f"FAIL: {test_name} - Expected HTTP {exp_str}, got HTTP {status}"
            FAILURES.append(msg)
            print(f"  {msg}")
            detail = body.get("detail", body.get("raw", ""))
            if detail:
                print(f"        Response: {str(detail)[:200]}")

    return status, body


def main():
    global PASS_COUNT, FAIL_COUNT, TOTAL

    print("=" * 60)
    print("  CASH FLOW MANAGEMENT - COMPREHENSIVE API TEST SUITE")
    print("=" * 60)
    print()

    # ============================================
    # STEP 1: Authentication
    # ============================================
    print("--- STEP 1: Authentication ---")

    # Register user (in case it doesn't exist yet)
    status, body = curl("POST", "/auth/register",
        data={"username": "admin_test2", "email": "admin2@test.com", "password": "Admin1234"},
        expected=[200, 201, 409], test_name="POST /auth/register - Register admin user")

    # Try to make user admin via docker
    try:
        result = subprocess.run(
            ["docker", "exec", "cashflow-db", "psql", "-U", "postgres", "-d", "cashflow",
             "-c", "UPDATE users SET is_admin = true WHERE username = 'admin_test2';"],
            capture_output=True, text=True, timeout=10
        )
        print(f"  Admin flag set via docker: {result.stdout.strip()}")
    except Exception as e:
        print(f"  Warning: Could not set admin via docker: {e}")

    # Login
    status, body = curl("POST", "/auth/login",
        data={"username": "admin_test2", "password": "Admin1234"},
        expected=200, test_name="POST /auth/login - Login as admin")

    TOKEN = body.get("access_token", "")
    REFRESH_TOKEN = body.get("refresh_token", "")
    if not TOKEN:
        print("  FATAL: Could not get token!")
        print(f"  Response: {body}")
        sys.exit(1)

    print(f"  Token: {TOKEN[:30]}...")
    print(f"  Refresh token: {'present' if REFRESH_TOKEN else 'NOT present'}")

    # Validate token
    status, body = curl("GET", "/auth/me", token=TOKEN,
        expected=200, test_name="GET /auth/me - Validate token")
    USER_ID = body.get("id", "")
    IS_ADMIN = body.get("is_admin", False)
    print(f"  User ID: {USER_ID}, is_admin: {IS_ADMIN}")

    print()

    # ============================================
    # STEP 2: Categories CRUD
    # ============================================
    print("--- STEP 2: Categories CRUD ---")

    categories_data = [
        {"name": "Salary", "name_he": "משכורת", "type": "income", "icon": "briefcase", "color": "#10B981"},
        {"name": "Freelance", "name_he": "פרילנס", "type": "income", "icon": "laptop", "color": "#3B82F6"},
        {"name": "Investments", "name_he": "השקעות", "type": "income", "icon": "trending-up", "color": "#8B5CF6"},
        {"name": "Rent", "name_he": "שכירות", "type": "expense", "icon": "home", "color": "#EF4444"},
        {"name": "Software", "name_he": "תוכנה", "type": "expense", "icon": "code", "color": "#F59E0B"},
        {"name": "Food", "name_he": "אוכל", "type": "expense", "icon": "utensils", "color": "#EC4899"},
        {"name": "Transportation", "name_he": "תחבורה", "type": "expense", "icon": "car", "color": "#6366F1"},
    ]

    cat_ids = {}
    for cat in categories_data:
        status, body = curl("POST", "/categories", data=cat, token=TOKEN,
            expected=[201, 409, 400], test_name=f"POST /categories - Create {cat['name']}")

        cat_id = body.get("id", "")
        if not cat_id and status in ["409", "400"]:
            print(f"    Category {cat['name']} may already exist, will fetch from list")
        cat_ids[cat["name"]] = cat_id

    # Fetch all categories and map names to IDs
    status, body = curl("GET", "/categories", token=TOKEN,
        expected=200, test_name="GET /categories - List all")

    cat_list = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
    print(f"  Total categories returned: {len(cat_list)}")

    for c in cat_list:
        name = c.get("name", "")
        if name in cat_ids:
            cat_ids[name] = c.get("id", cat_ids[name])
        # Also check for "Food & Dining" which we renamed earlier
        if name == "Food & Dining":
            cat_ids["Food"] = c.get("id", cat_ids.get("Food", ""))

    SALARY_ID = cat_ids.get("Salary", "")
    FREELANCE_ID = cat_ids.get("Freelance", "")
    INVEST_ID = cat_ids.get("Investments", "")
    RENT_ID = cat_ids.get("Rent", "")
    SOFTWARE_ID = cat_ids.get("Software", "")
    FOOD_ID = cat_ids.get("Food", "")
    TRANSPORT_ID = cat_ids.get("Transportation", "")

    print(f"  IDs: Salary={SALARY_ID[:8] if SALARY_ID else 'N/A'}..., Rent={RENT_ID[:8] if RENT_ID else 'N/A'}..., Food={FOOD_ID[:8] if FOOD_ID else 'N/A'}...")

    # GET single category
    if SALARY_ID:
        status, body = curl("GET", f"/categories/{SALARY_ID}", token=TOKEN,
            expected=200, test_name="GET /categories/{id} - Get Salary")

    # UPDATE category
    if FOOD_ID:
        status, body = curl("PUT", f"/categories/{FOOD_ID}", token=TOKEN,
            data={"name": "Food & Dining", "name_he": "אוכל ומסעדות", "color": "#F472B6"},
            expected=200, test_name="PUT /categories/{id} - Update Food name/color")

    # DELETE (soft delete = archive) and re-create to test
    # According to API, there's no archive/unarchive PATCH endpoint - DELETE does soft delete
    if TRANSPORT_ID:
        status, body = curl("DELETE", f"/categories/{TRANSPORT_ID}", token=TOKEN,
            expected=[200, 204], test_name="DELETE /categories/{id} - Soft delete Transportation")

        # Re-create Transportation after soft delete
        status, body = curl("POST", "/categories", token=TOKEN,
            data={"name": "Transportation", "name_he": "תחבורה", "type": "expense", "icon": "car", "color": "#6366F1"},
            expected=[201, 409, 400], test_name="POST /categories - Re-create Transportation after delete")
        new_transport = body.get("id", "")
        if new_transport:
            TRANSPORT_ID = new_transport

    # Refresh category list after modifications
    status, body = curl("GET", "/categories", token=TOKEN, expected=200,
        test_name="GET /categories - Refresh list after changes")
    cat_list_2 = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
    for c in cat_list_2:
        name = c.get("name", "")
        cid = c.get("id", "")
        if name == "Transportation" and not c.get("is_archived"):
            TRANSPORT_ID = cid
        if name in ("Food", "Food & Dining") and not c.get("is_archived"):
            FOOD_ID = cid

    print(f"  After changes - Transport={TRANSPORT_ID[:8] if TRANSPORT_ID else 'N/A'}..., Food={FOOD_ID[:8] if FOOD_ID else 'N/A'}...")

    print()

    # ============================================
    # STEP 3: Transactions CRUD
    # ============================================
    print("--- STEP 3: Transactions CRUD ---")

    txn_data_list = [
        {"type": "income", "amount": 25000, "description": "January Salary", "date": "2025-01-01", "category_id": SALARY_ID},
        {"type": "income", "amount": 25000, "description": "February Salary", "date": "2025-02-01", "category_id": SALARY_ID},
        {"type": "income", "amount": 5000, "description": "Freelance Web Project", "date": "2025-01-15", "category_id": FREELANCE_ID},
        {"type": "income", "amount": 2500, "description": "Investment Dividends", "date": "2025-02-10", "category_id": INVEST_ID},
        {"type": "expense", "amount": 5500, "description": "Monthly Rent Jan", "date": "2025-01-01", "category_id": RENT_ID},
        {"type": "expense", "amount": 5500, "description": "Monthly Rent Feb", "date": "2025-02-01", "category_id": RENT_ID},
        {"type": "expense", "amount": 150, "description": "JetBrains Subscription", "date": "2025-01-15", "category_id": SOFTWARE_ID},
        {"type": "expense", "amount": 800, "description": "Grocery Shopping", "date": "2025-01-20", "category_id": FOOD_ID},
        {"type": "expense", "amount": 350, "description": "Restaurant Dinner", "date": "2025-02-05", "category_id": FOOD_ID},
        {"type": "expense", "amount": 200, "description": "Uber Rides", "date": "2025-02-08", "category_id": TRANSPORT_ID},
        {"type": "income", "amount": 3000, "description": "Side Project Payment", "date": "2025-02-12", "category_id": FREELANCE_ID},
        {"type": "expense", "amount": 450, "description": "Weekly Food Shopping", "date": "2025-02-15", "category_id": FOOD_ID},
    ]

    txn_ids = []
    for txn in txn_data_list:
        if not txn.get("category_id"):
            print(f"  SKIP: {txn['description']} - No category ID available")
            continue
        status, body = curl("POST", "/transactions", data=txn, token=TOKEN,
            expected=201, test_name=f"POST /transactions - {txn['description']}")
        tid = body.get("id", "")
        if tid:
            txn_ids.append(tid)

    print(f"  Created {len(txn_ids)} transactions")

    # GET all transactions
    status, body = curl("GET", "/transactions", token=TOKEN,
        expected=200, test_name="GET /transactions - List all")
    if isinstance(body, dict):
        total_txn = body.get("total", len(body.get("items", [])))
    elif isinstance(body, list):
        total_txn = len(body)
    else:
        total_txn = "unknown"
    print(f"  Total transactions in system: {total_txn}")

    # Filter by type
    status, body = curl("GET", "/transactions?type=income", token=TOKEN,
        expected=200, test_name="GET /transactions?type=income - Filter income only")
    income_count = body.get("total", len(body.get("items", body if isinstance(body, list) else [])))
    print(f"    Income transactions: {income_count}")

    status, body = curl("GET", "/transactions?type=expense", token=TOKEN,
        expected=200, test_name="GET /transactions?type=expense - Filter expense only")
    expense_count = body.get("total", len(body.get("items", body if isinstance(body, list) else [])))
    print(f"    Expense transactions: {expense_count}")

    # Filter by date range
    status, body = curl("GET", "/transactions?date_from=2025-02-01&date_to=2025-02-28", token=TOKEN,
        expected=200, test_name="GET /transactions - Date range filter (Feb 2025)")

    # Filter by category
    if FOOD_ID:
        status, body = curl("GET", f"/transactions?category_id={FOOD_ID}", token=TOKEN,
            expected=200, test_name="GET /transactions - Category filter (Food)")

    # Filter by amount range
    status, body = curl("GET", "/transactions?amount_min=1000&amount_max=10000", token=TOKEN,
        expected=200, test_name="GET /transactions - Amount range (1000-10000)")

    # Search by description
    status, body = curl("GET", "/transactions?search=Salary", token=TOKEN,
        expected=200, test_name="GET /transactions?search=Salary - Full text search")

    # Pagination
    status, body = curl("GET", "/transactions?limit=3&offset=0", token=TOKEN,
        expected=200, test_name="GET /transactions - Pagination (limit=3, offset=0)")

    status, body = curl("GET", "/transactions?limit=3&offset=3", token=TOKEN,
        expected=200, test_name="GET /transactions - Pagination (limit=3, offset=3)")

    # Sorting
    status, body = curl("GET", "/transactions?sort_by=amount&sort_order=desc", token=TOKEN,
        expected=200, test_name="GET /transactions - Sort by amount descending")

    status, body = curl("GET", "/transactions?sort_by=date&sort_order=asc", token=TOKEN,
        expected=200, test_name="GET /transactions - Sort by date ascending")

    # Duplicate
    if txn_ids:
        status, body = curl("POST", f"/transactions/{txn_ids[0]}/duplicate", token=TOKEN,
            expected=201, test_name="POST /transactions/{id}/duplicate - Clone first txn")
        dup_id = body.get("id", "")

        if dup_id:
            status, body = curl("POST", "/transactions/bulk-delete",
                data={"ids": [dup_id]}, token=TOKEN,
                expected=200, test_name="POST /transactions/bulk-delete - Remove cloned txn")

    # Update transaction
    if len(txn_ids) > 7:
        status, body = curl("PUT", f"/transactions/{txn_ids[7]}", token=TOKEN,
            data={"amount": 950, "description": "Grocery Shopping (Updated)"},
            expected=200, test_name="PUT /transactions/{id} - Update grocery amount")

    # Get single transaction
    if txn_ids:
        status, body = curl("GET", f"/transactions/{txn_ids[0]}", token=TOKEN,
            expected=200, test_name="GET /transactions/{id} - Single transaction detail")

    # Delete a transaction
    if len(txn_ids) > 10:
        status, body = curl("DELETE", f"/transactions/{txn_ids[-1]}", token=TOKEN,
            expected=[200, 204], test_name="DELETE /transactions/{id} - Delete last txn")

    print()

    # ============================================
    # STEP 4: Fixed Income/Expenses
    # ============================================
    print("--- STEP 4: Fixed Income/Expenses ---")
    # Schema: name*, amount*, type*, day_of_month*, start_date*, category_id, description, end_date

    fixed_data_list = [
        {"name": "Monthly Salary", "type": "income", "amount": 25000, "description": "Monthly salary payment",
         "day_of_month": 1, "category_id": SALARY_ID, "start_date": "2025-01-01"},
        {"name": "Monthly Rent", "type": "expense", "amount": 5500, "description": "Apartment rent",
         "day_of_month": 1, "category_id": RENT_ID, "start_date": "2025-01-01"},
        {"name": "Software Sub", "type": "expense", "amount": 150, "description": "JetBrains subscription",
         "day_of_month": 15, "category_id": SOFTWARE_ID, "start_date": "2025-01-15"},
    ]

    fixed_ids = []
    for fd in fixed_data_list:
        if not fd.get("category_id"):
            print(f"  SKIP: {fd['name']} - No category ID")
            continue
        status, body = curl("POST", "/fixed", data=fd, token=TOKEN,
            expected=201, test_name=f"POST /fixed - Create '{fd['name']}'")
        fid = body.get("id", "")
        if fid:
            fixed_ids.append(fid)

    print(f"  Created {len(fixed_ids)} fixed entries")

    # GET all fixed
    status, body = curl("GET", "/fixed", token=TOKEN,
        expected=200, test_name="GET /fixed - List all fixed entries")
    fixed_list = body if isinstance(body, list) else body.get("items", []) if isinstance(body, dict) else []
    print(f"  Total fixed in system: {len(fixed_list)}")

    # GET single
    if fixed_ids:
        status, body = curl("GET", f"/fixed/{fixed_ids[0]}", token=TOKEN,
            expected=200, test_name="GET /fixed/{id} - Get salary fixed entry")

    # Pause (POST, not PATCH)
    if len(fixed_ids) >= 3:
        status, body = curl("POST", f"/fixed/{fixed_ids[2]}/pause", token=TOKEN,
            expected=200, test_name="POST /fixed/{id}/pause - Pause software sub")

        # Verify paused
        status, body = curl("GET", f"/fixed/{fixed_ids[2]}", token=TOKEN,
            expected=200, test_name="GET /fixed/{id} - Verify paused state")
        is_active = body.get("is_active", "N/A")
        print(f"    is_active after pause: {is_active}")

        # Resume (POST, not PATCH)
        status, body = curl("POST", f"/fixed/{fixed_ids[2]}/resume", token=TOKEN,
            expected=200, test_name="POST /fixed/{id}/resume - Resume software sub")

        # Verify resumed
        status, body = curl("GET", f"/fixed/{fixed_ids[2]}", token=TOKEN,
            expected=200, test_name="GET /fixed/{id} - Verify resumed state")
        is_active = body.get("is_active", "N/A")
        print(f"    is_active after resume: {is_active}")

    # Update fixed
    if fixed_ids:
        status, body = curl("PUT", f"/fixed/{fixed_ids[0]}", token=TOKEN,
            data={"amount": 26000, "name": "Monthly Salary (Raise)"},
            expected=200, test_name="PUT /fixed/{id} - Update salary to 26000")

    print()

    # ============================================
    # STEP 5: Installments
    # ============================================
    print("--- STEP 5: Installments ---")
    # Schema: name*, total_amount*, number_of_payments*, type*, start_date*, day_of_month*, category_id, description

    inst_data_list = [
        {"name": "MacBook Pro", "type": "expense", "total_amount": 12000,
         "number_of_payments": 12, "start_date": "2025-01-01", "day_of_month": 1,
         "category_id": SOFTWARE_ID, "description": "MacBook Pro purchase on installments"},
        {"name": "Consulting Payment", "type": "income", "total_amount": 18000,
         "number_of_payments": 6, "start_date": "2025-02-01", "day_of_month": 15,
         "category_id": FREELANCE_ID, "description": "Consulting project payment plan"},
    ]

    inst_ids = []
    for inst in inst_data_list:
        if not inst.get("category_id"):
            print(f"  SKIP: {inst['name']} - No category ID")
            continue
        status, body = curl("POST", "/installments", data=inst, token=TOKEN,
            expected=201, test_name=f"POST /installments - Create '{inst['name']}'")
        iid = body.get("id", "")
        if iid:
            inst_ids.append(iid)

    print(f"  Created {len(inst_ids)} installments")

    # GET all
    status, body = curl("GET", "/installments", token=TOKEN,
        expected=200, test_name="GET /installments - List all")

    # GET single (detail with schedule)
    if inst_ids:
        status, body = curl("GET", f"/installments/{inst_ids[0]}", token=TOKEN,
            expected=200, test_name="GET /installments/{id} - MacBook detail + schedule")
        if isinstance(body, dict):
            inst_data = body.get("installment", body)
            monthly = inst_data.get("monthly_amount", "N/A")
            total_p = inst_data.get("number_of_payments", "N/A")
            completed = inst_data.get("payments_completed", "N/A")
            schedule = body.get("schedule", [])
            print(f"    Monthly: {monthly}, Total payments: {total_p}, Completed: {completed}, Schedule entries: {len(schedule)}")

    # GET payment schedule
    if inst_ids:
        status, body = curl("GET", f"/installments/{inst_ids[0]}/payments", token=TOKEN,
            expected=200, test_name="GET /installments/{id}/payments - Payment schedule")

    # Update installment
    if inst_ids:
        status, body = curl("PUT", f"/installments/{inst_ids[0]}", token=TOKEN,
            data={"description": "MacBook Pro M4 - updated description"},
            expected=200, test_name="PUT /installments/{id} - Update description")

    print()

    # ============================================
    # STEP 6: Loans
    # ============================================
    print("--- STEP 6: Loans ---")
    # Schema: name*, original_amount*, monthly_payment*, start_date*, day_of_month*, total_payments*,
    #         interest_rate, category_id, description

    loan_data_list = [
        {"name": "Car Loan", "original_amount": 100000, "monthly_payment": 4300,
         "interest_rate": 3.0, "total_payments": 24, "start_date": "2025-01-01",
         "day_of_month": 1, "description": "Car loan from Bank Leumi"},
        {"name": "Personal Loan", "original_amount": 20000, "monthly_payment": 1667,
         "interest_rate": 0.0, "total_payments": 12, "start_date": "2025-02-01",
         "day_of_month": 5, "description": "Personal loan from family, 0% interest"},
    ]

    loan_ids = []
    for loan in loan_data_list:
        status, body = curl("POST", "/loans", data=loan, token=TOKEN,
            expected=201, test_name=f"POST /loans - Create '{loan['name']}'")
        lid = body.get("id", "")
        if lid:
            loan_ids.append(lid)

    print(f"  Created {len(loan_ids)} loans")

    # GET all loans
    status, body = curl("GET", "/loans", token=TOKEN,
        expected=200, test_name="GET /loans - List all loans")

    # Record payments (Schema: amount*)
    if loan_ids:
        status, body = curl("POST", f"/loans/{loan_ids[0]}/payment", token=TOKEN,
            data={"amount": 4300},
            expected=[200, 201], test_name="POST /loans/{id}/payment - Record car loan payment 1")

        status, body = curl("POST", f"/loans/{loan_ids[0]}/payment", token=TOKEN,
            data={"amount": 4300},
            expected=[200, 201], test_name="POST /loans/{id}/payment - Record car loan payment 2")

        if len(loan_ids) > 1:
            status, body = curl("POST", f"/loans/{loan_ids[1]}/payment", token=TOKEN,
                data={"amount": 1667},
                expected=[200, 201], test_name="POST /loans/{id}/payment - Record personal loan payment")

        # GET single loan detail
        status, body = curl("GET", f"/loans/{loan_ids[0]}", token=TOKEN,
            expected=200, test_name="GET /loans/{id} - Car loan detail")
        if isinstance(body, dict):
            loan_detail = body.get("loan", body)
            remaining = loan_detail.get("remaining_balance", "N/A")
            made = loan_detail.get("payments_made", "N/A")
            loan_status = loan_detail.get("status", "N/A")
            print(f"    Remaining: {remaining}, Payments made: {made}, Status: {loan_status}")

        # GET loan breakdown/amortization
        status, body = curl("GET", f"/loans/{loan_ids[0]}/breakdown", token=TOKEN,
            expected=200, test_name="GET /loans/{id}/breakdown - Amortization schedule")

    # Update loan
    if loan_ids:
        status, body = curl("PUT", f"/loans/{loan_ids[0]}", token=TOKEN,
            data={"description": "Car loan - Bank Leumi (updated)"},
            expected=200, test_name="PUT /loans/{id} - Update description")

    print()

    # ============================================
    # STEP 7: Balance
    # ============================================
    print("--- STEP 7: Balance ---")
    # Schema: balance*, effective_date*, notes

    balance_entries = [
        {"balance": 45000, "effective_date": "2025-01-01", "notes": "January opening balance"},
        {"balance": 48000, "effective_date": "2025-01-31", "notes": "January closing balance"},
        {"balance": 50000, "effective_date": "2025-02-09", "notes": "Current bank balance"},
    ]

    for bal in balance_entries:
        status, body = curl("POST", "/balance", data=bal, token=TOKEN,
            expected=[200, 201], test_name=f"POST /balance - {bal['notes']}")

    # GET current balance
    status, body = curl("GET", "/balance", token=TOKEN,
        expected=200, test_name="GET /balance - Current balance")
    if isinstance(body, dict):
        curr = body.get("balance", body.get("current_balance", "N/A"))
        print(f"    Current balance: {curr}")

    # Update balance
    status, body = curl("PUT", "/balance", token=TOKEN,
        data={"balance": 52000, "effective_date": "2025-02-09"},
        expected=200, test_name="PUT /balance - Update current balance to 52000")

    # GET history
    status, body = curl("GET", "/balance/history", token=TOKEN,
        expected=200, test_name="GET /balance/history - Balance history")
    if isinstance(body, dict):
        items = body.get("items", [])
        print(f"    History entries: {len(items)}")
        for item in items[:3]:
            print(f"      {item.get('effective_date', '?')}: {item.get('balance', '?')}")
    elif isinstance(body, list):
        print(f"    History entries: {len(body)}")

    print()

    # ============================================
    # STEP 8: Forecast
    # ============================================
    print("--- STEP 8: Forecast ---")

    status, body = curl("GET", "/forecast?months=6", token=TOKEN,
        expected=200, test_name="GET /forecast?months=6 - 6 month forecast")
    if isinstance(body, dict):
        has_neg = body.get("has_negative_months", "N/A")
        first_neg = body.get("first_negative_month", "none")
        months_data = body.get("months", [])
        curr_bal = body.get("current_balance", "N/A")
        print(f"    Current balance: {curr_bal}")
        print(f"    Has negative months: {has_neg}")
        print(f"    First negative month: {first_neg}")
        print(f"    Forecast months: {len(months_data)}")
        for m in months_data[:3]:
            print(f"      {m.get('month', '?')}: opening={m.get('opening_balance', '?')}, "
                  f"income={m.get('fixed_income', '?')}, expense={m.get('fixed_expenses', m.get('fixed_expense', '?'))}")

    status, body = curl("GET", "/forecast?months=12", token=TOKEN,
        expected=200, test_name="GET /forecast?months=12 - 12 month forecast")

    print()

    # ============================================
    # STEP 9: Dashboard
    # ============================================
    print("--- STEP 9: Dashboard ---")

    status, body = curl("GET", "/dashboard/summary", token=TOKEN,
        expected=200, test_name="GET /dashboard/summary - Dashboard KPIs")
    if isinstance(body, dict):
        for k, v in list(body.items())[:12]:
            print(f"    {k}: {v}")

    print()

    # ============================================
    # STEP 10: Alerts
    # ============================================
    print("--- STEP 10: Alerts ---")

    status, body = curl("GET", "/alerts", token=TOKEN,
        expected=200, test_name="GET /alerts - Get all alerts")

    alert_list = body if isinstance(body, list) else body.get("items", body.get("alerts", [])) if isinstance(body, dict) else []
    print(f"    Alerts found: {len(alert_list)}")
    for a in alert_list[:5]:
        sev = a.get("severity", "")
        msg = a.get("message", a.get("title", ""))[:80]
        atype = a.get("type", "")
        print(f"    - [{sev}] ({atype}) {msg}")

    # Mark as read if any
    if alert_list and alert_list[0].get("id"):
        aid = alert_list[0]["id"]
        status, body = curl("PATCH", f"/alerts/{aid}/read", token=TOKEN,
            expected=200, test_name="PATCH /alerts/{id}/read - Mark first alert as read")

    # Dismiss if more alerts
    if len(alert_list) > 1 and alert_list[1].get("id"):
        aid = alert_list[1]["id"]
        status, body = curl("PATCH", f"/alerts/{aid}/dismiss", token=TOKEN,
            expected=200, test_name="PATCH /alerts/{id}/dismiss - Dismiss second alert")

    print()

    # ============================================
    # STEP 11: Settings
    # ============================================
    print("--- STEP 11: Settings ---")

    status, body = curl("GET", "/settings", token=TOKEN,
        expected=200, test_name="GET /settings - Get current settings")
    if isinstance(body, dict):
        print(f"    Current: lang={body.get('language')}, theme={body.get('theme')}, "
              f"currency={body.get('currency')}, notifications={body.get('notifications_enabled')}")

    status, body = curl("PUT", "/settings", token=TOKEN,
        data={"language": "he", "theme": "dark", "currency": "ILS", "notifications_enabled": True},
        expected=200, test_name="PUT /settings - Update to Hebrew/Dark/ILS")

    status, body = curl("GET", "/settings", token=TOKEN,
        expected=200, test_name="GET /settings - Verify updated settings")
    if isinstance(body, dict):
        print(f"    After update: lang={body.get('language')}, theme={body.get('theme')}")

    # Reset to light mode
    status, body = curl("PUT", "/settings", token=TOKEN,
        data={"language": "en", "theme": "light"},
        expected=200, test_name="PUT /settings - Reset to English/Light")

    print()

    # ============================================
    # STEP 12: User Management (Admin)
    # ============================================
    print("--- STEP 12: User Management (Admin) ---")

    # List users
    status, body = curl("GET", "/users", token=TOKEN,
        expected=[200, 403], test_name="GET /users - List users (admin)")

    if status == "403":
        print("    Note: admin_test is not admin - skipping admin-only tests")
        BUGS.append("NOTE: admin_test user was not promoted to admin (docker exec may not have worked)")
    else:
        user_list = body if isinstance(body, list) else body.get("items", body.get("users", []))
        print(f"    Users found: {len(user_list) if isinstance(user_list, list) else 'N/A'}")

        # Create new user via admin endpoint
        status, body = curl("POST", "/users", token=TOKEN,
            data={"username": "testuser2", "email": "test2@test.com", "password": "Test1234", "is_admin": False},
            expected=[201, 409], test_name="POST /users - Create testuser2 (admin)")
        new_user_id = body.get("id", "")

        if new_user_id and status == "201":
            # Update user
            status, body = curl("PUT", f"/users/{new_user_id}", token=TOKEN,
                data={"email": "updated@test.com"},
                expected=200, test_name="PUT /users/{id} - Update testuser2 email")

            # Delete user
            status, body = curl("DELETE", f"/users/{new_user_id}", token=TOKEN,
                expected=[200, 204], test_name="DELETE /users/{id} - Delete testuser2")

    print()

    # ============================================
    # STEP 13: Edge Cases
    # ============================================
    print("--- STEP 13: Edge Cases ---")

    # Minimum amount
    if FOOD_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "expense", "amount": 0.01, "description": "Minimal amount test",
                  "date": "2025-02-09", "category_id": FOOD_ID},
            expected=201, test_name="EDGE: Minimum amount 0.01")

    # Very long description (500 chars)
    if FOOD_ID:
        long_desc = "A" * 500
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "expense", "amount": 100, "description": long_desc,
                  "date": "2025-02-09", "category_id": FOOD_ID},
            expected=[201, 422], test_name="EDGE: Very long description (500 chars)")

    # Zero amount (should be rejected)
    if FOOD_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "expense", "amount": 0, "description": "Zero amount",
                  "date": "2025-02-09", "category_id": FOOD_ID},
            expected=422, test_name="EDGE: Zero amount (should reject)")
        if status == "201":
            BUGS.append("BUG: Zero amount transaction was accepted - should be rejected")

    # Negative amount (should be rejected)
    if FOOD_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "expense", "amount": -100, "description": "Negative amount",
                  "date": "2025-02-09", "category_id": FOOD_ID},
            expected=422, test_name="EDGE: Negative amount (should reject)")
        if status == "201":
            BUGS.append("BUG: Negative amount transaction was accepted - should be rejected")

    # Wrong password
    status, body = curl("POST", "/auth/login",
        data={"username": "admin_test", "password": "WrongPassword"},
        expected=401, test_name="EDGE: Login with wrong password")

    # Non-existent user login
    status, body = curl("POST", "/auth/login",
        data={"username": "nonexistent_user_xyz", "password": "Whatever123"},
        expected=401, test_name="EDGE: Login with non-existent user")

    # No auth token
    status, body = curl("GET", "/transactions",
        expected=[401, 403], test_name="EDGE: Access /transactions without token")

    # Invalid token
    status, body = curl("GET", "/transactions", token="invalid_token_here",
        expected=[401, 403], test_name="EDGE: Access with invalid token")

    # Register regular user for isolation test
    status, body = curl("POST", "/auth/register",
        data={"username": "isolation_user", "email": "isolation@test.com", "password": "Isolation1234"},
        expected=[200, 201, 409], test_name="EDGE: Register isolation test user")

    status, body = curl("POST", "/auth/login",
        data={"username": "isolation_user", "password": "Isolation1234"},
        expected=200, test_name="EDGE: Login as isolation user")
    REG_TOKEN = body.get("access_token", "")

    if REG_TOKEN:
        # Non-admin accessing admin endpoints
        status, body = curl("GET", "/users", token=REG_TOKEN,
            expected=403, test_name="EDGE: Non-admin accessing /users (should 403)")
        if status == "200":
            BUGS.append("BUG: Non-admin user can list all users!")

        # Data isolation - should see 0 transactions
        status, body = curl("GET", "/transactions", token=REG_TOKEN,
            expected=200, test_name="EDGE: Regular user sees only own transactions")
        if isinstance(body, dict):
            rtxn = body.get("total", len(body.get("items", [])))
        elif isinstance(body, list):
            rtxn = len(body)
        else:
            rtxn = "unknown"
        print(f"    Isolation user transactions: {rtxn} (expected: 0)")
        if isinstance(rtxn, int) and rtxn > 0:
            BUGS.append(f"BUG: Isolation user sees {rtxn} transactions belonging to other users!")

    # Non-existent UUID
    status, body = curl("GET", "/transactions/00000000-0000-0000-0000-000000000000", token=TOKEN,
        expected=404, test_name="EDGE: Non-existent UUID")

    # Invalid UUID format
    status, body = curl("GET", "/transactions/not-a-uuid", token=TOKEN,
        expected=[404, 422], test_name="EDGE: Invalid UUID format")

    # Duplicate category name
    status, body = curl("POST", "/categories", token=TOKEN,
        data={"name": "Salary", "name_he": "duplicate", "type": "income", "icon": "x", "color": "#000"},
        expected=[400, 409, 422], test_name="EDGE: Duplicate category name (should reject)")
    if status == "201":
        BUGS.append("BUG: Duplicate category name 'Salary' was accepted without rejection")

    # Missing required fields
    status, body = curl("POST", "/transactions", token=TOKEN,
        data={"type": "expense"},
        expected=422, test_name="EDGE: Missing required fields")

    # Invalid date format
    if FOOD_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "expense", "amount": 100, "description": "Bad date",
                  "date": "not-a-date", "category_id": FOOD_ID},
            expected=422, test_name="EDGE: Invalid date format")

    # Token refresh (needs refresh_token in body)
    if REFRESH_TOKEN:
        status, body = curl("POST", "/auth/refresh",
            data={"refresh_token": REFRESH_TOKEN},
            expected=[200, 201], test_name="EDGE: Token refresh with refresh_token")
        if status in ["200", "201"]:
            new_token = body.get("access_token", "")
            print(f"    New token acquired: {'yes' if new_token else 'no'}")
    else:
        print("  SKIP: Token refresh - no refresh_token available")

    # Very large amount (max DECIMAL(15,2))
    if SALARY_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "income", "amount": 9999999999999.99, "description": "Max DECIMAL(15,2)",
                  "date": "2025-02-09", "category_id": SALARY_ID},
            expected=[201, 422], test_name="EDGE: Maximum DECIMAL(15,2) amount")

    # Empty body
    status, body = curl("POST", "/transactions", token=TOKEN,
        data={},
        expected=422, test_name="EDGE: Empty body POST")

    # Double login (should work fine)
    status, body = curl("POST", "/auth/login",
        data={"username": "admin_test", "password": "Admin1234"},
        expected=200, test_name="EDGE: Double login (concurrent sessions)")

    # Invalid type value
    if FOOD_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "invalid_type", "amount": 100, "description": "Bad type",
                  "date": "2025-02-09", "category_id": FOOD_ID},
            expected=422, test_name="EDGE: Invalid transaction type")

    # Future date transaction (should be accepted)
    if SALARY_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "income", "amount": 1000, "description": "Future transaction",
                  "date": "2026-12-31", "category_id": SALARY_ID},
            expected=[201, 422], test_name="EDGE: Future date transaction")

    # SQL injection attempt in search
    status, body = curl("GET", "/transactions?search=' OR 1=1 --", token=TOKEN,
        expected=200, test_name="EDGE: SQL injection in search (should be safe)")

    # XSS in description
    if FOOD_ID:
        status, body = curl("POST", "/transactions", token=TOKEN,
            data={"type": "expense", "amount": 10, "description": "<script>alert('xss')</script>",
                  "date": "2025-02-09", "category_id": FOOD_ID},
            expected=[201, 422], test_name="EDGE: XSS in description field")

    print()

    # ============================================
    # SUMMARY
    # ============================================
    print("=" * 60)
    print("  TEST RESULTS SUMMARY")
    print("=" * 60)
    print()
    print(f"  Total tests:  {TOTAL}")
    print(f"  Passed:       {PASS_COUNT}")
    print(f"  Failed:       {FAIL_COUNT}")
    if TOTAL > 0:
        print(f"  Pass rate:    {PASS_COUNT/TOTAL*100:.1f}%")
    print()

    if FAILURES:
        print("  FAILURES:")
        for f in FAILURES:
            print(f"    - {f}")
        print()

    if BUGS:
        print("  BUGS/NOTES FOUND:")
        for b in BUGS:
            print(f"    - {b}")
        print()

    print("  DATA CREATED IN SYSTEM:")
    print(f"  - 7+ categories (Salary, Freelance, Investments, Rent, Software, Food, Transportation)")
    print(f"  - {len(txn_ids)} transactions (mix of income/expense, Jan-Feb 2025)")
    print(f"  - {len(fixed_ids)} fixed entries (salary 26000/mo, rent 5500/mo, software 150/mo)")
    print(f"  - {len(inst_ids)} installments (MacBook 12x1000, Consulting 6x3000)")
    print(f"  - {len(loan_ids)} loans (Car 24m@3%, Personal 12m@0%)")
    print("  - Balance entries (45000 -> 48000 -> 52000)")
    print("  - Settings: tested dark/light, he/en")
    print("  - Users: admin_test, isolation_user, regular_user99")
    print("=" * 60)

    return FAIL_COUNT


if __name__ == "__main__":
    failures = main()
    sys.exit(min(failures, 1))
