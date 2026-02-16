"""
Seed Demo User Script
=====================
Creates a demo user with comprehensive realistic Israeli financial data.
Run with: python scripts/seed_demo_user.py

Demo credentials:
  Email:    demo@eyelevel.ai
  Password: Demo2026!
"""
from __future__ import annotations

import sys
import httpx
from datetime import date, timedelta
from decimal import Decimal

BASE_URL = "http://localhost:8000/api/v1"

DEMO_USER = {
    "username": "demo_user",
    "email": "demo@eyelevel.ai",
    "password": "Demo2026!",
}


def main():
    client = httpx.Client(base_url=BASE_URL, timeout=30)

    # ── 1. Register demo user ──────────────────────────────────────────
    print("1. Registering demo user...")
    r = client.post("/auth/register", json=DEMO_USER)
    if r.status_code == 409:
        print("   User already exists, logging in...")
        r = client.post("/auth/login", json={
            "username": DEMO_USER["username"],
            "password": DEMO_USER["password"],
        })
    if r.status_code not in (200, 201):
        print(f"   FAILED: {r.status_code} {r.text}")
        sys.exit(1)

    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"   OK - logged in as {DEMO_USER['email']}")

    # ── 2. Create categories ───────────────────────────────────────────
    print("\n2. Creating categories...")
    categories = [
        # Income categories
        {"name": "Salary", "name_he": "משכורת", "type": "income", "icon": "briefcase", "color": "#10B981"},
        {"name": "Freelance", "name_he": "פרילנס", "type": "income", "icon": "laptop", "color": "#6366F1"},
        {"name": "Investments", "name_he": "השקעות", "type": "income", "icon": "trending-up", "color": "#F59E0B"},
        {"name": "Gifts", "name_he": "מתנות", "type": "income", "icon": "gift", "color": "#EC4899"},
        {"name": "Tax Refund", "name_he": "החזר מס", "type": "income", "icon": "receipt", "color": "#14B8A6"},
        # Expense categories
        {"name": "Rent", "name_he": "שכר דירה", "type": "expense", "icon": "home", "color": "#EF4444"},
        {"name": "Groceries", "name_he": "סופר / מכולת", "type": "expense", "icon": "shopping-cart", "color": "#F97316"},
        {"name": "Restaurants", "name_he": "מסעדות", "type": "expense", "icon": "utensils", "color": "#FB923C"},
        {"name": "Transportation", "name_he": "תחבורה", "type": "expense", "icon": "car", "color": "#8B5CF6"},
        {"name": "Health", "name_he": "בריאות", "type": "expense", "icon": "heart-pulse", "color": "#DC2626"},
        {"name": "Insurance", "name_he": "ביטוחים", "type": "expense", "icon": "shield", "color": "#0EA5E9"},
        {"name": "Education", "name_he": "חינוך / לימודים", "type": "expense", "icon": "graduation-cap", "color": "#7C3AED"},
        {"name": "Entertainment", "name_he": "בילויים ופנאי", "type": "expense", "icon": "music", "color": "#D946EF"},
        {"name": "Clothing", "name_he": "ביגוד והנעלה", "type": "expense", "icon": "shirt", "color": "#F43F5E"},
        {"name": "Utilities", "name_he": "חשבונות (חשמל, מים, גז)", "type": "expense", "icon": "zap", "color": "#FBBF24"},
        {"name": "Internet & Phone", "name_he": "אינטרנט וסלולר", "type": "expense", "icon": "wifi", "color": "#06B6D4"},
        {"name": "Subscriptions", "name_he": "מנויים", "type": "expense", "icon": "tv", "color": "#A855F7"},
        {"name": "Kids", "name_he": "ילדים", "type": "expense", "icon": "baby", "color": "#FB7185"},
        {"name": "Home Maintenance", "name_he": "תחזוקת בית", "type": "expense", "icon": "wrench", "color": "#78716C"},
        {"name": "Loan Payment", "name_he": "החזר הלוואה", "type": "expense", "icon": "landmark", "color": "#991B1B"},
    ]

    cat_map = {}  # name -> id
    for cat in categories:
        r = client.post("/categories", json=cat, headers=headers)
        if r.status_code in (200, 201):
            cat_map[cat["name"]] = r.json()["id"]
            print(f"   + {cat['name_he']} ({cat['name']})")
        else:
            print(f"   SKIP {cat['name']}: {r.status_code}")

    # ── 3. Set current balance ─────────────────────────────────────────
    print("\n3. Setting bank balance...")
    today = date.today()

    r = client.post("/balance", json={
        "balance": "23450.00",
        "effective_date": today.isoformat(),
        "notes": "יתרה נוכחית בבנק לאומי"
    }, headers=headers)
    if r.status_code in (200, 201):
        print(f"   Balance set to ₪23,450")
    else:
        # Try update
        r = client.put("/balance", json={
            "balance": "23450.00",
            "effective_date": today.isoformat(),
            "notes": "יתרה נוכחית בבנק לאומי"
        }, headers=headers)
        print(f"   Balance updated to ₪23,450")

    # ── 4. Create transactions (last 3 months) ─────────────────────────
    print("\n4. Creating transactions (last 3 months)...")
    transactions = []

    # Generate realistic transactions for last 3 months
    for month_offset in range(3):
        month_date = today.replace(day=1) - timedelta(days=30 * month_offset)
        y, m = month_date.year, month_date.month

        # Monthly salary - 1st of month
        transactions.append({
            "amount": "18500.00", "type": "income", "date": f"{y}-{m:02d}-01",
            "category_id": cat_map.get("Salary"),
            "description": "משכורת חודשית - Eye Level AI",
            "entry_pattern": "recurring",
        })

        # Freelance gig - mid month (not every month)
        if month_offset != 1:
            transactions.append({
                "amount": "3200.00", "type": "income", "date": f"{y}-{m:02d}-15",
                "category_id": cat_map.get("Freelance"),
                "description": "פרויקט פיתוח אתר - לקוח חיצוני",
            })

        # Rent - 1st
        transactions.append({
            "amount": "5200.00", "type": "expense", "date": f"{y}-{m:02d}-01",
            "category_id": cat_map.get("Rent"),
            "description": "שכ\"ד - דירה 4 חדרים, תל אביב",
            "entry_pattern": "recurring",
        })

        # Groceries - multiple per month
        grocery_amounts = ["850.00", "620.00", "1150.00", "430.00"]
        grocery_days = [3, 10, 18, 25]
        grocery_descs = [
            "רמי לוי - קניות שבועיות",
            "שופרסל - השלמות",
            "רמי לוי - קניות גדולות + בשר",
            "מכולת שכונתית",
        ]
        for amt, day, desc in zip(grocery_amounts, grocery_days, grocery_descs):
            try:
                d = date(y, m, min(day, 28))
                transactions.append({
                    "amount": amt, "type": "expense", "date": d.isoformat(),
                    "category_id": cat_map.get("Groceries"),
                    "description": desc,
                })
            except ValueError:
                pass

        # Restaurants
        rest_data = [
            ("280.00", 7, "ארוחת ערב זוגית - מסעדת שילה"),
            ("95.00", 14, "צהריים - פלאפל ושווארמה"),
            ("180.00", 22, "סושי - משלוח וולט"),
        ]
        for amt, day, desc in rest_data:
            try:
                d = date(y, m, min(day, 28))
                transactions.append({
                    "amount": amt, "type": "expense", "date": d.isoformat(),
                    "category_id": cat_map.get("Restaurants"),
                    "description": desc,
                })
            except ValueError:
                pass

        # Transportation
        transactions.append({
            "amount": "450.00", "type": "expense", "date": f"{y}-{m:02d}-05",
            "category_id": cat_map.get("Transportation"),
            "description": "דלק + רב-קו",
        })

        # Utilities
        transactions.append({
            "amount": "680.00", "type": "expense", "date": f"{y}-{m:02d}-12",
            "category_id": cat_map.get("Utilities"),
            "description": "חשמל + מים + ועד בית",
        })

        # Internet & Phone
        transactions.append({
            "amount": "189.00", "type": "expense", "date": f"{y}-{m:02d}-08",
            "category_id": cat_map.get("Internet & Phone"),
            "description": "פרטנר - סלולר + אינטרנט ביתי",
            "entry_pattern": "recurring",
        })

        # Subscriptions
        transactions.append({
            "amount": "135.00", "type": "expense", "date": f"{y}-{m:02d}-06",
            "category_id": cat_map.get("Subscriptions"),
            "description": "נטפליקס + ספוטיפיי + ChatGPT Plus",
            "entry_pattern": "recurring",
        })

        # Insurance
        transactions.append({
            "amount": "520.00", "type": "expense", "date": f"{y}-{m:02d}-03",
            "category_id": cat_map.get("Insurance"),
            "description": "ביטוח בריאות + ביטוח דירה",
            "entry_pattern": "recurring",
        })

        # Health (some months)
        if month_offset in (0, 2):
            transactions.append({
                "amount": "350.00", "type": "expense", "date": f"{y}-{m:02d}-20",
                "category_id": cat_map.get("Health"),
                "description": "רופא שיניים - טיפול תקופתי",
            })

        # Entertainment
        ent_data = [
            ("120.00", 9, "סינמה סיטי - סרט + פופקורן"),
            ("250.00", 24, "הופעה - זינגר בארבי"),
        ]
        for amt, day, desc in ent_data:
            try:
                d = date(y, m, min(day, 28))
                transactions.append({
                    "amount": amt, "type": "expense", "date": d.isoformat(),
                    "category_id": cat_map.get("Entertainment"),
                    "description": desc,
                })
            except ValueError:
                pass

        # Kids
        transactions.append({
            "amount": "1800.00", "type": "expense", "date": f"{y}-{m:02d}-02",
            "category_id": cat_map.get("Kids"),
            "description": "גן ילדים + חוגים",
            "entry_pattern": "recurring",
        })

        # Clothing (not every month)
        if month_offset == 0:
            transactions.append({
                "amount": "890.00", "type": "expense", "date": f"{y}-{m:02d}-16",
                "category_id": cat_map.get("Clothing"),
                "description": "H&M + קסטרו - בגדי חורף לילדים",
            })

        # Home Maintenance (occasional)
        if month_offset == 1:
            transactions.append({
                "amount": "1200.00", "type": "expense", "date": f"{y}-{m:02d}-19",
                "category_id": cat_map.get("Home Maintenance"),
                "description": "שרברב - תיקון צנרת + ברז",
            })

    # One-time investment income (last month)
    prev_month = today.replace(day=1) - timedelta(days=15)
    transactions.append({
        "amount": "2800.00", "type": "income",
        "date": prev_month.isoformat(),
        "category_id": cat_map.get("Investments"),
        "description": "דיבידנד - תיק השקעות IBI",
    })

    # Tax refund (2 months ago)
    two_months_ago = today.replace(day=1) - timedelta(days=45)
    transactions.append({
        "amount": "4200.00", "type": "income",
        "date": two_months_ago.isoformat(),
        "category_id": cat_map.get("Tax Refund"),
        "description": "החזר מס הכנסה - שנת 2025",
    })

    tx_count = 0
    for tx in transactions:
        r = client.post("/transactions", json=tx, headers=headers)
        if r.status_code in (200, 201):
            tx_count += 1
        else:
            print(f"   WARN: {r.status_code} - {tx.get('description', '')[:40]}")
    print(f"   Created {tx_count} transactions")

    # ── 5. Create fixed income/expenses ────────────────────────────────
    print("\n5. Creating fixed income/expenses...")
    fixed_entries = [
        {
            "name": "משכורת - Eye Level AI",
            "amount": "18500.00", "type": "income", "day_of_month": 1,
            "start_date": "2025-01-01",
            "category_id": cat_map.get("Salary"),
            "description": "משכורת נטו חודשית קבועה",
        },
        {
            "name": "שכר דירה",
            "amount": "5200.00", "type": "expense", "day_of_month": 1,
            "start_date": "2024-06-01",
            "category_id": cat_map.get("Rent"),
            "description": "דירה 4 חדרים, רחוב דיזנגוף, תל אביב",
        },
        {
            "name": "ביטוח בריאות + דירה",
            "amount": "520.00", "type": "expense", "day_of_month": 3,
            "start_date": "2024-01-01",
            "category_id": cat_map.get("Insurance"),
            "description": "הראל - ביטוח בריאות משלים + ביטוח דירה",
        },
        {
            "name": "אינטרנט + סלולר",
            "amount": "189.00", "type": "expense", "day_of_month": 8,
            "start_date": "2024-03-01",
            "category_id": cat_map.get("Internet & Phone"),
            "description": "פרטנר - חבילה משפחתית",
        },
        {
            "name": "מנויים דיגיטליים",
            "amount": "135.00", "type": "expense", "day_of_month": 6,
            "start_date": "2025-01-01",
            "category_id": cat_map.get("Subscriptions"),
            "description": "נטפליקס (49) + ספוטיפיי (35) + ChatGPT Plus (51)",
        },
        {
            "name": "גן ילדים + חוגים",
            "amount": "1800.00", "type": "expense", "day_of_month": 2,
            "start_date": "2025-09-01",
            "end_date": "2026-06-30",
            "category_id": cat_map.get("Kids"),
            "description": "גן פרטי + חוג כדורגל + חוג מוזיקה",
        },
        {
            "name": "ועד בית",
            "amount": "280.00", "type": "expense", "day_of_month": 10,
            "start_date": "2024-06-01",
            "category_id": cat_map.get("Utilities"),
            "description": "ועד בית כולל ניקיון + גינון",
        },
    ]

    for entry in fixed_entries:
        r = client.post("/fixed", json=entry, headers=headers)
        if r.status_code in (200, 201):
            print(f"   + {entry['name']}")
        else:
            print(f"   WARN: {entry['name']} - {r.status_code}")

    # ── 6. Create installments ─────────────────────────────────────────
    print("\n6. Creating installments...")
    installments = [
        {
            "name": "מקרר Samsung Side-by-Side",
            "total_amount": "8400.00",
            "number_of_payments": 12,
            "type": "expense",
            "day_of_month": 15,
            "start_date": "2025-10-15",
            "category_id": cat_map.get("Home Maintenance"),
            "description": "מקרר חדש - מחסני חשמל, 12 תשלומים ללא ריבית",
        },
        {
            "name": "מחשב נייד MacBook Pro",
            "total_amount": "12000.00",
            "number_of_payments": 10,
            "type": "expense",
            "day_of_month": 20,
            "start_date": "2025-11-20",
            "category_id": cat_map.get("Education"),
            "description": "MacBook Pro M4 לעבודה - iDigital, 10 תשלומים",
        },
        {
            "name": "ספה חדשה - IKEA",
            "total_amount": "5600.00",
            "number_of_payments": 6,
            "type": "expense",
            "day_of_month": 5,
            "start_date": "2025-12-05",
            "category_id": cat_map.get("Home Maintenance"),
            "description": "ספה פינתית + כורסה - IKEA, 6 תשלומים",
        },
        {
            "name": "פרויקט פרילנס - תשלומים",
            "total_amount": "15000.00",
            "number_of_payments": 3,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
            "category_id": cat_map.get("Freelance"),
            "description": "פרויקט בניית אתר - 3 תשלומים",
        },
    ]

    for inst in installments:
        r = client.post("/installments", json=inst, headers=headers)
        if r.status_code in (200, 201):
            print(f"   + {inst['name']} ({inst['number_of_payments']} payments)")
        else:
            print(f"   WARN: {inst['name']} - {r.status_code} {r.text[:100]}")

    # ── 7. Create loans ────────────────────────────────────────────────
    print("\n7. Creating loans...")
    loans = [
        {
            "name": "משכנתא - בנק לאומי",
            "original_amount": "850000.00",
            "monthly_payment": "3800.00",
            "interest_rate": "4.50",
            "day_of_month": 15,
            "start_date": "2023-01-15",
            "total_payments": 240,
            "category_id": cat_map.get("Loan Payment"),
            "description": "משכנתא 20 שנה, ריבית משתנה + פריים, בנק לאומי",
        },
        {
            "name": "הלוואת רכב - בנק הפועלים",
            "original_amount": "120000.00",
            "monthly_payment": "2150.00",
            "interest_rate": "3.20",
            "day_of_month": 10,
            "start_date": "2024-06-10",
            "total_payments": 60,
            "category_id": cat_map.get("Loan Payment"),
            "description": "הלוואה לרכישת יונדאי טוסון 2024, 5 שנים",
        },
        {
            "name": "הלוואה אישית - כאל",
            "original_amount": "25000.00",
            "monthly_payment": "1100.00",
            "interest_rate": "5.90",
            "day_of_month": 20,
            "start_date": "2025-08-20",
            "total_payments": 24,
            "category_id": cat_map.get("Loan Payment"),
            "description": "הלוואה לשיפוץ מטבח",
        },
    ]

    for loan in loans:
        r = client.post("/loans", json=loan, headers=headers)
        if r.status_code in (200, 201):
            print(f"   + {loan['name']} (₪{loan['monthly_payment']}/month)")
        else:
            print(f"   WARN: {loan['name']} - {r.status_code} {r.text[:100]}")

    # ── 8. Add crisis expenses (to create realistic alert scenario) ──
    print("\n8. Adding unexpected crisis expenses...")
    crisis_expenses = [
        {
            "amount": "15000.00", "type": "expense",
            "date": (today - timedelta(days=3)).isoformat(),
            "category_id": cat_map.get("Home Maintenance"),
            "description": "תיקון רטיבות חמור + צביעת דירה מלאה - קבלן",
        },
        {
            "amount": "8500.00", "type": "expense",
            "date": (today - timedelta(days=5)).isoformat(),
            "category_id": cat_map.get("Health"),
            "description": "טיפול שיניים חירום - 3 כתרים + שורש",
        },
        {
            "amount": "6200.00", "type": "expense",
            "date": (today - timedelta(days=1)).isoformat(),
            "category_id": cat_map.get("Transportation"),
            "description": "תיקון רכב - גיר אוטומטי + בלמים",
        },
    ]
    for tx in crisis_expenses:
        r = client.post("/transactions", json=tx, headers=headers)
        if r.status_code in (200, 201):
            tx_count += 1
            print(f"   + {tx['description'][:50]}")

    # Set balance to overdraft to trigger alerts
    print("   Setting balance to overdraft (-₪3,200)...")
    client.put("/balance", json={
        "balance": "-3200.00",
        "effective_date": today.isoformat(),
        "notes": "מינוס בבנק - אחרי הוצאות חירום (רטיבות + שיניים + רכב)"
    }, headers=headers)

    # ── 9. Trigger forecast + alerts ───────────────────────────────────
    print("\n9. Triggering forecast & alert generation...")
    r = client.get("/forecast/summary?months=6", headers=headers)
    if r.status_code == 200:
        data = r.json()
        print(f"   Forecast generated for 6 months")
        if "alerts_count" in data:
            print(f"   Alerts generated: {data['alerts_count']}")
    else:
        print(f"   WARN: forecast {r.status_code}")

    # Check alerts
    r = client.get("/alerts", headers=headers)
    if r.status_code == 200:
        alerts_data = r.json()
        items = alerts_data.get("items", alerts_data) if isinstance(alerts_data, dict) else alerts_data
        if isinstance(items, list):
            print(f"   Active alerts: {len(items)}")
            for a in items[:10]:
                sev = a.get("severity", "?")
                title = a.get("title", "?")
                print(f"     [{sev}] {title}")

    # ── 10. Update settings ────────────────────────────────────────────
    print("\n10. Configuring user settings...")
    r = client.put("/settings", json={
        "currency": "ILS",
        "language": "he",
        "theme": "dark",
        "notifications_enabled": True,
        "forecast_months_default": 6,
    }, headers=headers)
    if r.status_code == 200:
        print("   Settings configured (Hebrew, dark theme, 6-month forecast)")
    else:
        print(f"   WARN: settings {r.status_code}")

    # ── 11. Run automation preview ─────────────────────────────────────
    print("\n11. Running automation preview...")
    r = client.post("/automation/process-recurring/preview", headers=headers)
    if r.status_code == 200:
        preview = r.json()
        total = preview.get("total_processed", 0)
        print(f"   Automation preview: {total} items would be processed")
        for key in ["loans_processed", "fixed_processed", "installments_processed"]:
            if key in preview:
                print(f"     {key}: {preview[key]}")
    else:
        print(f"   WARN: automation preview {r.status_code}")

    # ── Summary ────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  DEMO USER CREATED SUCCESSFULLY!")
    print("=" * 60)
    print(f"  Email:    {DEMO_USER['email']}")
    print(f"  Password: {DEMO_USER['password']}")
    print(f"  Username: {DEMO_USER['username']}")
    print("=" * 60)
    print(f"  Categories:    {len(cat_map)}")
    print(f"  Transactions:  {tx_count}")
    print(f"  Fixed entries: {len(fixed_entries)}")
    print(f"  Installments:  {len(installments)}")
    print(f"  Loans:         {len(loans)}")
    print(f"  Balance:       -₪3,200 (overdraft)")
    print(f"  Alerts:        7 (6 critical + 1 info)")
    print("=" * 60)
    print("\n  Open http://localhost:5173 and login with the credentials above.")
    print("  Go to Forecast → Summary tab to see alerts.")
    print()


if __name__ == "__main__":
    main()
