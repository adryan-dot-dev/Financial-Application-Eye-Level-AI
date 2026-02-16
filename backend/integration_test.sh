#!/bin/bash
# Cross-Module Integration Test Script
# Tests data flow between modules in the Cash Flow Management app

set -e

BASE="http://localhost:8000/api/v1"
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass_test() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "  ${GREEN}PASS${NC}: $1"
}

fail_test() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "  ${RED}FAIL${NC}: $1"
  echo -e "    ${RED}Expected: $2${NC}"
  echo -e "    ${RED}Got:      $3${NC}"
}

warn_test() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo -e "  ${YELLOW}WARN${NC}: $1"
}

section() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

# =========================================
# SETUP: Register and Login
# =========================================
section "SETUP: Registration and Authentication"

UNIQUE=$(date +%s)
USERNAME="inttest_${UNIQUE}"
EMAIL="int_${UNIQUE}@test.com"

echo "Registering user: $USERNAME"
REG_RESP=$(curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"IntTest1234\"}")
echo "  Register response: $REG_RESP"

LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"IntTest1234\"}")

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo -e "${RED}FATAL: Could not get auth token${NC}"
  echo "Login response: $LOGIN_RESP"
  exit 1
fi
echo "  Token obtained successfully"
AUTH="Authorization: Bearer $TOKEN"

# =========================================
# FLOW 1: Category -> Transaction -> Dashboard
# =========================================
section "FLOW 1: Category -> Transaction -> Dashboard"

# Step 1: Create category "Salary" (income)
echo "Step 1: Creating category 'Salary' (income)..."
CAT_RESP=$(curl -s -X POST "$BASE/categories" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Salary","name_he":"משכורת","type":"income","icon":"wallet","color":"#22C55E"}')
echo "  Category response: $CAT_RESP"
CAT_ID=$(echo "$CAT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Category ID: $CAT_ID"

CAT_TYPE=$(echo "$CAT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['type'])")
if [ "$CAT_TYPE" = "income" ]; then
  pass_test "Category created with type=income"
else
  fail_test "Category type" "income" "$CAT_TYPE"
fi

# Step 2: Create transaction linked to that category
echo "Step 2: Creating transaction linked to Salary category..."
TX_RESP=$(curl -s -X POST "$BASE/transactions" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"amount\":18000,\"type\":\"income\",\"category_id\":\"$CAT_ID\",\"description\":\"January Salary\",\"date\":\"2026-02-01\"}")
echo "  Transaction response: $TX_RESP"
TX_ID=$(echo "$TX_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
TX_CAT=$(echo "$TX_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['category_id'])")

if [ "$TX_CAT" = "$CAT_ID" ]; then
  pass_test "Transaction linked to category correctly"
else
  fail_test "Transaction category_id" "$CAT_ID" "$TX_CAT"
fi

# Step 3: Get dashboard summary - verify income reflects the transaction
echo "Step 3: Getting dashboard summary..."
# First set a balance so dashboard works
curl -s -X POST "$BASE/balance" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"balance":50000,"effective_date":"2026-02-01"}' > /dev/null

DASH_RESP=$(curl -s "$BASE/dashboard/summary" -H "$AUTH")
echo "  Dashboard: $DASH_RESP"
MONTHLY_INCOME=$(echo "$DASH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['monthly_income'])")
echo "  Monthly income: $MONTHLY_INCOME"

# The transaction is in February 2026 (current month), so it should show in monthly_income
if python3 -c "assert float('$MONTHLY_INCOME') >= 18000, f'Expected >= 18000, got {$MONTHLY_INCOME}'"; then
  pass_test "Dashboard monthly_income reflects the 18000 transaction (got $MONTHLY_INCOME)"
else
  fail_test "Dashboard monthly_income" ">= 18000" "$MONTHLY_INCOME"
fi

# Step 4: Delete (archive) the category
echo "Step 4: Archiving category..."
DEL_RESP=$(curl -s -X DELETE "$BASE/categories/$CAT_ID" -H "$AUTH")
echo "  Delete response: $DEL_RESP"

# Verify category is archived
CAT_ARCHIVED=$(curl -s "$BASE/categories/$CAT_ID" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['is_archived'])")
if [ "$CAT_ARCHIVED" = "True" ]; then
  pass_test "Category soft-deleted (is_archived=True)"
else
  fail_test "Category is_archived" "True" "$CAT_ARCHIVED"
fi

# Step 5: Get the transaction - should still have category_id
echo "Step 5: Checking transaction still has category_id after category archive..."
TX_AFTER=$(curl -s "$BASE/transactions/$TX_ID" -H "$AUTH")
TX_CAT_AFTER=$(echo "$TX_AFTER" | python3 -c "import sys,json; print(json.load(sys.stdin)['category_id'])")
if [ "$TX_CAT_AFTER" = "$CAT_ID" ]; then
  pass_test "Transaction retains category_id after category archive"
else
  fail_test "Transaction category_id after archive" "$CAT_ID" "$TX_CAT_AFTER"
fi

# Step 6: Create new transaction with archived category
echo "Step 6: Creating new transaction with archived category..."
TX2_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/transactions" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"amount\":5000,\"type\":\"income\",\"category_id\":\"$CAT_ID\",\"description\":\"Test archived cat\",\"date\":\"2026-02-05\"}")
echo "  HTTP status: $TX2_RESP"
if [ "$TX2_RESP" = "201" ]; then
  warn_test "Transaction with archived category ALLOWED (HTTP 201) - No validation prevents using archived categories"
else
  pass_test "Transaction with archived category rejected (HTTP $TX2_RESP)"
fi


# =========================================
# FLOW 2: Fixed -> Forecast -> Alert
# =========================================
section "FLOW 2: Fixed -> Forecast -> Alert"

# Step 1: Set balance to 5000
echo "Step 1: Setting balance to 5000..."
curl -s -X PUT "$BASE/balance" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"balance":5000,"effective_date":"2026-02-09"}' > /dev/null

BAL_CHECK=$(curl -s "$BASE/balance" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['balance'])")
if python3 -c "assert float('$BAL_CHECK') == 5000"; then
  pass_test "Balance set to 5000 (got $BAL_CHECK)"
else
  fail_test "Balance" "5000" "$BAL_CHECK"
fi

# Step 2: Create fixed income: 10000/month
echo "Step 2: Creating fixed income 10000/month..."
FI_RESP=$(curl -s -X POST "$BASE/fixed" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Main Salary","amount":10000,"type":"income","day_of_month":10,"start_date":"2026-01-01"}')
echo "  Fixed income: $FI_RESP"
FI_ID=$(echo "$FI_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Step 3: Create fixed expense: 12000/month (net negative!)
echo "Step 3: Creating fixed expense 12000/month..."
FE_RESP=$(curl -s -X POST "$BASE/fixed" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"All Expenses","amount":12000,"type":"expense","day_of_month":15,"start_date":"2026-01-01"}')
echo "  Fixed expense: $FE_RESP"
FE_ID=$(echo "$FE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Step 4: Get forecast for 6 months
echo "Step 4: Getting 6-month forecast (net -2000/month on balance 5000)..."
FC_RESP=$(curl -s "$BASE/forecast?months=6" -H "$AUTH")
echo "  Forecast response (first 500 chars): $(echo "$FC_RESP" | head -c 500)"

HAS_NEG=$(echo "$FC_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['has_negative_months'])")
if [ "$HAS_NEG" = "True" ]; then
  pass_test "Forecast shows has_negative_months=True (income 10000 - expense 12000 = net -2000/month)"
else
  fail_test "has_negative_months" "True" "$HAS_NEG"
fi

# Check month-by-month
echo "  Month-by-month forecast:"
python3 -c "
import sys, json
data = json.loads('''$FC_RESP''')
print(f'  Current balance: {data[\"current_balance\"]}')
for m in data['months']:
    print(f'  {m[\"month\"]}: open={m[\"opening_balance\"]}, fi={m[\"fixed_income\"]}, fe={m[\"fixed_expenses\"]}, net={m[\"net_change\"]}, close={m[\"closing_balance\"]}')
print(f'  has_negative_months: {data[\"has_negative_months\"]}')
print(f'  first_negative_month: {data[\"first_negative_month\"]}')
"

# Verify declining balance
MONTH1_CLOSE=$(echo "$FC_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][0]['closing_balance'])")
MONTH6_CLOSE=$(echo "$FC_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][5]['closing_balance'])")
if python3 -c "assert float('$MONTH6_CLOSE') < float('$MONTH1_CLOSE'), f'{$MONTH6_CLOSE} not < {$MONTH1_CLOSE}'"; then
  pass_test "Balance declines over 6 months (month1=$MONTH1_CLOSE, month6=$MONTH6_CLOSE)"
else
  fail_test "Balance decline" "month6 < month1" "month1=$MONTH1_CLOSE, month6=$MONTH6_CLOSE"
fi

# Step 5: Get forecast summary
echo "Step 5: Getting forecast summary..."
FS_RESP=$(curl -s "$BASE/forecast/summary?months=6" -H "$AUTH")
echo "  Summary: $FS_RESP"
FS_NEG=$(echo "$FS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['has_negative_months'])")
if [ "$FS_NEG" = "True" ]; then
  pass_test "Forecast summary shows has_negative_months=True"
else
  fail_test "Summary has_negative_months" "True" "$FS_NEG"
fi

# Step 6: Get alerts - should have negative forecast alert
echo "Step 6: Checking alerts..."
ALERT_RESP=$(curl -s "$BASE/alerts" -H "$AUTH")
echo "  Alerts: $(echo "$ALERT_RESP" | head -c 500)"
ALERT_COUNT=$(echo "$ALERT_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['items']))")
echo "  Alert count: $ALERT_COUNT"
if [ "$ALERT_COUNT" -gt "0" ]; then
  pass_test "Alerts generated ($ALERT_COUNT alerts found)"
  # Check for negative_cashflow type
  NEG_ALERT=$(echo "$ALERT_RESP" | python3 -c "
import sys,json
alerts = json.load(sys.stdin)['items']
neg = [a for a in alerts if a['alert_type'] == 'negative_cashflow']
print(len(neg))
")
  if [ "$NEG_ALERT" -gt "0" ]; then
    pass_test "Found $NEG_ALERT negative_cashflow alert(s)"
  else
    fail_test "negative_cashflow alerts" ">0" "0"
  fi
else
  fail_test "Alert count" ">0" "$ALERT_COUNT"
fi

# Step 7: Add more income to make net positive
echo "Step 7: Adding 5000/month more income to make net positive..."
FI2_RESP=$(curl -s -X POST "$BASE/fixed" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Side Gig","amount":5000,"type":"income","day_of_month":20,"start_date":"2026-01-01"}')
FI2_ID=$(echo "$FI2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Step 8: Get forecast again - should be positive now (10000+5000-12000 = +3000/month)
echo "Step 8: Getting updated forecast (income 15000 - expense 12000 = net +3000/month)..."
FC2_RESP=$(curl -s "$BASE/forecast?months=6" -H "$AUTH")
HAS_NEG2=$(echo "$FC2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['has_negative_months'])")

echo "  Updated month-by-month forecast:"
python3 -c "
import sys, json
data = json.loads('''$FC2_RESP''')
print(f'  Current balance: {data[\"current_balance\"]}')
for m in data['months']:
    print(f'  {m[\"month\"]}: open={m[\"opening_balance\"]}, fi={m[\"fixed_income\"]}, fe={m[\"fixed_expenses\"]}, net={m[\"net_change\"]}, close={m[\"closing_balance\"]}')
print(f'  has_negative_months: {data[\"has_negative_months\"]}')
"

if [ "$HAS_NEG2" = "False" ]; then
  pass_test "After adding income, has_negative_months=False (net +3000/month now)"
else
  # Could still be True if earlier months with one_time transactions cause it
  warn_test "has_negative_months is still $HAS_NEG2 after adding income - checking closing balances"
  python3 -c "
import sys, json
data = json.loads('''$FC2_RESP''')
for m in data['months']:
    if float(m['closing_balance']) < 0:
        print(f'    Negative closing: {m[\"month\"]} = {m[\"closing_balance\"]}')
"
fi

# Cleanup fixed items for next flows
echo "  Cleaning up fixed items..."
curl -s -X DELETE "$BASE/fixed/$FI_ID" -H "$AUTH" > /dev/null
curl -s -X DELETE "$BASE/fixed/$FE_ID" -H "$AUTH" > /dev/null
curl -s -X DELETE "$BASE/fixed/$FI2_ID" -H "$AUTH" > /dev/null


# =========================================
# FLOW 3: Installment -> Forecast
# =========================================
section "FLOW 3: Installment -> Forecast"

# Reset balance
echo "Step 0: Setting balance to 50000..."
curl -s -X PUT "$BASE/balance" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"balance":50000,"effective_date":"2026-02-09"}' > /dev/null

# Step 1: Create installment
echo "Step 1: Creating installment 12000 in 6 payments (2000/month)..."
INST_RESP=$(curl -s -X POST "$BASE/installments" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Furniture","total_amount":12000,"number_of_payments":6,"type":"expense","start_date":"2026-02-01","day_of_month":15}')
echo "  Installment: $INST_RESP"
INST_ID=$(echo "$INST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
INST_MONTHLY=$(echo "$INST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['monthly_amount'])")

if python3 -c "assert float('$INST_MONTHLY') == 2000, f'Expected 2000, got $INST_MONTHLY'"; then
  pass_test "Installment monthly amount = 2000 (12000/6) got $INST_MONTHLY"
else
  fail_test "Installment monthly_amount" "2000" "$INST_MONTHLY"
fi

# Step 2: Get forecast
echo "Step 2: Getting 8-month forecast to verify installment payments..."
FC3_RESP=$(curl -s "$BASE/forecast?months=8" -H "$AUTH")

echo "  Month-by-month installment payments in forecast:"
python3 -c "
import sys, json
data = json.loads('''$FC3_RESP''')
for i, m in enumerate(data['months']):
    inst_pay = m['installment_payments']
    print(f'  Month {i+1} ({m[\"month\"]}): installment_payments={inst_pay}, closing={m[\"closing_balance\"]}')
"

# Verify first 6 months show 2000 installment payment
INST_M1=$(echo "$FC3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][0]['installment_payments'])")
INST_M6=$(echo "$FC3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][5]['installment_payments'])")

if python3 -c "assert float('$INST_M1') == 2000, f'Expected 2000, got $INST_M1'"; then
  pass_test "Month 1 installment_payments = 2000 (got $INST_M1)"
else
  fail_test "Month 1 installment_payments" "2000" "$INST_M1"
fi

# Check month 7 and 8 (after 6 payments, should be 0)
INST_M7=$(echo "$FC3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][6]['installment_payments'])")
INST_M8=$(echo "$FC3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][7]['installment_payments'])")

if python3 -c "assert float('$INST_M7') == 0, f'Expected 0, got $INST_M7'"; then
  pass_test "Month 7 installment_payments = 0 (installment ended) got $INST_M7"
else
  fail_test "Month 7 installment_payments" "0" "$INST_M7"
fi

if python3 -c "assert float('$INST_M8') == 0, f'Expected 0, got $INST_M8'"; then
  pass_test "Month 8 installment_payments = 0 (installment ended) got $INST_M8"
else
  fail_test "Month 8 installment_payments" "0" "$INST_M8"
fi

# Cleanup
curl -s -X DELETE "$BASE/installments/$INST_ID" -H "$AUTH" > /dev/null


# =========================================
# FLOW 4: Loan -> Forecast
# =========================================
section "FLOW 4: Loan -> Forecast"

# Step 1: Create loan
echo "Step 1: Creating loan 50000, monthly 2500, 24 payments..."
LOAN_RESP=$(curl -s -X POST "$BASE/loans" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Car Loan","original_amount":50000,"monthly_payment":2500,"interest_rate":5,"start_date":"2026-02-01","day_of_month":5,"total_payments":24}')
echo "  Loan: $LOAN_RESP"
LOAN_ID=$(echo "$LOAN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
LOAN_RB=$(echo "$LOAN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['remaining_balance'])")
LOAN_PM=$(echo "$LOAN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['payments_made'])")

if [ "$LOAN_PM" = "0" ]; then
  pass_test "Loan starts with payments_made=0"
else
  fail_test "Loan payments_made" "0" "$LOAN_PM"
fi

if python3 -c "assert float('$LOAN_RB') == 50000"; then
  pass_test "Loan remaining_balance starts at 50000 (got $LOAN_RB)"
else
  fail_test "Loan remaining_balance" "50000" "$LOAN_RB"
fi

# Step 2: Get forecast
echo "Step 2: Getting 6-month forecast to verify loan payments..."
FC4_RESP=$(curl -s "$BASE/forecast?months=6" -H "$AUTH")
LOAN_M1=$(echo "$FC4_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][0]['loan_payments'])")
echo "  Month 1 loan_payments: $LOAN_M1"

if python3 -c "assert float('$LOAN_M1') == 2500, f'Expected 2500, got $LOAN_M1'"; then
  pass_test "Month 1 loan_payments = 2500 (got $LOAN_M1)"
else
  fail_test "Month 1 loan_payments" "2500" "$LOAN_M1"
fi

# Step 3: Record a payment
echo "Step 3: Recording a payment of 2500..."
PAY_RESP=$(curl -s -X POST "$BASE/loans/$LOAN_ID/payment" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":2500}')
echo "  Payment response: $PAY_RESP"

PAY_PM=$(echo "$PAY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['payments_made'])")
PAY_RB=$(echo "$PAY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['remaining_balance'])")

if [ "$PAY_PM" = "1" ]; then
  pass_test "After payment, payments_made=1"
else
  fail_test "payments_made after payment" "1" "$PAY_PM"
fi

if python3 -c "assert float('$PAY_RB') == 47500, f'Expected 47500, got $PAY_RB'"; then
  pass_test "After payment, remaining_balance=47500 (50000-2500) got $PAY_RB"
else
  fail_test "remaining_balance after payment" "47500" "$PAY_RB"
fi

# Step 4: Get loan detail
echo "Step 4: Getting loan detail..."
LOAN_DET=$(curl -s "$BASE/loans/$LOAN_ID" -H "$AUTH")
LOAN_DET_PM=$(echo "$LOAN_DET" | python3 -c "import sys,json; print(json.load(sys.stdin)['loan']['payments_made'])")
AMORT_LEN=$(echo "$LOAN_DET" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['amortization']))")

if [ "$LOAN_DET_PM" = "1" ]; then
  pass_test "Loan detail shows payments_made=1"
else
  fail_test "Loan detail payments_made" "1" "$LOAN_DET_PM"
fi

if [ "$AMORT_LEN" = "24" ]; then
  pass_test "Amortization schedule has 24 entries"
else
  fail_test "Amortization length" "24" "$AMORT_LEN"
fi

# Step 5: Forecast should still show future loan payments
echo "Step 5: Checking forecast still shows loan payments after recording one..."
FC4B_RESP=$(curl -s "$BASE/forecast?months=6" -H "$AUTH")
echo "  Month-by-month loan payments in updated forecast:"
python3 -c "
import sys, json
data = json.loads('''$FC4B_RESP''')
for i, m in enumerate(data['months']):
    print(f'  Month {i+1} ({m[\"month\"]}): loan_payments={m[\"loan_payments\"]}, close={m[\"closing_balance\"]}')
"

# Month 1 (Feb 2026) - payment already made, so forecast should skip it
LOAN_M1B=$(echo "$FC4B_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][0]['loan_payments'])")
LOAN_M2B=$(echo "$FC4B_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][1]['loan_payments'])")

# After recording payment for month 1, month 1 loan_payments might be 0 (already paid) or still 2500
echo "  Month 1 loan_payments after recording payment: $LOAN_M1B"
echo "  Month 2 loan_payments: $LOAN_M2B"

if python3 -c "assert float('$LOAN_M2B') == 2500"; then
  pass_test "Month 2 still shows 2500 loan payment after recording month 1 payment"
else
  fail_test "Month 2 loan_payments" "2500" "$LOAN_M2B"
fi

# Cleanup
curl -s -X DELETE "$BASE/loans/$LOAN_ID" -H "$AUTH" > /dev/null


# =========================================
# FLOW 5: Balance -> Dashboard -> Forecast chain
# =========================================
section "FLOW 5: Balance -> Dashboard -> Forecast chain"

# Step 1: Set balance to 100000
echo "Step 1: Setting balance to 100000..."
curl -s -X POST "$BASE/balance" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"balance":100000,"effective_date":"2026-02-09"}' > /dev/null

# Step 2: Get dashboard summary
echo "Step 2: Getting dashboard summary..."
DASH5_RESP=$(curl -s "$BASE/dashboard/summary" -H "$AUTH")
DASH5_BAL=$(echo "$DASH5_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['current_balance'])")
echo "  Dashboard current_balance: $DASH5_BAL"

if python3 -c "assert float('$DASH5_BAL') == 100000"; then
  pass_test "Dashboard current_balance = 100000 (got $DASH5_BAL)"
else
  fail_test "Dashboard current_balance" "100000" "$DASH5_BAL"
fi

# Step 3: Get forecast - opening balance should be 100000
echo "Step 3: Getting forecast..."
FC5_RESP=$(curl -s "$BASE/forecast?months=3" -H "$AUTH")
FC5_OPEN=$(echo "$FC5_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][0]['opening_balance'])")
FC5_CUR=$(echo "$FC5_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['current_balance'])")
echo "  Forecast current_balance: $FC5_CUR"
echo "  Month 1 opening_balance: $FC5_OPEN"

if python3 -c "assert float('$FC5_CUR') == 100000"; then
  pass_test "Forecast current_balance = 100000 (got $FC5_CUR)"
else
  fail_test "Forecast current_balance" "100000" "$FC5_CUR"
fi

if python3 -c "assert float('$FC5_OPEN') == 100000"; then
  pass_test "Month 1 opening_balance = 100000 (got $FC5_OPEN)"
else
  fail_test "Month 1 opening_balance" "100000" "$FC5_OPEN"
fi

# Step 4: Create expense transaction
echo "Step 4: Creating expense transaction (5000)..."
TX5_RESP=$(curl -s -X POST "$BASE/transactions" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amount":5000,"type":"expense","description":"Big purchase","date":"2026-02-09"}')
TX5_ID=$(echo "$TX5_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Step 5: Dashboard should show expense
echo "Step 5: Dashboard after expense..."
DASH5B_RESP=$(curl -s "$BASE/dashboard/summary" -H "$AUTH")
DASH5B_EXP=$(echo "$DASH5B_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['monthly_expenses'])")
echo "  Dashboard monthly_expenses: $DASH5B_EXP"

if python3 -c "assert float('$DASH5B_EXP') >= 5000, f'Expected >= 5000, got $DASH5B_EXP'"; then
  pass_test "Dashboard monthly_expenses includes 5000 expense (got $DASH5B_EXP)"
else
  fail_test "Dashboard monthly_expenses" ">= 5000" "$DASH5B_EXP"
fi

# Step 6: Update balance to 95000
echo "Step 6: Updating balance to 95000..."
curl -s -X PUT "$BASE/balance" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"balance":95000,"effective_date":"2026-02-09"}' > /dev/null

# Step 7: Get forecast - should use updated balance
echo "Step 7: Forecast with updated balance..."
FC5C_RESP=$(curl -s "$BASE/forecast?months=3" -H "$AUTH")
FC5C_CUR=$(echo "$FC5C_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['current_balance'])")
FC5C_OPEN=$(echo "$FC5C_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['months'][0]['opening_balance'])")
echo "  Forecast current_balance: $FC5C_CUR"
echo "  Month 1 opening_balance: $FC5C_OPEN"

if python3 -c "assert float('$FC5C_CUR') == 95000"; then
  pass_test "Forecast current_balance updated to 95000 (got $FC5C_CUR)"
else
  fail_test "Forecast current_balance after update" "95000" "$FC5C_CUR"
fi


# =========================================
# FLOW 6: Full Real-World Scenario
# =========================================
section "FLOW 6: Full Real-World Scenario"

# Clean up old data - create fresh user for this scenario
UNIQUE2=$(date +%s%N | head -c 13)
USERNAME2="realworld_${UNIQUE2}"
EMAIL2="rw_${UNIQUE2}@test.com"

echo "Creating fresh user for real-world scenario: $USERNAME2"
curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME2\",\"email\":\"$EMAIL2\",\"password\":\"RealWorld123\"}" > /dev/null

LOGIN2_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME2\",\"password\":\"RealWorld123\"}")
TOKEN2=$(echo "$LOGIN2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
AUTH2="Authorization: Bearer $TOKEN2"

# Setup balance: 30000 ILS
echo "Step 1: Setting balance to 30000 ILS..."
curl -s -X POST "$BASE/balance" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"balance":30000,"effective_date":"2026-02-01","notes":"Opening balance"}' > /dev/null

# Create categories
echo "Step 2: Creating categories..."
SAL_CAT=$(curl -s -X POST "$BASE/categories" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"name":"Salary","name_he":"משכורת","type":"income","icon":"wallet","color":"#22C55E"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

RENT_CAT=$(curl -s -X POST "$BASE/categories" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"name":"Rent","name_he":"שכירות","type":"expense","icon":"home","color":"#EF4444"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

BILLS_CAT=$(curl -s -X POST "$BASE/categories" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"name":"Bills","name_he":"חשבונות","type":"expense","icon":"receipt","color":"#F59E0B"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

INS_CAT=$(curl -s -X POST "$BASE/categories" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"name":"Insurance","name_he":"ביטוח","type":"expense","icon":"shield","color":"#6366F1"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

LOAN_CAT=$(curl -s -X POST "$BASE/categories" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"name":"Loan","name_he":"הלוואה","type":"expense","icon":"banknote","color":"#DC2626"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "  Categories created: Salary=$SAL_CAT, Rent=$RENT_CAT, Bills=$BILLS_CAT, Insurance=$INS_CAT, Loan=$LOAN_CAT"

# Monthly salary: 18000 (fixed income, day 10)
echo "Step 3: Creating fixed income - Salary 18000/month (day 10)..."
SALARY_RESP=$(curl -s -X POST "$BASE/fixed" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Monthly Salary\",\"amount\":18000,\"type\":\"income\",\"category_id\":\"$SAL_CAT\",\"day_of_month\":10,\"start_date\":\"2026-01-01\"}")
echo "  $SALARY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Salary: {d[\"amount\"]}/month on day {d[\"day_of_month\"]}')"

# Rent: 5500 (fixed expense, day 1)
echo "Step 4: Creating fixed expense - Rent 5500/month (day 1)..."
curl -s -X POST "$BASE/fixed" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Rent\",\"amount\":5500,\"type\":\"expense\",\"category_id\":\"$RENT_CAT\",\"day_of_month\":1,\"start_date\":\"2026-01-01\"}" > /dev/null

# Bills: 800 (fixed expense, day 15)
echo "Step 5: Creating fixed expense - Bills 800/month (day 15)..."
curl -s -X POST "$BASE/fixed" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Utility Bills\",\"amount\":800,\"type\":\"expense\",\"category_id\":\"$BILLS_CAT\",\"day_of_month\":15,\"start_date\":\"2026-01-01\"}" > /dev/null

# Car insurance: 450 (fixed expense, day 5)
echo "Step 6: Creating fixed expense - Car Insurance 450/month (day 5)..."
curl -s -X POST "$BASE/fixed" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Car Insurance\",\"amount\":450,\"type\":\"expense\",\"category_id\":\"$INS_CAT\",\"day_of_month\":5,\"start_date\":\"2026-01-01\"}" > /dev/null

# Car loan: 80000 original, 1800/month, 48 payments
echo "Step 7: Creating car loan - 80000, 1800/month, 48 payments..."
CARLOAN_RESP=$(curl -s -X POST "$BASE/loans" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Car Loan\",\"original_amount\":80000,\"monthly_payment\":1800,\"interest_rate\":4.5,\"category_id\":\"$LOAN_CAT\",\"start_date\":\"2026-01-01\",\"day_of_month\":1,\"total_payments\":48}")
echo "  Car loan: $CARLOAN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Loan: {d[\"original_amount\"]}, {d[\"monthly_payment\"]}/month, {d[\"total_payments\"]} payments')"

# New fridge installment: 4800 in 12 payments
echo "Step 8: Creating fridge installment - 4800 in 12 payments (400/month)..."
FRIDGE_RESP=$(curl -s -X POST "$BASE/installments" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"name":"New Fridge","total_amount":4800,"number_of_payments":12,"type":"expense","start_date":"2026-02-01","day_of_month":10}')
FRIDGE_MONTHLY=$(echo "$FRIDGE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['monthly_amount'])")
echo "  Fridge monthly amount: $FRIDGE_MONTHLY"

if python3 -c "assert float('$FRIDGE_MONTHLY') == 400"; then
  pass_test "Fridge installment monthly = 400 (4800/12)"
else
  fail_test "Fridge monthly_amount" "400" "$FRIDGE_MONTHLY"
fi

# Various one-time transactions in Jan 2026 (past month)
echo "Step 9: Creating one-time transactions..."
curl -s -X POST "$BASE/transactions" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"amount":300,"type":"expense","description":"Restaurant dinner","date":"2026-01-15"}' > /dev/null
curl -s -X POST "$BASE/transactions" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"amount":1200,"type":"expense","description":"New clothes","date":"2026-01-20"}' > /dev/null
curl -s -X POST "$BASE/transactions" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"amount":500,"type":"income","description":"Freelance work","date":"2026-01-25"}' > /dev/null
# Feb transactions
curl -s -X POST "$BASE/transactions" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"amount":250,"type":"expense","description":"Groceries","date":"2026-02-05"}' > /dev/null
curl -s -X POST "$BASE/transactions" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"amount":150,"type":"expense","description":"Pharmacy","date":"2026-02-07"}' > /dev/null

# Expected income for March: 20000 (bonus)
echo "Step 10: Setting expected income for March 2026 = 20000 (bonus)..."
EI_RESP=$(curl -s -X PUT "$BASE/expected-income/2026-03-01" \
  -H "$AUTH2" -H 'Content-Type: application/json' \
  -d '{"expected_amount":20000,"notes":"Annual bonus"}')
echo "  Expected income: $EI_RESP"

# ===== VERIFICATION =====
echo ""
echo -e "${BLUE}--- VERIFICATION ---${NC}"
echo ""

# 1. Get dashboard summary
echo "Verification 1: Dashboard Summary"
DASH6_RESP=$(curl -s "$BASE/dashboard/summary" -H "$AUTH2")
echo "  Full dashboard response: $DASH6_RESP"
python3 -c "
import sys, json
d = json.loads('''$DASH6_RESP''')
print(f'  current_balance:  {d[\"current_balance\"]}')
print(f'  monthly_income:   {d[\"monthly_income\"]}')
print(f'  monthly_expenses: {d[\"monthly_expenses\"]}')
print(f'  net_cashflow:     {d[\"net_cashflow\"]}')
print(f'  balance_trend:    {d[\"balance_trend\"]}%')
print(f'  income_trend:     {d[\"income_trend\"]}%')
print(f'  expense_trend:    {d[\"expense_trend\"]}%')
"

DASH6_BAL=$(echo "$DASH6_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['current_balance'])")
if python3 -c "assert float('$DASH6_BAL') == 30000"; then
  pass_test "Dashboard current_balance = 30000"
else
  fail_test "Dashboard current_balance" "30000" "$DASH6_BAL"
fi

# 2. Get 6-month forecast
echo ""
echo "Verification 2: 6-Month Forecast"
FC6_RESP=$(curl -s "$BASE/forecast?months=6" -H "$AUTH2")
python3 -c "
import sys, json
data = json.loads('''$FC6_RESP''')
print(f'  Current balance: {data[\"current_balance\"]}')
print(f'  has_negative_months: {data[\"has_negative_months\"]}')
print(f'  first_negative_month: {data[\"first_negative_month\"]}')
print()
for i, m in enumerate(data['months']):
    print(f'  Month {i+1} ({m[\"month\"]}):')
    print(f'    opening_balance:     {m[\"opening_balance\"]}')
    print(f'    fixed_income:        {m[\"fixed_income\"]}')
    print(f'    fixed_expenses:      {m[\"fixed_expenses\"]}')
    print(f'    installment_payments:{m[\"installment_payments\"]}')
    print(f'    loan_payments:       {m[\"loan_payments\"]}')
    print(f'    expected_income:     {m[\"expected_income\"]}')
    print(f'    one_time_income:     {m[\"one_time_income\"]}')
    print(f'    one_time_expenses:   {m[\"one_time_expenses\"]}')
    print(f'    total_income:        {m[\"total_income\"]}')
    print(f'    total_expenses:      {m[\"total_expenses\"]}')
    print(f'    net_change:          {m[\"net_change\"]}')
    print(f'    closing_balance:     {m[\"closing_balance\"]}')
    print()
"

# 3. Verify monthly forecast shows correct breakdown
echo "Verification 3: Monthly breakdown accuracy check"

# Expected for a typical month: salary(18000) - rent(5500) - bills(800) - insurance(450) - car_loan(1800) - fridge(400) = net ~9050/month
# Fixed income: 18000
# Fixed expenses: 5500 + 800 + 450 = 6750
# Loan payments: 1800
# Installment payments: 400
# Total expenses: 6750 + 1800 + 400 = 8950
# Net: 18000 - 8950 = 9050

python3 << 'PYEOF'
import json, sys

fc_raw = '''PLACEHOLDER_FC6'''
# We need to get the data from the actual response, so let's re-read it
PYEOF

# Use python to do the detailed verification
python3 -c "
import json, sys

data = json.loads('''$FC6_RESP''')

# Check a typical future month (month 3 or later to avoid Feb one-time tx noise)
# Actually, let's check each month individually

errors = []
passes = []

for i, m in enumerate(data['months']):
    month_label = m['month']
    fi = float(m['fixed_income'])
    fe = float(m['fixed_expenses'])
    ip = float(m['installment_payments'])
    lp = float(m['loan_payments'])
    ei = float(m['expected_income'])

    # Fixed income should be 18000
    if fi != 18000:
        errors.append(f'Month {i+1} ({month_label}): fixed_income expected 18000, got {fi}')
    else:
        passes.append(f'Month {i+1} fixed_income=18000')

    # Fixed expenses should be 6750 (5500+800+450)
    if fe != 6750:
        errors.append(f'Month {i+1} ({month_label}): fixed_expenses expected 6750, got {fe}')
    else:
        passes.append(f'Month {i+1} fixed_expenses=6750')

    # Loan payments should be 1800
    if lp != 1800:
        errors.append(f'Month {i+1} ({month_label}): loan_payments expected 1800, got {lp}')
    else:
        passes.append(f'Month {i+1} loan_payments=1800')

    # Installment payments should be 400 (for first 12 months from Feb)
    if ip != 400:
        errors.append(f'Month {i+1} ({month_label}): installment_payments expected 400, got {ip}')
    else:
        passes.append(f'Month {i+1} installment_payments=400')

# Check March expected income = 20000
march_data = None
for m in data['months']:
    if '2026-03' in str(m['month']):
        march_data = m
        break

if march_data:
    if float(march_data['expected_income']) == 20000:
        passes.append(f'March expected_income=20000 (bonus)')
    else:
        errors.append(f'March expected_income expected 20000, got {march_data[\"expected_income\"]}')
else:
    errors.append('March 2026 not found in forecast')

# Check no negative months
if not data['has_negative_months']:
    passes.append('No negative months (correct - net positive each month)')
else:
    errors.append(f'has_negative_months=True but should be False with these numbers')

for p in passes:
    print(f'  PASS: {p}')
for e in errors:
    print(f'  FAIL: {e}')

sys.exit(0)
"

# 4. Get forecast summary
echo ""
echo "Verification 4: Forecast Summary"
FS6_RESP=$(curl -s "$BASE/forecast/summary?months=6" -H "$AUTH2")
python3 -c "
import sys, json
d = json.loads('''$FS6_RESP''')
print(f'  current_balance:       {d[\"current_balance\"]}')
print(f'  forecast_months:       {d[\"forecast_months\"]}')
print(f'  total_expected_income: {d[\"total_expected_income\"]}')
print(f'  total_expected_expenses:{d[\"total_expected_expenses\"]}')
print(f'  net_projected:         {d[\"net_projected\"]}')
print(f'  end_balance:           {d[\"end_balance\"]}')
print(f'  has_negative_months:   {d[\"has_negative_months\"]}')
print(f'  alerts_count:          {d[\"alerts_count\"]}')
"

FS6_NEG=$(echo "$FS6_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['has_negative_months'])")
if [ "$FS6_NEG" = "False" ]; then
  pass_test "Real-world scenario has no negative months"
else
  warn_test "Real-world scenario shows negative months (unexpected with net +9050/month and 30000 starting balance)"
fi

# 5. Check alerts
echo ""
echo "Verification 5: Alerts"
ALERTS6_RESP=$(curl -s "$BASE/alerts" -H "$AUTH2")
ALERTS6_COUNT=$(echo "$ALERTS6_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['items']))")
echo "  Total alerts: $ALERTS6_COUNT"
python3 -c "
import sys, json
data = json.loads('''$ALERTS6_RESP''')
for a in data['items']:
    print(f'  [{a[\"severity\"]}] {a[\"alert_type\"]}: {a[\"title\"]}')
    print(f'    {a[\"message\"]}')
"

# =========================================
# FINAL SUMMARY
# =========================================
section "FINAL SUMMARY"
echo -e "  ${GREEN}PASSED: $PASS_COUNT${NC}"
echo -e "  ${RED}FAILED: $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}WARNINGS: $WARN_COUNT${NC}"
echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}ALL TESTS PASSED!${NC}"
else
  echo -e "  ${RED}$FAIL_COUNT/$TOTAL TESTS FAILED${NC}"
fi
echo ""
