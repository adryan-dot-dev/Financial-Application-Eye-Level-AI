"""
Seed data script for Cash Flow Management application.

Creates:
1. Admin user (username: admin, password from .env ADMIN_DEFAULT_PASSWORD)
2. Default categories for the admin user

Usage:
    cd backend
    python scripts/seed_data.py
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.config import settings
from app.core.security import hash_password
from app.db.models import Category, Settings, User
from app.db.session import async_session


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


async def seed():
    print("=" * 50)
    print("Cash Flow Management - Seed Data")
    print("=" * 50)

    async with async_session() as db:
        # 1. Create admin user
        result = await db.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()

        if admin:
            print("\n[SKIP] Admin user already exists")
        else:
            admin = User(
                username="admin",
                email="admin@eyelevel.ai",
                password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                is_admin=True,
            )
            db.add(admin)
            await db.flush()

            # Create settings for admin
            admin_settings = Settings(user_id=admin.id)
            db.add(admin_settings)
            await db.flush()

            print(f"\n[OK] Admin user created (username: admin, password: from .env)")

        # 2. Create default categories for admin
        result = await db.execute(
            select(Category).where(Category.user_id == admin.id).limit(1)
        )
        if result.scalar_one_or_none():
            print("[SKIP] Categories already exist for admin")
        else:
            for cat_data in DEFAULT_CATEGORIES:
                category = Category(user_id=admin.id, **cat_data)
                db.add(category)
            print(f"[OK] Created {len(DEFAULT_CATEGORIES)} default categories")

        await db.commit()

    print("\n" + "=" * 50)
    print("Seed completed successfully!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
