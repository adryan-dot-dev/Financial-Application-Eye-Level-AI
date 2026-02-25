"""Fix and enrich demo data for presentation"""
from __future__ import annotations
import httpx, time
from datetime import date
from dateutil.relativedelta import relativedelta

BASE = "http://localhost:8000/api/v1"

# Login
time.sleep(2)
r = httpx.post(f"{BASE}/auth/login", json={"username":"eyelevel_demo","password":"EyeLevel2025!"}, timeout=10)
print("Login status:", r.status_code, r.text[:100])
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

def get(path):
    return httpx.get(f"{BASE}{path}", headers=H, timeout=15).json()

def post(path, data):
    r = httpx.post(f"{BASE}{path}", json=data, headers=H, timeout=15)
    if r.status_code >= 400:
        print(f"  ✗ {r.status_code} {path}: {r.text[:120]}")
        return None
    return r.json()

def put(path, data):
    r = httpx.put(f"{BASE}{path}", json=data, headers=H, timeout=15)
    if r.status_code >= 400:
        print(f"  ✗ PUT {r.status_code} {path}: {r.text[:120]}")
        return None
    return r.json()

# ── Get existing IDs ──────────────────────────────────────────────────────────
banks = get("/bank-accounts")
bank_id = banks[0]["id"] if banks else None
cards = get("/credit-cards")
visa_id = next((c["id"] for c in cards if "Visa" in c["name"]), None)
mc_id   = next((c["id"] for c in cards if "Master" in c["name"]), None)
print(f"Bank: {bank_id}, Visa: {visa_id}, MC: {mc_id}")

# ── Check / create categories ─────────────────────────────────────────────────
print("\n=== Categories ===")
existing_raw = get("/categories")
existing = existing_raw.get("items", existing_raw) if isinstance(existing_raw, dict) else existing_raw
cats = {c["name_he"]: c["id"] for c in existing} if existing else {}
print(f"  Existing: {len(cats)}")

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
    if name_he not in cats:
        c = post("/categories", {"name": name_en, "name_he": name_he, "type": typ, "color": color, "icon": icon})
        if c:
            cats[name_he] = c["id"]
            print(f"  ✓ Created: {name_he}")
    else:
        print(f"  ✓ Exists: {name_he}")

# ── Fix fixed income (was failing before) ─────────────────────────────────────
print("\n=== Fixed Income ===")
existing_fixed = get("/fixed")
fixed_names = [f["name"] for f in (existing_fixed.get("items",[]) if isinstance(existing_fixed,dict) else existing_fixed)]

if "הכנסות מנויים — מועדון Eye Level" not in fixed_names:
    post("/fixed", {
        "name": "הכנסות מנויים — מועדון Eye Level",
        "amount": "38000.00", "type": "income",
        "category_id": cats.get("מנויים למועדון"),
        "day_of_month": 5, "start_date": "2025-01-01",
        "currency": "ILS", "payment_method": "bank_transfer",
        "bank_account_id": bank_id,
        "description": "~190 מנויים × ₪200/חודש"
    })
    print("  ✓ Club memberships: ₪38,000/month")

if "הכנסות אפליקציה — מנויים דיגיטליים" not in fixed_names:
    post("/fixed", {
        "name": "הכנסות אפליקציה — מנויים דיגיטליים",
        "amount": "18500.00", "type": "income",
        "category_id": cats.get("הכנסות אפליקציה"),
        "day_of_month": 1, "start_date": "2025-01-01",
        "currency": "ILS", "payment_method": "credit_card",
        "credit_card_id": visa_id,
        "description": "~370 משתמשים × ₪50/חודש"
    })
    print("  ✓ App subscriptions: ₪18,500/month")

# ── Update categories on existing fixed/transactions if cats were missing ──────
print("\n=== Linking categories to existing data ===")
fixed_list = get("/fixed")
items = fixed_list.get("items", fixed_list) if isinstance(fixed_list, dict) else fixed_list
for item in items:
    if not item.get("category_id"):
        name = item["name"]
        if "משכורת" in name:
            cat = cats.get("משכורות")
        elif "שכר דירה" in name or "חשמל" in name:
            cat = cats.get("שכר דירה ומשרד")
        elif "ביטוח" in name:
            cat = cats.get("ביטוחים")
        else:
            cat = cats.get("הוצאות כלליות")
        if cat:
            put(f"/fixed/{item['id']}", {"category_id": cat})
            print(f"  ✓ Linked {name[:30]}")

# ── Add more transactions for richness ────────────────────────────────────────
print("\n=== Extra transactions for richer data ===")
extra_txns = [
    # ציוד
    ("2025-02-15", 8500, "expense", "ציוד ורכש", "רכישת ציוד פיתוח — MacBook Pro", "credit_card", visa_id),
    ("2025-04-10", 4200, "expense", "ציוד ורכש", "מסכים ועכברים לצוות", "credit_card", visa_id),
    ("2025-08-20", 12000, "expense", "ציוד ורכש", "שרת פנימי לפיתוח", "bank_transfer", None),
    # שיווק
    ("2025-03-05", 15000, "expense", "שיווק ופרסום", "כנס TechFest — ספונסר", "bank_transfer", None),
    ("2025-07-12", 22000, "expense", "שיווק ופרסום", "קמפיין Google Ads Q3", "credit_card", mc_id),
    ("2025-11-01", 18000, "expense", "שיווק ופרסום", "פרסום דיגיטלי Q4", "credit_card", mc_id),
    # הכנסות גדולות
    ("2025-05-20", 85000, "income", "שירותי ייעוץ", "פרויקט ייעוץ ענק — Bank Leumi", "bank_transfer", None),
    ("2025-09-15", 120000, "income", "שירותי אוטומציה", "פרויקט אוטומציה — Startup Nation", "bank_transfer", None),
    ("2025-12-10", 95000, "income", "שירותי ייעוץ", "ייעוץ אסטרטגי Q4 — Enterprise Client", "bank_transfer", None),
    ("2026-01-25", 65000, "income", "שירותי אוטומציה", "Phase 2 — אוטומציה מלאה", "bank_transfer", None),
    # הוצאות שונות
    ("2025-06-30", 3200, "expense", "הוצאות כלליות", "נסיעות עסקיות — יוני", "credit_card", mc_id),
    ("2025-10-15", 2800, "expense", "הוצאות כלליות", "ארוחות עסקיות Q4", "credit_card", visa_id),
    ("2025-12-28", 5500, "expense", "הוצאות כלליות", "מסיבת חברה שנתית", "credit_card", mc_id),
]
for d, amount, typ, cat_he, desc, method, card in extra_txns:
    payload = {
        "amount": str(amount) + ".00", "type": typ,
        "category_id": cats.get(cat_he),
        "date": d, "description": desc,
        "currency": "ILS", "payment_method": method,
    }
    if method == "credit_card" and card:
        payload["credit_card_id"] = card
    else:
        payload["bank_account_id"] = bank_id
    r = post("/transactions", payload)
    if r:
        print(f"  ✓ {d} {typ} ₪{amount:,} — {desc[:40]}")

# ── Generate alerts ───────────────────────────────────────────────────────────
print("\n=== Generating alerts ===")
r = httpx.get(f"{BASE}/dashboard/summary", headers=H, timeout=15)
print(f"  Dashboard refresh: {r.status_code}")
r = httpx.get(f"{BASE}/forecast", headers=H, timeout=15)
print(f"  Forecast refresh: {r.status_code}")

# ── Final summary ─────────────────────────────────────────────────────────────
print("\n=== FINAL STATE ===")
cats_final = get("/categories")
fixed_final = get("/fixed")
txn_final = get("/transactions")
subs_final = get("/subscriptions")
loans_final = get("/loans")
alerts_final = get("/alerts")
balance_final = get("/balance")
insts_final = get("/installments")

fixed_items = fixed_final.get("items", fixed_final) if isinstance(fixed_final, dict) else fixed_final
txn_items = txn_final if isinstance(txn_final, list) else txn_final.get("items", [])
subs_items = subs_final if isinstance(subs_final, list) else subs_final.get("items", [])
loan_items = loans_final if isinstance(loans_final, list) else loans_final.get("items", [])
alerts_items = alerts_final if isinstance(alerts_final, list) else alerts_final.get("items", [])
inst_items = insts_final if isinstance(insts_final, list) else insts_final.get("items", [])

print(f"  Categories : {len(cats_final) if isinstance(cats_final, list) else '?'}")
print(f"  Fixed      : {len(fixed_items)} (income + expense)")
print(f"  Transactions: {txn_final.get('total', len(txn_items)) if isinstance(txn_final,dict) else len(txn_items)}")
print(f"  Subscriptions: {len(subs_items)}")
print(f"  Loans      : {len(loan_items)}")
print(f"  Installments: {len(inst_items)}")
print(f"  Alerts     : {len(alerts_items)}")
if isinstance(balance_final, dict):
    print(f"  Balance    : ₪{balance_final.get('balance','?')}")
print("\n✅ Ready for presentation!")
