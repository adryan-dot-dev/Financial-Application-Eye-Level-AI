"""
Demo data script — Eye Level AI
חברת תוכנה, 14 עובדים, סטארטאפ רווחי
נתונים: ינואר 2025 – פברואר 2026
"""
from __future__ import annotations
import httpx
from datetime import date
from dateutil.relativedelta import relativedelta

BASE = "http://localhost:8000/api/v1"
HEADERS = {}

def api(method, path, **kwargs):
    r = httpx.request(method, f"{BASE}{path}", headers=HEADERS, timeout=30, **kwargs)
    if r.status_code >= 400:
        print(f"  ✗ {r.status_code} {method} {path}: {r.text[:150]}")
        return None
    return r.json()

def login(username, password):
    global HEADERS
    r = api("POST", "/auth/login", json={"username": username, "password": password})
    if r:
        HEADERS["Authorization"] = f"Bearer {r['access_token']}"
        print(f"  ✓ Logged in as {username}")
        return True
    return False

# ─── 1. יצירת משתמש ───────────────────────────────────────────────────────────
print("\n=== 1. Creating demo user ===")
api("POST", "/auth/register", json={
    "username": "eyelevel_demo",
    "email": "demo@eyelevelai.com",
    "password": "EyeLevel2025!",
    "full_name": "Eye Level AI"
})
login("eyelevel_demo", "EyeLevel2025!")

# ─── 2. הגדרות ────────────────────────────────────────────────────────────────
print("\n=== 2. Settings ===")
api("PUT", "/settings", json={"currency": "ILS", "language": "he", "date_format": "DD/MM/YYYY"})
print("  ✓ Settings saved")

# ─── 3. חשבון בנק ─────────────────────────────────────────────────────────────
print("\n=== 3. Bank account ===")
bank = api("POST", "/bank-accounts", json={
    "name": "בנק הפועלים - חשבון עסקי",
    "bank_name": "בנק הפועלים",
    "account_number": "12-345678",
    "account_type": "business_checking",
    "currency": "ILS",
    "is_active": True
})
bank_id = bank["id"] if bank else None
print(f"  ✓ Bank: {bank_id}")

api("POST", "/balance", json={
    "balance": "180000.00",
    "effective_date": "2025-01-01",
    "currency": "ILS",
    "bank_account_id": bank_id,
    "notes": "יתרה התחלתית ינואר 2025"
})
print("  ✓ Initial balance: ₪180,000")

# ─── 4. כרטיסי אשראי ──────────────────────────────────────────────────────────
print("\n=== 4. Credit cards ===")
visa = api("POST", "/credit-cards", json={
    "name": "Visa Business Gold",
    "last_four_digits": "4521",
    "card_network": "visa",
    "issuer": "בנק הפועלים",
    "credit_limit": "50000.00",
    "billing_day": 15,
    "currency": "ILS",
    "bank_account_id": bank_id
})
visa_id = visa["id"] if visa else None
print(f"  ✓ Visa Business Gold ****4521")

mc = api("POST", "/credit-cards", json={
    "name": "Mastercard Corporate",
    "last_four_digits": "8833",
    "card_network": "mastercard",
    "issuer": "בנק לאומי",
    "credit_limit": "30000.00",
    "billing_day": 20,
    "currency": "ILS",
    "bank_account_id": bank_id
})
mc_id = mc["id"] if mc else None
print(f"  ✓ Mastercard Corporate ****8833")

# ─── 5. קטגוריות ──────────────────────────────────────────────────────────────
print("\n=== 5. Categories ===")
cats = {}
cat_defs = [
    ("Club Subscriptions",   "מנויים למועדון",    "income",  "#6366f1", "users"),
    ("Consulting Services",  "שירותי ייעוץ",       "income",  "#0ea5e9", "briefcase"),
    ("Automation Services",  "שירותי אוטומציה",    "income",  "#8b5cf6", "zap"),
    ("Project 100",          "פרויקט 100",         "income",  "#f59e0b", "target"),
    ("App Revenue",          "הכנסות אפליקציה",    "income",  "#10b981", "smartphone"),
    ("Salaries",             "משכורות",             "expense", "#ef4444", "users"),
    ("Marketing",            "שיווק ופרסום",        "expense", "#f97316", "megaphone"),
    ("Cloud Infrastructure", "תשתית ענן",           "expense", "#3b82f6", "cloud"),
    ("Office and Rent",      "שכר דירה ומשרד",     "expense", "#84cc16", "building"),
    ("Dev Tools",            "כלי פיתוח",           "expense", "#06b6d4", "code"),
    ("Insurance",            "ביטוחים",             "expense", "#a855f7", "shield"),
    ("Equipment",            "ציוד ורכש",           "expense", "#ec4899", "package"),
    ("General",              "הוצאות כלליות",       "expense", "#6b7280", "more-horizontal"),
]
for name_en, name_he, typ, color, icon in cat_defs:
    c = api("POST", "/categories", json={
        "name": name_en, "name_he": name_he,
        "type": typ, "color": color, "icon": icon
    })
    if c:
        cats[name_he] = c["id"]
        print(f"  ✓ {name_he}")

# ─── 6. הלוואה ────────────────────────────────────────────────────────────────
print("\n=== 6. Loan ===")
loan = api("POST", "/loans", json={
    "name": "הלוואת סטארטאפ - בנק הפועלים",
    "original_amount": "200000.00",
    "monthly_payment": "6082.00",
    "interest_rate": "5.50",
    "start_date": "2025-03-01",
    "day_of_month": 1,
    "total_payments": 36,
    "bank_account_id": bank_id,
    "description": "הלוואת הון חוזר לפיתוח מוצר",
    "first_payment_made": True
})
loan_id = loan["id"] if loan else None
print(f"  ✓ Loan ₪200,000 / 36 months @ 5.5%")

if loan_id:
    for i in range(11):
        pay_date = date(2025, 4, 1) + relativedelta(months=i)
        r = api("POST", f"/loans/{loan_id}/payment", json={
            "payment_date": str(pay_date),
            "amount": "6082.00",
            "notes": f"תשלום {i+2}/36"
        })
        if r:
            print(f"  ✓ Payment {i+2}/12: {pay_date}")

# ─── 7. משכורות קבועות ────────────────────────────────────────────────────────
print("\n=== 7. Fixed — Salaries (14 employees) ===")
employees = [
    ("אורן כהן",    22000, "Senior Developer"),
    ("מיה לוי",     21500, "Senior Developer"),
    ("נועם גולן",   22500, "Senior Developer"),
    ("שירה ברק",    16000, "Mid Developer"),
    ("עמית רוזן",   15500, "Mid Developer"),
    ("תמר פרץ",     16500, "Mid Developer"),
    ("יוסי אביב",   15000, "Mid Developer"),
    ("ליאור שפיר",  11000, "Junior Developer"),
    ("נועה כץ",     10500, "Junior Developer"),
    ("מור ישראלי",  14000, "UX Designer"),
    ("דניאל שמש",   19000, "Product Manager"),
    ("ענבל נחמיאס", 16000, "Marketing Manager"),
    ("רועי אדרי",   28000, "CEO"),
    ("אסתר בוגנים", 12500, "Operations"),
]
for emp_name, amount, role in employees:
    api("POST", "/fixed", json={
        "name": f"משכורת — {emp_name}",
        "amount": str(amount) + ".00",
        "type": "expense",
        "category_id": cats.get("משכורות"),
        "day_of_month": 10,
        "start_date": "2025-01-01",
        "currency": "ILS",
        "payment_method": "bank_transfer",
        "bank_account_id": bank_id,
        "description": role
    })
    print(f"  ✓ {emp_name} ({role}): ₪{amount:,}")

total_sal = sum(e[1] for e in employees)
print(f"  → Total: ₪{total_sal:,}/month")

# ─── 8. הוצאות קבועות — משרד ─────────────────────────────────────────────────
print("\n=== 8. Fixed — Office ===")
for name, amount, cat, day in [
    ("שכר דירה — משרד תל אביב", 15000, "שכר דירה ומשרד", 1),
    ("חשמל ומים",               1800,  "שכר דירה ומשרד", 1),
    ("רואה חשבון",              3500,  "הוצאות כלליות",   5),
    ("ביטוח עסקי",              2800,  "ביטוחים",         1),
]:
    api("POST", "/fixed", json={
        "name": name, "amount": str(amount) + ".00",
        "type": "expense", "category_id": cats.get(cat),
        "day_of_month": day, "start_date": "2025-01-01",
        "currency": "ILS", "payment_method": "bank_transfer",
        "bank_account_id": bank_id
    })
    print(f"  ✓ {name}: ₪{amount:,}")

# ─── 9. מנויים לשירותים ───────────────────────────────────────────────────────
print("\n=== 9. Subscriptions ===")
subs = [
    ("AWS Cloud",         8500, mc_id,   "monthly", "תשתית ענן",    "Amazon"),
    ("GitHub Enterprise",  450, visa_id, "monthly", "כלי פיתוח",    "GitHub"),
    ("Figma",              320, visa_id, "monthly", "כלי פיתוח",    "Figma"),
    ("Slack",              280, mc_id,   "monthly", "כלי פיתוח",    "Slack"),
    ("HubSpot CRM",       1200, mc_id,   "monthly", "שיווק ופרסום", "HubSpot"),
    ("Zoom",               180, visa_id, "monthly", "כלי פיתוח",    "Zoom"),
    ("Notion",             150, visa_id, "monthly", "כלי פיתוח",    "Notion"),
    ("Linear",             240, visa_id, "monthly", "כלי פיתוח",    "Linear"),
    ("Sentry",             190, mc_id,   "monthly", "תשתית ענן",    "Sentry"),
    ("Datadog",            850, mc_id,   "monthly", "תשתית ענן",    "Datadog"),
    ("LinkedIn Ads",      3500, mc_id,   "monthly", "שיווק ופרסום", "LinkedIn"),
    ("Google Workspace",   420, visa_id, "monthly", "כלי פיתוח",    "Google"),
]
for name, amount, card_id, freq, cat, provider in subs:
    s = api("POST", "/subscriptions", json={
        "name": name, "amount": str(amount) + ".00",
        "category_id": cats.get(cat),
        "billing_cycle": freq,
        "next_renewal_date": "2026-03-01",
        "currency": "ILS",
        "credit_card_id": card_id,
        "provider": provider,
        "auto_renew": True
    })
    if s:
        print(f"  ✓ {name}: ₪{amount:,}/month")

# ─── 10. פרויקט 100 — תשלומים ────────────────────────────────────────────────
print("\n=== 10. Installments — Project 100 ===")
p100 = [
    ("פרויקט 100 — אבי מזרחי",   "2025-01-15", 15, 5),
    ("פרויקט 100 — רחל שטרן",    "2025-02-10", 10, 5),
    ("פרויקט 100 — משה לביא",    "2025-03-20", 20, 4),
    ("פרויקט 100 — שרה כהן",     "2025-06-05",  5, 4),
    ("פרויקט 100 — דוד פרידמן",  "2025-09-01",  1, 3),
    ("פרויקט 100 — לילי גרין",   "2025-11-15", 15, 2),
    ("פרויקט 100 — טל שמיר",     "2026-01-10", 10, 1),
]
for name, start, dom, paid in p100:
    inst = api("POST", "/installments", json={
        "name": name,
        "total_amount": "2200.00",
        "number_of_payments": 6,
        "type": "income",
        "start_date": start,
        "day_of_month": dom,
        "category_id": cats.get("פרויקט 100"),
        "currency": "ILS",
        "first_payment_made": True,
        "description": "תוכנית ליווי עסקי — פרויקט 100"
    })
    if inst:
        inst_id = inst["id"]
        for p in range(paid - 1):
            api("POST", f"/installments/{inst_id}/mark-paid", json={})
        print(f"  ✓ {name}: {paid}/6 שולמו")

# ─── 11. הכנסה קבועה חודשית ───────────────────────────────────────────────────
print("\n=== 11. Fixed income ===")
api("POST", "/fixed", json={
    "name": "הכנסות מנויים — מועדון Eye Level",
    "amount": "38000.00", "type": "income",
    "category_id": cats.get("מנויים למועדון"),
    "day_of_month": 5, "start_date": "2025-01-01",
    "currency": "ILS", "payment_method": "bank_transfer",
    "description": "~190 מנויים × ₪200/חודש"
})
print("  ✓ Club memberships: ₪38,000/month")

api("POST", "/fixed", json={
    "name": "הכנסות אפליקציה — מנויים דיגיטליים",
    "amount": "18500.00", "type": "income",
    "category_id": cats.get("הכנסות אפליקציה"),
    "day_of_month": 1, "start_date": "2025-01-01",
    "currency": "ILS", "payment_method": "credit_card",
    "description": "~370 משתמשים × ₪50/חודש"
})
print("  ✓ App subscriptions: ₪18,500/month")

# ─── 12. עסקאות חודשיות ───────────────────────────────────────────────────────
print("\n=== 12. Transactions — 14 months ===")
monthly_data = [
    ("2025-01", 45000, 22000, 8000,  5500),
    ("2025-02", 52000, 18000, 12000, 4200),
    ("2025-03", 38000, 31000, 9500,  6800),
    ("2025-04", 61000, 25000, 14000, 3900),
    ("2025-05", 55000, 35000, 11000, 7200),
    ("2025-06", 48000, 42000, 16000, 5100),
    ("2025-07", 72000, 28000, 13500, 4600),
    ("2025-08", 44000, 51000, 10000, 8300),
    ("2025-09", 67000, 38000, 18000, 6100),
    ("2025-10", 83000, 44000, 22000, 5400),
    ("2025-11", 59000, 56000, 15000, 7800),
    ("2025-12", 91000, 62000, 25000, 9200),
    ("2026-01", 76000, 48000, 19000, 6600),
    ("2026-02", 68000, 55000, 21000, 4800),
]
for month_str, consulting, automation, mktg, misc in monthly_data:
    y, m = int(month_str.split("-")[0]), int(month_str.split("-")[1])
    api("POST", "/transactions", json={
        "amount": str(consulting) + ".00", "type": "income",
        "category_id": cats.get("שירותי ייעוץ"),
        "date": f"{y}-{m:02d}-12",
        "description": f"שירותי ייעוץ — {month_str}",
        "currency": "ILS", "payment_method": "bank_transfer",
        "bank_account_id": bank_id
    })
    api("POST", "/transactions", json={
        "amount": str(automation) + ".00", "type": "income",
        "category_id": cats.get("שירותי אוטומציה"),
        "date": f"{y}-{m:02d}-18",
        "description": f"פרויקטי אוטומציה — {month_str}",
        "currency": "ILS", "payment_method": "bank_transfer",
        "bank_account_id": bank_id
    })
    api("POST", "/transactions", json={
        "amount": str(mktg) + ".00", "type": "expense",
        "category_id": cats.get("שיווק ופרסום"),
        "date": f"{y}-{m:02d}-22",
        "description": f"קמפיין שיווק — {month_str}",
        "currency": "ILS", "payment_method": "credit_card",
        "credit_card_id": mc_id
    })
    api("POST", "/transactions", json={
        "amount": str(misc) + ".00", "type": "expense",
        "category_id": cats.get("הוצאות כלליות"),
        "date": f"{y}-{m:02d}-28",
        "description": f"הוצאות שוטפות — {month_str}",
        "currency": "ILS", "payment_method": "bank_transfer",
        "bank_account_id": bank_id
    })
    print(f"  ✓ {month_str}: +₪{consulting+automation:,} | -₪{mktg+misc:,}")

# ─── 13. יתרה סופית ───────────────────────────────────────────────────────────
print("\n=== 13. Final balance ===")
api("POST", "/balance", json={
    "balance": "487500.00",
    "effective_date": "2026-02-25",
    "currency": "ILS",
    "bank_account_id": bank_id,
    "notes": "יתרה פברואר 2026"
})
print("  ✓ Final balance: ₪487,500")

print("\n" + "="*55)
print("✅  DEMO COMPLETE — Eye Level AI")
print("="*55)
print("  Username : eyelevel_demo")
print("  Password : EyeLevel2025!")
print("  Email    : demo@eyelevelai.com")
print("="*55)
print("  14 משכורות | הלוואה ₪200K | 2 כרטיסי אשראי")
print("  12 מנויי SaaS | 7 לקוחות פרויקט 100")
print("  14 חודשי עסקאות | יתרה ₪487,500")
print("="*55)
