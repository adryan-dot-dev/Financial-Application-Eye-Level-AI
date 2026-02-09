"""
Seed data script for Cash Flow Management application.

Creates:
1. Admin user (username: admin, password from .env ADMIN_DEFAULT_PASSWORD)
2. Default categories in Hebrew

Usage:
    cd backend
    python scripts/seed_data.py
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


DEFAULT_CATEGORIES = [
    # Income categories
    {"name": "salary", "name_he": "משכורת", "type": "income", "icon": "briefcase", "color": "#10B981", "display_order": 1},
    {"name": "freelance", "name_he": "פרילנס", "type": "income", "icon": "laptop", "color": "#3B82F6", "display_order": 2},
    {"name": "investments", "name_he": "השקעות", "type": "income", "icon": "trending-up", "color": "#8B5CF6", "display_order": 3},
    {"name": "other_income", "name_he": "הכנסה אחרת", "type": "income", "icon": "plus-circle", "color": "#6B7280", "display_order": 4},
    # Expense categories
    {"name": "rent", "name_he": "שכירות", "type": "expense", "icon": "home", "color": "#EF4444", "display_order": 1},
    {"name": "software", "name_he": "תוכנה", "type": "expense", "icon": "code", "color": "#7C3AED", "display_order": 2},
    {"name": "car", "name_he": "רכב", "type": "expense", "icon": "car", "color": "#F59E0B", "display_order": 3},
    {"name": "restaurants", "name_he": "מסעדות", "type": "expense", "icon": "utensils", "color": "#EC4899", "display_order": 4},
    {"name": "insurance", "name_he": "ביטוח", "type": "expense", "icon": "shield", "color": "#64748B", "display_order": 5},
    {"name": "marketing", "name_he": "שיווק", "type": "expense", "icon": "megaphone", "color": "#06B6D4", "display_order": 6},
    {"name": "salaries", "name_he": "שכר עובדים", "type": "expense", "icon": "users", "color": "#F97316", "display_order": 7},
    {"name": "office", "name_he": "משרד", "type": "expense", "icon": "building", "color": "#6366F1", "display_order": 8},
    {"name": "general", "name_he": "כללי", "type": "expense", "icon": "more-horizontal", "color": "#6B7280", "display_order": 9},
]

ADMIN_USER = {
    "username": "admin",
    "email": "admin@eyelevel.ai",
    "is_admin": True,
}


async def seed():
    """
    Seed database with initial data.
    This script will be fully functional once the ORM models are created in Phase 1.
    For now, it serves as documentation of the seed data structure.
    """
    print("=" * 50)
    print("Cash Flow Management - Seed Data")
    print("=" * 50)

    print("\nAdmin User:")
    print(f"  Username: {ADMIN_USER['username']}")
    print(f"  Email: {ADMIN_USER['email']}")
    print(f"  Is Admin: {ADMIN_USER['is_admin']}")
    print(f"  Password: (from .env ADMIN_DEFAULT_PASSWORD)")

    print(f"\nDefault Categories ({len(DEFAULT_CATEGORIES)} total):")
    print("\n  Income:")
    for cat in DEFAULT_CATEGORIES:
        if cat["type"] == "income":
            print(f"    {cat['icon']:20s} {cat['name_he']:15s} ({cat['name']})")

    print("\n  Expenses:")
    for cat in DEFAULT_CATEGORIES:
        if cat["type"] == "expense":
            print(f"    {cat['icon']:20s} {cat['name_he']:15s} ({cat['name']})")

    print("\n" + "=" * 50)
    print("NOTE: Full seeding will be implemented in Phase 1")
    print("when ORM models (User, Settings, Category) are ready.")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
