"""Seed script: reset admin password + populate with realistic financial data."""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update
from app.db.session import engine, async_session
from app.db.models.user import User
from app.db.models.transaction import Transaction
from app.db.models.fixed_income_expense import FixedIncomeExpense
from app.db.models.installment import Installment
from app.db.models.loan import Loan
from app.db.models.bank_balance import BankBalance
from app.db.models.alert import Alert
from app.db.models.expected_income import ExpectedIncome
from app.core.security import hash_password

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
ADMIN_PASSWORD = "Admin2026!"
USER_ID = uuid.UUID("7b6339d7-ae1d-4d2f-98b6-6dc5dbf9c8be")

# Category IDs
CAT = {
    "salary":       uuid.UUID("2d127543-a2df-45d7-8476-4403c13e97e2"),
    "freelance":    uuid.UUID("f8c59d58-7f3c-4289-a30e-8965105a0633"),
    "investments":  uuid.UUID("b3415804-ac72-4056-8a91-35f7b675b474"),
    "other_income": uuid.UUID("e1c748e1-1722-4554-bbac-9b070144b311"),
    "rent":         uuid.UUID("9e309d57-7bea-4c55-973d-8eb791e22c67"),
    "software":     uuid.UUID("eb0ec6d3-65e2-4417-94c5-9c2ebafa4fab"),
    "car":          uuid.UUID("fffee7a7-bf3b-457b-8b6b-e97189f53378"),
    "restaurants":  uuid.UUID("54073dda-cead-4199-b936-bcafd153c9f1"),
    "insurance":    uuid.UUID("cce5d216-e79f-4e8e-bc46-e7a16f64ae8b"),
    "marketing":    uuid.UUID("2a732eeb-f348-4794-8afc-baa6cc69294f"),
    "salaries":     uuid.UUID("5665a5f7-98b9-462b-8d3d-4d8cc06a545e"),
    "office":       uuid.UUID("7294339b-af45-48a1-8036-3688c5dff72d"),
    "general":      uuid.UUID("ad733f3a-6d0f-4880-9686-1eb8bece600b"),
}


async def seed():
    async with async_session() as db:
        # ------------------------------------------------------------------- #
        # 1. Reset admin password
        # ------------------------------------------------------------------- #
        await db.execute(
            update(User)
            .where(User.id == USER_ID)
            .values(password_hash=hash_password(ADMIN_PASSWORD), is_admin=True)
        )
        print("[OK] Admin password reset to:", ADMIN_PASSWORD)

        # ------------------------------------------------------------------- #
        # 2. Bank Balance history (last 6 months)
        # ------------------------------------------------------------------- #
        balances = [
            (date(2025, 9, 1),  Decimal("42000.00"), False),
            (date(2025, 10, 1), Decimal("48500.00"), False),
            (date(2025, 11, 1), Decimal("51200.00"), False),
            (date(2025, 12, 1), Decimal("45800.00"), False),
            (date(2026, 1, 1),  Decimal("53400.00"), False),
            (date(2026, 2, 1),  Decimal("58750.00"), True),
        ]
        for eff_date, bal, is_current in balances:
            db.add(BankBalance(
                user_id=USER_ID,
                balance=bal,
                effective_date=eff_date,
                is_current=is_current,
                notes="Balance snapshot",
            ))
        print("[OK] Bank balances seeded (6 months)")

        # ------------------------------------------------------------------- #
        # 3. Transactions (last 3 months - ~60 transactions)
        # ------------------------------------------------------------------- #
        transactions = [
            # --- December 2025 ---
            (Decimal("28000.00"), "income", CAT["salary"],     "Monthly salary - Dec",       date(2025, 12, 1)),
            (Decimal("5500.00"),  "income", CAT["freelance"],  "Freelance project - Acme",   date(2025, 12, 5)),
            (Decimal("1200.00"), "income", CAT["investments"], "Stock dividends Q4",         date(2025, 12, 15)),
            (Decimal("8500.00"), "expense", CAT["rent"],       "Office rent - Dec",          date(2025, 12, 1)),
            (Decimal("12000.00"), "expense", CAT["salaries"],  "Employee salaries - Dec",    date(2025, 12, 5)),
            (Decimal("850.00"),  "expense", CAT["software"],   "AWS hosting",                date(2025, 12, 7)),
            (Decimal("420.00"),  "expense", CAT["software"],   "Figma Pro",                  date(2025, 12, 10)),
            (Decimal("780.00"),  "expense", CAT["car"],        "Car lease payment",          date(2025, 12, 12)),
            (Decimal("350.00"),  "expense", CAT["restaurants"], "Team lunch",                date(2025, 12, 14)),
            (Decimal("1500.00"), "expense", CAT["marketing"],  "Facebook Ads campaign",      date(2025, 12, 16)),
            (Decimal("230.00"),  "expense", CAT["office"],     "Office supplies",            date(2025, 12, 18)),
            (Decimal("680.00"),  "expense", CAT["insurance"],  "Business insurance",         date(2025, 12, 20)),
            (Decimal("150.00"),  "expense", CAT["restaurants"], "Client dinner",             date(2025, 12, 22)),
            (Decimal("320.00"),  "expense", CAT["general"],    "Accounting services",        date(2025, 12, 25)),
            (Decimal("190.00"),  "expense", CAT["software"],   "GitHub Enterprise",          date(2025, 12, 28)),
            (Decimal("2500.00"), "income", CAT["other_income"],"Tax refund",                 date(2025, 12, 30)),

            # --- January 2026 ---
            (Decimal("28000.00"), "income", CAT["salary"],     "Monthly salary - Jan",       date(2026, 1, 1)),
            (Decimal("3200.00"), "income", CAT["freelance"],   "Freelance - Logo design",    date(2026, 1, 8)),
            (Decimal("8500.00"), "expense", CAT["rent"],       "Office rent - Jan",          date(2026, 1, 1)),
            (Decimal("12000.00"), "expense", CAT["salaries"],  "Employee salaries - Jan",    date(2026, 1, 5)),
            (Decimal("850.00"),  "expense", CAT["software"],   "AWS hosting",                date(2026, 1, 7)),
            (Decimal("1200.00"), "expense", CAT["marketing"],  "Google Ads campaign",        date(2026, 1, 9)),
            (Decimal("780.00"),  "expense", CAT["car"],        "Car lease payment",          date(2026, 1, 12)),
            (Decimal("420.00"),  "expense", CAT["software"],   "Figma Pro",                  date(2026, 1, 10)),
            (Decimal("280.00"),  "expense", CAT["restaurants"], "Team lunch",                date(2026, 1, 14)),
            (Decimal("1800.00"), "expense", CAT["marketing"],  "LinkedIn sponsored posts",   date(2026, 1, 16)),
            (Decimal("450.00"),  "expense", CAT["office"],     "New monitor",                date(2026, 1, 18)),
            (Decimal("680.00"),  "expense", CAT["insurance"],  "Business insurance",         date(2026, 1, 20)),
            (Decimal("190.00"),  "expense", CAT["software"],   "GitHub Enterprise",          date(2026, 1, 22)),
            (Decimal("6500.00"), "income", CAT["freelance"],   "Freelance - Web app",        date(2026, 1, 25)),
            (Decimal("350.00"),  "expense", CAT["general"],    "Legal consultation",         date(2026, 1, 27)),
            (Decimal("520.00"),  "expense", CAT["restaurants"], "Client meetings",           date(2026, 1, 28)),
            (Decimal("900.00"),  "income", CAT["investments"], "Crypto gains",               date(2026, 1, 30)),

            # --- February 2026 ---
            (Decimal("28000.00"), "income", CAT["salary"],     "Monthly salary - Feb",       date(2026, 2, 1)),
            (Decimal("4200.00"), "income", CAT["freelance"],   "Freelance - Mobile app",     date(2026, 2, 3)),
            (Decimal("8500.00"), "expense", CAT["rent"],       "Office rent - Feb",          date(2026, 2, 1)),
            (Decimal("12000.00"), "expense", CAT["salaries"],  "Employee salaries - Feb",    date(2026, 2, 5)),
            (Decimal("850.00"),  "expense", CAT["software"],   "AWS hosting",                date(2026, 2, 7)),
            (Decimal("780.00"),  "expense", CAT["car"],        "Car lease payment",          date(2026, 2, 8)),
            (Decimal("420.00"),  "expense", CAT["software"],   "Figma Pro",                  date(2026, 2, 10)),
        ]

        for amount, tx_type, cat_id, desc, tx_date in transactions:
            db.add(Transaction(
                user_id=USER_ID,
                amount=amount,
                type=tx_type,
                category_id=cat_id,
                description=desc,
                date=tx_date,
                entry_pattern="one_time",
            ))
        print(f"[OK] Transactions seeded ({len(transactions)} records)")

        # ------------------------------------------------------------------- #
        # 4. Fixed Income/Expenses
        # ------------------------------------------------------------------- #
        fixed_items = [
            ("Office Rent",        Decimal("8500.00"),  "expense", CAT["rent"],      1,  date(2025, 1, 1), None),
            ("Employee Salaries",  Decimal("12000.00"), "expense", CAT["salaries"],  5,  date(2025, 1, 1), None),
            ("AWS Hosting",        Decimal("850.00"),   "expense", CAT["software"],  7,  date(2025, 3, 1), None),
            ("Figma Pro",          Decimal("420.00"),   "expense", CAT["software"],  10, date(2025, 6, 1), None),
            ("Car Lease",          Decimal("780.00"),   "expense", CAT["car"],       12, date(2025, 1, 1), date(2027, 12, 31)),
            ("Business Insurance", Decimal("680.00"),   "expense", CAT["insurance"], 20, date(2025, 1, 1), None),
            ("Monthly Salary",     Decimal("28000.00"), "income",  CAT["salary"],    1,  date(2024, 1, 1), None),
            ("Retainer Client",    Decimal("3500.00"),  "income",  CAT["freelance"], 15, date(2025, 9, 1), date(2026, 8, 31)),
        ]

        for name, amount, fx_type, cat_id, dom, start, end in fixed_items:
            db.add(FixedIncomeExpense(
                user_id=USER_ID,
                name=name,
                amount=amount,
                type=fx_type,
                category_id=cat_id,
                day_of_month=dom,
                start_date=start,
                end_date=end,
                is_active=True,
            ))
        print(f"[OK] Fixed income/expenses seeded ({len(fixed_items)} records)")

        # ------------------------------------------------------------------- #
        # 5. Installments
        # ------------------------------------------------------------------- #
        installments = [
            ("MacBook Pro 16",   Decimal("14400.00"), Decimal("1200.00"), 12, "expense", CAT["office"],   date(2025, 8, 1),  15, 6),
            ("Office Furniture", Decimal("9000.00"),  Decimal("750.00"),  12, "expense", CAT["office"],   date(2025, 10, 1), 10, 4),
            ("Client Project A", Decimal("24000.00"), Decimal("4000.00"), 6,  "income",  CAT["freelance"],date(2025, 11, 1), 1,  3),
        ]

        for name, total, monthly, num_pay, i_type, cat_id, start, dom, completed in installments:
            db.add(Installment(
                user_id=USER_ID,
                name=name,
                total_amount=total,
                monthly_amount=monthly,
                number_of_payments=num_pay,
                type=i_type,
                category_id=cat_id,
                start_date=start,
                day_of_month=dom,
                payments_completed=completed,
            ))
        print(f"[OK] Installments seeded ({len(installments)} records)")

        # ------------------------------------------------------------------- #
        # 6. Loans
        # ------------------------------------------------------------------- #
        loans = [
            ("Business Expansion Loan", Decimal("150000.00"), Decimal("3200.00"), Decimal("4.5"),
             CAT["general"], date(2024, 6, 1), 15, 60, 20,
             Decimal("150000.00") - Decimal("3200.00") * 20, "active"),
            ("Equipment Loan", Decimal("30000.00"), Decimal("1500.00"), Decimal("3.2"),
             CAT["office"], date(2025, 3, 1), 10, 24, 11,
             Decimal("30000.00") - Decimal("1500.00") * 11, "active"),
        ]

        for name, orig, monthly, rate, cat_id, start, dom, total_pay, made, remaining, status in loans:
            db.add(Loan(
                user_id=USER_ID,
                name=name,
                original_amount=orig,
                monthly_payment=monthly,
                interest_rate=rate,
                category_id=cat_id,
                start_date=start,
                day_of_month=dom,
                total_payments=total_pay,
                payments_made=made,
                remaining_balance=remaining,
                status=status,
            ))
        print(f"[OK] Loans seeded ({len(loans)} records)")

        # ------------------------------------------------------------------- #
        # 7. Expected Income (next 3 months)
        # ------------------------------------------------------------------- #
        expected = [
            (date(2026, 2, 1), Decimal("35000.00")),
            (date(2026, 3, 1), Decimal("38000.00")),
            (date(2026, 4, 1), Decimal("33000.00")),
        ]
        for month, amount in expected:
            db.add(ExpectedIncome(
                user_id=USER_ID,
                month=month,
                expected_amount=amount,
                notes="Projected income",
            ))
        print(f"[OK] Expected income seeded ({len(expected)} records)")

        # ------------------------------------------------------------------- #
        # 8. Alerts
        # ------------------------------------------------------------------- #
        now = datetime.now(timezone.utc)
        alerts = [
            ("high_expense", "warning", "הוצאות שיווק גבוהות",
             "הוצאות השיווק חרגו מהתקציב ב-15% החודש.",
             "category", CAT["marketing"], False),
            ("loan_payment", "info", "תשלום הלוואה קרב",
             "תשלום הלוואת הרחבת העסק בסך 3,200 ₪ ב-15 בפברואר.",
             None, None, False),
            ("low_balance", "critical", "יתרת מזומנים נמוכה",
             "יתרת הבנק ירדה מתחת לסף הביטחון של 50,000 ₪.",
             None, None, False),
            ("installment_progress", "info", "התקדמות תשלומי MacBook Pro",
             "6 מתוך 12 תשלומים שולמו עבור MacBook Pro 16.",
             "installment", None, True),
        ]

        for a_type, severity, title, msg, entity_type, entity_id, is_read in alerts:
            db.add(Alert(
                user_id=USER_ID,
                alert_type=a_type,
                severity=severity,
                title=title,
                message=msg,
                related_entity_type=entity_type,
                related_entity_id=entity_id,
                is_read=is_read,
            ))
        print(f"[OK] Alerts seeded ({len(alerts)} records)")

        # ------------------------------------------------------------------- #
        await db.commit()
        print("\n=== Seeding complete! ===")
        print(f"Username: admin")
        print(f"Password: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
