"""
Generate Project Specification Document (מסמך אפיון)
=====================================================
Creates a professional Hebrew PDF document for non-technical stakeholders.
"""
from __future__ import annotations

import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable,
)

from bidi.algorithm import get_display

# ── Paths ──────────────────────────────────────────────────────────────
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_PATH = os.path.join(PROJECT_DIR, "אפיון_מערכת_ניהול_תזרים.pdf")
LOGO_PATH = os.path.join(PROJECT_DIR, "frontend", "public", "logo.jpeg")

# ── Font Registration ──────────────────────────────────────────────────
ARIAL_HEB = "/System/Library/Fonts/ArialHB.ttc"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

pdfmetrics.registerFont(TTFont("ArialHeb", ARIAL_HEB, subfontIndex=0))
pdfmetrics.registerFont(TTFont("ArialHebBold", ARIAL_HEB, subfontIndex=1))
pdfmetrics.registerFont(TTFont("Arial", ARIAL))
pdfmetrics.registerFont(TTFont("ArialBold", ARIAL_BOLD))

# ── Brand Colors ───────────────────────────────────────────────────────
BRAND_BLUE = colors.HexColor("#3B82F6")
BRAND_CYAN = colors.HexColor("#06B6D4")
BRAND_PURPLE = colors.HexColor("#8B5CF6")
BRAND_MAGENTA = colors.HexColor("#EC4899")
DARK_BG = colors.HexColor("#1E293B")
DARK_TEXT = colors.HexColor("#1E293B")
GRAY_TEXT = colors.HexColor("#64748B")
LIGHT_BG = colors.HexColor("#F8FAFC")
LIGHT_BORDER = colors.HexColor("#E2E8F0")
GREEN = colors.HexColor("#10B981")
RED = colors.HexColor("#EF4444")
AMBER = colors.HexColor("#F59E0B")


def bidi(text: str) -> str:
    """Apply bidi algorithm for proper Hebrew RTL display."""
    return get_display(text)


def build_styles():
    """Create all paragraph styles."""
    styles = {}

    styles["cover_title"] = ParagraphStyle(
        "CoverTitle", fontName="ArialHebBold", fontSize=32,
        alignment=TA_CENTER, textColor=DARK_TEXT, leading=42,
        spaceAfter=10,
    )
    styles["cover_subtitle"] = ParagraphStyle(
        "CoverSubtitle", fontName="ArialHeb", fontSize=16,
        alignment=TA_CENTER, textColor=GRAY_TEXT, leading=22,
        spaceAfter=6,
    )
    styles["cover_info"] = ParagraphStyle(
        "CoverInfo", fontName="ArialHeb", fontSize=12,
        alignment=TA_CENTER, textColor=GRAY_TEXT, leading=18,
    )
    styles["h1"] = ParagraphStyle(
        "H1", fontName="ArialHebBold", fontSize=22,
        alignment=TA_RIGHT, textColor=BRAND_BLUE, leading=30,
        spaceBefore=20, spaceAfter=12,
    )
    styles["h2"] = ParagraphStyle(
        "H2", fontName="ArialHebBold", fontSize=16,
        alignment=TA_RIGHT, textColor=DARK_TEXT, leading=22,
        spaceBefore=14, spaceAfter=8,
    )
    styles["h3"] = ParagraphStyle(
        "H3", fontName="ArialHebBold", fontSize=13,
        alignment=TA_RIGHT, textColor=BRAND_PURPLE, leading=18,
        spaceBefore=10, spaceAfter=6,
    )
    styles["body"] = ParagraphStyle(
        "Body", fontName="ArialHeb", fontSize=11,
        alignment=TA_RIGHT, textColor=DARK_TEXT, leading=18,
        spaceAfter=6,
    )
    styles["body_center"] = ParagraphStyle(
        "BodyCenter", fontName="ArialHeb", fontSize=11,
        alignment=TA_CENTER, textColor=DARK_TEXT, leading=18,
    )
    styles["bullet"] = ParagraphStyle(
        "Bullet", fontName="ArialHeb", fontSize=11,
        alignment=TA_RIGHT, textColor=DARK_TEXT, leading=18,
        spaceAfter=4, rightIndent=15,
    )
    styles["table_header"] = ParagraphStyle(
        "TableHeader", fontName="ArialHebBold", fontSize=10,
        alignment=TA_CENTER, textColor=colors.white, leading=14,
    )
    styles["table_cell"] = ParagraphStyle(
        "TableCell", fontName="ArialHeb", fontSize=10,
        alignment=TA_RIGHT, textColor=DARK_TEXT, leading=14,
    )
    styles["table_cell_center"] = ParagraphStyle(
        "TableCellCenter", fontName="ArialHeb", fontSize=10,
        alignment=TA_CENTER, textColor=DARK_TEXT, leading=14,
    )
    styles["table_cell_ltr"] = ParagraphStyle(
        "TableCellLTR", fontName="Arial", fontSize=10,
        alignment=TA_LEFT, textColor=DARK_TEXT, leading=14,
    )
    styles["caption"] = ParagraphStyle(
        "Caption", fontName="ArialHeb", fontSize=9,
        alignment=TA_CENTER, textColor=GRAY_TEXT, leading=13,
        spaceAfter=10,
    )
    styles["footer"] = ParagraphStyle(
        "Footer", fontName="ArialHeb", fontSize=8,
        alignment=TA_CENTER, textColor=GRAY_TEXT,
    )
    return styles


def make_table(headers, rows, col_widths=None, styles_dict=None):
    """Create a styled RTL table."""
    s = styles_dict or build_styles()

    # Reverse columns for RTL display
    header_cells = [Paragraph(bidi(h), s["table_header"]) for h in reversed(headers)]
    data = [header_cells]

    for row in rows:
        reversed_row = list(reversed(row))
        cells = []
        for cell in reversed_row:
            if isinstance(cell, Paragraph):
                cells.append(cell)
            else:
                cells.append(Paragraph(bidi(str(cell)), s["table_cell_center"]))
        data.append(cells)

    if col_widths:
        col_widths = list(reversed(col_widths))

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def make_status_table(headers, rows, status_col_idx, col_widths=None, styles_dict=None):
    """Create a table with colored status column."""
    s = styles_dict or build_styles()

    header_cells = [Paragraph(bidi(h), s["table_header"]) for h in reversed(headers)]
    data = [header_cells]

    num_cols = len(headers)
    reversed_status_idx = num_cols - 1 - status_col_idx

    for row in rows:
        reversed_row = list(reversed(row))
        cells = []
        for cell in reversed_row:
            if isinstance(cell, Paragraph):
                cells.append(cell)
            else:
                cells.append(Paragraph(bidi(str(cell)), s["table_cell_center"]))
        data.append(cells)

    if col_widths:
        col_widths = list(reversed(col_widths))

    t = Table(data, colWidths=col_widths, repeatRows=1)

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]

    # Color status cells
    for i, row in enumerate(rows, start=1):
        status = row[status_col_idx]
        if "הושלם" in status or "פעיל" in status:
            style_cmds.append(("TEXTCOLOR", (reversed_status_idx, i), (reversed_status_idx, i), GREEN))
            style_cmds.append(("FONTNAME", (reversed_status_idx, i), (reversed_status_idx, i), "ArialHebBold"))
        elif "בתכנון" in status or "עתידי" in status:
            style_cmds.append(("TEXTCOLOR", (reversed_status_idx, i), (reversed_status_idx, i), AMBER))
            style_cmds.append(("FONTNAME", (reversed_status_idx, i), (reversed_status_idx, i), "ArialHebBold"))

    t.setStyle(TableStyle(style_cmds))
    return t


def hr():
    """Horizontal rule."""
    return HRFlowable(width="100%", thickness=1, color=LIGHT_BORDER, spaceAfter=10, spaceBefore=5)


def build_document():
    """Build the full specification document."""
    s = build_styles()
    story = []
    today_str = date.today().strftime("%d/%m/%Y")
    W = 17 * cm  # usable width

    # ═══════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 3 * cm))

    if os.path.exists(LOGO_PATH):
        logo = Image(LOGO_PATH, width=5 * cm, height=5 * cm)
        logo.hAlign = "CENTER"
        story.append(logo)
        story.append(Spacer(1, 1.5 * cm))

    story.append(Paragraph(bidi("מסמך אפיון מערכת"), s["cover_title"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(bidi("ניהול תזרים מזומנים"), s["cover_title"]))
    story.append(Spacer(1, 1 * cm))

    story.append(HRFlowable(width="60%", thickness=2, color=BRAND_BLUE, spaceAfter=15, spaceBefore=5))

    story.append(Paragraph(bidi("Eye Level AI"), s["cover_subtitle"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(bidi("Cash Flow Management System"), s["cover_subtitle"]))
    story.append(Spacer(1, 2 * cm))

    cover_info = [
        f"גרסה: 2.0",
        f"תאריך: {today_str}",
        f"סטטוס: פעיל - שלב 5 הושלם",
    ]
    for info in cover_info:
        story.append(Paragraph(bidi(info), s["cover_info"]))
        story.append(Spacer(1, 0.2 * cm))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("תוכן עניינים"), s["h1"]))
    story.append(hr())

    toc_items = [
        ("1", "תקציר מנהלים"),
        ("2", "רקע וצורך עסקי"),
        ("3", "סקירת המערכת"),
        ("4", "מודולים ותכונות"),
        ("5", "תהליכי עבודה"),
        ("6", "אבטחה ואמינות"),
        ("7", "ממשק משתמש"),
        ("8", "סטטוס פיתוח"),
        ("9", "תוכנית המשך"),
        ("10", "נספחים"),
    ]
    for num, title in toc_items:
        story.append(Paragraph(bidi(f"{title}  .....  {num}"), s["body"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 1. EXECUTIVE SUMMARY
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("1. תקציר מנהלים"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi(
        "מערכת ניהול תזרים מזומנים של Eye Level AI היא פלטפורמה מלאה לניהול פיננסי "
        "המיועדת לעסקים קטנים ובינוניים. המערכת מאפשרת מעקב אחר הכנסות והוצאות, "
        "חיזוי תזרים עתידי, ניהול הלוואות ופריסות תשלומים, וקבלת התראות על מצבים "
        "פיננסיים חריגים - הכל דרך ממשק נוח ונגיש בעברית."
    ), s["body"]))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph(bidi("עיקרון מנחה: SELF-SERVICE מלא"), s["h3"]))
    story.append(Paragraph(bidi(
        "המערכת תוכננה כך שמשתמש שאינו טכני יוכל לנהל את כל הפעילות הפיננסית בעצמו, "
        "ללא תלות במפתח או איש IT. כל פעולה - מהכנסת נתונים ועד הפקת תחזיות - "
        "מתבצעת דרך ממשק המשתמש הגרפי."
    ), s["body"]))
    story.append(Spacer(1, 0.3 * cm))

    # Key numbers box
    kpi_data = [
        ["מספר", "מדד"],
        ["73", bidi("נקודות API פעילות")],
        ["14", bidi("מודולים פעילים")],
        ["176", bidi("בדיקות אוטומטיות עוברות")],
        ["10", bidi("דפי ממשק CRUD מלאים")],
        ["2", bidi("שפות (עברית + אנגלית)")],
    ]
    kpi_table = Table(kpi_data, colWidths=[3 * cm, 10 * cm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "ArialHebBold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(kpi_table)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 2. BUSINESS BACKGROUND
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("2. רקע וצורך עסקי"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi("הבעיה"), s["h2"]))
    story.append(Paragraph(bidi(
        "עסקים קטנים ובינוניים מתמודדים עם אתגר מתמשך בניהול תזרים המזומנים שלהם. "
        "רבים מנהלים את החשבונות בגליונות Excel מורכבים, חסרים תמונה עדכנית של המצב "
        "הפיננסי, ולא מצליחים לחזות בעיות תזרים לפני שהן מתרחשות."
    ), s["body"]))

    problems = [
        "אין תמונה מאוחדת של כל ההכנסות וההוצאות במקום אחד",
        "קושי לחזות תזרים עתידי ולזהות חודשים בעייתיים מראש",
        "ניהול ידני של הלוואות, פריסות ותשלומים קבועים",
        "היעדר התראות אוטומטיות על מצבים פיננסיים חריגים",
        "תלות בגורם טכני להפקת דוחות וניתוחים",
    ]
    for p in problems:
        story.append(Paragraph(bidi(f"  {p}  •"), s["bullet"]))

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(bidi("הפתרון"), s["h2"]))
    story.append(Paragraph(bidi(
        "המערכת שלנו מספקת פתרון כולל ונגיש שמאפשר לבעלי עסקים ומנהלים כספיים "
        "לנהל את התזרים בצורה חכמה ועצמאית:"
    ), s["body"]))

    solutions = [
        "דשבורד מרכזי - תמונה מלאה של המצב הפיננסי במבט אחד",
        "חיזוי אוטומטי - תחזית תזרים ל-6 חודשים קדימה",
        "התראות חכמות - זיהוי אוטומטי של תזרים שלילי צפוי",
        "ניהול הלוואות - מעקב אוטומטי אחר תשלומים ולוחות סילוקין",
        "אוטומציה - חיוב אוטומטי של תשלומים קבועים ביום התשלום",
        "ממשק בעברית - עיצוב RTL מקצועי עם תמיכה באנגלית",
    ]
    for sol in solutions:
        story.append(Paragraph(bidi(f"  {sol}  •"), s["bullet"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 3. SYSTEM OVERVIEW
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("3. סקירת המערכת"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi("ארכיטקטורה כללית"), s["h2"]))
    story.append(Paragraph(bidi(
        "המערכת בנויה בארכיטקטורת שרת-לקוח מודרנית, עם הפרדה מלאה בין צד השרת "
        "(Backend) לצד הלקוח (Frontend). תקשורת מתבצעת דרך API מאובטח."
    ), s["body"]))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(bidi("רכיבי המערכת"), s["h3"]))

    arch_data = [
        ["טכנולוגיה", "תיאור", "רכיב"],
        ["FastAPI + Python", bidi("שרת API מהיר ומאובטח"), bidi("צד שרת")],
        ["PostgreSQL 16", bidi("מסד נתונים יחסי - דיוק פיננסי"), bidi("מסד נתונים")],
        ["React 19 + TypeScript", bidi("ממשק משתמש מודרני ומהיר"), bidi("צד לקוח")],
        ["Tailwind CSS v4", bidi("עיצוב רספונסיבי עם תמיכת RTL"), bidi("עיצוב")],
        ["JWT Tokens", bidi("אימות מאובטח עם רענון אוטומטי"), bidi("אבטחה")],
        ["Recharts", bidi("גרפים ותרשימים אינטראקטיביים"), bidi("ויזואליזציה")],
    ]
    arch_table = Table(arch_data, colWidths=[5 * cm, 7.5 * cm, 4.5 * cm])
    arch_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTNAME", (0, 1), (-1, -1), "ArialHeb"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(arch_table)

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(bidi("תכונות עיקריות"), s["h3"]))

    features = [
        "דו-שפתיות מלאה - עברית (ברירת מחדל, RTL) ואנגלית (LTR)",
        "מצב כהה ובהיר - התאמה אוטומטית או ידנית",
        "דיוק פיננסי - שני ספרות אחרי הנקודה (DECIMAL 15,2)",
        "מטבע ברירת מחדל - שקל (ILS), עם תמיכה במטבעות נוספים",
        "ממשק רספונסיבי - מותאם למחשב ולמובייל",
        "בדיקות אוטומטיות - 176 בדיקות מכסות את כל הלוגיקה העסקית",
    ]
    for f in features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 4. MODULES AND FEATURES
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("4. מודולים ותכונות"), s["h1"]))
    story.append(hr())

    # ── 4.1 Dashboard ──
    story.append(Paragraph(bidi("4.1 דשבורד (לוח בקרה)"), s["h2"]))
    story.append(Paragraph(bidi(
        "דף הבית של המערכת מציג סיכום מלא של המצב הפיננסי:"
    ), s["body"]))
    dash_features = [
        "כרטיסי KPI - יתרה נוכחית, הכנסות החודש, הוצאות החודש, צפי",
        "גרף תחזית - תזרים צפוי ל-6 חודשים קדימה",
        "פאנל התראות - התראות פעילות עם רמות חומרה (קריטי, אזהרה, מידע)",
        "פעולות מהירות - קיצורי דרך ליצירת תנועה, הגדרת יתרה, ועוד",
    ]
    for f in dash_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.2 Transactions ──
    story.append(Paragraph(bidi("4.2 תנועות (הכנסות והוצאות)"), s["h2"]))
    story.append(Paragraph(bidi(
        "ניהול מלא של כל ההכנסות וההוצאות עם כלי סינון וחיפוש מתקדמים:"
    ), s["body"]))
    tx_features = [
        "יצירה, עריכה ומחיקה של תנועות",
        "שכפול תנועה בלחיצה אחת",
        "סינון לפי: תאריך, קטגוריה, סכום, סוג (הכנסה/הוצאה), טקסט חופשי",
        "מיון לפי כל עמודה (תאריך, סכום, תיאור)",
        "פעולות מרובות - מחיקה, עדכון קטגוריה",
        "Pagination - דפדוף בין עמודים",
        "שיוך לקטגוריה עם צבע ואייקון",
    ]
    for f in tx_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.3 Categories ──
    story.append(Paragraph(bidi("4.3 קטגוריות"), s["h2"]))
    story.append(Paragraph(bidi(
        "ניהול קטגוריות מותאמות אישית להכנסות ולהוצאות:"
    ), s["body"]))
    cat_features = [
        "תצוגה דו-עמודית: הכנסות משמאל, הוצאות מימין",
        "בחירת צבע ואייקון לכל קטגוריה",
        "שם בעברית ובאנגלית",
        "ארכיון (מחיקה רכה) - קטגוריה עם תנועות לא נמחקת לצמיתות",
        "שינוי סדר תצוגה",
    ]
    for f in cat_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.4 Fixed ──
    story.append(Paragraph(bidi("4.4 הכנסות והוצאות קבועות"), s["h2"]))
    story.append(Paragraph(bidi(
        "ניהול תשלומים חודשיים קבועים שחוזרים על עצמם:"
    ), s["body"]))
    fixed_features = [
        "הגדרת סכום, יום חיוב בחודש, תאריך התחלה וסיום",
        "סוג: הכנסה או הוצאה",
        "השהיה וחידוש (Pause/Resume) - לדוגמה: חופשה ללא תשלום",
        "תצוגת כרטיסים נוחה",
        'דוגמאות: משכורת, שכ"ד, ביטוח, מנויים, ועד בית',
    ]
    for f in fixed_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(PageBreak())

    # ── 4.5 Installments ──
    story.append(Paragraph(bidi("4.5 פריסות תשלומים"), s["h2"]))
    story.append(Paragraph(bidi(
        "ניהול רכישות בתשלומים (קרדיט) ותשלומים מפוצלים:"
    ), s["body"]))
    inst_features = [
        "הגדרת סכום כולל ומספר תשלומים",
        "חישוב אוטומטי של תשלום חודשי",
        "פס התקדמות (Progress Bar) - כמה תשלומים שולמו",
        "לוח תשלומים מפורט - תאריך כל תשלום",
        "תמיכה בהכנסות בתשלומים (למשל: פרויקט שמשולם בחלקים)",
        "דוגמאות: מקרר בתשלומים, מחשב נייד, ריהוט",
    ]
    for f in inst_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.6 Loans ──
    story.append(Paragraph(bidi("4.6 הלוואות"), s["h2"]))
    story.append(Paragraph(bidi(
        "ניהול מלא של הלוואות עם לוח סילוקין ומעקב תשלומים:"
    ), s["body"]))
    loan_features = [
        "פרטי הלוואה: סכום מקורי, תשלום חודשי, ריבית, מספר תשלומים",
        "לוח סילוקין (Amortization) - פירוט קרן וריבית בכל תשלום",
        "רישום תשלום - עדכון אוטומטי של יתרת הלוואה",
        "ניהול סטטוס: פעילה, הושלמה, מושהית",
        "חסימת סגירה מוקדמת אם נותרו תשלומים",
        "דוגמאות: משכנתא, הלוואת רכב, הלוואה אישית",
    ]
    for f in loan_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.7 Balance ──
    story.append(Paragraph(bidi("4.7 יתרת בנק"), s["h2"]))
    story.append(Paragraph(bidi(
        "ניהול יתרת חשבון הבנק כנקודת התחלה לתחזית:"
    ), s["body"]))
    balance_features = [
        "הגדרת יתרה נוכחית בפעולה אחת",
        "גרף היסטוריית יתרות לאורך זמן",
        "הערות לכל עדכון יתרה",
        "היתרה משמשת כבסיס לחישוב התחזית",
    ]
    for f in balance_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.8 Forecast ──
    story.append(Paragraph(bidi("4.8 תחזית תזרים"), s["h2"]))
    story.append(Paragraph(bidi(
        "מנוע חיזוי שמחשב את התזרים הצפוי בהתבסס על כל הנתונים במערכת:"
    ), s["body"]))
    forecast_features = [
        "תחזית חודשית - 6 חודשים קדימה (ניתן להגדרה עד 24)",
        "תחזית שבועית - 12 שבועות קדימה",
        "סיכום - יתרת פתיחה, הכנסות, הוצאות, שינוי נטו, יתרת סגירה",
        "מקורות תחזית: קבועות, פריסות, הלוואות, תנועות חד-פעמיות",
        "גרף תחזית אינטראקטיבי",
        "יצירת התראות אוטומטית בעת חישוב",
    ]
    for f in forecast_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(PageBreak())

    # ── 4.9 Alerts ──
    story.append(Paragraph(bidi("4.9 מערכת התראות"), s["h2"]))
    story.append(Paragraph(bidi(
        "זיהוי אוטומטי של מצבים פיננסיים חריגים והתרעה למשתמש:"
    ), s["body"]))

    alert_table_data = [
        [bidi("תיאור"), bidi("סף"), bidi("רמת חומרה")],
        [
            bidi("יתרה צפויה שלילית מאוד"),
            bidi("יתרה < -5,000 ש\"ח"),
            bidi("קריטי"),
        ],
        [
            bidi("יתרה צפויה שלילית"),
            bidi("יתרה < 0 ש\"ח"),
            bidi("אזהרה"),
        ],
        [
            bidi("חודש הוצאות גבוהות"),
            bidi("שינוי נטו < -10,000 ש\"ח"),
            bidi("מידע"),
        ],
    ]
    alert_table = Table(alert_table_data, colWidths=[7 * cm, 5 * cm, 5 * cm])
    alert_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTNAME", (0, 1), (-1, -1), "ArialHeb"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        # Color severity cells
        ("TEXTCOLOR", (2, 1), (2, 1), RED),
        ("FONTNAME", (2, 1), (2, 1), "ArialHebBold"),
        ("TEXTCOLOR", (2, 2), (2, 2), AMBER),
        ("FONTNAME", (2, 2), (2, 2), "ArialHebBold"),
        ("TEXTCOLOR", (2, 3), (2, 3), BRAND_BLUE),
        ("FONTNAME", (2, 3), (2, 3), "ArialHebBold"),
    ]))
    story.append(alert_table)
    story.append(Spacer(1, 0.2 * cm))

    alert_features = [
        "סימון כנקרא - ההתראה נשמרת אך לא מוצגת כחדשה",
        "ביטול התראה - נמחקת מהרשימה לצמיתות",
        "שמירת מצב - סימון 'נקרא' נשמר גם אחרי עדכון התחזית",
        "הצגה בדשבורד - חמש התראות אחרונות מוצגות בדף הבית",
    ]
    for f in alert_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.10 Automation ──
    story.append(Paragraph(bidi("4.10 אוטומציית תשלומים"), s["h2"]))
    story.append(Paragraph(bidi(
        "שירות אוטומציה שיוצר תנועות מהלוואות, קבועות ופריסות ביום התשלום:"
    ), s["body"]))
    auto_features = [
        "עיבוד הלוואות - יצירת תנועת הוצאה ביום החיוב, עדכון מונה תשלומים",
        "עיבוד קבועות - יצירת תנועות הכנסה/הוצאה לפי יום בחודש",
        "עיבוד פריסות - יצירת תנועה ועדכון מונה תשלומים ששולמו",
        "מניעת כפילויות - לא יוצר תנועה כפולה אם כבר קיימת לאותו יום",
        "תצוגה מקדימה - אפשרות לראות מה ייווצר לפני הביצוע",
        "סגירה אוטומטית - הלוואה שכל תשלומיה שולמו מסומנת כהושלמה",
    ]
    for f in auto_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))

    # ── 4.11 Settings ──
    story.append(Paragraph(bidi("4.11 הגדרות"), s["h2"]))
    settings_features = [
        "החלפת ערכת נושא: בהיר / כהה",
        "החלפת שפה: עברית / אנגלית (RTL/LTR אוטומטי)",
        "הגדרת כמות חודשי תחזית (1-24)",
        "הפעלה/כיבוי התראות",
        "שמירה אוטומטית - שינויים נשמרים מיד",
    ]
    for f in settings_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 5. WORKFLOWS
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("5. תהליכי עבודה"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi("5.1 תהליך יומי מומלץ"), s["h2"]))
    daily_steps = [
        "כניסה למערכת → דשבורד מציג את המצב העדכני",
        "בדיקת התראות → טיפול בהתראות קריטיות",
        "הזנת תנועות חדשות → הכנסות/הוצאות שהתקבלו היום",
        "סקירת תחזית → בדיקה שאין בעיות צפויות",
    ]
    for i, step in enumerate(daily_steps, 1):
        story.append(Paragraph(bidi(f"  {step}  .{i}"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("5.2 תהליך חודשי"), s["h2"]))
    monthly_steps = [
        "עדכון יתרת בנק → הזנת היתרה הנוכחית מדף החשבון",
        "בדיקת תחזית 6 חודשים → זיהוי חודשים בעייתיים",
        "ניהול הלוואות → רישום תשלומים שבוצעו",
        "הפעלת אוטומציה → עיבוד חיובים קבועים של החודש",
        "סקירת קטגוריות → בדיקת התפלגות ההוצאות",
    ]
    for i, step in enumerate(monthly_steps, 1):
        story.append(Paragraph(bidi(f"  {step}  .{i}"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("5.3 תרחיש לדוגמה: זיהוי תזרים שלילי"), s["h2"]))
    story.append(Paragraph(bidi(
        "המשתמש מזין יתרה נמוכה (₪500) ויש לו הוצאות קבועות גבוהות (₪10,000/חודש). "
        "ברגע שנכנס לדף התחזית, המערכת מחשבת שהיתרה תהיה שלילית ומייצרת התראות קריטיות. "
        "המשתמש רואה את ההתראות בדשבורד ובדף ההתראות, ויכול לסמן אותן כנקראו או לבטל."
    ), s["body"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 6. SECURITY
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("6. אבטחה ואמינות"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi("6.1 אימות והרשאות"), s["h2"]))
    security_features = [
        "JWT Tokens - אימות מאובטח ללא שמירת מצב בשרת",
        "Refresh Tokens - חידוש אוטומטי של הגישה ללא צורך בהתחברות מחדש",
        "הצפנת סיסמאות - bcrypt עם salt ייחודי",
        "הפרדת משתמשים - כל משתמש רואה רק את הנתונים שלו",
        "תיקון IDOR - בדיקת בעלות על קטגוריות בכל פעולה",
        "הגנת CORS - רק מקורות מורשים יכולים לגשת ל-API",
    ]
    for f in security_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("6.2 שלמות נתונים"), s["h2"]))
    data_features = [
        "22 אינדקסים על טבלאות מסד הנתונים - ביצועים מהירים",
        "CHECK Constraints - אכיפת ערכים תקינים (סכומים חיוביים, תאריכים)",
        "Foreign Keys - שלמות קשרים בין טבלאות",
        "Soft Delete - קטגוריות עם תנועות לא נמחקות לצמיתות",
        "176 בדיקות אוטומטיות - מכסות את כל הלוגיקה העסקית",
    ]
    for f in data_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("6.3 טיפול בשגיאות"), s["h2"]))
    error_features = [
        "Error Boundary - תפיסת שגיאות ממשק עם אפשרות לנסות שוב",
        "דף 404 מותאם - עיצוב מקצועי עם לוגו ומידע לדיבוג",
        "טיפול בשגיאות שרת - הודעות מובנות ללא חשיפת מידע רגיש",
        "Validation - בדיקת תקינות קלט בצד השרת ובצד הלקוח",
    ]
    for f in error_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 7. UI
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("7. ממשק משתמש"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi(
        "ממשק המשתמש תוכנן לנוחות מקסימלית עם דגש על נגישות ושימושיות:"
    ), s["body"]))

    story.append(Paragraph(bidi("7.1 עיצוב"), s["h2"]))
    ui_features = [
        "גרדיאנט מותג: ציאן → כחול → סגול → מג'נטה",
        "ערכת נושא כהה/בהיר עם מעבר חלק",
        "Sidebar נווט - מתכווץ למובייל, אייקונים + טקסט",
        "כרטיסים (Cards) - תצוגה נוחה למידע פיננסי",
        "טבלאות - מיון, סינון, דפדוף",
        "מודלים (Modals) - יצירה ועריכה עם backdrop מטושטש",
    ]
    for f in ui_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("7.2 נגישות"), s["h2"]))
    a11y_features = [
        "תמיכה מלאה ב-RTL (ימין לשמאל) לעברית",
        "מעבר אוטומטי ל-LTR לאנגלית",
        "CSS Logical Properties - אין ternaries קשיחים",
        'תגיות נגישות: scope="col" בטבלאות, aria-describedby בטפסים',
        "Hover effects דרך CSS בלבד (ללא JavaScript מיותר)",
        "Tooltips על טקסט חתוך - הצגת הטקסט המלא",
    ]
    for f in a11y_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("7.3 מפת דפים"), s["h2"]))

    pages_data = [
        ["תיאור", "נתיב", "דף"],
        [bidi("כרטיסי KPI, גרף תחזית, התראות"), "/dashboard", bidi("דשבורד")],
        [bidi("טבלה עם CRUD, סינון, מיון, bulk"), "/transactions", bidi("תנועות")],
        [bidi("כרטיסים עם pause/resume"), "/fixed", bidi("קבועות")],
        [bidi("Progress bars, לוח תשלומים"), "/installments", bidi("פריסות")],
        [bidi("לוח סילוקין, מעקב תשלומים"), "/loans", bidi("הלוואות")],
        [bidi("שתי עמודות, צבע ואייקון"), "/categories", bidi("קטגוריות")],
        [bidi("יתרה נוכחית, גרף היסטוריה"), "/balance", bidi("יתרה")],
        [bidi("חודשי, שבועי, סיכום + גרפים"), "/forecast", bidi("תחזית")],
        [bidi("סינון לפי חומרה, סימון, ביטול"), "/alerts", bidi("התראות")],
        [bidi("ערכת נושא, שפה, העדפות"), "/settings", bidi("הגדרות")],
        [bidi("ניהול משתמשים (מנהל בלבד)"), "/users", bidi("משתמשים")],
    ]
    pages_table = Table(pages_data, colWidths=[8 * cm, 4 * cm, 5 * cm])
    pages_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTNAME", (0, 1), (-1, -1), "ArialHeb"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(pages_table)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 8. DEVELOPMENT STATUS
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("8. סטטוס פיתוח"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi(
        "המערכת נמצאת בפיתוח פעיל. להלן סטטוס כל שלבי הפיתוח:"
    ), s["body"]))

    status_data = [
        [bidi("הערות"), bidi("סטטוס"), bidi("תיאור"), bidi("שלב")],
        [bidi("Docker, FastAPI, React"), bidi("הושלם"), bidi("הקמת תשתית"), bidi("שלב 0")],
        [bidi("23 בדיקות, 33 נתיבי API"), bidi("הושלם"), bidi("תשתית Backend"), bidi("שלב 1")],
        [bidi("155 בדיקות, 67 נתיבי API"), bidi("הושלם"), bidi("תכונות פיננסיות"), bidi("שלב 2")],
        [bidi("88 בדיקות edge case"), bidi("הושלם"), bidi("הקשחת אבטחה"), bidi("שלב 2.5")],
        [bidi("Router, Auth, i18n, Theme"), bidi("הושלם"), bidi("תשתית Frontend"), bidi("שלב 3")],
        [bidi("10 דפי CRUD מלאים"), bidi("הושלם"), bidi("דפי ממשק"), bidi("שלב 4")],
        [bidi("176 בדיקות, אוטומציה"), bidi("הושלם"), bidi("ליטוש ו-QA"), bidi("שלב 5")],
        [bidi("ייצוא וייבוא"), bidi("בתכנון"), bidi("שירות עצמי"), bidi("שלב 6")],
    ]
    status_table = Table(status_data, colWidths=[5.5 * cm, 3 * cm, 5 * cm, 3.5 * cm])
    status_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTNAME", (0, 1), (-1, -1), "ArialHeb"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        # Green for completed
        ("TEXTCOLOR", (2, 1), (2, 7), GREEN),
        ("FONTNAME", (2, 1), (2, 7), "ArialHebBold"),
        # Amber for planned
        ("TEXTCOLOR", (2, 8), (2, 8), AMBER),
        ("FONTNAME", (2, 8), (2, 8), "ArialHebBold"),
    ]))
    story.append(status_table)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 9. ROADMAP
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("9. תוכנית המשך"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi("9.1 שלב הבא: ייצוא וייבוא"), s["h2"]))
    next_features = [
        "ייצוא תנועות ל-CSV ו-Excel",
        "ייצוא דוח חודשי/שנתי ל-PDF",
        "ייבוא תנועות מקובץ CSV עם מיפוי עמודות",
        "תצוגה מקדימה לפני ייבוא",
        "דיווח על שורות שנכשלו",
    ]
    for f in next_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(bidi("9.2 תכונות עתידיות"), s["h2"]))
    future_features = [
        "תזמון אוטומציה - עיבוד חיובים קבועים אוטומטי (ללא הפעלה ידנית)",
        "תמיכה מלאה ברב-מטבעות - המרה אוטומטית",
        "חיבור ל-API בנקאי - סנכרון אוטומטי של תנועות",
        "דוחות מתוזמנים - שליחת סיכום חודשי במייל",
        "אפליקציית מובייל - React Native",
        "לוג שינויים (Audit Log) - מעקב אחר כל פעולה במערכת",
    ]
    for f in future_features:
        story.append(Paragraph(bidi(f"  {f}  •"), s["bullet"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════
    # 10. APPENDIX - DATABASE
    # ═══════════════════════════════════════════════════════════════════
    story.append(Paragraph(bidi("10. נספחים"), s["h1"]))
    story.append(hr())

    story.append(Paragraph(bidi("10.1 מבנה מסד הנתונים"), s["h2"]))
    story.append(Paragraph(bidi(
        "המערכת משתמשת ב-10 טבלאות עיקריות במסד הנתונים:"
    ), s["body"]))

    db_data = [
        [bidi("תיאור"), bidi("טבלה")],
        [bidi("משתמשי המערכת (כולל מנהלים)"), "users"],
        [bidi("הגדרות משתמש (שפה, ערכת נושא, מטבע)"), "settings"],
        [bidi("קטגוריות הכנסה/הוצאה"), "categories"],
        [bidi("תנועות הכנסה והוצאה"), "transactions"],
        [bidi("הכנסות והוצאות חודשיות קבועות"), "fixed_income_expenses"],
        [bidi("פריסות תשלומים"), "installments"],
        [bidi("הלוואות"), "loans"],
        [bidi("היסטוריית יתרות בנק"), "bank_balances"],
        [bidi("הכנסות צפויות (הערכות)"), "expected_income"],
        [bidi("התראות אוטומטיות"), "alerts"],
    ]
    db_table = Table(db_data, colWidths=[10 * cm, 7 * cm])
    db_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTNAME", (0, 1), (-1, -1), "ArialHeb"),
        ("FONTNAME", (1, 1), (1, -1), "Arial"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(db_table)

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(bidi("10.2 נקודות API"), s["h2"]))
    story.append(Paragraph(bidi(
        "המערכת חושפת 73 נקודות API (67 אפליקטיביות + 6 תשתיתיות) ב-14 מודולים:"
    ), s["body"]))

    api_data = [
        [bidi("פעולות"), bidi("כמות"), bidi("מודול")],
        [bidi("הרשמה, כניסה, רענון, עדכון פרופיל"), "7", bidi("אימות")],
        [bidi("רשימה, יצירה, עדכון, מחיקה"), "4", bidi("משתמשים")],
        [bidi("CRUD + שכפול + bulk"), "9", bidi("תנועות")],
        [bidi("CRUD + שינוי סדר"), "6", bidi("קטגוריות")],
        [bidi("CRUD + השהיה/חידוש"), "7", bidi("קבועות")],
        [bidi("CRUD + לוח תשלומים"), "6", bidi("פריסות")],
        [bidi("CRUD + תשלום + לוח סילוקין"), "7", bidi("הלוואות")],
        [bidi("יתרה, עדכון, היסטוריה"), "4", bidi("יתרה")],
        [bidi("חודשי, שבועי, סיכום"), "3", bidi("תחזית")],
        [bidi("סיכום, שבועי, חודשי, רבעוני"), "4", bidi("דשבורד")],
        [bidi("רשימה, נקרא, ביטול"), "4", bidi("התראות")],
        [bidi("קריאה, עדכון"), "2", bidi("הגדרות")],
        [bidi("עיבוד, תצוגה מקדימה"), "2", bidi("אוטומציה")],
    ]
    api_table = Table(api_data, colWidths=[8 * cm, 3 * cm, 6 * cm])
    api_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "ArialHebBold"),
        ("FONTNAME", (0, 1), (-1, -1), "ArialHeb"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(api_table)

    # ── BUILD ──────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2 * cm,
        title="מסמך אפיון - ניהול תזרים מזומנים",
        author="Eye Level AI",
    )

    def add_page_number(canvas_obj, doc_obj):
        page_num = canvas_obj.getPageNumber()
        canvas_obj.saveState()
        canvas_obj.setFont("ArialHeb", 8)
        canvas_obj.setFillColor(GRAY_TEXT)
        canvas_obj.drawCentredString(
            A4[0] / 2, 1.2 * cm,
            get_display(f"Eye Level AI - מסמך אפיון מערכת ניהול תזרים  |  עמוד {page_num}")
        )
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"\nPDF created: {OUTPUT_PATH}")
    print(f"Pages: {doc.page}")


if __name__ == "__main__":
    build_document()
