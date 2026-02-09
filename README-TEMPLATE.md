# 🚀 Multi-Agent Project Template V2

> תבנית משודרגת לפרויקטים עם צוות של 5 סוכני AI

---

## 📋 מה כלול בתבנית זו?

### קבצי הגדרות
- ✅ **CLAUDE.md** - קובץ ראשי משודרג עם סעיפים חדשים
- ✅ **GUIDE.md** - מדריך מלא לשימוש
- ✅ **.gitignore.template** - תבנית gitignore מקיפה

### מבנה סוכנים
```
agents/
├── ORCHESTRATOR.md      # הוראות לארכיטקט
├── IMPLEMENTER.md       # הוראות למפתח
├── TESTER.md            # הוראות לבודק
├── REVIEWER.md          # הוראות לסוקר
├── DOCS.md              # הוראות למתעד
│
├── tasks/               # משימות לכל סוכן
├── status/              # סטטוסים של כל סוכן
└── shared/              # מידע משותף
    ├── decisions.md     # החלטות ארכיטקטוניות
    ├── conventions.md   # קונבנציות קוד
    └── blockers.md      # חסימות
```

---

## 🆕 מה חדש ב-V2?

### שיפורים ב-CLAUDE.md:

1. **Project Goals & Success Criteria**
   - מטרות ברורות
   - קריטריונים למדידה
   - הגדרת Scope

2. **Tech Stack מורחב**
   - קטגוריות נוספות (Build Tool, CI/CD, Deployment)
   - עמודת "סיבה" להחלטות

3. **Architecture Overview**
   - סעיף לתיאור ארכיטקטורה
   - רשימת רכיבים
   - תרשים Data Flow

4. **Setup & Run Instructions**
   - Prerequisites
   - Installation
   - Development, Testing, Build

5. **.gitignore מקיף**
   - תמיכה בשפות רבות
   - הגנה על Secrets
   - תצורות IDE

---

## 🎯 איך להשתמש בתבנית?

### אופציה 1: העתקה ידנית
```bash
# העתק את התבנית לפרויקט חדש
cp -r multi-agent-template-v2 ~/projects/my-new-project
cd ~/projects/my-new-project

# שנה שם .gitignore
mv .gitignore.template .gitignore

# אתחל git
git init
git add .
git commit -m "Initial commit from multi-agent template v2"

# ערוך CLAUDE.md
# - עדכן שם פרויקט
# - הוסף תיאור
# - הגדר מטרות
```

### אופציה 2: שימוש בסקיל `/multi-agent-setup`
```
1. פתח Claude Code
2. הקלד: /multi-agent-setup
3. ענה על השאלות
4. הסקיל יצור הכל אוטומטית! 🎉
```

---

## 📖 מדריך התחלה מהירה

### שלב 1: הכנת הפרויקט
1. העתק תבנית זו לפרויקט חדש
2. עדכן `CLAUDE.md` עם פרטי הפרויקט
3. שנה שם `.gitignore.template` ל-`.gitignore`

### שלב 2: פתיחת 5 טאבים
פתח 5 טאבים/חלונות של Claude Code באותו פרויקט:

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

### שלב 3: התחל לעבוד!
חזור ל-Tab 1 (Orchestrator) ותאר את הפרויקט:
```
אני רוצה לבנות [תיאור הפרויקט].
המטרה היא [מטרה].
```

---

## 🔄 השוואה בין V1 ל-V2

| תכונה | V1 | V2 |
|-------|----|----|
| **CLAUDE.md בסיסי** | ✅ | ✅ |
| **5 סוכנים** | ✅ | ✅ |
| **GUIDE.md** | ✅ | ✅ |
| **Project Goals** | ❌ | ✅ |
| **Tech Stack מורחב** | ❌ | ✅ |
| **Architecture Overview** | ❌ | ✅ |
| **Setup Instructions** | ❌ | ✅ |
| **.gitignore מקיף** | ❌ | ✅ |
| **תמיכה בסקיל** | ❌ | ✅ |

---

## 🛠️ התאמה אישית

### הוספת סוכן נוסף
1. צור `agents/NEW_AGENT.md`
2. צור `agents/tasks/new_agent.md`
3. צור `agents/status/new_agent.md`
4. עדכן את הטבלה ב-`CLAUDE.md`

### שינוי שפת ברירת מחדל
ערוך את `agents/shared/conventions.md` עם הקונבנציות של השפה שלך.

---

## 📚 משאבים נוספים

- **GUIDE.md** - מדריך מקיף
- **agents/ORCHESTRATOR.md** - הבנת תפקיד הארכיטקט
- **agents/shared/conventions.md** - קונבנציות קוד

---

## 🐛 בעיות נפוצות

### סוכן שוכח מי הוא?
```
תקרא שוב את agents/[AGENT].md ותעבוד לפי ההוראות שם
```

### סוכן לא רואה משימות?
```
תקרא את agents/tasks/[agent].md
```

### שיחה ארוכה מדי?
1. סגור את הטאב
2. פתח מחדש
3. הדבק את הפרומפט ההתחלתי
4. "יש לך משימות בקובץ, תמשיך מאיפה שהפסקת"

---

## 📝 רישיון

תבנית זו חופשית לשימוש בכל פרויקט.

---

**Version:** 2.0
**תאריך עדכון:** 2026-01-27
**יצר:** Roei Edri + Claude Sonnet 4.5
