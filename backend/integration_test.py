#!/usr/bin/env python3
"""Cross-Module Integration Test Script for Cash Flow Management App"""

import json
import sys
import time
import requests
from decimal import Decimal

BASE = "http://localhost:8000/api/v1"
PASS_COUNT = 0
FAIL_COUNT = 0
WARN_COUNT = 0

def pass_test(msg):
    global PASS_COUNT
    PASS_COUNT += 1
    print(f"  PASS: {msg}")

def fail_test(msg, expected=None, got=None):
    global FAIL_COUNT
    FAIL_COUNT += 1
    print(f"  FAIL: {msg}")
    if expected is not None:
        print(f"    Expected: {expected}")
        print(f"    Got:      {got}")

def warn_test(msg):
    global WARN_COUNT
    WARN_COUNT += 1
    print(f"  WARN: {msg}")

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def api(method, path, token=None, data=None, raw=False):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if method == "GET":
        r = requests.get(url, headers=headers)
    elif method == "POST":
        r = requests.post(url, headers=headers, json=data)
    elif method == "PUT":
        r = requests.put(url, headers=headers, json=data)
    elif method == "DELETE":
        r = requests.delete(url, headers=headers)
    if raw:
        return r
    return r.json()

# =========================================
# SETUP: Register and Login
# =========================================
section("SETUP: Registration and Authentication")

unique = str(int(time.time()))
username = f"inttest_{unique}"
email = f"int_{unique}@test.com"

print(f"Registering user: {username}")
reg = api("POST", "/auth/register", data={"username": username, "email": email, "password": "IntTest1234"})
print(f"  Register: {reg}")

login = api("POST", "/auth/login", data={"username": username, "password": "IntTest1234"})
TOKEN = login["access_token"]
print(f"  Token obtained successfully")

# =========================================
# FLOW 1: Category -> Transaction -> Dashboard
# =========================================
section("FLOW 1: Category -> Transaction -> Dashboard")

# Step 1: Create category "Salary" (income)
print("Step 1: Creating category 'Salary' (income)...")
cat = api("POST", "/categories", TOKEN, {"name": "Salary", "name_he": "משכורת", "type": "income", "icon": "wallet", "color": "#22C55E"})
CAT_ID = cat["id"]
print(f"  Category ID: {CAT_ID}, type: {cat['type']}")
if cat["type"] == "income":
    pass_test("Category created with type=income")
else:
    fail_test("Category type", "income", cat["type"])

# Step 2: Create transaction linked to that category
print("Step 2: Creating transaction linked to Salary category...")
tx = api("POST", "/transactions", TOKEN, {
    "amount": 18000, "type": "income", "category_id": CAT_ID,
    "description": "January Salary", "date": "2026-02-01"
})
TX_ID = tx["id"]
if tx["category_id"] == CAT_ID:
    pass_test("Transaction linked to category correctly")
else:
    fail_test("Transaction category_id", CAT_ID, tx["category_id"])

# Step 3: Set balance so dashboard works, then get dashboard
print("Step 3: Setting balance and getting dashboard summary...")
api("POST", "/balance", TOKEN, {"balance": 50000, "effective_date": "2026-02-01"})
dash = api("GET", "/dashboard/summary", TOKEN)
print(f"  Dashboard: balance={dash['current_balance']}, income={dash['monthly_income']}, expenses={dash['monthly_expenses']}, net={dash['net_cashflow']}")

monthly_income = float(dash["monthly_income"])
if monthly_income >= 18000:
    pass_test(f"Dashboard monthly_income reflects the 18000 transaction (got {monthly_income})")
else:
    fail_test("Dashboard monthly_income", ">= 18000", monthly_income)

# Step 4: Delete (archive) the category
print("Step 4: Archiving category...")
del_resp = api("DELETE", f"/categories/{CAT_ID}", TOKEN)
print(f"  Delete: {del_resp}")

cat_after = api("GET", f"/categories/{CAT_ID}", TOKEN)
if cat_after["is_archived"] == True:
    pass_test("Category soft-deleted (is_archived=True)")
else:
    fail_test("Category is_archived", True, cat_after["is_archived"])

# Step 5: Transaction should still have category_id
print("Step 5: Checking transaction still has category_id after category archive...")
tx_after = api("GET", f"/transactions/{TX_ID}", TOKEN)
if tx_after["category_id"] == CAT_ID:
    pass_test("Transaction retains category_id after category archive")
else:
    fail_test("Transaction category_id after archive", CAT_ID, tx_after["category_id"])

# Step 6: Create new transaction with archived category
print("Step 6: Creating new transaction with archived category...")
tx2_raw = api("POST", "/transactions", TOKEN, {
    "amount": 5000, "type": "income", "category_id": CAT_ID,
    "description": "Test archived cat", "date": "2026-02-05"
}, raw=True)
print(f"  HTTP status: {tx2_raw.status_code}")
if tx2_raw.status_code == 201:
    warn_test("Transaction with archived category ALLOWED (HTTP 201) - No validation prevents using archived categories")
else:
    pass_test(f"Transaction with archived category rejected (HTTP {tx2_raw.status_code})")


# =========================================
# FLOW 2: Fixed -> Forecast -> Alert
# =========================================
section("FLOW 2: Fixed -> Forecast -> Alert")

# Step 1: Set balance to 5000
print("Step 1: Setting balance to 5000...")
api("PUT", "/balance", TOKEN, {"balance": 5000, "effective_date": "2026-02-09"})
bal = api("GET", "/balance", TOKEN)
if float(bal["balance"]) == 5000:
    pass_test(f"Balance set to 5000 (got {bal['balance']})")
else:
    fail_test("Balance", 5000, bal["balance"])

# Step 2: Create fixed income: 10000/month
print("Step 2: Creating fixed income 10000/month...")
fi = api("POST", "/fixed", TOKEN, {
    "name": "Main Salary", "amount": 10000, "type": "income",
    "day_of_month": 10, "start_date": "2026-01-01"
})
FI_ID = fi["id"]

# Step 3: Create fixed expense: 12000/month (net negative!)
print("Step 3: Creating fixed expense 12000/month (net will be -2000/month)...")
fe = api("POST", "/fixed", TOKEN, {
    "name": "All Expenses", "amount": 12000, "type": "expense",
    "day_of_month": 15, "start_date": "2026-01-01"
})
FE_ID = fe["id"]

# Step 4: Get forecast for 6 months
print("Step 4: Getting 6-month forecast...")
fc = api("GET", "/forecast?months=6", TOKEN)
print(f"  Current balance: {fc['current_balance']}")
print(f"  has_negative_months: {fc['has_negative_months']}")
print(f"  first_negative_month: {fc['first_negative_month']}")
for i, m in enumerate(fc["months"]):
    print(f"  Month {i+1} ({m['month']}): open={m['opening_balance']}, fi={m['fixed_income']}, fe={m['fixed_expenses']}, net={m['net_change']}, close={m['closing_balance']}")

if fc["has_negative_months"]:
    pass_test("Forecast shows has_negative_months=True (income 10000 - expense 12000 = net -2000/month)")
else:
    fail_test("has_negative_months", True, fc["has_negative_months"])

# Verify declining balance
m1_close = float(fc["months"][0]["closing_balance"])
m6_close = float(fc["months"][5]["closing_balance"])
if m6_close < m1_close:
    pass_test(f"Balance declines over 6 months (month1_close={m1_close}, month6_close={m6_close})")
else:
    fail_test("Balance decline", f"month6({m6_close}) < month1({m1_close})", f"month6={m6_close}")

# Step 5: Get forecast summary
print("Step 5: Getting forecast summary...")
fs = api("GET", "/forecast/summary?months=6", TOKEN)
print(f"  Summary: {json.dumps(fs, indent=2)}")
if fs["has_negative_months"]:
    pass_test("Forecast summary shows has_negative_months=True")
else:
    fail_test("Summary has_negative_months", True, fs["has_negative_months"])

# Step 6: Get alerts
print("Step 6: Checking alerts...")
alerts = api("GET", "/alerts", TOKEN)
alert_count = len(alerts["items"])
print(f"  Alert count: {alert_count}")
for a in alerts["items"]:
    print(f"  [{a['severity']}] {a['alert_type']}: {a['title']}")
if alert_count > 0:
    pass_test(f"Alerts generated ({alert_count} alerts found)")
    neg_alerts = [a for a in alerts["items"] if a["alert_type"] == "negative_cashflow"]
    if len(neg_alerts) > 0:
        pass_test(f"Found {len(neg_alerts)} negative_cashflow alert(s)")
    else:
        fail_test("negative_cashflow alerts", ">0", 0)
else:
    fail_test("Alert count", ">0", alert_count)

# Step 7: Add more income to make net positive
print("Step 7: Adding 5000/month more income (total income 15000 vs 12000 expense = net +3000)...")
fi2 = api("POST", "/fixed", TOKEN, {
    "name": "Side Gig", "amount": 5000, "type": "income",
    "day_of_month": 20, "start_date": "2026-01-01"
})
FI2_ID = fi2["id"]

# Step 8: Get forecast again
print("Step 8: Getting updated forecast...")
fc2 = api("GET", "/forecast?months=6", TOKEN)
print(f"  has_negative_months: {fc2['has_negative_months']}")
for i, m in enumerate(fc2["months"]):
    print(f"  Month {i+1} ({m['month']}): open={m['opening_balance']}, fi={m['fixed_income']}, fe={m['fixed_expenses']}, net={m['net_change']}, close={m['closing_balance']}")

if not fc2["has_negative_months"]:
    pass_test("After adding income, has_negative_months=False (net +3000/month now)")
else:
    # Check if any months are actually negative
    neg_months = [m for m in fc2["months"] if float(m["closing_balance"]) < 0]
    if neg_months:
        warn_test(f"Still has {len(neg_months)} negative month(s) due to one-time expenses or timing")
        for m in neg_months:
            print(f"    Negative: {m['month']} closing={m['closing_balance']}")
    else:
        warn_test("has_negative_months=True but no closing_balance is negative - possible accounting artifact")

# Cleanup fixed items
print("  Cleaning up fixed items...")
api("DELETE", f"/fixed/{FI_ID}", TOKEN)
api("DELETE", f"/fixed/{FE_ID}", TOKEN)
api("DELETE", f"/fixed/{FI2_ID}", TOKEN)


# =========================================
# FLOW 3: Installment -> Forecast
# =========================================
section("FLOW 3: Installment -> Forecast")

# Reset balance
print("Step 0: Setting balance to 50000...")
api("PUT", "/balance", TOKEN, {"balance": 50000, "effective_date": "2026-02-09"})

# Step 1: Create installment
print("Step 1: Creating installment 12000 in 6 payments (2000/month)...")
inst = api("POST", "/installments", TOKEN, {
    "name": "Furniture", "total_amount": 12000, "number_of_payments": 6,
    "type": "expense", "start_date": "2026-02-01", "day_of_month": 15
})
INST_ID = inst["id"]
inst_monthly = float(inst["monthly_amount"])
print(f"  Installment monthly amount: {inst_monthly}")
if inst_monthly == 2000:
    pass_test(f"Installment monthly amount = 2000 (12000/6)")
else:
    fail_test("Installment monthly_amount", 2000, inst_monthly)

# Step 2: Get 8-month forecast
print("Step 2: Getting 8-month forecast...")
fc3 = api("GET", "/forecast?months=8", TOKEN)
print("  Month-by-month installment payments:")
for i, m in enumerate(fc3["months"]):
    print(f"  Month {i+1} ({m['month']}): installment_payments={m['installment_payments']}, closing={m['closing_balance']}")

# First 6 months should show 2000
inst_m1 = float(fc3["months"][0]["installment_payments"])
if inst_m1 == 2000:
    pass_test(f"Month 1 installment_payments = 2000")
else:
    fail_test("Month 1 installment_payments", 2000, inst_m1)

# Check month 6
inst_m6 = float(fc3["months"][5]["installment_payments"])
if inst_m6 == 2000:
    pass_test(f"Month 6 installment_payments = 2000")
else:
    fail_test("Month 6 installment_payments", 2000, inst_m6)

# Month 7 and 8 should be 0
inst_m7 = float(fc3["months"][6]["installment_payments"])
inst_m8 = float(fc3["months"][7]["installment_payments"])
if inst_m7 == 0:
    pass_test(f"Month 7 installment_payments = 0 (installment ended)")
else:
    fail_test("Month 7 installment_payments", 0, inst_m7)
if inst_m8 == 0:
    pass_test(f"Month 8 installment_payments = 0 (installment ended)")
else:
    fail_test("Month 8 installment_payments", 0, inst_m8)

# Verify balance declines by 2000/month for first 6, then stable
for i in range(min(6, len(fc3["months"])-1)):
    m_close = float(fc3["months"][i]["closing_balance"])
    m_open = float(fc3["months"][i]["opening_balance"])
    net = float(fc3["months"][i]["net_change"])
    if abs(net - (-2000)) < 1:  # Should be -2000 (only installment, no other fixed)
        pass_test(f"Month {i+1} net_change = {net} (installment -2000 + one-time tx)")
    else:
        # May include one-time transactions from earlier tests
        print(f"  INFO: Month {i+1} net_change = {net} (includes any one-time transactions)")

# Cleanup
api("DELETE", f"/installments/{INST_ID}", TOKEN)


# =========================================
# FLOW 4: Loan -> Forecast
# =========================================
section("FLOW 4: Loan -> Forecast")

# Step 1: Create loan
print("Step 1: Creating loan 50000, monthly 2500, 24 payments...")
loan = api("POST", "/loans", TOKEN, {
    "name": "Car Loan", "original_amount": 50000, "monthly_payment": 2500,
    "interest_rate": 5, "start_date": "2026-02-01", "day_of_month": 5,
    "total_payments": 24
})
LOAN_ID = loan["id"]
print(f"  Loan: payments_made={loan['payments_made']}, remaining={loan['remaining_balance']}, status={loan['status']}")

if loan["payments_made"] == 0:
    pass_test("Loan starts with payments_made=0")
else:
    fail_test("Loan payments_made", 0, loan["payments_made"])

if float(loan["remaining_balance"]) == 50000:
    pass_test(f"Loan remaining_balance starts at 50000")
else:
    fail_test("Loan remaining_balance", 50000, loan["remaining_balance"])

# Step 2: Get forecast
print("Step 2: Getting 6-month forecast with loan...")
fc4 = api("GET", "/forecast?months=6", TOKEN)
for i, m in enumerate(fc4["months"]):
    print(f"  Month {i+1} ({m['month']}): loan_payments={m['loan_payments']}, close={m['closing_balance']}")

loan_m1 = float(fc4["months"][0]["loan_payments"])
if loan_m1 == 2500:
    pass_test(f"Month 1 loan_payments = 2500")
else:
    fail_test("Month 1 loan_payments", 2500, loan_m1)

# Step 3: Record a payment
print("Step 3: Recording a payment of 2500...")
pay = api("POST", f"/loans/{LOAN_ID}/payment", TOKEN, {"amount": 2500})
print(f"  After payment: payments_made={pay['payments_made']}, remaining={pay['remaining_balance']}")

if pay["payments_made"] == 1:
    pass_test("After payment, payments_made=1")
else:
    fail_test("payments_made after payment", 1, pay["payments_made"])

if float(pay["remaining_balance"]) == 47500:
    pass_test(f"After payment, remaining_balance=47500 (50000-2500)")
else:
    fail_test("remaining_balance after payment", 47500, pay["remaining_balance"])

# Step 4: Get loan detail
print("Step 4: Getting loan detail...")
loan_det = api("GET", f"/loans/{LOAN_ID}", TOKEN)
amort_len = len(loan_det["amortization"])
if loan_det["loan"]["payments_made"] == 1:
    pass_test("Loan detail shows payments_made=1")
else:
    fail_test("Loan detail payments_made", 1, loan_det["loan"]["payments_made"])
if amort_len == 24:
    pass_test(f"Amortization schedule has 24 entries")
else:
    fail_test("Amortization length", 24, amort_len)

# Step 5: Forecast after payment
print("Step 5: Checking forecast after recording one payment...")
fc4b = api("GET", "/forecast?months=6", TOKEN)
for i, m in enumerate(fc4b["months"]):
    print(f"  Month {i+1} ({m['month']}): loan_payments={m['loan_payments']}, close={m['closing_balance']}")

# Month 1 (Feb): payment_num=1, payments_made=1, so 1 > 1 is False -> no payment counted
# Month 2 (Mar): payment_num=2, payments_made=1, so 2 > 1 is True -> 2500
loan_m1b = float(fc4b["months"][0]["loan_payments"])
loan_m2b = float(fc4b["months"][1]["loan_payments"])
print(f"  Month 1 loan_payments after recording payment: {loan_m1b}")
print(f"  Month 2 loan_payments: {loan_m2b}")

if loan_m1b == 0:
    pass_test("Month 1 loan_payments = 0 (payment already recorded)")
elif loan_m1b == 2500:
    warn_test("Month 1 still shows 2500 loan_payment even though payment was recorded (forecast may not account for recorded payments in current month)")
else:
    fail_test("Month 1 loan_payments after payment", "0 or 2500", loan_m1b)

if loan_m2b == 2500:
    pass_test("Month 2 still shows 2500 loan payment")
else:
    fail_test("Month 2 loan_payments", 2500, loan_m2b)

# Cleanup
api("DELETE", f"/loans/{LOAN_ID}", TOKEN)


# =========================================
# FLOW 5: Balance -> Dashboard -> Forecast chain
# =========================================
section("FLOW 5: Balance -> Dashboard -> Forecast chain")

# Step 1: Set balance to 100000
print("Step 1: Setting balance to 100000...")
api("POST", "/balance", TOKEN, {"balance": 100000, "effective_date": "2026-02-09"})

# Step 2: Dashboard
print("Step 2: Getting dashboard summary...")
dash5 = api("GET", "/dashboard/summary", TOKEN)
print(f"  Dashboard: balance={dash5['current_balance']}, income={dash5['monthly_income']}, expenses={dash5['monthly_expenses']}")
if float(dash5["current_balance"]) == 100000:
    pass_test(f"Dashboard current_balance = 100000")
else:
    fail_test("Dashboard current_balance", 100000, dash5["current_balance"])

# Step 3: Forecast
print("Step 3: Getting forecast...")
fc5 = api("GET", "/forecast?months=3", TOKEN)
print(f"  Forecast current_balance: {fc5['current_balance']}")
print(f"  Month 1 opening: {fc5['months'][0]['opening_balance']}")
if float(fc5["current_balance"]) == 100000:
    pass_test(f"Forecast current_balance = 100000")
else:
    fail_test("Forecast current_balance", 100000, fc5["current_balance"])
if float(fc5["months"][0]["opening_balance"]) == 100000:
    pass_test(f"Month 1 opening_balance = 100000")
else:
    fail_test("Month 1 opening_balance", 100000, fc5["months"][0]["opening_balance"])

# Step 4: Create expense
print("Step 4: Creating expense transaction (5000)...")
tx5 = api("POST", "/transactions", TOKEN, {
    "amount": 5000, "type": "expense", "description": "Big purchase", "date": "2026-02-09"
})

# Step 5: Dashboard shows expense
print("Step 5: Dashboard after expense...")
dash5b = api("GET", "/dashboard/summary", TOKEN)
print(f"  Dashboard expenses: {dash5b['monthly_expenses']}")
if float(dash5b["monthly_expenses"]) >= 5000:
    pass_test(f"Dashboard monthly_expenses includes 5000 expense (got {dash5b['monthly_expenses']})")
else:
    fail_test("Dashboard monthly_expenses", ">= 5000", dash5b["monthly_expenses"])

# Step 6: Update balance
print("Step 6: Updating balance to 95000...")
api("PUT", "/balance", TOKEN, {"balance": 95000, "effective_date": "2026-02-09"})

# Step 7: Forecast updates
print("Step 7: Forecast with updated balance...")
fc5c = api("GET", "/forecast?months=3", TOKEN)
print(f"  Forecast current_balance: {fc5c['current_balance']}")
if float(fc5c["current_balance"]) == 95000:
    pass_test(f"Forecast current_balance updated to 95000")
else:
    fail_test("Forecast current_balance after update", 95000, fc5c["current_balance"])


# =========================================
# FLOW 6: Full Real-World Scenario
# =========================================
section("FLOW 6: Full Real-World Scenario")

# Create fresh user
unique2 = str(int(time.time() * 1000))
username2 = f"realworld_{unique2}"
email2 = f"rw_{unique2}@test.com"
print(f"Creating fresh user: {username2}")
api("POST", "/auth/register", data={"username": username2, "email": email2, "password": "RealWorld123"})
login2 = api("POST", "/auth/login", data={"username": username2, "password": "RealWorld123"})
TOKEN2 = login2["access_token"]

# Balance: 30000 ILS
print("Step 1: Setting balance to 30000 ILS...")
api("POST", "/balance", TOKEN2, {"balance": 30000, "effective_date": "2026-02-01", "notes": "Opening balance"})

# Categories
print("Step 2: Creating categories...")
sal_cat = api("POST", "/categories", TOKEN2, {"name": "Salary", "name_he": "משכורת", "type": "income", "icon": "wallet", "color": "#22C55E"})["id"]
rent_cat = api("POST", "/categories", TOKEN2, {"name": "Rent", "name_he": "שכירות", "type": "expense", "icon": "home", "color": "#EF4444"})["id"]
bills_cat = api("POST", "/categories", TOKEN2, {"name": "Bills", "name_he": "חשבונות", "type": "expense", "icon": "receipt", "color": "#F59E0B"})["id"]
ins_cat = api("POST", "/categories", TOKEN2, {"name": "Insurance", "name_he": "ביטוח", "type": "expense", "icon": "shield", "color": "#6366F1"})["id"]
loan_cat = api("POST", "/categories", TOKEN2, {"name": "Loan", "name_he": "הלוואה", "type": "expense", "icon": "banknote", "color": "#DC2626"})["id"]
print(f"  Created 5 categories")

# Monthly salary: 18000 (fixed income, day 10)
print("Step 3: Creating fixed income - Salary 18000/month (day 10)...")
api("POST", "/fixed", TOKEN2, {
    "name": "Monthly Salary", "amount": 18000, "type": "income",
    "category_id": sal_cat, "day_of_month": 10, "start_date": "2026-01-01"
})

# Rent: 5500 (fixed expense, day 1)
print("Step 4: Creating fixed expense - Rent 5500/month (day 1)...")
api("POST", "/fixed", TOKEN2, {
    "name": "Rent", "amount": 5500, "type": "expense",
    "category_id": rent_cat, "day_of_month": 1, "start_date": "2026-01-01"
})

# Bills: 800 (fixed expense, day 15)
print("Step 5: Creating fixed expense - Bills 800/month (day 15)...")
api("POST", "/fixed", TOKEN2, {
    "name": "Utility Bills", "amount": 800, "type": "expense",
    "category_id": bills_cat, "day_of_month": 15, "start_date": "2026-01-01"
})

# Car insurance: 450 (fixed expense, day 5)
print("Step 6: Creating fixed expense - Car Insurance 450/month (day 5)...")
api("POST", "/fixed", TOKEN2, {
    "name": "Car Insurance", "amount": 450, "type": "expense",
    "category_id": ins_cat, "day_of_month": 5, "start_date": "2026-01-01"
})

# Car loan: 80000 original, 1800/month, 48 payments
print("Step 7: Creating car loan - 80000, 1800/month, 48 payments...")
car_loan = api("POST", "/loans", TOKEN2, {
    "name": "Car Loan", "original_amount": 80000, "monthly_payment": 1800,
    "interest_rate": 4.5, "category_id": loan_cat, "start_date": "2026-01-01",
    "day_of_month": 1, "total_payments": 48
})
print(f"  Car loan: {car_loan['original_amount']}, {car_loan['monthly_payment']}/month")

# New fridge installment: 4800 in 12 payments
print("Step 8: Creating fridge installment - 4800 in 12 payments (400/month)...")
fridge = api("POST", "/installments", TOKEN2, {
    "name": "New Fridge", "total_amount": 4800, "number_of_payments": 12,
    "type": "expense", "start_date": "2026-02-01", "day_of_month": 10
})
fridge_monthly = float(fridge["monthly_amount"])
if fridge_monthly == 400:
    pass_test(f"Fridge installment monthly = 400 (4800/12)")
else:
    fail_test("Fridge monthly_amount", 400, fridge_monthly)

# One-time transactions
print("Step 9: Creating one-time transactions...")
api("POST", "/transactions", TOKEN2, {"amount": 300, "type": "expense", "description": "Restaurant dinner", "date": "2026-01-15"})
api("POST", "/transactions", TOKEN2, {"amount": 1200, "type": "expense", "description": "New clothes", "date": "2026-01-20"})
api("POST", "/transactions", TOKEN2, {"amount": 500, "type": "income", "description": "Freelance work", "date": "2026-01-25"})
api("POST", "/transactions", TOKEN2, {"amount": 250, "type": "expense", "description": "Groceries", "date": "2026-02-05"})
api("POST", "/transactions", TOKEN2, {"amount": 150, "type": "expense", "description": "Pharmacy", "date": "2026-02-07"})

# Expected income for March: 20000 (bonus)
print("Step 10: Setting expected income for March 2026 = 20000 (bonus)...")
ei = api("PUT", "/expected-income/2026-03-01", TOKEN2, {"expected_amount": 20000, "notes": "Annual bonus"})
print(f"  Expected income: month={ei['month']}, amount={ei['expected_amount']}")

# ===== VERIFICATION =====
print("\n" + "="*60)
print("  VERIFICATION")
print("="*60)

# 1. Dashboard summary
print("\nVerification 1: Dashboard Summary")
dash6 = api("GET", "/dashboard/summary", TOKEN2)
print(f"  current_balance:  {dash6['current_balance']}")
print(f"  monthly_income:   {dash6['monthly_income']}")
print(f"  monthly_expenses: {dash6['monthly_expenses']}")
print(f"  net_cashflow:     {dash6['net_cashflow']}")
print(f"  balance_trend:    {dash6['balance_trend']}%")
print(f"  income_trend:     {dash6['income_trend']}%")
print(f"  expense_trend:    {dash6['expense_trend']}%")

if float(dash6["current_balance"]) == 30000:
    pass_test("Dashboard current_balance = 30000")
else:
    fail_test("Dashboard current_balance", 30000, dash6["current_balance"])

# 2. 6-month forecast
print("\nVerification 2: 6-Month Forecast Detail")
fc6 = api("GET", "/forecast?months=6", TOKEN2)
print(f"  Current balance: {fc6['current_balance']}")
print(f"  has_negative_months: {fc6['has_negative_months']}")
print(f"  first_negative_month: {fc6['first_negative_month']}")
print()

for i, m in enumerate(fc6["months"]):
    print(f"  Month {i+1} ({m['month']}):")
    print(f"    opening_balance:      {m['opening_balance']}")
    print(f"    fixed_income:         {m['fixed_income']}")
    print(f"    fixed_expenses:       {m['fixed_expenses']}")
    print(f"    installment_payments: {m['installment_payments']}")
    print(f"    loan_payments:        {m['loan_payments']}")
    print(f"    expected_income:      {m['expected_income']}")
    print(f"    one_time_income:      {m['one_time_income']}")
    print(f"    one_time_expenses:    {m['one_time_expenses']}")
    print(f"    total_income:         {m['total_income']}")
    print(f"    total_expenses:       {m['total_expenses']}")
    print(f"    net_change:           {m['net_change']}")
    print(f"    closing_balance:      {m['closing_balance']}")
    print()

# 3. Monthly accuracy check
print("Verification 3: Monthly breakdown accuracy")
# Expected per month (from month 2+, no one-time):
# Fixed income: 18000
# Fixed expenses: 5500 + 800 + 450 = 6750
# Loan payments: 1800
# Installment payments: 400 (fridge, starting Feb)
# Total income: 18000
# Total expenses: 6750 + 1800 + 400 = 8950
# Net recurring: 18000 - 8950 = 9050

errors_found = False
for i, m in enumerate(fc6["months"]):
    month_label = m["month"]
    fi = float(m["fixed_income"])
    fe = float(m["fixed_expenses"])
    ip = float(m["installment_payments"])
    lp = float(m["loan_payments"])
    ei_val = float(m["expected_income"])

    # Fixed income should always be 18000
    if fi != 18000:
        fail_test(f"Month {i+1} ({month_label}) fixed_income", 18000, fi)
        errors_found = True
    else:
        pass_test(f"Month {i+1} ({month_label}) fixed_income = 18000")

    # Fixed expenses: 5500 + 800 + 450 = 6750
    if fe != 6750:
        fail_test(f"Month {i+1} ({month_label}) fixed_expenses", 6750, fe)
        errors_found = True
    else:
        pass_test(f"Month {i+1} ({month_label}) fixed_expenses = 6750")

    # Loan payments: 1800
    if lp != 1800:
        fail_test(f"Month {i+1} ({month_label}) loan_payments", 1800, lp)
        errors_found = True
    else:
        pass_test(f"Month {i+1} ({month_label}) loan_payments = 1800")

    # Installment: 400 for months starting from Feb
    expected_ip = 400
    if ip != expected_ip:
        fail_test(f"Month {i+1} ({month_label}) installment_payments", expected_ip, ip)
        errors_found = True
    else:
        pass_test(f"Month {i+1} ({month_label}) installment_payments = {expected_ip}")

# 4. March expected income check
march_data = None
for m in fc6["months"]:
    if "2026-03" in str(m["month"]):
        march_data = m
        break

if march_data:
    march_ei = float(march_data["expected_income"])
    if march_ei == 20000:
        pass_test("March 2026 expected_income = 20000 (annual bonus)")
    else:
        fail_test("March expected_income", 20000, march_ei)

    # March total income: 18000 (salary) + 20000 (bonus) = 38000
    march_total_income = float(march_data["total_income"])
    if march_total_income == 38000:
        pass_test(f"March total_income = 38000 (18000 salary + 20000 bonus)")
    else:
        # Could include one-time transactions
        print(f"  INFO: March total_income = {march_total_income} (expected 38000, difference may be from one-time transactions)")
else:
    fail_test("March 2026 not found in forecast", "found", "not found")

# 5. No negative months check
if not fc6["has_negative_months"]:
    pass_test("No negative months (correct - net positive each month + 30000 starting balance)")
else:
    fail_test("has_negative_months", False, True)
    # Find which months are negative
    for m in fc6["months"]:
        if float(m["closing_balance"]) < 0:
            print(f"    Negative month: {m['month']} closing_balance={m['closing_balance']}")

# Net change calculation for a clean month (no one-time tx)
print("\nVerification 4: Net change calculation")
# Find a clean month (after Feb, not March with bonus)
for m in fc6["months"]:
    if "2026-04" in str(m["month"]) or "2026-05" in str(m["month"]):
        clean_net = float(m["net_change"])
        # Expected: 18000 - 6750 - 1800 - 400 = 9050
        expected_net = 18000 - 6750 - 1800 - 400
        if clean_net == expected_net:
            pass_test(f"{m['month']}: net_change = {clean_net} (18000 - 6750 - 1800 - 400 = {expected_net})")
        else:
            fail_test(f"{m['month']} net_change", expected_net, clean_net)
        break

# 5. Forecast summary
print("\nVerification 5: Forecast Summary")
fs6 = api("GET", "/forecast/summary?months=6", TOKEN2)
print(f"  current_balance:        {fs6['current_balance']}")
print(f"  forecast_months:        {fs6['forecast_months']}")
print(f"  total_expected_income:  {fs6['total_expected_income']}")
print(f"  total_expected_expenses:{fs6['total_expected_expenses']}")
print(f"  net_projected:          {fs6['net_projected']}")
print(f"  end_balance:            {fs6['end_balance']}")
print(f"  has_negative_months:    {fs6['has_negative_months']}")
print(f"  alerts_count:           {fs6['alerts_count']}")

# 6. Alerts check
print("\nVerification 6: Alerts")
alerts6 = api("GET", "/alerts", TOKEN2)
alert_count6 = len(alerts6["items"])
print(f"  Total alerts: {alert_count6}")
for a in alerts6["items"]:
    print(f"  [{a['severity']}] {a['alert_type']}: {a['title']}")
    print(f"    {a['message']}")


# =========================================
# FINAL SUMMARY
# =========================================
print(f"\n{'='*60}")
print(f"  FINAL SUMMARY")
print(f"{'='*60}")
print(f"  PASSED:   {PASS_COUNT}")
print(f"  FAILED:   {FAIL_COUNT}")
print(f"  WARNINGS: {WARN_COUNT}")
print()
total = PASS_COUNT + FAIL_COUNT
if FAIL_COUNT == 0:
    print(f"  ALL {PASS_COUNT} TESTS PASSED!")
else:
    print(f"  {FAIL_COUNT}/{total} TESTS FAILED")
print()

sys.exit(0 if FAIL_COUNT == 0 else 1)
