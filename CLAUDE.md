# Financial-Application-Eye-Level-AI

> עדכן את שם הפרויקט והתיאור כאן

## תיאור

אפליקציית ניהול פיננסי

---

## Project Goals

**Primary Goal:** ניתוח נתונים פיננסיים

**Success Criteria:**
- [ ] [קריטריון 1 - יעודכן ע"י Orchestrator]
- [ ] [קריטריון 2]
- [ ] [קריטריון 3]

**Out of Scope:**
- [מה שהפרויקט לא עושה - יעודכן ע"י Orchestrator]

---

## Multi-Agent Setup

פרויקט זה משתמש ב-5 סוכני AI:

| Tab | סוכן | תפקיד | קובץ הוראות |
|-----|------|-------|-------------|
| 1 | **Orchestrator** | מתכנן ומתאם | `agents/ORCHESTRATOR.md` |
| 2 | **Implementer** | כותב קוד | `agents/IMPLEMENTER.md` |
| 3 | **Tester** | כותב ומריץ טסטים | `agents/TESTER.md` |
| 4 | **Reviewer** | בודק איכות קוד | `agents/REVIEWER.md` |
| 5 | **Docs** | כותב תיעוד | `agents/DOCS.md` |

---

## מבנה תיקיות

```
agents/
├── ORCHESTRATOR.md     # הוראות לארכיטקט
├── IMPLEMENTER.md      # הוראות למפתח
├── TESTER.md           # הוראות לבודק
├── REVIEWER.md         # הוראות לסוקר
├── DOCS.md             # הוראות למתעד
│
├── tasks/              # משימות (Orchestrator כותב)
│   ├── implement.md
│   ├── test.md
│   ├── review.md
│   └── docs.md
│
├── status/             # סטטוסים (כל סוכן מעדכן את שלו)
│   ├── implement.md
│   ├── test.md
│   ├── review.md
│   └── docs.md
│
└── shared/             # מידע משותף לכולם
    ├── decisions.md    # החלטות ארכיטקטוניות
    ├── conventions.md  # קונבנציות קוד
    └── blockers.md     # חסימות לפתרון
```

---

## כללים לכל הסוכנים

1. **קרא את הקובץ שלך** לפני שמתחיל (`agents/[AGENT].md`)
2. **עדכן סטטוס** אחרי כל משימה
3. **אל תעשה עבודה של סוכן אחר**
4. **אם נתקעת** - כתוב ל-`agents/shared/blockers.md`
5. **עקוב אחרי** `agents/shared/conventions.md`

---

## פרומפטים להפעלה

**Tab 1 - Orchestrator:**
```
אתה Orchestrator. קרא agents/ORCHESTRATOR.md והתחל לעבוד.
```

**Tab 2 - Implementer:**
```
אתה Implementer. קרא agents/IMPLEMENTER.md
```

**Tab 3 - Tester:**
```
אתה Tester. קרא agents/TESTER.md
```

**Tab 4 - Reviewer:**
```
אתה Reviewer. קרא agents/REVIEWER.md
```

**Tab 5 - Docs:**
```
אתה Docs. קרא agents/DOCS.md
```

---

## Tech Stack

> יעודכן ע"י Orchestrator

| קטגוריה | טכנולוגיה | סיבה |
|---------|----------|------|
| **Language** | Python | |
| **Framework** | | |
| **Database** | | |
| **Testing** | | |
| **Build Tool** | | |
| **Package Manager** | | |
| **CI/CD** | | |
| **Deployment** | | |

---

## Architecture Overview

> יעודכן ע"י Orchestrator

**Components:**
- [רכיב 1]: [תיאור]
- [רכיב 2]: [תיאור]

**Data Flow:**
```
[תרשים או תיאור של זרימת המידע]
```

**Key Decisions:**
- ראה `agents/shared/decisions.md` לפירוט מלא

---

## Setup & Run

> יעודכן ע"י Orchestrator

### Prerequisites
- [דרישה 1]
- [דרישה 2]

### Installation
```bash
# יעודכן ע"י Orchestrator
```

### Development
```bash
# Run development server
# יעודכן ע"י Orchestrator
```

### Testing
```bash
# Run tests
# יעודכן ע"י Orchestrator
```

### Build
```bash
# Build for production
# יעודכן ע"י Orchestrator
```

---

## התקדמות נוכחית

> יעודכן ע"י Orchestrator

**שלב נוכחי:** [תכנון / פיתוח / בדיקות / תיעוד]

**משימות פתוחות:**
- [ ] ...

---

## הערות חשובות

> הוסף כאן מידע קריטי שכל הסוכנים צריכים לדעת
