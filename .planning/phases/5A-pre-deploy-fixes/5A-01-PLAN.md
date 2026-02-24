---
phase: 5A-pre-deploy-fixes
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/v1/endpoints/installments.py
  - backend/app/api/v1/endpoints/transactions.py
  - backend/app/api/v1/endpoints/fixed.py
  - backend/app/api/v1/schemas/loans.py
  - backend/app/api/v1/endpoints/balance.py
  - backend/alembic/versions/[new_migration]_phase5a_indexes_and_constraints.py
  - backend/tests/test_installments.py
autonomous: true
requirements:
  - BUG-01
  - BUG-02
  - BUG-03
  - BUG-04
  - BUG-05
  - BUG-06

must_haves:
  truths:
    - "Reversing an installment payment does not leave orphaned Transaction rows in the database (verified by integration test)"
    - "A unique DB constraint prevents two concurrent is_current=true balance rows for the same user"
    - "LoanCreate schema accepts credit_card_id field without validation error"
    - "Income category cannot be used on an expense transaction (422 returned)"
    - "All list endpoints use typed List[Model] response_model (no raw list)"
    - "All 155+ existing backend tests pass after all changes"
  artifacts:
    - path: "backend/tests/test_installments.py"
      provides: "BUG-01 regression test — test_reverse_payment_no_orphaned_transaction"
      contains: "test_reverse_payment_no_orphaned_transaction"
    - path: "backend/alembic/versions/[new].py"
      provides: "Phase 5A DB migration — BUG-02 constraint + BUG-05 indexes"
      contains: "CREATE INDEX IF NOT EXISTS"
    - path: "backend/app/api/v1/schemas/loans.py"
      provides: "BUG-03 fix — credit_card_id field on LoanCreate if DB column exists"
  key_links:
    - from: "backend/tests/test_installments.py::test_reverse_payment_no_orphaned_transaction"
      to: "backend/app/api/v1/endpoints/installments.py::reverse_installment_payment"
      via: "integration test POST /installments/{id}/payments/{n}/reverse"
      pattern: "reverse.*payment"
    - from: "backend/alembic/versions/[new].py"
      to: "bank_balances table"
      via: "CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_current_global"
      pattern: "uq_balance_current"
---

<objective>
Fix all six backend data integrity bugs (BUG-01 through BUG-06) in the FastAPI backend. Several bugs are already fixed in the codebase — the executor MUST read actual code before implementing anything. The primary deliverable is the BUG-01 regression test and the Alembic migration for BUG-02 + BUG-05.

Purpose: Prevent data corruption bugs from reaching production. BUG-01 orphaned transactions are the highest severity — a reverse-payment that leaves a dangling Transaction row corrupts balance calculations.
Output: BUG-01 regression test, single Alembic migration (BUG-02 constraint + BUG-05 indexes), schema fix for BUG-03, confirmation that BUG-04/BUG-06 are already handled.
</objective>

<execution_context>
@/Users/roeiedri/.claude/get-shit-done/workflows/execute-plan.md
@/Users/roeiedri/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/5A-pre-deploy-fixes/5A-CONTEXT.md
@.planning/phases/5A-pre-deploy-fixes/5A-RESEARCH.md

@backend/app/api/v1/endpoints/installments.py
@backend/app/api/v1/endpoints/transactions.py
@backend/app/api/v1/schemas/loans.py
@backend/alembic/versions/57ac70dcfa4d_fix_balance_constraints.py
@backend/tests/test_installments.py
@backend/tests/conftest.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: BUG-01 — Write regression test for orphaned transaction on reverse-payment</name>
  <files>backend/tests/test_installments.py</files>
  <action>
CRITICAL FIRST STEP: Read backend/app/api/v1/endpoints/installments.py lines 467-510 to confirm the reverse_installment_payment fix already exists (delete-orphan logic). The fix IS already there — do NOT modify installments.py unless a gap is found.

Add a new test function `test_reverse_payment_no_orphaned_transaction` to backend/tests/test_installments.py.

The test must:
1. Create an installment plan via POST /api/v1/installments/ (use existing helper patterns in the file)
2. Mark installment payment #1 as paid via POST /api/v1/installments/{id}/payments/1/pay — this creates a Transaction row with installment_id set
3. Reverse the payment via POST /api/v1/installments/{id}/payments/1/reverse
4. Query the DB directly using db_session (already available in conftest.py): `SELECT * FROM transactions WHERE installment_id = {uuid} AND installment_number = 1`
5. Assert the result is None — no orphaned Transaction row remains

Import requirements for the test:
```python
from __future__ import annotations
from sqlalchemy import select, text
from app.db.models import Transaction
```

Use the existing test fixtures: `client`, `auth_headers`, `db_session` (all available from conftest.py).

Follow the exact same fixture usage and assertion style as existing tests in test_installments.py (check the first 50 lines for patterns). Python 3.9 — use `Optional[X]`, no `X | Y` syntax.

If test_installments.py already contains `test_reverse_payment_no_orphaned_transaction`, skip creation and note it exists.
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/test_installments.py::test_reverse_payment_no_orphaned_transaction -x -v 2>&1 | tail -20</automated>
    <manual>Test must PASS (green) — "PASSED test_installments.py::test_reverse_payment_no_orphaned_transaction"</manual>
  </verify>
  <done>test_reverse_payment_no_orphaned_transaction exists in test_installments.py, runs green, and queries the DB directly to confirm no orphaned Transaction row after reverse-payment.</done>
</task>

<task type="auto">
  <name>Task 2: BUG-02 + BUG-05 — Alembic migration for constraint and missing indexes</name>
  <files>backend/alembic/versions/[new_revision]_phase5a_indexes_and_constraints.py</files>
  <action>
Create a new Alembic migration file that chains from `57ac70dcfa4d` (current head).

Run first to confirm current head:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. alembic current
```

Generate migration stub:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. alembic revision --rev-id phase5a_fixes --message "phase5a_indexes_and_constraints"
```

The migration must set `down_revision = '57ac70dcfa4d'`.

**BUG-02 (balance race condition):**
The migration history (57ac70dcfa4d) already created `uq_balance_current_per_account` and `uq_balance_current_global`. Verify these exist using inspector before adding anything. If they exist, BUG-02 DB fix is already applied — add a comment noting this and skip.

**BUG-05 (missing indexes):**
First run this query against the DB to find actual missing indexes:
```python
# In the upgrade() function, use inspector
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
```

Add these 4 indexes using `IF NOT EXISTS` pattern (they may already exist — use IF NOT EXISTS to be safe):

```python
# credit_cards — billing_day for APScheduler queries
op.execute(sa.text(
    "CREATE INDEX IF NOT EXISTS ix_credit_cards_billing_day "
    "ON credit_cards (billing_day)"
))

# subscriptions — billing_cycle for filtering
op.execute(sa.text(
    "CREATE INDEX IF NOT EXISTS ix_subscriptions_billing_cycle "
    "ON subscriptions (billing_cycle)"
))

# transactions — installment_id for orphan lookups (this is the critical one for BUG-01 performance)
op.execute(sa.text(
    "CREATE INDEX IF NOT EXISTS ix_transactions_installment_id "
    "ON transactions (installment_id) WHERE installment_id IS NOT NULL"
))

# bank_balances — composite index for account+is_current lookups
op.execute(sa.text(
    "CREATE INDEX IF NOT EXISTS ix_bank_balances_account_current "
    "ON bank_balances (bank_account_id, is_current) WHERE bank_account_id IS NOT NULL"
))
```

Also add Python-level duplicate detection for BUG-02 in balance.py:
Read backend/app/api/v1/endpoints/balance.py — find the `create_balance` function. Before the db.commit(), add a check:
```python
# Python-level guard (DB constraint is primary, this is belt-and-suspenders)
existing = await db.execute(
    select(BankBalance).where(
        BankBalance.user_id == current_user.id,
        BankBalance.is_current == True,
        BankBalance.bank_account_id == None
    )
)
if existing.scalar_one_or_none() is not None:
    raise HTTPException(status_code=409, detail="Current balance already exists for this user")
```
Only add this if create_balance doesn't already have it. Use `from __future__ import annotations` if not present.

**downgrade():** Use DROP INDEX IF EXISTS for each index added.

Run migration:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. alembic upgrade head
```
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. alembic current 2>&1 && PYTHONPATH=. pytest tests/test_balance.py tests/test_concurrent_access.py -x -v --tb=short 2>&1 | tail -20</automated>
    <manual>alembic current shows new revision as head. Balance tests pass.</manual>
  </verify>
  <done>Migration file exists with down_revision='57ac70dcfa4d'. `alembic upgrade head` runs without error. balance.py has Python-level duplicate guard (or note it was already present). All balance tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: BUG-03, BUG-04, BUG-06 — Schema fixes and verification of already-fixed bugs</name>
  <files>
    backend/app/api/v1/schemas/loans.py
    backend/app/api/v1/endpoints/transactions.py
    backend/app/api/v1/endpoints/fixed.py
    backend/app/api/v1/endpoints/installments.py
  </files>
  <action>
**BUG-03 — Fix missing schema fields (LoanCreate):**
Read backend/app/api/v1/schemas/loans.py. Find LoanCreate class.
Read backend/app/db/models.py or equivalent loan model to check if `credit_card_id` column exists on the loans table.
- If `credit_card_id` column EXISTS on the loan DB model: add `credit_card_id: Optional[UUID] = None` to LoanCreate schema.
- If `credit_card_id` column does NOT exist on the loan DB model: do NOT add it to schema (schema can't have fields with no DB column). Add a code comment in LoanCreate: `# credit_card_id: not applicable for loans (BUG-03 checked 2026-02-24)`
Also verify InstallmentCreate, FixedCreate have `credit_card_id`, `bank_account_id`, `currency` fields. Add any that are missing and have corresponding DB columns.
Add `first_payment_made: Optional[bool] = None` to schemas if the DB model has this column and it's absent from Create/Update schemas.
Python 3.9: `from __future__ import annotations` + `from typing import Optional`. No `X | Y`.

**BUG-04 — Verify category type mismatch validation:**
Read transactions.py lines 120-135 (create) and 248-260 (update). The research confirms lines 125-128 and 252-255 already enforce category type mismatch (returns 422).
Check installments.py create endpoint — does it also validate category type? If not, add the same validation pattern (3 lines).
Check fixed.py create endpoint — same check.
If BUG-04 is fully covered across all 3 endpoints: write a one-line comment in the task summary "BUG-04 verified: category mismatch enforced in transactions.py (create+update), installments.py, fixed.py".

**BUG-06 — Verify all list endpoints use typed response_model:**
Run this grep to check for untyped `list`:
```bash
grep -rn "response_model=list" backend/app/api/v1/endpoints/ | grep -v "List\["
```
If output is empty: BUG-06 is already fixed — note in summary.
If any untyped endpoints found: change `response_model=list` to `response_model=List[CorrectType]` using the correct response schema for each endpoint.

After all schema/code changes, run full test suite:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -x --tb=short -q
```
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ --tb=short -q 2>&1 | tail -10</automated>
    <manual>All 155+ tests pass. LoanCreate schema is verified (credit_card_id added or confirmed not applicable). No untyped list response_model remains.</manual>
  </verify>
  <done>Full backend test suite passes (155+ tests). LoanCreate has credit_card_id if DB column exists (or documented why not). BUG-04 category validation confirmed on create/update in transactions, installments, fixed. BUG-06 untyped list endpoints either fixed or confirmed already correct.</done>
</task>

</tasks>

<verification>
Final plan-level check:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v --tb=short 2>&1 | tail -20
```
Expected: All 155+ tests pass. test_reverse_payment_no_orphaned_transaction is PASSED. No new failures introduced.

Migration check:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. alembic history --verbose 2>&1 | head -10
```
Expected: Phase 5A migration is the current head.
</verification>

<success_criteria>
- test_reverse_payment_no_orphaned_transaction exists and passes (BUG-01 verified)
- Alembic migration runs cleanly with IF NOT EXISTS guards (BUG-02, BUG-05)
- LoanCreate schema updated for missing fields OR documented why field not applicable (BUG-03)
- Category type mismatch validated across transactions, installments, fixed endpoints (BUG-04)
- All list endpoints use typed List[Model] response_model (BUG-06)
- Full backend test suite: 155+ tests green, zero regressions
</success_criteria>

<output>
After completion, create `.planning/phases/5A-pre-deploy-fixes/5A-01-SUMMARY.md` with:
- Which bugs were truly fixed (new work) vs. already fixed (verified)
- Migration revision ID created
- Test count before/after (should be 155+ → 156+)
- Any deviations from plan and why
</output>
