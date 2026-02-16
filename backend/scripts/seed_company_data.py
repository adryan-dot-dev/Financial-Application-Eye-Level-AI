"""
Seed script: Eye Level AI company financial data
Populates realistic financial data for testing all features.
"""
from __future__ import annotations

import asyncio
import httpx

BASE = "http://localhost:8000/api/v1"
USERNAME = "admin"
PASSWORD = "Admin2026!"


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        # ── Login ──
        r = await c.post("/auth/login", json={"username": USERNAME, "password": PASSWORD})
        assert r.status_code == 200, f"Login failed: {r.text}"
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        print("[OK] Logged in as admin")

        # ── Fetch seed categories ──
        cats_resp = await c.get("/categories?page_size=200", headers=h)
        cats = {cat["name"]: cat["id"] for cat in cats_resp.json()["items"]}
        print(f"[OK] Found {len(cats)} categories")

        # ── Helper ──
        async def post(path, data):
            r = await c.post(path, json=data, headers=h)
            if r.status_code not in (200, 201):
                print(f"  [WARN] {path}: {r.status_code} - {r.text[:120]}")
                return None
            return r.json()

        # ══════════════════════════════════════════════════════════
        # 1. BALANCE - Starting bank balance
        # ══════════════════════════════════════════════════════════
        print("\n── Setting bank balance ──")
        await post("/balance", {
            "balance": 285000,
            "effective_date": "2026-01-01",
            "notes": "Opening balance - Eye Level AI company account"
        })
        print("[OK] Balance: 285,000 ILS")

        # ══════════════════════════════════════════════════════════
        # 2. FIXED INCOME - Recurring monthly revenue
        # ══════════════════════════════════════════════════════════
        print("\n── Creating fixed income ──")
        fixed_income = [
            {"name": "Client A - SaaS Monthly", "amount": 35000, "day_of_month": 1,
             "start_date": "2025-06-01", "description": "Enterprise SaaS license - Client A"},
            {"name": "Client B - Retainer", "amount": 22000, "day_of_month": 5,
             "start_date": "2025-09-01", "description": "Monthly AI consulting retainer"},
            {"name": "Client C - API Usage", "amount": 8500, "day_of_month": 10,
             "start_date": "2025-11-01", "description": "API usage-based billing"},
            {"name": "Client D - Support Plan", "amount": 12000, "day_of_month": 15,
             "start_date": "2026-01-01", "description": "Premium support plan"},
        ]
        for item in fixed_income:
            await post("/fixed", {**item, "type": "income"})
            print(f"  [OK] {item['name']}: {item['amount']:,} ILS/month")

        # ══════════════════════════════════════════════════════════
        # 3. FIXED EXPENSES - Recurring monthly costs
        # ══════════════════════════════════════════════════════════
        print("\n── Creating fixed expenses ──")
        expense_cat = cats.get("Software & Services") or cats.get("Shopping")
        salary_cat = cats.get("Salary") or cats.get("Other")
        rent_cat = cats.get("Housing") or cats.get("Other")
        transport_cat = cats.get("Transportation")
        food_cat = cats.get("Food & Dining")

        fixed_expenses = [
            # Salaries
            {"name": "Salary - CEO (Roei)", "amount": 28000, "day_of_month": 9,
             "start_date": "2025-01-01", "description": "CEO monthly salary",
             "category_id": salary_cat},
            {"name": "Salary - CTO", "amount": 32000, "day_of_month": 9,
             "start_date": "2025-01-01", "description": "CTO monthly salary",
             "category_id": salary_cat},
            {"name": "Salary - Full Stack Developer", "amount": 24000, "day_of_month": 9,
             "start_date": "2025-06-01", "description": "Senior developer salary",
             "category_id": salary_cat},
            {"name": "Salary - AI Engineer", "amount": 26000, "day_of_month": 9,
             "start_date": "2025-09-01", "description": "ML/AI engineer salary",
             "category_id": salary_cat},
            # Office
            {"name": "Office Rent - WeWork TLV", "amount": 8500, "day_of_month": 1,
             "start_date": "2025-01-01", "description": "WeWork Tel Aviv co-working space",
             "category_id": rent_cat},
            # SaaS / Software
            {"name": "Monday.com - Business Plan", "amount": 680, "day_of_month": 3,
             "start_date": "2025-01-01", "description": "Monday.com 10 seats business plan"},
            {"name": "Claude API (Anthropic)", "amount": 4200, "day_of_month": 1,
             "start_date": "2025-03-01", "description": "Anthropic Claude API usage"},
            {"name": "AWS Cloud Hosting", "amount": 6800, "day_of_month": 5,
             "start_date": "2025-01-01", "description": "EC2, S3, RDS, CloudFront"},
            {"name": "GitHub Teams", "amount": 320, "day_of_month": 15,
             "start_date": "2025-01-01", "description": "GitHub Teams - 5 developers"},
            {"name": "Figma Professional", "amount": 180, "day_of_month": 12,
             "start_date": "2025-03-01", "description": "Figma design tool - 2 editors"},
            {"name": "Slack Business+", "amount": 420, "day_of_month": 1,
             "start_date": "2025-01-01", "description": "Slack Business+ 10 users"},
            {"name": "Vercel Pro", "amount": 150, "day_of_month": 20,
             "start_date": "2025-06-01", "description": "Vercel Pro - frontend hosting"},
            # Professional services
            {"name": "Accounting - CPA Firm", "amount": 3500, "day_of_month": 25,
             "start_date": "2025-01-01", "description": "Monthly accounting & bookkeeping"},
            {"name": "Legal Retainer", "amount": 2000, "day_of_month": 1,
             "start_date": "2025-06-01", "description": "Legal advisor monthly retainer"},
            # Insurance
            {"name": "Business Insurance", "amount": 1200, "day_of_month": 10,
             "start_date": "2025-01-01", "description": "Professional liability + property"},
            # Internet & Phone
            {"name": "Office Internet (Bezeq)", "amount": 350, "day_of_month": 15,
             "start_date": "2025-01-01", "description": "1Gbps business fiber"},
            {"name": "Company Phone Plan", "amount": 480, "day_of_month": 20,
             "start_date": "2025-01-01", "description": "5 mobile lines - business plan"},
        ]
        for item in fixed_expenses:
            payload = {
                "name": item["name"],
                "amount": item["amount"],
                "type": "expense",
                "day_of_month": item["day_of_month"],
                "start_date": item["start_date"],
                "description": item.get("description", ""),
            }
            if item.get("category_id"):
                payload["category_id"] = item["category_id"]
            await post("/fixed", payload)
            print(f"  [OK] {item['name']}: {item['amount']:,} ILS/month")

        # ══════════════════════════════════════════════════════════
        # 4. INSTALLMENTS - Split payments (income & expense)
        # ══════════════════════════════════════════════════════════
        print("\n── Creating installments ──")
        installments = [
            # Expense installments
            {"name": "Office Furniture (IKEA)", "total_amount": 18000,
             "number_of_payments": 12, "type": "expense",
             "start_date": "2025-10-01", "day_of_month": 5,
             "description": "Desks, chairs, shelving for new office"},
            {"name": "MacBook Pro x3 (iDigital)", "total_amount": 42000,
             "number_of_payments": 12, "type": "expense",
             "start_date": "2025-11-01", "day_of_month": 10,
             "description": "3 MacBook Pro M4 for dev team"},
            {"name": "Conference Tickets (AI Summit)", "total_amount": 9600,
             "number_of_payments": 4, "type": "expense",
             "start_date": "2026-01-01", "day_of_month": 1,
             "description": "4 tickets to AI Summit Berlin"},
            {"name": "Server Upgrade (Dell)", "total_amount": 28000,
             "number_of_payments": 6, "type": "expense",
             "start_date": "2026-01-01", "day_of_month": 15,
             "description": "Dell PowerEdge server for on-prem ML training"},
            # Income installments
            {"name": "Project Alpha - Client E", "total_amount": 120000,
             "number_of_payments": 6, "type": "income",
             "start_date": "2025-12-01", "day_of_month": 1,
             "description": "Custom AI pipeline development - 6 milestone payments"},
            {"name": "Training Program - Client F", "total_amount": 36000,
             "number_of_payments": 3, "type": "income",
             "start_date": "2026-01-01", "day_of_month": 20,
             "description": "AI training workshops - 3 sessions"},
        ]
        for item in installments:
            result = await post("/installments", item)
            if result:
                print(f"  [OK] {item['name']}: {item['total_amount']:,} ILS / {item['number_of_payments']} payments ({item['type']})")

        # Mark some installment payments as paid
        print("\n  Marking some installment payments as paid...")
        inst_list = await c.get("/installments", headers=h)
        for inst in inst_list.json():
            name = inst["name"]
            iid = inst["id"]
            # Mark payments for older installments
            if "IKEA" in name:
                for _ in range(4):  # 4 of 12 paid
                    await c.post(f"/installments/{iid}/mark-paid", headers=h)
                print(f"  [OK] {name}: marked 4/12 paid")
            elif "MacBook" in name:
                for _ in range(3):  # 3 of 12 paid
                    await c.post(f"/installments/{iid}/mark-paid", headers=h)
                print(f"  [OK] {name}: marked 3/12 paid")
            elif "Project Alpha" in name:
                for _ in range(3):  # 3 of 6 paid
                    await c.post(f"/installments/{iid}/mark-paid", headers=h)
                print(f"  [OK] {name}: marked 3/6 paid")
            elif "Conference" in name:
                for _ in range(1):  # 1 of 4 paid
                    await c.post(f"/installments/{iid}/mark-paid", headers=h)
                print(f"  [OK] {name}: marked 1/4 paid")

        # ══════════════════════════════════════════════════════════
        # 5. LOANS - Business loans
        # ══════════════════════════════════════════════════════════
        print("\n── Creating loans ──")
        loans = [
            {"name": "Business Expansion Loan (Leumi)", "original_amount": 500000,
             "monthly_payment": 9500, "interest_rate": 4.5,
             "start_date": "2025-06-01", "day_of_month": 15,
             "total_payments": 60,
             "description": "5-year business expansion loan from Bank Leumi"},
            {"name": "Equipment Financing (Mizrahi)", "original_amount": 150000,
             "monthly_payment": 6800, "interest_rate": 3.2,
             "start_date": "2025-09-01", "day_of_month": 1,
             "total_payments": 24,
             "description": "2-year equipment financing - servers & hardware"},
        ]
        for loan in loans:
            result = await post("/loans", loan)
            if result:
                lid = result["id"]
                print(f"  [OK] {loan['name']}: {loan['original_amount']:,} ILS @ {loan['interest_rate']}%")

        # Make some loan payments
        print("\n  Making loan payments...")
        loan_list = await c.get("/loans", headers=h)
        for loan in loan_list.json():
            name = loan["name"]
            lid = loan["id"]
            if "Leumi" in name:
                for _ in range(8):  # 8 payments made (Jun 2025 - Jan 2026)
                    await c.post(f"/loans/{lid}/payment",
                                 json={"amount": 9500}, headers=h)
                print(f"  [OK] {name}: 8 payments made")
            elif "Mizrahi" in name:
                for _ in range(5):  # 5 payments made (Sep 2025 - Jan 2026)
                    await c.post(f"/loans/{lid}/payment",
                                 json={"amount": 6800}, headers=h)
                print(f"  [OK] {name}: 5 payments made")

        # ══════════════════════════════════════════════════════════
        # 6. TRANSACTIONS - Historical transactions (last 3 months)
        # ══════════════════════════════════════════════════════════
        print("\n── Creating transactions ──")

        # December 2025 transactions
        dec_transactions = [
            {"amount": 35000, "type": "income", "description": "Client A - SaaS Dec", "date": "2025-12-01"},
            {"amount": 22000, "type": "income", "description": "Client B - Retainer Dec", "date": "2025-12-05"},
            {"amount": 8500, "type": "income", "description": "Client C - API Dec", "date": "2025-12-10"},
            {"amount": 15000, "type": "income", "description": "Ad-hoc consulting project", "date": "2025-12-18",
             "tags": ["consulting", "one-time"]},
            {"amount": 28000, "type": "expense", "description": "Salary - CEO Dec", "date": "2025-12-09"},
            {"amount": 32000, "type": "expense", "description": "Salary - CTO Dec", "date": "2025-12-09"},
            {"amount": 24000, "type": "expense", "description": "Salary - Developer Dec", "date": "2025-12-09"},
            {"amount": 26000, "type": "expense", "description": "Salary - AI Engineer Dec", "date": "2025-12-09"},
            {"amount": 8500, "type": "expense", "description": "Office Rent Dec", "date": "2025-12-01"},
            {"amount": 4200, "type": "expense", "description": "Claude API Dec", "date": "2025-12-01"},
            {"amount": 7200, "type": "expense", "description": "AWS Dec (higher usage)", "date": "2025-12-05"},
            {"amount": 680, "type": "expense", "description": "Monday.com Dec", "date": "2025-12-03"},
            {"amount": 3500, "type": "expense", "description": "Accounting Dec", "date": "2025-12-25"},
            {"amount": 2800, "type": "expense", "description": "Team dinner - year end", "date": "2025-12-28",
             "tags": ["team", "celebration"]},
            {"amount": 1500, "type": "expense", "description": "Office supplies", "date": "2025-12-15"},
        ]

        # January 2026 transactions
        jan_transactions = [
            {"amount": 35000, "type": "income", "description": "Client A - SaaS Jan", "date": "2026-01-01"},
            {"amount": 22000, "type": "income", "description": "Client B - Retainer Jan", "date": "2026-01-05"},
            {"amount": 8500, "type": "income", "description": "Client C - API Jan", "date": "2026-01-10"},
            {"amount": 12000, "type": "income", "description": "Client D - Support Plan Jan", "date": "2026-01-15"},
            {"amount": 20000, "type": "income", "description": "Project Alpha - Milestone 1", "date": "2026-01-01",
             "entry_pattern": "installment"},
            {"amount": 28000, "type": "expense", "description": "Salary - CEO Jan", "date": "2026-01-09"},
            {"amount": 32000, "type": "expense", "description": "Salary - CTO Jan", "date": "2026-01-09"},
            {"amount": 24000, "type": "expense", "description": "Salary - Developer Jan", "date": "2026-01-09"},
            {"amount": 26000, "type": "expense", "description": "Salary - AI Engineer Jan", "date": "2026-01-09"},
            {"amount": 8500, "type": "expense", "description": "Office Rent Jan", "date": "2026-01-01"},
            {"amount": 4200, "type": "expense", "description": "Claude API Jan", "date": "2026-01-01"},
            {"amount": 6800, "type": "expense", "description": "AWS Jan", "date": "2026-01-05"},
            {"amount": 680, "type": "expense", "description": "Monday.com Jan", "date": "2026-01-03"},
            {"amount": 320, "type": "expense", "description": "GitHub Teams Jan", "date": "2026-01-15"},
            {"amount": 180, "type": "expense", "description": "Figma Jan", "date": "2026-01-12"},
            {"amount": 420, "type": "expense", "description": "Slack Jan", "date": "2026-01-01"},
            {"amount": 3500, "type": "expense", "description": "Accounting Jan", "date": "2026-01-25"},
            {"amount": 2000, "type": "expense", "description": "Legal Retainer Jan", "date": "2026-01-01"},
            {"amount": 1200, "type": "expense", "description": "Business Insurance Jan", "date": "2026-01-10"},
            {"amount": 350, "type": "expense", "description": "Internet Jan", "date": "2026-01-15"},
            {"amount": 480, "type": "expense", "description": "Phone Plan Jan", "date": "2026-01-20"},
            {"amount": 150, "type": "expense", "description": "Vercel Pro Jan", "date": "2026-01-20"},
            {"amount": 5500, "type": "expense", "description": "Marketing - Google Ads Jan", "date": "2026-01-08",
             "tags": ["marketing", "ads"]},
            {"amount": 3200, "type": "expense", "description": "Marketing - LinkedIn Ads Jan", "date": "2026-01-10",
             "tags": ["marketing", "ads"]},
        ]

        # February 2026 transactions
        feb_transactions = [
            {"amount": 35000, "type": "income", "description": "Client A - SaaS Feb", "date": "2026-02-01"},
            {"amount": 22000, "type": "income", "description": "Client B - Retainer Feb", "date": "2026-02-05"},
            {"amount": 9200, "type": "income", "description": "Client C - API Feb (growth)", "date": "2026-02-10"},
            {"amount": 12000, "type": "income", "description": "Client D - Support Plan Feb", "date": "2026-02-15"},
            {"amount": 28000, "type": "expense", "description": "Salary - CEO Feb", "date": "2026-02-09"},
            {"amount": 32000, "type": "expense", "description": "Salary - CTO Feb", "date": "2026-02-09"},
            {"amount": 24000, "type": "expense", "description": "Salary - Developer Feb", "date": "2026-02-09"},
            {"amount": 26000, "type": "expense", "description": "Salary - AI Engineer Feb", "date": "2026-02-09"},
            {"amount": 8500, "type": "expense", "description": "Office Rent Feb", "date": "2026-02-01"},
            {"amount": 4800, "type": "expense", "description": "Claude API Feb (increased)", "date": "2026-02-01"},
            {"amount": 7100, "type": "expense", "description": "AWS Feb", "date": "2026-02-05"},
            {"amount": 680, "type": "expense", "description": "Monday.com Feb", "date": "2026-02-03"},
            {"amount": 320, "type": "expense", "description": "GitHub Teams Feb", "date": "2026-02-15"},
            {"amount": 3500, "type": "expense", "description": "Accounting Feb", "date": "2026-02-14"},
            {"amount": 4200, "type": "expense", "description": "Marketing - Google Ads Feb", "date": "2026-02-06",
             "tags": ["marketing", "ads"]},
            {"amount": 2400, "type": "expense", "description": "Team lunch - brainstorm", "date": "2026-02-12",
             "tags": ["team", "food"]},
            {"amount": 850, "type": "expense", "description": "Domain renewals", "date": "2026-02-08"},
        ]

        all_txns = dec_transactions + jan_transactions + feb_transactions
        income_count = sum(1 for t in all_txns if t["type"] == "income")
        expense_count = sum(1 for t in all_txns if t["type"] == "expense")
        for txn in all_txns:
            await post("/transactions", txn)

        print(f"  [OK] Created {len(all_txns)} transactions ({income_count} income, {expense_count} expense)")

        # ══════════════════════════════════════════════════════════
        # 7. SUMMARY
        # ══════════════════════════════════════════════════════════
        print("\n" + "=" * 60)
        print("  SEED COMPLETE - Eye Level AI Company Data")
        print("=" * 60)
        print(f"  Balance:       285,000 ILS (opening)")
        print(f"  Fixed Income:  {len(fixed_income)} entries ({sum(f['amount'] for f in fixed_income):,} ILS/month)")
        print(f"  Fixed Expense: {len(fixed_expenses)} entries ({sum(f['amount'] for f in fixed_expenses):,} ILS/month)")
        print(f"  Installments:  {len(installments)} ({sum(1 for i in installments if i['type']=='expense')} expense, {sum(1 for i in installments if i['type']=='income')} income)")
        print(f"  Loans:         {len(loans)} ({sum(l['original_amount'] for l in loans):,} ILS total)")
        print(f"  Transactions:  {len(all_txns)} ({income_count} income, {expense_count} expense)")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
