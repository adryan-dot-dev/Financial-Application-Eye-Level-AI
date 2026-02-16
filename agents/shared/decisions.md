# Architectural Decisions

> קובץ זה מתעד החלטות ארכיטקטוניות. מעודכן ע"י **Orchestrator**.
> כל הסוכנים צריכים לקרוא קובץ זה לפני שמתחילים לעבוד.

---

## 2026-02-09 - Phase 5: UI Polish, Accessibility & QA Sprint

**החלטה:** לפני להתקדם לפיצ'רים חדשים (Export/Import), נבצע sprint של תיקוני UI, נגישות, ביצועים ו-QA מקיף.

**סיבה:**
- אותיות חופפות בקטגוריות ודפים נוספים
- חוסר עקביות ב-RTL (שימוש ב-left/right במקום logical properties)
- חוסרים בנגישות (ARIA labels, focus indicators, form associations)
- ביצועים - inline handlers במקום CSS, חוסר React.memo
- צריך QA מקצה לקצה לפני שממשיכים

**חלופות שנשקלו:**
- להמשיך ל-Export/Import ולתקן אח"כ - נדחה כי UX שבור מונע בדיקה אפקטיבית
- תיקונים נקודתיים בלבד - נדחה כי הבעיות מערכתיות

---

## 2026-02-09 - CSS Logical Properties over RTL Ternaries

**החלטה:** להחליף את כל ה-`isRtl ? 'left-X' : 'right-X'` ב-Tailwind logical properties (`start-X`, `end-X`, `ms-X`, `me-X`)

**סיבה:**
- קוד נקי יותר - אין צורך בתנאים
- עובד אוטומטית עם `dir="rtl"` ו-`dir="ltr"`
- סטנדרט CSS מודרני
- פחות באגים כשמוסיפים אלמנטים חדשים

**חלופות שנשקלו:**
- להשאיר את הגישה הנוכחית עם ternaries - עובד אבל verbose ונוטה לשגיאות

---

## 2026-02-09 - Replace Inline Hover Handlers with CSS

**החלטה:** להחליף את כל ה-`onMouseEnter/onMouseLeave` inline handlers ב-CSS `hover:` classes

**סיבה:**
- ביצועים - inline handlers יוצרים function instances בכל render
- קוד נקי יותר
- עקביות - כל ה-hover effects דרך CSS
- נגישות טובה יותר - CSS hover עובד גם עם keyboard focus

**חלופות שנשקלו:**
- useCallback לכל handler - עדיין verbose יותר מ-CSS

---

## 2026-02-09 - Recurring Charge Automation Service

**החלטה:** ליצור שירות אוטומציה שמייצר transactions אוטומטית מ-loans, fixed entries, ו-installments ביום התשלום החודשי.

**סיבה:**
- המערכת מנהלת הכנסות/הוצאות קבועות אבל לא מייצרת transactions אוטומטית
- המשתמש צריך לראות כל תשלום כ-transaction בפועל
- מאפשר מעקב מדויק אחרי תזרים מזומנים

**עיצוב:**
- `automation_service.py` - פונקציה async שמעבדת את כל הפריטים החוזרים
- Idempotent - בודק אם כבר קיים transaction לאותו מקור + תאריך
- API: `POST /automation/process-recurring` + preview endpoint
- כרגע trigger ידני (API call), בעתיד אפשר להוסיף scheduler

**חלופות שנשקלו:**
- Background task/scheduler (APScheduler/Celery) - יותר מדי מורכב בשלב זה
- Trigger ב-login - לא אמין, משתמש לא תמיד מתחבר ב-15 לחודש

---

## 2026-02-09 - Category Ownership Validation (IDOR Fix)

**החלטה:** להוסיף בדיקת בעלות על קטגוריות בכל endpoint שמקבל category_id.

**סיבה:**
- IDOR vulnerability: משתמש יכול להצמיד category_id של משתמש אחר ל-transaction שלו
- DB FK constraint בודק רק שהקטגוריה קיימת, לא שהיא שייכת לאותו משתמש

**עיצוב:**
- בדיקה בכל create/update endpoint שמקבל category_id
- `if data.category_id: verify cat.user_id == current_user.id`
- Error 422: "Category not found or does not belong to you"

---

## 2026-02-09 - Modal Backdrop Standardization

**החלטה:** כל modals ישתמשו ב-`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` במקום `absolute inset-0 bg-black/40`.

**סיבה:**
- `fixed` מכסה את כל ה-viewport גם כשיש scroll
- `bg-black/50` נותן ניגודיות טובה יותר ב-dark mode
- `backdrop-blur-sm` נותן תחושת עומק מקצועית
- עקביות - UsersPage כבר השתמש בדפוס הזה

---

## 2026-02-09 - React ErrorBoundary + Custom Error Page

**החלטה:** להוסיף ErrorBoundary שעוטף את כל האפליקציה, ודף שגיאה מותאם עם לוגו החברה.

**סיבה:**
- כרגע שגיאה ב-React מראה מסך לבן ריק
- המפתח (Claude Code) צריך לראות stack trace מלא לדיבוג
- המשתמש צריך לראות הודעה ידידותית עם אפשרות retry
- דף 404 חסר לנתיבים לא קיימים

**עיצוב:**
- ErrorBoundary: class component (חובה ל-Error Boundaries)
- ErrorPage: מציג לוגו, קוד שגיאה, הודעה ידידותית
- DEV mode: מציג stack trace מלא בבלוק code מתקפל
- 404 route: catch-all route ב-React Router
