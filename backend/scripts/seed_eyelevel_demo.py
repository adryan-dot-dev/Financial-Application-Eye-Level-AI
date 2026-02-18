"""Seed script: Create Eye Level AI demo user with comprehensive company data.

Usage:
    cd backend && source venv/bin/activate
    PYTHONPATH=. python scripts/seed_eyelevel_demo.py
"""
from __future__ import annotations

import asyncio
import sys
from datetime import date, timedelta

import httpx

BASE = "http://localhost:8000/api/v1"

# ──────────────────────────────────────────
# User credentials
# ──────────────────────────────────────────
USER = {
    "username": "eyelevel_co",
    "email": "team@eyelevel.ai",
    "password": "EyeLevel2026!",
}


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        # ── 1. Register ───────────────────────────
        print("1. Registering user...")
        r = await c.post("/auth/register", json=USER)
        if r.status_code == 201:
            token = r.json()["access_token"]
            print(f"   ✓ User created: {USER['username']}")
        elif r.status_code == 409:
            print("   User exists, logging in...")
            r = await c.post("/auth/login", json={
                "username": USER["username"],
                "password": USER["password"],
            })
            if r.status_code != 200:
                print(f"   ✗ Login failed: {r.status_code} {r.text}")
                sys.exit(1)
            token = r.json()["access_token"]
        else:
            print(f"   ✗ Register failed: {r.status_code} {r.text}")
            sys.exit(1)

        h = {"Authorization": f"Bearer {token}"}

        # ── 2. Settings ──────────────────────────
        print("2. Updating settings...")
        await c.put("/settings", json={
            "currency": "ILS",
            "language": "he",
            "theme": "dark",
            "forecast_months_default": 6,
            "alert_warning_threshold": 50000,
            "alert_critical_threshold": 20000,
            "onboarding_completed": True,
        }, headers=h)
        print("   ✓ Settings updated")

        # ── 3. Categories ────────────────────────
        print("3. Creating categories...")
        cats = {}

        custom_categories = [
            # Expense categories
            {"name": "SaaS & Software", "name_he": "תוכנה ומנויים", "type": "expense", "icon": "monitor", "color": "#8B5CF6"},
            {"name": "Marketing & Ads", "name_he": "שיווק ופרסום", "type": "expense", "icon": "megaphone", "color": "#EF4444"},
            {"name": "Salaries", "name_he": "משכורות", "type": "expense", "icon": "users", "color": "#F59E0B"},
            {"name": "Office & Rent", "name_he": "משרד ושכירות", "type": "expense", "icon": "building", "color": "#6366F1"},
            {"name": "Servers & Infra", "name_he": "שרתים ותשתיות", "type": "expense", "icon": "server", "color": "#06B6D4"},
            {"name": "Professional Services", "name_he": "ייעוץ מקצועי", "type": "expense", "icon": "briefcase", "color": "#10B981"},
            {"name": "Insurance & Pension", "name_he": "ביטוח ופנסיה", "type": "expense", "icon": "shield", "color": "#F97316"},
            {"name": "Communication", "name_he": "תקשורת", "type": "expense", "icon": "phone", "color": "#14B8A6"},
            {"name": "Equipment", "name_he": "ציוד", "type": "expense", "icon": "wrench", "color": "#78716C"},
            {"name": "Travel & Transport", "name_he": "נסיעות", "type": "expense", "icon": "car", "color": "#A855F7"},
            # Income categories
            {"name": "AI Services", "name_he": "שירותי AI", "type": "income", "icon": "brain", "color": "#3B82F6"},
            {"name": "Consulting", "name_he": "ייעוץ", "type": "income", "icon": "message-circle", "color": "#22C55E"},
            {"name": "Product Sales", "name_he": "מכירת מוצר", "type": "income", "icon": "package", "color": "#0EA5E9"},
            {"name": "Retainers", "name_he": "ריטיינרים", "type": "income", "icon": "repeat", "color": "#8B5CF6"},
        ]

        for cat_data in custom_categories:
            r = await c.post("/categories", json=cat_data, headers=h)
            if r.status_code == 201:
                cats[cat_data["name"]] = r.json()["id"]
            elif r.status_code == 409:
                # Already exists, fetch it
                pass
            else:
                print(f"   ⚠ Category '{cat_data['name']}': {r.status_code}")

        # Fetch all categories to fill gaps (paginated response)
        r = await c.get("/categories", params={"page_size": 100}, headers=h)
        if r.status_code == 200:
            data = r.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            for cat in items:
                cats[cat["name"]] = cat["id"]
        print(f"   ✓ {len(cats)} categories ready")

        # ── 4. Bank Balance ──────────────────────
        print("4. Setting bank balance...")
        await c.post("/balance", json={
            "balance": 187500,
            "effective_date": "2026-02-18",
            "notes": "יתרת חשבון עסקי - בנק הפועלים",
        }, headers=h)
        print("   ✓ Balance set: ₪187,500")

        # ── 5. Subscriptions ─────────────────────
        print("5. Creating subscriptions...")

        saas_id = cats.get("SaaS & Software")
        marketing_id = cats.get("Marketing & Ads")
        servers_id = cats.get("Servers & Infra")
        comm_id = cats.get("Communication")
        prof_id = cats.get("Professional Services")
        ins_id = cats.get("Insurance & Pension")

        subscriptions = [
            # Monthly USD subscriptions
            {"name": "Lovable", "amount": 25, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": saas_id,
             "provider": "Lovable", "notes": "AI development platform"},
            {"name": "Claude Pro (x2)", "amount": 40, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-05", "category_id": saas_id,
             "provider": "Anthropic", "notes": "2 מנויים - בר ויובל"},
            {"name": "ChatGPT Plus", "amount": 20, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-10", "category_id": saas_id,
             "provider": "OpenAI"},
            {"name": "Zoom - Bar", "amount": 64.99, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": comm_id,
             "provider": "Zoom Video Communications"},
            {"name": "Zadarma", "amount": 20, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": comm_id,
             "provider": "Zadarma", "notes": "טלפוניית VoIP"},
            {"name": "SendGrid", "amount": 89.95, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": saas_id,
             "provider": "Twilio SendGrid", "notes": "שליחת מיילים"},
            {"name": "ManyChat", "amount": 150, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-15", "category_id": marketing_id,
             "provider": "ManyChat", "notes": "אוטומציית צ'אט"},
            {"name": "Digital Ocean", "amount": 12, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": servers_id,
             "provider": "Digital Ocean", "notes": "שרת VPS"},
            {"name": "Monday.com", "amount": 240, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": saas_id,
             "provider": "Monday.com", "notes": "ניהול פרויקטים"},
            {"name": "Sentry", "amount": 29, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": servers_id,
             "provider": "Sentry", "notes": "ניטור שגיאות"},
            {"name": "Slack", "amount": 26.25, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": comm_id,
             "provider": "Slack Technologies", "notes": "תכף מסתיים"},
            {"name": "Make (Integromat)", "amount": 10, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": saas_id,
             "provider": "Make", "notes": "אוטומציות"},
            {"name": "PayPro Global", "amount": 144, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": prof_id,
             "provider": "PayPro Global", "notes": "פלטפורמת תשלומים"},
            {"name": "GenSpark", "amount": 25, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-05", "category_id": saas_id,
             "provider": "GenSpark"},
            {"name": "Ideogram", "amount": 20, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-10", "category_id": saas_id,
             "provider": "Ideogram", "notes": "יצירת תמונות AI"},
            # Monthly ILS subscriptions
            {"name": "Google Workspace", "amount": 180, "currency": "ILS", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": saas_id,
             "provider": "Google", "notes": "חבילת Google לעסקים"},
            {"name": "Vangus", "amount": 40.12, "currency": "ILS", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": comm_id,
             "provider": "Vangus", "notes": "הקלטת שיחות"},
            {"name": "Gemini Advanced", "amount": 75, "currency": "ILS", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-15", "category_id": saas_id,
             "provider": "Google", "notes": "Gemini AI"},
            {"name": "WeCom", "amount": 120, "currency": "ILS", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": comm_id,
             "provider": "Tencent", "notes": "תקשורת צוותית"},
            # Annual USD subscriptions
            {"name": "Zoom - Annual (Bar)", "amount": 1649.90, "currency": "USD", "billing_cycle": "annual",
             "next_renewal_date": "2027-01-15", "category_id": comm_id,
             "provider": "Zoom Video Communications", "notes": "מנוי שנתי"},
            {"name": "Gamma", "amount": 180, "currency": "USD", "billing_cycle": "annual",
             "next_renewal_date": "2027-01-01", "category_id": saas_id,
             "provider": "Gamma", "notes": "מצגות AI - מנוי שנתי"},
            {"name": "Canva Pro", "amount": 120, "currency": "USD", "billing_cycle": "annual",
             "next_renewal_date": "2026-12-01", "category_id": saas_id,
             "provider": "Canva", "notes": "עיצוב - מנוי שנתי"},
            # Annual ILS subscriptions
            {"name": "Captions", "amount": 229, "currency": "ILS", "billing_cycle": "annual",
             "next_renewal_date": "2027-02-01", "category_id": saas_id,
             "provider": "Captions", "notes": "כתוביות AI - מנוי שנתי"},
            {"name": "CapCut Pro", "amount": 500, "currency": "ILS", "billing_cycle": "annual",
             "next_renewal_date": "2026-11-01", "category_id": saas_id,
             "provider": "ByteDance", "notes": "עריכת וידאו - מנוי שנתי"},
            {"name": "Kling AI", "amount": 30, "currency": "USD", "billing_cycle": "monthly",
             "next_renewal_date": "2026-03-01", "category_id": saas_id,
             "provider": "Kuaishou", "notes": "יצירת וידאו AI"},
        ]

        sub_count = 0
        for sub in subscriptions:
            r = await c.post("/subscriptions", json=sub, headers=h)
            if r.status_code == 201:
                sub_count += 1
            else:
                print(f"   ⚠ Subscription '{sub['name']}': {r.status_code} {r.text[:100]}")
        print(f"   ✓ {sub_count} subscriptions created")

        # ── 6. Fixed Income/Expenses ──────────────
        print("6. Creating fixed income/expenses...")

        fixed_items = [
            # Fixed expenses
            {"name": "משכורת - בר", "amount": 22000, "type": "expense", "day_of_month": 9,
             "start_date": "2025-01-01", "category_id": cats.get("Salaries"),
             "description": "משכורת ברוטו + הפרשות מעסיק"},
            {"name": "משכורת - יובל", "amount": 18000, "type": "expense", "day_of_month": 9,
             "start_date": "2025-03-01", "category_id": cats.get("Salaries"),
             "description": "משכורת ברוטו + הפרשות מעסיק"},
            {"name": "משכורת - נועה", "amount": 15000, "type": "expense", "day_of_month": 9,
             "start_date": "2025-06-01", "category_id": cats.get("Salaries"),
             "description": "משכורת ברוטו + הפרשות מעסיק"},
            {"name": "משכורת - דן (פרילנסר)", "amount": 12000, "type": "expense", "day_of_month": 1,
             "start_date": "2025-09-01", "category_id": cats.get("Salaries"),
             "description": "חשבונית חודשית - פיתוח"},
            {"name": "שכירות משרד - הרצליה", "amount": 8500, "type": "expense", "day_of_month": 1,
             "start_date": "2025-01-01", "category_id": cats.get("Office & Rent"),
             "description": "משרד 60 מ\"ר, הרצליה פיתוח"},
            {"name": "ארנונה + ועד בית", "amount": 1200, "type": "expense", "day_of_month": 15,
             "start_date": "2025-01-01", "category_id": cats.get("Office & Rent")},
            {"name": "חשמל משרד", "amount": 650, "type": "expense", "day_of_month": 20,
             "start_date": "2025-01-01", "category_id": cats.get("Office & Rent")},
            {"name": "אינטרנט - בזק", "amount": 280, "type": "expense", "day_of_month": 5,
             "start_date": "2025-01-01", "category_id": cats.get("Communication"),
             "description": "חבילת עסקים 500Mbps"},
            {"name": "רואה חשבון", "amount": 3500, "type": "expense", "day_of_month": 10,
             "start_date": "2025-01-01", "category_id": cats.get("Professional Services"),
             "description": "הנהלת חשבונות + דוחות"},
            {"name": "ביטוח מקצועי", "amount": 850, "type": "expense", "day_of_month": 1,
             "start_date": "2025-01-01", "category_id": cats.get("Insurance & Pension"),
             "description": "ביטוח אחריות מקצועית + צד ג"},
            {"name": "מיכפל - פנסיות", "amount": 2800, "type": "expense", "day_of_month": 15,
             "start_date": "2025-01-01", "category_id": cats.get("Insurance & Pension"),
             "description": "הפרשות פנסיוניות - 50 כללי + 14.9 לת\"ז"},
            {"name": "קארדקום - עמלות סליקה", "amount": 1800, "type": "expense", "day_of_month": 5,
             "start_date": "2025-01-01", "category_id": cats.get("Professional Services"),
             "description": "עמלות סליקת אשראי - מחיר משתנה, ממוצע"},
            # Fixed income
            {"name": "ריטיינר - חברת אלפא", "amount": 35000, "type": "income", "day_of_month": 1,
             "start_date": "2025-04-01", "category_id": cats.get("Retainers"),
             "description": "שירותי AI חודשיים - חוזה שנתי"},
            {"name": "ריטיינר - סטארטאפ ביתא", "amount": 18000, "type": "income", "day_of_month": 1,
             "start_date": "2025-07-01", "category_id": cats.get("Retainers"),
             "description": "ייעוץ AI + פיתוח חודשי"},
            {"name": "ריטיינר - גמא טכנולוגיות", "amount": 12000, "type": "income", "day_of_month": 15,
             "start_date": "2025-10-01", "category_id": cats.get("AI Services"),
             "description": "תחזוקת מודלים + אופטימיזציה"},
            {"name": "מנוי מוצר SaaS", "amount": 8500, "type": "income", "day_of_month": 1,
             "start_date": "2025-06-01", "category_id": cats.get("Product Sales"),
             "description": "15 לקוחות x ₪566 ממוצע"},
        ]

        fixed_count = 0
        for item in fixed_items:
            r = await c.post("/fixed", json=item, headers=h)
            if r.status_code == 201:
                fixed_count += 1
            else:
                print(f"   ⚠ Fixed '{item['name']}': {r.status_code} {r.text[:100]}")
        print(f"   ✓ {fixed_count} fixed items created")

        # ── 7. Transactions (6 months history) ────
        print("7. Creating transactions (6 months)...")
        tx_count = 0

        # Meta advertising - variable monthly
        meta_amounts = [8200, 9933, 11500, 7800, 10200, 9400]
        for i, amt in enumerate(meta_amounts):
            month = date(2025, 9 + i if 9 + i <= 12 else (9 + i - 12), 15)
            if 9 + i > 12:
                month = date(2026, 9 + i - 12, 15)
            r = await c.post("/transactions", json={
                "amount": amt, "type": "expense", "date": str(month),
                "category_id": marketing_id,
                "description": f"Meta Ads - פרסום ממומן",
                "notes": f"קמפיינים: Lead Gen + Awareness",
            }, headers=h)
            if r.status_code == 201:
                tx_count += 1

        # Google Ads - variable monthly
        google_amounts = [4500, 5200, 3800, 6100, 4900, 5500]
        for i, amt in enumerate(google_amounts):
            month = date(2025, 9 + i if 9 + i <= 12 else (9 + i - 12), 20)
            if 9 + i > 12:
                month = date(2026, 9 + i - 12, 20)
            r = await c.post("/transactions", json={
                "amount": amt, "type": "expense", "date": str(month),
                "category_id": marketing_id,
                "description": "Google Ads - קמפיינים",
            }, headers=h)
            if r.status_code == 201:
                tx_count += 1

        # One-time project income
        project_income = [
            ("2025-09-15", 45000, "פרויקט חד-פעמי - אינטגרציית AI לחברת דלתא", "AI Services"),
            ("2025-10-20", 28000, "סדנת AI למנהלים - חברת אומגה", "Consulting"),
            ("2025-11-05", 15000, "פיתוח POC - סטארטאפ ZetaAI", "AI Services"),
            ("2025-12-10", 52000, "פרויקט NLP - בנק לאומי", "AI Services"),
            ("2026-01-15", 35000, "אופטימיזציית מודלים - חברת ביטוח", "Consulting"),
            ("2026-01-28", 8000, "הרצאה בכנס AI Israel", "Consulting"),
            ("2026-02-05", 42000, "פרויקט Computer Vision - תעשייה", "AI Services"),
            ("2026-02-12", 18000, "ייעוץ ארכיטקטורת AI - סטארטאפ", "Consulting"),
        ]
        for dt, amt, desc, cat_name in project_income:
            r = await c.post("/transactions", json={
                "amount": amt, "type": "income", "date": dt,
                "category_id": cats.get(cat_name),
                "description": desc,
            }, headers=h)
            if r.status_code == 201:
                tx_count += 1

        # One-time expenses
        onetime_expenses = [
            ("2025-09-20", 3500, "כנס TechCrunch - כרטיסי טיסה", "Travel & Transport"),
            ("2025-10-05", 12500, "מחשב MacBook Pro M4 - יובל", "Equipment"),
            ("2025-10-15", 2200, "ריהוט משרד - כיסאות ארגונומיים x2", "Office & Rent"),
            ("2025-11-01", 8900, "שרת GPU ענן - חודש אימון מודלים", "Servers & Infra"),
            ("2025-11-20", 1500, "אירוח לקוחות - ארוחת ערב עסקית", "Professional Services"),
            ("2025-12-01", 15000, "בונוס סוף שנה - בר", "Salaries"),
            ("2025-12-01", 10000, "בונוס סוף שנה - יובל", "Salaries"),
            ("2025-12-15", 4200, "מתנות סוף שנה לצוות + לקוחות", "Office & Rent"),
            ("2026-01-05", 6800, "כנס CES - נסיעה + לינה", "Travel & Transport"),
            ("2026-01-10", 3200, "שדרוג מסכים x3 - 4K monitors", "Equipment"),
            ("2026-01-20", 1800, "חידוש דומיינים + SSL", "Servers & Infra"),
            ("2026-02-01", 2500, "ייעוץ משפטי - חוזה לקוח חדש", "Professional Services"),
            ("2026-02-10", 950, "חומרי שיווק - רול-אפים + כרטיסי ביקור", "Marketing & Ads"),
            ("2026-02-15", 7500, "GPU Cloud - אימון מודל חדש", "Servers & Infra"),
        ]
        for dt, amt, desc, cat_name in onetime_expenses:
            r = await c.post("/transactions", json={
                "amount": amt, "type": "expense", "date": dt,
                "category_id": cats.get(cat_name),
                "description": desc,
            }, headers=h)
            if r.status_code == 201:
                tx_count += 1

        print(f"   ✓ {tx_count} transactions created")

        # ── 8. Loans ─────────────────────────────
        print("8. Creating loans...")

        loans = [
            {
                "name": "הלוואת ציוד מחשוב",
                "original_amount": 85000,
                "monthly_payment": 7500,
                "interest_rate": 4.5,
                "start_date": "2025-06-01",
                "day_of_month": 10,
                "total_payments": 12,
                "description": "רכישת שרתים + תחנות עבודה",
                "category_id": cats.get("Equipment"),
            },
            {
                "name": "הלוואת הרחבת משרד",
                "original_amount": 120000,
                "monthly_payment": 5500,
                "interest_rate": 3.8,
                "start_date": "2025-09-01",
                "day_of_month": 1,
                "total_payments": 24,
                "description": "שיפוץ + הרחבת משרד הרצליה",
                "category_id": cats.get("Office & Rent"),
            },
        ]

        loan_ids = []
        for loan_data in loans:
            r = await c.post("/loans", json=loan_data, headers=h)
            if r.status_code == 201:
                lid = r.json()["id"]
                loan_ids.append(lid)
            else:
                print(f"   ⚠ Loan '{loan_data['name']}': {r.status_code} {r.text[:100]}")

        # Record payments on first loan (8 payments made since June 2025)
        if len(loan_ids) >= 1:
            detail = await c.get(f"/loans/{loan_ids[0]}", headers=h)
            if detail.status_code == 200:
                amort = detail.json()["amortization"]
                for i in range(min(8, len(amort))):
                    principal = float(amort[i]["principal"])
                    await c.post(f"/loans/{loan_ids[0]}/payment",
                                 json={"amount": principal}, headers=h)

        # Record payments on second loan (5 payments made since Sep 2025)
        if len(loan_ids) >= 2:
            detail = await c.get(f"/loans/{loan_ids[1]}", headers=h)
            if detail.status_code == 200:
                amort = detail.json()["amortization"]
                for i in range(min(5, len(amort))):
                    principal = float(amort[i]["principal"])
                    await c.post(f"/loans/{loan_ids[1]}/payment",
                                 json={"amount": principal}, headers=h)

        print(f"   ✓ {len(loan_ids)} loans created with payments recorded")

        # ── 9. Installments ──────────────────────
        print("9. Creating installments...")

        installments = [
            {
                "name": "חבילת שרתי AWS",
                "total_amount": 36000,
                "number_of_payments": 12,
                "type": "expense",
                "start_date": "2025-07-01",
                "day_of_month": 1,
                "category_id": cats.get("Servers & Infra"),
                "description": "חבילת Reserved Instances שנתית",
            },
            {
                "name": "ריהוט משרד חדש",
                "total_amount": 24000,
                "number_of_payments": 6,
                "type": "expense",
                "start_date": "2025-10-01",
                "day_of_month": 15,
                "category_id": cats.get("Office & Rent"),
                "description": "שולחנות ישיבה + כיסאות + ארונות",
            },
            {
                "name": "רכישת רישיון Enterprise",
                "total_amount": 48000,
                "number_of_payments": 12,
                "type": "expense",
                "start_date": "2025-11-01",
                "day_of_month": 5,
                "category_id": cats.get("SaaS & Software"),
                "description": "רישיון ML Platform - שנתי",
            },
            {
                "name": "פרויקט NLP - בנק לאומי",
                "total_amount": 180000,
                "number_of_payments": 6,
                "type": "income",
                "start_date": "2025-12-01",
                "day_of_month": 1,
                "category_id": cats.get("AI Services"),
                "description": "תשלומים על פרויקט NLP גדול",
            },
        ]

        inst_ids = []
        for inst_data in installments:
            r = await c.post("/installments", json=inst_data, headers=h)
            if r.status_code == 201:
                iid = r.json()["id"]
                inst_ids.append((iid, inst_data))
            else:
                print(f"   ⚠ Installment '{inst_data['name']}': {r.status_code} {r.text[:100]}")

        # Mark payments on installments based on their start dates
        for iid, inst_data in inst_ids:
            start = date.fromisoformat(inst_data["start_date"])
            today = date(2026, 2, 18)
            months_passed = (today.year - start.year) * 12 + (today.month - start.month)
            payments_to_mark = min(months_passed, inst_data["number_of_payments"])
            for _ in range(payments_to_mark):
                await c.post(f"/installments/{iid}/mark-paid", headers=h)

        print(f"   ✓ {len(inst_ids)} installments created with payments marked")

        # ── 10. Expected Income ──────────────────
        print("10. Setting expected income...")

        expected = [
            ("2026-03-01", 95000, "ריטיינרים + מנויים + פרויקט צפוי"),
            ("2026-04-01", 105000, "ריטיינרים + פרויקט NLP + ייעוץ"),
            ("2026-05-01", 88000, "ריטיינרים + מנויים"),
            ("2026-06-01", 110000, "ריטיינרים + פרויקט חדש צפוי"),
            ("2026-07-01", 92000, "ריטיינרים + מנויים"),
            ("2026-08-01", 85000, "ריטיינרים (חופשות קיץ - הפחתה)"),
        ]

        for month, amt, notes in expected:
            r = await c.put(f"/expected-income/{month}", json={
                "expected_amount": amt, "notes": notes,
            }, headers=h)
            if r.status_code not in (200, 201):
                print(f"   ⚠ Expected income {month}: {r.status_code}")
        print(f"   ✓ {len(expected)} months of expected income set")

        # ── Done! ────────────────────────────────
        print("\n" + "=" * 50)
        print("✅ SEED COMPLETE — Eye Level AI Demo User")
        print("=" * 50)
        print(f"   Username:  {USER['username']}")
        print(f"   Password:  {USER['password']}")
        print(f"   Email:     {USER['email']}")
        print("=" * 50)
        print(f"   Categories:      {len(cats)}")
        print(f"   Subscriptions:   {sub_count}")
        print(f"   Fixed items:     {fixed_count}")
        print(f"   Transactions:    {tx_count}")
        print(f"   Loans:           {len(loan_ids)}")
        print(f"   Installments:    {len(inst_ids)}")
        print(f"   Expected income: {len(expected)} months")
        print(f"   Bank balance:    ₪187,500")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
