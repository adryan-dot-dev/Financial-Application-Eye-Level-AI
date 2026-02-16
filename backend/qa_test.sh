#!/bin/bash
# QA Test Script for Cash Flow Management API
# Tests complete financial data entry across all modules

T="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ODg5YmY2Ny04M2M2LTQyMDMtODE2Ny1kNWE3Y2E2NzE2NWYiLCJleHAiOjE3NzA2MzA5OTIsInR5cGUiOiJhY2Nlc3MiLCJpc19hZG1pbiI6ZmFsc2V9.dA4sYkcep97cFuy3SoJ6irOTZrqWP6PhuCZNFrmQSWg"
B="http://localhost:8000/api/v1"
H="Authorization: Bearer $T"

# Category IDs (already created)
CAT_SALARY="354f1b6e-cac6-458e-9e25-250f1849c1bb"
CAT_RENT="e79fadef-edbf-4d9b-b640-14f9615b112a"
CAT_GROCERIES="38cfff4b-9d9b-4028-b265-60eb4f4bce8f"
CAT_FREELANCE="19b9b9e5-3379-46e9-a5cd-e077f65ccbd8"
CAT_INSURANCE="46c66d5c-7498-4343-8675-8ad70b15afb2"

PASS=0
FAIL=0

check() {
    local desc="$1"
    local expected="$2"
    local actual="$3"
    if [ "$actual" = "$expected" ]; then
        echo "  PASS: $desc (HTTP $actual)"
        PASS=$((PASS+1))
    else
        echo "  FAIL: $desc (expected HTTP $expected, got $actual)"
        FAIL=$((FAIL+1))
    fi
}

echo "=============================================="
echo "  SECTION 2: TRANSACTIONS"
echo "=============================================="
echo ""

echo "--- 2.1 Create 10 diverse transactions ---"

CODE=$(curl -s -o /tmp/tx1.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":15000,\"type\":\"income\",\"category_id\":\"$CAT_SALARY\",\"description\":\"January Salary\",\"date\":\"2026-01-01\",\"notes\":\"Monthly salary\"}")
check "TX1: January Salary 15000 income" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx2.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":4500,\"type\":\"expense\",\"category_id\":\"$CAT_RENT\",\"description\":\"January Rent\",\"date\":\"2026-01-01\",\"notes\":\"Monthly rent\"}")
check "TX2: January Rent 4500 expense" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx3.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":800,\"type\":\"expense\",\"category_id\":\"$CAT_GROCERIES\",\"description\":\"Groceries Week 1\",\"date\":\"2026-01-05\"}")
check "TX3: Groceries Week 1 800 expense" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx4.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":3000,\"type\":\"income\",\"category_id\":\"$CAT_FREELANCE\",\"description\":\"Website project\",\"date\":\"2026-01-10\",\"notes\":\"Client: ABC Corp\"}")
check "TX4: Freelance 3000 income" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx5.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":350,\"type\":\"expense\",\"category_id\":\"$CAT_INSURANCE\",\"description\":\"Health Insurance\",\"date\":\"2026-01-15\"}")
check "TX5: Insurance 350 expense" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx6.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":650,\"type\":\"expense\",\"category_id\":\"$CAT_GROCERIES\",\"description\":\"Groceries Week 3\",\"date\":\"2026-01-20\"}")
check "TX6: Groceries Week 3 650 expense" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx7.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":15000,\"type\":\"income\",\"category_id\":\"$CAT_SALARY\",\"description\":\"February Salary\",\"date\":\"2026-02-01\"}")
check "TX7: February Salary 15000 income" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx8.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":4500,\"type\":\"expense\",\"category_id\":\"$CAT_RENT\",\"description\":\"February Rent\",\"date\":\"2026-02-01\"}")
check "TX8: February Rent 4500 expense" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx9.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":5000,\"type\":\"income\",\"category_id\":\"$CAT_FREELANCE\",\"description\":\"Mobile app project\",\"date\":\"2026-02-05\",\"notes\":\"Client: XYZ Ltd\",\"tags\":[\"freelance\",\"mobile\"]}")
check "TX9: Freelance 5000 income (with tags)" "201" "$CODE"

CODE=$(curl -s -o /tmp/tx10.json -w "%{http_code}" -X POST "$B/transactions" -H "Content-Type: application/json" -H "$H" -d "{\"amount\":900,\"type\":\"expense\",\"category_id\":\"$CAT_GROCERIES\",\"description\":\"Groceries February\",\"date\":\"2026-02-08\"}")
check "TX10: Groceries February 900 expense" "201" "$CODE"

echo ""
echo "--- 2.2 List with pagination (page_size=5) ---"
RESP=$(curl -s "$B/transactions?page_size=5&page=1" -H "$H")
TOTAL=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
ITEMS=$(echo "$RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['items']))")
PAGES=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['pages'])")
echo "  Total: $TOTAL, Items on page 1: $ITEMS, Pages: $PAGES"
if [ "$TOTAL" = "10" ] && [ "$ITEMS" = "5" ] && [ "$PAGES" = "2" ]; then
    echo "  PASS: Pagination correct (10 total, 5 per page, 2 pages)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Pagination incorrect (total=$TOTAL, items=$ITEMS, pages=$PAGES)"
    FAIL=$((FAIL+1))
fi

RESP2=$(curl -s "$B/transactions?page_size=5&page=2" -H "$H")
ITEMS2=$(echo "$RESP2" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['items']))")
echo "  Page 2 items: $ITEMS2"
if [ "$ITEMS2" = "5" ]; then
    echo "  PASS: Page 2 has 5 items"
    PASS=$((PASS+1))
else
    echo "  FAIL: Page 2 has $ITEMS2 items (expected 5)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 2.3 Filter by type=income ---"
RESP=$(curl -s "$B/transactions?type=income" -H "$H")
INCOME_TOTAL=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['total'])")
INCOME_TYPES=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); types=set(i['type'] for i in d['items']); print(','.join(types))")
echo "  Income transactions: $INCOME_TOTAL, Types found: $INCOME_TYPES"
if [ "$INCOME_TOTAL" = "4" ] && [ "$INCOME_TYPES" = "income" ]; then
    echo "  PASS: Income filter correct (4 income transactions)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Income filter (total=$INCOME_TOTAL, types=$INCOME_TYPES)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 2.4 Filter by date range (Jan only: 2026-01-01 to 2026-01-31) ---"
RESP=$(curl -s "$B/transactions?start_date=2026-01-01&end_date=2026-01-31" -H "$H")
JAN_TOTAL=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
echo "  January transactions: $JAN_TOTAL"
if [ "$JAN_TOTAL" = "6" ]; then
    echo "  PASS: Date range filter correct (6 Jan transactions)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Date range filter (expected 6, got $JAN_TOTAL)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 2.5 Filter by category (Groceries) ---"
RESP=$(curl -s "$B/transactions?category_id=$CAT_GROCERIES" -H "$H")
GROC_TOTAL=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
echo "  Groceries transactions: $GROC_TOTAL"
if [ "$GROC_TOTAL" = "3" ]; then
    echo "  PASS: Category filter correct (3 groceries transactions)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Category filter (expected 3, got $GROC_TOTAL)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 2.6 Duplicate a transaction ---"
TX1_ID=$(python3 -c "import json; print(json.load(open('/tmp/tx1.json'))['id'])")
CODE=$(curl -s -o /tmp/txdup.json -w "%{http_code}" -X POST "$B/transactions/$TX1_ID/duplicate" -H "$H")
check "Duplicate TX1 (January Salary)" "201" "$CODE"
DUP_AMOUNT=$(python3 -c "import json; print(json.load(open('/tmp/txdup.json'))['amount'])")
DUP_DESC=$(python3 -c "import json; print(json.load(open('/tmp/txdup.json'))['description'])")
DUP_ID=$(python3 -c "import json; print(json.load(open('/tmp/txdup.json'))['id'])")
echo "  Duplicated: amount=$DUP_AMOUNT, description=$DUP_DESC, new_id=$DUP_ID"
if [ "$DUP_AMOUNT" = "15000.00" ]; then
    echo "  PASS: Duplicate has correct amount"
    PASS=$((PASS+1))
else
    echo "  FAIL: Duplicate amount wrong ($DUP_AMOUNT)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 2.7 Update transaction amount ---"
TX3_ID=$(python3 -c "import json; print(json.load(open('/tmp/tx3.json'))['id'])")
CODE=$(curl -s -o /tmp/tx3_updated.json -w "%{http_code}" -X PUT "$B/transactions/$TX3_ID" -H "Content-Type: application/json" -H "$H" -d '{"amount":950}')
check "Update TX3 amount 800->950" "200" "$CODE"
NEW_AMOUNT=$(python3 -c "import json; print(json.load(open('/tmp/tx3_updated.json'))['amount'])")
echo "  Updated amount: $NEW_AMOUNT"
if [ "$NEW_AMOUNT" = "950.00" ]; then
    echo "  PASS: Amount updated correctly"
    PASS=$((PASS+1))
else
    echo "  FAIL: Amount not updated ($NEW_AMOUNT)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 2.8 Delete the duplicate transaction ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$B/transactions/$DUP_ID" -H "$H")
check "Delete duplicated transaction" "200" "$CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$B/transactions/$DUP_ID" -H "$H")
check "Verify deleted transaction returns 404" "404" "$CODE"

RESP=$(curl -s "$B/transactions" -H "$H")
FINAL_TOTAL=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
echo "  Final total after delete: $FINAL_TOTAL"
if [ "$FINAL_TOTAL" = "10" ]; then
    echo "  PASS: Total back to 10 after delete"
    PASS=$((PASS+1))
else
    echo "  FAIL: Total is $FINAL_TOTAL (expected 10)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=============================================="
echo "  SECTION 3: FIXED INCOME/EXPENSES"
echo "=============================================="
echo ""

echo "--- 3.1 Create fixed income: Monthly Salary ---"
CODE=$(curl -s -o /tmp/fixed1.json -w "%{http_code}" -X POST "$B/fixed" -H "Content-Type: application/json" -H "$H" -d "{\"name\":\"Monthly Salary\",\"amount\":15000,\"type\":\"income\",\"day_of_month\":1,\"start_date\":\"2026-01-01\",\"category_id\":\"$CAT_SALARY\"}")
check "Create fixed income: Monthly Salary" "201" "$CODE"
python3 -c "import json; f=json.load(open('/tmp/fixed1.json')); print(f'  name={f[\"name\"]}, amount={f[\"amount\"]}, is_active={f[\"is_active\"]}, day={f[\"day_of_month\"]}')"

echo ""
echo "--- 3.2 Create fixed expense: Rent Payment ---"
CODE=$(curl -s -o /tmp/fixed2.json -w "%{http_code}" -X POST "$B/fixed" -H "Content-Type: application/json" -H "$H" -d "{\"name\":\"Rent Payment\",\"amount\":4500,\"type\":\"expense\",\"day_of_month\":1,\"start_date\":\"2026-01-01\",\"category_id\":\"$CAT_RENT\"}")
check "Create fixed expense: Rent Payment" "201" "$CODE"

echo ""
echo "--- 3.3 Create fixed expense: Insurance ---"
CODE=$(curl -s -o /tmp/fixed3.json -w "%{http_code}" -X POST "$B/fixed" -H "Content-Type: application/json" -H "$H" -d "{\"name\":\"Insurance\",\"amount\":350,\"type\":\"expense\",\"day_of_month\":15,\"start_date\":\"2026-01-15\",\"category_id\":\"$CAT_INSURANCE\"}")
check "Create fixed expense: Insurance" "201" "$CODE"

echo ""
echo "--- 3.4 Pause Insurance ---"
FIXED3_ID=$(python3 -c "import json; print(json.load(open('/tmp/fixed3.json'))['id'])")
CODE=$(curl -s -o /tmp/fixed3_paused.json -w "%{http_code}" -X POST "$B/fixed/$FIXED3_ID/pause" -H "$H")
check "Pause Insurance" "200" "$CODE"
PAUSED=$(python3 -c "import json; print(json.load(open('/tmp/fixed3_paused.json'))['is_active'])")
echo "  is_active after pause: $PAUSED"
if [ "$PAUSED" = "False" ]; then
    echo "  PASS: is_active=False after pause"
    PASS=$((PASS+1))
else
    echo "  FAIL: is_active=$PAUSED (expected False)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 3.5 Resume Insurance ---"
CODE=$(curl -s -o /tmp/fixed3_resumed.json -w "%{http_code}" -X POST "$B/fixed/$FIXED3_ID/resume" -H "$H")
check "Resume Insurance" "200" "$CODE"
RESUMED=$(python3 -c "import json; print(json.load(open('/tmp/fixed3_resumed.json'))['is_active'])")
echo "  is_active after resume: $RESUMED"
if [ "$RESUMED" = "True" ]; then
    echo "  PASS: is_active=True after resume"
    PASS=$((PASS+1))
else
    echo "  FAIL: is_active=$RESUMED (expected True)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 3.6 List all fixed ---"
FIXED_LIST=$(curl -s "$B/fixed" -H "$H")
FIXED_COUNT=$(echo "$FIXED_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "  Total fixed items: $FIXED_COUNT"
if [ "$FIXED_COUNT" = "3" ]; then
    echo "  PASS: 3 fixed items listed"
    PASS=$((PASS+1))
else
    echo "  FAIL: Expected 3, got $FIXED_COUNT"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=============================================="
echo "  SECTION 4: INSTALLMENTS"
echo "=============================================="
echo ""

echo "--- 4.1 Create installment: New Laptop (6000/12) ---"
CODE=$(curl -s -o /tmp/inst1.json -w "%{http_code}" -X POST "$B/installments" -H "Content-Type: application/json" -H "$H" -d '{"name":"New Laptop","total_amount":6000,"number_of_payments":12,"type":"expense","start_date":"2026-01-15","day_of_month":15}')
check "Create installment: New Laptop" "201" "$CODE"
MONTHLY=$(python3 -c "import json; print(json.load(open('/tmp/inst1.json'))['monthly_amount'])")
echo "  monthly_amount: $MONTHLY (expected 500.00)"
if [ "$MONTHLY" = "500.00" ]; then
    echo "  PASS: Monthly amount calculated correctly (6000/12=500)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Monthly amount is $MONTHLY (expected 500.00)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 4.2 Get installment detail with payment schedule ---"
INST1_ID=$(python3 -c "import json; print(json.load(open('/tmp/inst1.json'))['id'])")
CODE=$(curl -s -o /tmp/inst1_detail.json -w "%{http_code}" "$B/installments/$INST1_ID" -H "$H")
check "Get installment detail" "200" "$CODE"
SCHED_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/inst1_detail.json'))['schedule']))")
echo "  Payments in schedule: $SCHED_COUNT"
if [ "$SCHED_COUNT" = "12" ]; then
    echo "  PASS: 12 payments in schedule"
    PASS=$((PASS+1))
else
    echo "  FAIL: Expected 12, got $SCHED_COUNT"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 4.3 Get payment schedule via /payments endpoint ---"
CODE=$(curl -s -o /tmp/inst1_payments.json -w "%{http_code}" "$B/installments/$INST1_ID/payments" -H "$H")
check "Get payment schedule endpoint" "200" "$CODE"
PAYMENT_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/inst1_payments.json'))))")
echo "  Payments via /payments: $PAYMENT_COUNT"
if [ "$PAYMENT_COUNT" = "12" ]; then
    echo "  PASS: 12 payments listed via /payments"
    PASS=$((PASS+1))
else
    echo "  FAIL: Expected 12, got $PAYMENT_COUNT"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 4.4 Create installment: Uneven split (7000/6) ---"
CODE=$(curl -s -o /tmp/inst2.json -w "%{http_code}" -X POST "$B/installments" -H "Content-Type: application/json" -H "$H" -d '{"name":"Furniture Set","total_amount":7000,"number_of_payments":6,"type":"expense","start_date":"2026-02-01","day_of_month":1}')
check "Create installment: Furniture Set (7000/6)" "201" "$CODE"
MONTHLY2=$(python3 -c "import json; print(json.load(open('/tmp/inst2.json'))['monthly_amount'])")
echo "  monthly_amount: $MONTHLY2 (expected 1166.67)"
if [ "$MONTHLY2" = "1166.67" ]; then
    echo "  PASS: Uneven split calculated correctly (7000/6=1166.67)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Monthly amount is $MONTHLY2 (expected 1166.67)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=============================================="
echo "  SECTION 5: LOANS"
echo "=============================================="
echo ""

echo "--- 5.1 Create loan: Car Loan (100000, 3.5%, 48 months) ---"
CODE=$(curl -s -o /tmp/loan1.json -w "%{http_code}" -X POST "$B/loans" -H "Content-Type: application/json" -H "$H" -d '{"name":"Car Loan","original_amount":100000,"monthly_payment":2500,"interest_rate":3.5,"start_date":"2026-01-01","day_of_month":1,"total_payments":48}')
check "Create loan: Car Loan" "201" "$CODE"
python3 -c "
import json
l=json.load(open('/tmp/loan1.json'))
print(f'  status={l[\"status\"]}, remaining={l[\"remaining_balance\"]}, payments_made={l[\"payments_made\"]}')
print(f'  original={l[\"original_amount\"]}, monthly={l[\"monthly_payment\"]}, rate={l[\"interest_rate\"]}%')
"

echo ""
echo "--- 5.2 Get loan detail with amortization ---"
LOAN1_ID=$(python3 -c "import json; print(json.load(open('/tmp/loan1.json'))['id'])")
CODE=$(curl -s -o /tmp/loan1_detail.json -w "%{http_code}" "$B/loans/$LOAN1_ID" -H "$H")
check "Get loan detail with amortization" "200" "$CODE"
AMORT_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/loan1_detail.json'))['amortization']))")
echo "  Amortization entries: $AMORT_COUNT"
if [ "$AMORT_COUNT" = "48" ]; then
    echo "  PASS: 48 amortization entries"
    PASS=$((PASS+1))
else
    echo "  FAIL: Expected 48, got $AMORT_COUNT"
    FAIL=$((FAIL+1))
fi

python3 -c "
import json
d=json.load(open('/tmp/loan1_detail.json'))
a=d['amortization'][0]
print(f'  Payment #1: principal={a[\"principal\"]}, interest={a[\"interest\"]}, remaining={a[\"remaining_balance\"]}')
a_last=d['amortization'][-1]
print(f'  Payment #48: principal={a_last[\"principal\"]}, interest={a_last[\"interest\"]}, remaining={a_last[\"remaining_balance\"]}')
"

echo ""
echo "--- 5.3 Get loan breakdown ---"
CODE=$(curl -s -o /tmp/loan1_breakdown.json -w "%{http_code}" "$B/loans/$LOAN1_ID/breakdown" -H "$H")
check "Get loan breakdown" "200" "$CODE"
BREAKDOWN_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/loan1_breakdown.json'))))")
echo "  Breakdown entries: $BREAKDOWN_COUNT"

echo ""
echo "--- 5.4 Record a payment ---"
CODE=$(curl -s -o /tmp/loan1_paid.json -w "%{http_code}" -X POST "$B/loans/$LOAN1_ID/payment" -H "Content-Type: application/json" -H "$H" -d '{"amount":2500}')
check "Record loan payment" "200" "$CODE"
PM_AFTER=$(python3 -c "import json; print(json.load(open('/tmp/loan1_paid.json'))['payments_made'])")
RB_AFTER=$(python3 -c "import json; print(json.load(open('/tmp/loan1_paid.json'))['remaining_balance'])")
echo "  After payment: payments_made=$PM_AFTER, remaining_balance=$RB_AFTER"
if [ "$PM_AFTER" = "1" ]; then
    echo "  PASS: payments_made increased to 1"
    PASS=$((PASS+1))
else
    echo "  FAIL: payments_made=$PM_AFTER (expected 1)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 5.5 Create 0% interest loan ---"
CODE=$(curl -s -o /tmp/loan2.json -w "%{http_code}" -X POST "$B/loans" -H "Content-Type: application/json" -H "$H" -d '{"name":"Interest Free Loan","original_amount":12000,"monthly_payment":1000,"interest_rate":0,"start_date":"2026-02-01","day_of_month":1,"total_payments":12}')
check "Create 0% interest loan" "201" "$CODE"
LOAN2_RATE=$(python3 -c "import json; print(json.load(open('/tmp/loan2.json'))['interest_rate'])")
echo "  interest_rate: $LOAN2_RATE"

LOAN2_ID=$(python3 -c "import json; print(json.load(open('/tmp/loan2.json'))['id'])")
AMORT2=$(curl -s "$B/loans/$LOAN2_ID/breakdown" -H "$H")
ZERO_INT=$(echo "$AMORT2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(all(float(i['interest'])==0 for i in d))")
echo "  All interest portions zero: $ZERO_INT"
if [ "$ZERO_INT" = "True" ]; then
    echo "  PASS: 0% loan has zero interest in all payments"
    PASS=$((PASS+1))
else
    echo "  FAIL: 0% loan has non-zero interest"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=============================================="
echo "  SECTION 6: BALANCE"
echo "=============================================="
echo ""

echo "--- 6.1 Set initial balance ---"
CODE=$(curl -s -o /tmp/bal1.json -w "%{http_code}" -X POST "$B/balance" -H "Content-Type: application/json" -H "$H" -d '{"balance":25000,"effective_date":"2026-01-01","notes":"Opening balance"}')
check "Set initial balance 25000" "201" "$CODE"
python3 -c "import json; b=json.load(open('/tmp/bal1.json')); print(f'  balance={b[\"balance\"]}, is_current={b[\"is_current\"]}, notes={b[\"notes\"]}')"

echo ""
echo "--- 6.2 Create new balance entry (becomes current) ---"
CODE=$(curl -s -o /tmp/bal2.json -w "%{http_code}" -X POST "$B/balance" -H "Content-Type: application/json" -H "$H" -d '{"balance":28000,"effective_date":"2026-02-01","notes":"After salary"}')
check "Create balance 28000" "201" "$CODE"
python3 -c "import json; b=json.load(open('/tmp/bal2.json')); print(f'  balance={b[\"balance\"]}, is_current={b[\"is_current\"]}')"

echo ""
echo "--- 6.3 Get current balance ---"
CODE=$(curl -s -o /tmp/bal_current.json -w "%{http_code}" "$B/balance" -H "$H")
check "Get current balance" "200" "$CODE"
CURRENT_BAL=$(python3 -c "import json; print(json.load(open('/tmp/bal_current.json'))['balance'])")
echo "  Current balance: $CURRENT_BAL"
if [ "$CURRENT_BAL" = "28000.00" ]; then
    echo "  PASS: Current balance is 28000 (latest)"
    PASS=$((PASS+1))
else
    echo "  FAIL: Current balance is $CURRENT_BAL (expected 28000.00)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 6.4 Get balance history ---"
CODE=$(curl -s -o /tmp/bal_history.json -w "%{http_code}" "$B/balance/history" -H "$H")
check "Get balance history" "200" "$CODE"
HIST_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/bal_history.json'))['items']))")
echo "  History entries: $HIST_COUNT"
if [ "$HIST_COUNT" = "2" ]; then
    echo "  PASS: 2 balance history entries"
    PASS=$((PASS+1))
else
    echo "  FAIL: Expected 2 entries, got $HIST_COUNT"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 6.5 Update current balance via PUT ---"
CODE=$(curl -s -o /tmp/bal_updated.json -w "%{http_code}" -X PUT "$B/balance" -H "Content-Type: application/json" -H "$H" -d '{"balance":27500,"notes":"Corrected after expenses"}')
check "Update balance via PUT" "200" "$CODE"
UPDATED_BAL=$(python3 -c "import json; print(json.load(open('/tmp/bal_updated.json'))['balance'])")
UPDATED_NOTES=$(python3 -c "import json; print(json.load(open('/tmp/bal_updated.json'))['notes'])")
echo "  Updated balance: $UPDATED_BAL, notes: $UPDATED_NOTES"

echo ""
echo "=============================================="
echo "  SECTION 7: SETTINGS"
echo "=============================================="
echo ""

echo "--- 7.1 Get current settings ---"
CODE=$(curl -s -o /tmp/settings1.json -w "%{http_code}" "$B/settings" -H "$H")
check "Get current settings" "200" "$CODE"
python3 -c "import json; s=json.load(open('/tmp/settings1.json')); print(f'  currency={s[\"currency\"]}, theme={s[\"theme\"]}, language={s[\"language\"]}, date_format={s[\"date_format\"]}, notifications={s[\"notifications_enabled\"]}, forecast_months={s[\"forecast_months_default\"]}, week_start={s[\"week_start_day\"]}')"

echo ""
echo "--- 7.2 Update settings ---"
CODE=$(curl -s -o /tmp/settings2.json -w "%{http_code}" -X PUT "$B/settings" -H "Content-Type: application/json" -H "$H" -d '{"currency":"USD","theme":"dark","language":"en"}')
check "Update settings to USD/dark/en" "200" "$CODE"
python3 -c "import json; s=json.load(open('/tmp/settings2.json')); print(f'  currency={s[\"currency\"]}, theme={s[\"theme\"]}, language={s[\"language\"]}')"

echo ""
echo "--- 7.3 Verify settings persisted ---"
CODE=$(curl -s -o /tmp/settings3.json -w "%{http_code}" "$B/settings" -H "$H")
check "Re-read settings to verify persistence" "200" "$CODE"
S_CUR=$(python3 -c "import json; print(json.load(open('/tmp/settings3.json'))['currency'])")
S_THEME=$(python3 -c "import json; print(json.load(open('/tmp/settings3.json'))['theme'])")
S_LANG=$(python3 -c "import json; print(json.load(open('/tmp/settings3.json'))['language'])")
echo "  currency=$S_CUR, theme=$S_THEME, language=$S_LANG"
if [ "$S_CUR" = "USD" ] && [ "$S_THEME" = "dark" ] && [ "$S_LANG" = "en" ]; then
    echo "  PASS: Settings persisted correctly"
    PASS=$((PASS+1))
else
    echo "  FAIL: Settings did not persist (currency=$S_CUR, theme=$S_THEME, language=$S_LANG)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "--- 7.4 Reset to ILS/light/he ---"
CODE=$(curl -s -o /tmp/settings4.json -w "%{http_code}" -X PUT "$B/settings" -H "Content-Type: application/json" -H "$H" -d '{"currency":"ILS","theme":"light","language":"he"}')
check "Reset settings to ILS/light/he" "200" "$CODE"
S_CUR=$(python3 -c "import json; print(json.load(open('/tmp/settings4.json'))['currency'])")
echo "  Reset currency: $S_CUR"
if [ "$S_CUR" = "ILS" ]; then
    echo "  PASS: Settings reset to ILS"
    PASS=$((PASS+1))
else
    echo "  FAIL: Settings not reset ($S_CUR)"
    FAIL=$((FAIL+1))
fi

echo ""
echo "=============================================="
echo "  FINAL SUMMARY"
echo "=============================================="
echo ""
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo "  TOTAL:  $((PASS+FAIL))"
echo ""
if [ "$FAIL" = "0" ]; then
    echo "  >>> ALL TESTS PASSED <<<"
else
    echo "  >>> $FAIL TEST(S) FAILED - SEE DETAILS ABOVE <<<"
fi
echo ""
