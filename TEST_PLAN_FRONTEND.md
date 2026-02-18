# תכנית בדיקות Frontend — CashFlow Management System

> תאריך: 18 בפברואר 2026
> גרסה: 1.0
> סטאק: React 19 + TypeScript + Vite + Tailwind v4 + React Query + i18next + Recharts
> כלי בדיקות: Vitest + React Testing Library

---

## תוכן עניינים

1. [LoginPage — עמוד התחברות](#1-loginpage)
2. [RegisterPage — עמוד הרשמה](#2-registerpage)
3. [OnboardingPage — אשף הגדרה ראשונית](#3-onboardingpage)
4. [DashboardPage — דשבורד ראשי](#4-dashboardpage)
5. [TransactionsPage — תנועות כספיות](#5-transactionspage)
6. [FixedPage — הכנסות/הוצאות קבועות](#6-fixedpage)
7. [InstallmentsPage — תשלומים](#7-installmentspage)
8. [LoansPage — הלוואות](#8-loanspage)
9. [SubscriptionsPage — מנויים](#9-subscriptionspage)
10. [CategoriesPage — קטגוריות](#10-categoriespage)
11. [ForecastPage — תחזית תזרים](#11-forecastpage)
12. [BalancePage — מאזן בנק](#12-balancepage)
13. [AlertsPage — התראות](#13-alertspage)
14. [SettingsPage — הגדרות](#14-settingspage)
15. [UsersPage — ניהול משתמשים](#15-userspage)
16. [BackupsPage — גיבויים](#16-backupspage)
17. [OrganizationPage — ארגונים](#17-organizationpage)
18. [ErrorPage — עמוד שגיאה](#18-errorpage)
19. [בדיקות רוחביות (Cross-Cutting)](#19-cross-cutting)
20. [סיכום כמותי](#20-summary)

---

## 1. LoginPage

**נתיב:** `/login`
**API:** `authApi.login()` via `useAuth().login()`
**State:** username, password, showPassword, error, isSubmitting
**קומפוננטות:** Form, Theme toggle, Language toggle, Link to Register

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 1.1 | רינדור | העמוד עולה ללא קריסה ומציג את כותרת ההתחברות |
| 1.2 | רינדור | לוגו החברה מוצג (logo.webp) |
| 1.3 | רינדור | שדות username ו-password מוצגים |
| 1.4 | רינדור | כפתור "התחבר" מוצג עם טקסט מתורגם |
| 1.5 | רינדור | לינק להרשמה מוצג ומפנה ל-/register |
| 1.6 | אינטגרציית API | שליחת טופס מצליחה קוראת ל-login עם username+password |
| 1.7 | אינטגרציית API | לאחר התחברות מוצלחת — ניווט ל-/dashboard |
| 1.8 | אינטגרציית API | שגיאת API מציגה הודעת שגיאה (getApiErrorMessage) |
| 1.9 | אינטגרציית API | מצב טעינה — כפתור מציג Loader2 ומושבת |
| 1.10 | ולידציית טופס | שליחה עם שדות ריקים לא אפשרית (HTML required) |
| 1.11 | ולידציית טופס | הקלדה בשדה מנקה הודעת שגיאה קודמת |
| 1.12 | i18n | ברירת מחדל עברית — כל הטקסטים בעברית |
| 1.13 | i18n | לחיצה על כפתור שפה מחליפה לאנגלית |
| 1.14 | i18n | החלפת שפה משנה את dir של ה-document |
| 1.15 | Dark/Light | כפתור theme מסתובב: light → dark → system |
| 1.16 | Dark/Light | שינוי theme משפיע על צבעי הרקע והטקסט |
| 1.17 | RTL | בעברית — התצוגה מימין לשמאל |
| 1.18 | RTL | פאנל Brand בצד ימין (order-2) ב-RTL |
| 1.19 | Responsive | במובייל — פאנל Brand מוסתר (hidden lg:flex) |
| 1.20 | Responsive | הטופס תופס רוחב מלא במסך צר |
| 1.21 | נגישות | שדה סיסמה — כפתור Eye/EyeOff מחליף visible/hidden |
| 1.22 | ניווט | לחיצה על "הרשם" מנווטת ל-/register |

**סה"כ: 22 בדיקות**

---

## 2. RegisterPage

**נתיב:** `/register`
**API:** `authApi.register()` via `useAuth().register()`
**State:** username, email, password, confirmPassword, showPassword, showConfirmPassword, error, fieldErrors, isSubmitting
**קומפוננטות:** Form, Password strength indicator, Theme/Language toggles

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 2.1 | רינדור | העמוד עולה ללא קריסה ומציג כותרת הרשמה |
| 2.2 | רינדור | כל 4 שדות מוצגים: username, email, password, confirmPassword |
| 2.3 | רינדור | מד חוזק סיסמה מוצג כשיש תווים בשדה סיסמה |
| 2.4 | רינדור | לינק ל-/login מוצג |
| 2.5 | אינטגרציית API | שליחה מוצלחת קוראת ל-register ומנווטת ל-/onboarding |
| 2.6 | אינטגרציית API | שגיאת API (כמו username תפוס) מציגה הודעה |
| 2.7 | אינטגרציית API | מצב טעינה — כפתור מושבת עם Loader2 |
| 2.8 | ולידציית טופס | username קצר מ-4 תווים — שגיאה |
| 2.9 | ולידציית טופס | email לא תקין — שגיאת פורמט |
| 2.10 | ולידציית טופס | סיסמה קצרה מ-8 תווים — שגיאה |
| 2.11 | ולידציית טופס | סיסמה ללא אות גדולה — שגיאה |
| 2.12 | ולידציית טופס | סיסמה ללא אות קטנה — שגיאה |
| 2.13 | ולידציית טופס | סיסמה ללא ספרה — שגיאה |
| 2.14 | ולידציית טופס | סיסמאות לא תואמות — שגיאה + אייקון XCircle |
| 2.15 | ולידציית טופס | סיסמאות תואמות — אייקון CheckCircle2 מוצג |
| 2.16 | ולידציית טופס | חוזק סיסמה: weak / fair / good / excellent — צבע ותווית נכונים |
| 2.17 | i18n | עברית ברירת מחדל — כל שגיאות הוולידציה בעברית |
| 2.18 | i18n | החלפה לאנגלית — שגיאות מוצגות באנגלית |
| 2.19 | Dark/Light | כפתור theme עובד (light/dark/system) |
| 2.20 | RTL | בעברית כיוון מימין לשמאל |
| 2.21 | Responsive | במובייל — תצוגה חד-עמודית |
| 2.22 | נגישות | Eye/EyeOff בשני שדות סיסמה |
| 2.23 | ניווט | לינק "כבר יש חשבון" מנווט ל-/login |

**סה"כ: 23 בדיקות**

---

## 3. OnboardingPage

**נתיב:** `/onboarding` (protected)
**API:** `settingsApi`, `balanceApi`, `categoriesApi`, `fixedApi`, `authApi.updateMe()`
**State:** OnboardingState (7 שלבים), categories, isSaving, direction, confetti
**קומפוננטות:** אשף 7 שלבים, DatePicker, Category toggles, Fixed items

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 3.1 | רינדור | העמוד עולה ללא קריסה ומציג את שלב 1 |
| 3.2 | רינדור | סרגל התקדמות מציג 7 שלבים |
| 3.3 | רינדור | כפתורי "הבא" ו-"הקודם" מוצגים |
| 3.4 | אינטגרציית API | שמירת פרופיל (שם, טלפון) קוראת ל-authApi.updateMe |
| 3.5 | אינטגרציית API | הגדרת מטבע קוראת ל-settingsApi.update |
| 3.6 | אינטגרציית API | שמירת יתרה קוראת ל-balanceApi.create |
| 3.7 | אינטגרציית API | ארכוב קטגוריות שולח לקטגוריות API |
| 3.8 | אינטגרציית API | יצירת פריטים קבועים קוראת ל-fixedApi.create |
| 3.9 | אינטגרציית API | סיום אשף מסמן onboarding_completed בהגדרות |
| 3.10 | ולידציית טופס | שלב יתרה — סכום ריק מציג שגיאה (balanceError) |
| 3.11 | ולידציית טופס | שלב מטבע — חובה לבחור מטבע לפני המשך |
| 3.12 | מצב ריק | רשימת קטגוריות ריקה — מציג הודעה |
| 3.13 | i18n | כל שלב מוצג בעברית |
| 3.14 | RTL | כפתורי ניווט — הבא בצד שמאל (RTL), הקודם בימין |
| 3.15 | Dark/Light | ערכת צבעים משתנה עם theme |
| 3.16 | Responsive | במובייל — שלבים מוצגים במלא רוחב |
| 3.17 | localStorage | מצב נשמר ב-localStorage (STORAGE_KEY) |
| 3.18 | localStorage | רענון עמוד — חוזר לשלב האחרון ששמר |
| 3.19 | localStorage | סיום אשף — מנקה state מ-localStorage |
| 3.20 | ניווט | סיום — ניווט ל-/dashboard |
| 3.21 | ניווט | ניסיון גישה ללא auth — הפניה ל-/login |
| 3.22 | אנימציה | מעבר בין שלבים — אנימציית slide (direction next/prev) |
| 3.23 | אנימציה | שלב אחרון — אנימציית confetti |
| 3.24 | Fixed items | הפעלה/כיבוי של toggle משנה enabled |
| 3.25 | Fixed items | הקלדת סכום ויום בחודש נשמרים |

**סה"כ: 25 בדיקות**

---

## 4. DashboardPage

**נתיב:** `/dashboard` (protected, AppLayout)
**API:** `dashboardApi.summary()`, `dashboardApi.period()`, `dashboardApi.categoryBreakdown()`, `dashboardApi.upcomingPayments()`, `dashboardApi.subscriptionsSummary()`, `forecastApi.monthly()`, `alertsApi.list()`
**State:** PeriodSelector, alertExpanded
**קומפוננטות:** KpiCards, AreaChart, PieChart, AlertPanel, QuickActions, MonthlyComparisonChart, FinancialHealthWidget, InstallmentsSummaryWidget, LoansSummaryWidget, TopExpensesWidget

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 4.1 | רינדור | העמוד עולה ללא קריסה |
| 4.2 | רינדור | 4 כרטיסי KPI מוצגים (יתרה, הכנסות, הוצאות, תזרים נקי) |
| 4.3 | רינדור | גרף Forecast (AreaChart) מוצג |
| 4.4 | רינדור | פאנל התראות מוצג |
| 4.5 | רינדור | Quick Actions מוצגים (הוספת תנועה, צפי, וכו') |
| 4.6 | רינדור | PeriodSelector מוצג |
| 4.7 | רינדור | ווידג'טים: Monthly Comparison, Financial Health, Installments, Loans, Top Expenses |
| 4.8 | אינטגרציית API | קריאה ל-dashboardApi.summary בטעינה |
| 4.9 | אינטגרציית API | קריאה ל-forecastApi.monthly |
| 4.10 | אינטגרציית API | קריאה ל-alertsApi.list |
| 4.11 | אינטגרציית API | קריאה ל-dashboardApi.categoryBreakdown |
| 4.12 | אינטגרציית API | קריאה ל-dashboardApi.upcomingPayments |
| 4.13 | אינטגרציית API | קריאה ל-dashboardApi.subscriptionsSummary |
| 4.14 | אינטגרציית API | שינוי תקופה (PeriodSelector) מרענן נתונים |
| 4.15 | אינטגרציית API | מצב טעינה — skeleton placeholders |
| 4.16 | אינטגרציית API | שגיאת API — הודעת שגיאה מוצגת |
| 4.17 | מצב ריק | אין התראות — פאנל התראות מציג הודעת "אין התראות" |
| 4.18 | מצב ריק | אין נתוני forecast — גרף מציג מצב ריק |
| 4.19 | i18n | כל הכותרות בעברית — KPI, תוויות גרף |
| 4.20 | i18n | החלפה לאנגלית — כל הטקסטים באנגלית |
| 4.21 | Dark/Light | כרטיסי KPI עם gradient ב-dark mode |
| 4.22 | RTL | כרטיסי KPI מסודרים RTL |
| 4.23 | RTL | גרפים — ציר X מימין לשמאל |
| 4.24 | Responsive | במובייל — כרטיסי KPI בעמודה אחת |
| 4.25 | Responsive | בטאבלט — 2 כרטיסים בשורה |
| 4.26 | KPI | מספרים מוצגים עם אנימציית CountUp |
| 4.27 | KPI | טרנדים — חץ ירוק/אדום + אחוז |
| 4.28 | ניווט | Quick Actions — לינקים לעמודים הנכונים |
| 4.29 | התראות | קליק על התראה — סימון כנקראה |
| 4.30 | Auth guard | גישה ללא token — הפניה ל-/login |

**סה"כ: 30 בדיקות**

---

## 5. TransactionsPage

**נתיב:** `/transactions` (protected, AppLayout)
**API:** `transactionsApi.list()`, `.create()`, `.update()`, `.delete()`, `categoriesApi.list()`
**State:** filters (search, type, category_id, dates, amounts), sortField, sortOrder, page, modalOpen, editingTransaction, formData, formErrors, deleteTarget
**קומפוננטות:** Table, Filters, Search, PeriodSelector, Modal (Create/Edit), DeleteConfirm, Pagination, CurrencySelector, DatePicker, CategoryBadge

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 5.1 | רינדור | העמוד עולה ללא קריסה ומציג כותרת "תנועות" |
| 5.2 | רינדור | טבלת תנועות מוצגת עם עמודות: תאריך, תיאור, קטגוריה, סכום, פעולות |
| 5.3 | רינדור | כפתור "הוסף תנועה" (+) מוצג |
| 5.4 | רינדור | שורת חיפוש ופילטרים מוצגת |
| 5.5 | אינטגרציית API | בטעינה — קריאה ל-transactionsApi.list |
| 5.6 | אינטגרציית API | קריאה ל-categoriesApi.list לפילטר ולטופס |
| 5.7 | אינטגרציית API | מצב טעינה — TableSkeleton מוצג |
| 5.8 | אינטגרציית API | שגיאה — הודעת שגיאה |
| 5.9 | CRUD — Create | לחיצה על "+" פותחת מודל יצירה |
| 5.10 | CRUD — Create | מילוי טופס ושמירה — קריאה ל-transactionsApi.create |
| 5.11 | CRUD — Create | לאחר יצירה — רשימה מתרעננת (invalidateQueries) |
| 5.12 | CRUD — Create | הודעת toast "נוצר בהצלחה" |
| 5.13 | CRUD — Read | תנועות מוצגות עם סכום מפורמט (formatCurrency) |
| 5.14 | CRUD — Read | קטגוריה מוצגת כ-CategoryBadge עם צבע ואייקון |
| 5.15 | CRUD — Update | לחיצה על עט (Pencil) פותחת מודל עריכה עם נתונים קיימים |
| 5.16 | CRUD — Update | שמירת שינויים — קריאה ל-transactionsApi.update |
| 5.17 | CRUD — Update | הודעת toast "עודכן בהצלחה" |
| 5.18 | CRUD — Delete | לחיצה על פח (Trash2) מציגה חלון אישור |
| 5.19 | CRUD — Delete | אישור מחיקה — קריאה ל-transactionsApi.delete |
| 5.20 | CRUD — Delete | ביטול מחיקה — סוגר חלון אישור |
| 5.21 | CRUD — Copy | כפתור Copy יוצר תנועה חדשה מנתונים קיימים |
| 5.22 | ולידציית טופס | סכום ריק — שגיאת שדה חובה |
| 5.23 | ולידציית טופס | סכום שלילי — שגיאה |
| 5.24 | ולידציית טופס | תאריך ריק — שגיאה |
| 5.25 | ולידציית טופס | סכום לא מספרי — שגיאה |
| 5.26 | Pagination | מוצגים 15 פריטים בעמוד (PAGE_SIZE) |
| 5.27 | Pagination | כפתורי עמוד הבא/הקודם (ChevronLeft/Right) |
| 5.28 | Pagination | עמוד 1 — כפתור "הקודם" מושבת |
| 5.29 | Pagination | עמוד אחרון — כפתור "הבא" מושבת |
| 5.30 | Pagination | שינוי עמוד מעדכן את params.page |
| 5.31 | Filtering | חיפוש טקסט — מסנן לפי search |
| 5.32 | Filtering | פילטר סוג (הכנסה/הוצאה) |
| 5.33 | Filtering | פילטר קטגוריה (category_id) |
| 5.34 | Filtering | פילטר תאריכים (start_date, end_date) |
| 5.35 | Filtering | פילטר סכום (min_amount, max_amount) |
| 5.36 | Filtering | PeriodSelector משנה טווח תאריכים |
| 5.37 | Filtering | איפוס פילטרים מחזיר ל-EMPTY_FILTERS |
| 5.38 | Sorting | לחיצה על כותרת עמודה date — מיון לפי תאריך |
| 5.39 | Sorting | לחיצה על כותרת amount — מיון לפי סכום |
| 5.40 | Sorting | לחיצה חוזרת — מחליף asc/desc |
| 5.41 | i18n | כותרות טבלה בעברית |
| 5.42 | i18n | פורמט תאריך DD/MM/YYYY בעברית |
| 5.43 | Dark/Light | טבלה עם צבעי רקע נכונים |
| 5.44 | RTL | טבלה מיושרת מימין לשמאל |
| 5.45 | RTL | מספרים נשארים LTR בתוך הקשר RTL |
| 5.46 | מצב ריק | אין תנועות — הודעת "אין תנועות" |
| 5.47 | מצב ריק | חיפוש ללא תוצאות — "לא נמצאו תוצאות" |
| 5.48 | Modal | ESC סוגר מודל |
| 5.49 | Modal | לחיצה מחוץ למודל סוגרת אותו |
| 5.50 | Modal | כפתור X סוגר מודל |
| 5.51 | Responsive | במובייל — טבלה עם scroll אופקי או layout כרטיסים |
| 5.52 | Auth guard | ניתוק — הפניה ל-/login |
| 5.53 | מטבע | CurrencySelector — שינוי מטבע בטופס |

**סה"כ: 53 בדיקות**

---

## 6. FixedPage

**נתיב:** `/fixed` (protected, AppLayout)
**API:** `fixedApi.list()`, `.create()`, `.update()`, `.delete()`, `.toggleActive()`, `categoriesApi.list()`
**State:** filterType, modalOpen, editingEntry, formData, formErrors, deleteTarget
**קומפוננטות:** Cards grid, Filter (income/expense), Modal, DeleteConfirm, CategoryBadge, CurrencySelector, DatePicker

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 6.1 | רינדור | העמוד עולה ללא קריסה ומציג כותרת "הכנסות והוצאות קבועות" |
| 6.2 | רינדור | כרטיסי פריטים מוצגים ב-grid (1/2/3 עמודות) |
| 6.3 | רינדור | כפתור "הוסף" (+) מוצג |
| 6.4 | רינדור | כל כרטיס מציג: שם, סכום, יום בחודש, סטטוס |
| 6.5 | אינטגרציית API | טעינה — קריאה ל-fixedApi.list |
| 6.6 | אינטגרציית API | קריאה ל-categoriesApi.list |
| 6.7 | אינטגרציית API | CardSkeleton מוצג בטעינה |
| 6.8 | אינטגרציית API | שגיאה — הודעה מוצגת |
| 6.9 | CRUD — Create | לחיצה על "+" פותחת מודל |
| 6.10 | CRUD — Create | שדות: שם, סכום, סוג, יום בחודש, תאריך התחלה, תאריך סיום, תיאור, קטגוריה, מטבע |
| 6.11 | CRUD — Create | שמירה — fixedApi.create + refresh |
| 6.12 | CRUD — Create | toast "נוצר בהצלחה" |
| 6.13 | CRUD — Update | לחיצה על Pencil — מודל עם נתונים |
| 6.14 | CRUD — Update | שמירה — fixedApi.update |
| 6.15 | CRUD — Delete | לחיצה על Trash2 — חלון אישור |
| 6.16 | CRUD — Delete | אישור — fixedApi.delete |
| 6.17 | Toggle Active | כפתור Pause/Play — הפעלה/השהיה של פריט |
| 6.18 | Toggle Active | פריט מושהה מוצג עם opacity מופחת |
| 6.19 | ולידציית טופס | שם ריק — שגיאה |
| 6.20 | ולידציית טופס | סכום ריק/לא חוקי — שגיאה |
| 6.21 | ולידציית טופס | יום בחודש מחוץ לטווח 1-31 — שגיאה |
| 6.22 | Filtering | פילטר סוג: הכל / הכנסה / הוצאה |
| 6.23 | i18n | כותרות ותוויות בעברית |
| 6.24 | Dark/Light | כרטיסים עם צבעי card |
| 6.25 | RTL | כרטיסים מסודרים RTL |
| 6.26 | מצב ריק | אין פריטים — הודעת "אין פריטים קבועים" |
| 6.27 | Modal | ESC/X/outside click — סוגר |
| 6.28 | Responsive | מובייל — עמודה אחת, דסקטופ — 3 עמודות |
| 6.29 | Auth guard | ללא auth — הפניה |
| 6.30 | מטבע | CurrencySelector בטופס |

**סה"כ: 30 בדיקות**

---

## 7. InstallmentsPage

**נתיב:** `/installments` (protected, AppLayout)
**API:** `installmentsApi.list()`, `.create()`, `.update()`, `.delete()`, `.recordPayment()`, `.paymentSchedule()`, `categoriesApi.list()`
**State:** typeFilter, modalOpen, editingInstallment, formData, formErrors, deleteTarget, paymentScheduleOpen
**קומפוננטות:** Cards grid, StatusBadge, ProgressBar, PaymentSchedule modal, CategoryBadge, CurrencySelector, DatePicker

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 7.1 | רינדור | העמוד עולה ללא קריסה |
| 7.2 | רינדור | כרטיסים ב-grid עם progress bar |
| 7.3 | רינדור | StatusBadge: completed/active/pending/overdue — צבעים נכונים |
| 7.4 | רינדור | כפתור "הוסף" מוצג |
| 7.5 | אינטגרציית API | טעינה — installmentsApi.list |
| 7.6 | אינטגרציית API | categoriesApi.list |
| 7.7 | אינטגרציית API | CardSkeleton בטעינה |
| 7.8 | CRUD — Create | מודל יצירה: שם, סכום כולל, מספר תשלומים, סוג, תאריך, יום, תיאור, קטגוריה, מטבע |
| 7.9 | CRUD — Create | checkbox "תשלום ראשון בוצע" (first_payment_made) |
| 7.10 | CRUD — Create | שמירה — installmentsApi.create |
| 7.11 | CRUD — Update | Pencil — מודל עם נתונים |
| 7.12 | CRUD — Update | שמירה — installmentsApi.update |
| 7.13 | CRUD — Delete | Trash2 → אישור → installmentsApi.delete |
| 7.14 | Record Payment | כפתור תשלום — installmentsApi.recordPayment |
| 7.15 | Record Payment | progress bar מתעדכן |
| 7.16 | Payment Schedule | כפתור לוח תשלומים — פותח מודל עם רשימת תשלומים |
| 7.17 | Payment Schedule | סטטוס: completed / upcoming / future |
| 7.18 | ולידציית טופס | שם ריק — שגיאה |
| 7.19 | ולידציית טופס | סכום כולל ריק — שגיאה |
| 7.20 | ולידציית טופס | מספר תשלומים ריק/0 — שגיאה |
| 7.21 | Filtering | all / income / expense |
| 7.22 | ProgressBar | 0% — כחול, 50%+ — amber, 100% — ירוק |
| 7.23 | ProgressBar | תשלום ב-7 ימים הקרובים — isWithin7Days highlight |
| 7.24 | i18n | כותרות, סטטוסים, לייבלים בעברית |
| 7.25 | Dark/Light | כרטיסים ב-dark/light |
| 7.26 | RTL | כרטיסים RTL |
| 7.27 | מצב ריק | אין פריסות — הודעת "אין תשלומים" |
| 7.28 | Modal | ESC/X/outside — סוגר |
| 7.29 | Responsive | מובייל 1 עמודה, דסקטופ 3 עמודות |
| 7.30 | Auth guard | ללא auth — הפניה |

**סה"כ: 30 בדיקות**

---

## 8. LoansPage

**נתיב:** `/loans` (protected, AppLayout)
**API:** `loansApi.list()`, `.create()`, `.update()`, `.delete()`, `.recordPayment()`, `.breakdown()`, `categoriesApi.list()`
**State:** modalOpen, editingLoan, formData, formErrors, deleteTarget, breakdownTarget
**קומפוננטות:** Cards grid, ProgressBar, LoanBreakdown modal, CategoryBadge, CurrencySelector, DatePicker

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 8.1 | רינדור | העמוד עולה ללא קריסה |
| 8.2 | רינדור | כרטיסי הלוואות ב-grid עם progress bar |
| 8.3 | רינדור | פרטים: סכום מקורי, תשלום חודשי, ריבית, יתרה |
| 8.4 | רינדור | כפתור "הוסף הלוואה" |
| 8.5 | אינטגרציית API | טעינה — loansApi.list |
| 8.6 | אינטגרציית API | categoriesApi.list |
| 8.7 | אינטגרציית API | CardSkeleton בטעינה |
| 8.8 | CRUD — Create | שדות: שם, סכום, תשלום חודשי, ריבית, סה"כ תשלומים, תאריך, יום, תיאור, קטגוריה, מטבע |
| 8.9 | CRUD — Create | checkbox "תשלום ראשון בוצע" |
| 8.10 | CRUD — Create | loansApi.create |
| 8.11 | CRUD — Update | Pencil → מודל → loansApi.update |
| 8.12 | CRUD — Delete | Trash2 → אישור → loansApi.delete |
| 8.13 | Record Payment | כפתור תשלום → loansApi.recordPayment |
| 8.14 | Breakdown | כפתור "לוח סילוקין" (TableProperties) → loansApi.breakdown |
| 8.15 | Breakdown | מודל עם טבלת: מספר תשלום, תאריך, תשלום, קרן, ריבית, יתרה |
| 8.16 | Breakdown | סטטוסים: paid / upcoming / future — צבעים שונים |
| 8.17 | ולידציית טופס | שם ריק — שגיאה |
| 8.18 | ולידציית טופס | סכום מקורי ריק — שגיאה |
| 8.19 | ולידציית טופס | תשלום חודשי ריק — שגיאה |
| 8.20 | ולידציית טופס | ריבית שלילית — שגיאה |
| 8.21 | ולידציית טופס | סה"כ תשלומים 0 — שגיאה |
| 8.22 | ProgressBar | מילוי אחוזי לפי payments_made / total_payments |
| 8.23 | i18n | כותרות, תוויות, מונחים בעברית |
| 8.24 | Dark/Light | כרטיסים מותאמים |
| 8.25 | RTL | תצוגה RTL |
| 8.26 | מצב ריק | אין הלוואות — הודעה |
| 8.27 | Modal | ESC/X/outside — סוגר |
| 8.28 | Responsive | מובייל 1, טאבלט 2, דסקטופ 3 |
| 8.29 | Auth guard | ללא auth — הפניה |
| 8.30 | מטבע | CurrencySelector |

**סה"כ: 30 בדיקות**

---

## 9. SubscriptionsPage

**נתיב:** `/subscriptions` (protected, AppLayout)
**API:** `subscriptionsApi.list()`, `.create()`, `.update()`, `.delete()`, `.pause()`, `.resume()`, `categoriesApi.list()`
**State:** statusFilter, cycleFilter, modalOpen, editingSubscription, formData, formErrors, deleteTarget
**קומפוננטות:** Cards grid, Modal, CategoryBadge, CurrencySelector, DatePicker

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 9.1 | רינדור | העמוד עולה ללא קריסה |
| 9.2 | רינדור | כרטיסי מנויים ב-grid |
| 9.3 | רינדור | פרטים: שם, סכום, מחזור חיוב, תאריך חידוש, ספק |
| 9.4 | רינדור | כפתור "הוסף מנוי" |
| 9.5 | אינטגרציית API | subscriptionsApi.list בטעינה |
| 9.6 | אינטגרציית API | categoriesApi.list |
| 9.7 | אינטגרציית API | CardSkeleton בטעינה |
| 9.8 | CRUD — Create | שדות: שם, סכום, מטבע, קטגוריה, מחזור חיוב, תאריך חידוש, חידוש אוטומטי, ספק, URL, הערות |
| 9.9 | CRUD — Create | subscriptionsApi.create |
| 9.10 | CRUD — Update | Pencil → מודל → subscriptionsApi.update |
| 9.11 | CRUD — Delete | Trash2 → אישור → subscriptionsApi.delete |
| 9.12 | Pause/Resume | Pause → subscriptionsApi.pause — מנוי מוצג כמושהה |
| 9.13 | Pause/Resume | Play → subscriptionsApi.resume — מנוי חוזר לפעיל |
| 9.14 | ולידציית טופס | שם ריק — שגיאה |
| 9.15 | ולידציית טופס | סכום ריק/לא חוקי — שגיאה |
| 9.16 | ולידציית טופס | תאריך חידוש ריק — שגיאה |
| 9.17 | Filtering | סטטוס: all / active / paused |
| 9.18 | Filtering | מחזור חיוב: monthly / quarterly / semi_annual / annual |
| 9.19 | Monthly amount | סכום מנוי שנתי מומר לחודשי (toMonthlyAmount) |
| 9.20 | Upcoming | מנוי שמתחדש ב-7 ימים — isWithinDays highlight |
| 9.21 | Provider link | ExternalLink — פתיחת URL ספק |
| 9.22 | i18n | כותרות, מחזורי חיוב בעברית |
| 9.23 | Dark/Light | כרטיסים מותאמים |
| 9.24 | RTL | תצוגה RTL |
| 9.25 | מצב ריק | אין מנויים — הודעה |
| 9.26 | Modal | ESC/X/outside — סוגר |
| 9.27 | Responsive | מובייל 1, דסקטופ 3 |
| 9.28 | Auth guard | ללא auth — הפניה |

**סה"כ: 28 בדיקות**

---

## 10. CategoriesPage

**נתיב:** `/categories` (protected, AppLayout)
**API:** `categoriesApi.list()`, `.create()`, `.update()`, `.archive()`
**State:** modalOpen, editingCategory, formData, formErrors
**קומפוננטות:** Two-column layout (income/expense), CategoryCard, ColorPicker (PRESET_COLORS), IconPicker (PRESET_ICONS), Modal

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 10.1 | רינדור | העמוד עולה ללא קריסה |
| 10.2 | רינדור | שתי עמודות: הכנסות (ירוק) והוצאות (אדום) |
| 10.3 | רינדור | כל קטגוריה מציגה: אייקון, שם, שם עברי, צבע |
| 10.4 | רינדור | כפתור "הוסף קטגוריה" |
| 10.5 | אינטגרציית API | categoriesApi.list בטעינה |
| 10.6 | אינטגרציית API | CategoryListSkeleton בטעינה |
| 10.7 | CRUD — Create | מודל: שם (EN), שם (HE), סוג, אייקון, צבע |
| 10.8 | CRUD — Create | ColorPicker — 6 צבעים preset |
| 10.9 | CRUD — Create | IconPicker — 24 אימוג'ים preset |
| 10.10 | CRUD — Create | categoriesApi.create |
| 10.11 | CRUD — Update | Pencil → מודל עם נתונים |
| 10.12 | CRUD — Update | categoriesApi.update |
| 10.13 | CRUD — Archive | Archive → categoriesApi.archive (soft delete) |
| 10.14 | CRUD — Archive | קטגוריה מאורכבת — לא מופיעה ברשימה (is_archived) |
| 10.15 | ולידציית טופס | שם EN ריק — שגיאה |
| 10.16 | ולידציית טופס | שם HE ריק — שגיאה |
| 10.17 | ולידציית טופס | אייקון לא נבחר — שגיאה |
| 10.18 | i18n | שם קטגוריה מוצג בעברית (name_he) ב-RTL |
| 10.19 | i18n | באנגלית — name מוצג |
| 10.20 | Dark/Light | כרטיסים עם צבעי card-lift |
| 10.21 | RTL | שתי עמודות הפוכות ב-RTL |
| 10.22 | מצב ריק | עמודת הכנסות ריקה — הודעה |
| 10.23 | מצב ריק | עמודת הוצאות ריקה — הודעה |
| 10.24 | Modal | ESC/X/outside — סוגר |
| 10.25 | Responsive | מובייל — עמודה אחת |
| 10.26 | Auth guard | ללא auth — הפניה |
| 10.27 | Hover | CategoryCard — accent line מופיע ב-hover |
| 10.28 | Animation | fade-in-up stagger על כרטיסים |

**סה"כ: 28 בדיקות**

---

## 11. ForecastPage

**נתיב:** `/forecast` (protected, AppLayout)
**API:** `forecastApi.monthly()`, `forecastApi.weekly()`, `forecastApi.summary()`
**State:** activeTab (monthly/weekly/summary/comparison), monthsAhead (1/3/6/12), chartViewMode (area/bar), whatIfState, seriesVisibility
**קומפוננטות:** Tabs, ComposedChart (Area+Bar+Line), Brush, MonthlyTable, WeeklyChart, SummaryCards, ComparisonView, WhatIf panel

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 11.1 | רינדור | העמוד עולה ללא קריסה |
| 11.2 | רינדור | 4 טאבים: חודשי, שבועי, סיכום, השוואה |
| 11.3 | רינדור | ברירת מחדל — טאב חודשי |
| 11.4 | רינדור | בורר חודשים: 1, 3, 6, 12 |
| 11.5 | אינטגרציית API | forecastApi.monthly בטעינה |
| 11.6 | אינטגרציית API | שינוי monthsAhead — קריאה מחדש |
| 11.7 | אינטגרציית API | טאב שבועי — forecastApi.weekly |
| 11.8 | אינטגרציית API | טאב סיכום — forecastApi.summary |
| 11.9 | אינטגרציית API | Loader2 בטעינה |
| 11.10 | אינטגרציית API | שגיאה — הודעה |
| 11.11 | Monthly Chart | ComposedChart עם Area/Bar מוצג |
| 11.12 | Monthly Chart | Brush — zoom בגרף |
| 11.13 | Monthly Chart | Tooltip — פירוט הכנסות והוצאות |
| 11.14 | Monthly Chart | Legend — מקרא צבעים |
| 11.15 | Monthly Chart | chartViewMode — מעבר בין area ל-bar |
| 11.16 | Weekly Chart | גרף שבועי עם income/expenses/balance |
| 11.17 | Summary | כרטיסי סיכום: יתרה נוכחית, סה"כ הכנסות, סה"כ הוצאות, מאזן סופי |
| 11.18 | Summary | CountUp אנימציה על מספרים |
| 11.19 | Comparison | השוואה בין חודשים |
| 11.20 | What-If | פאנל "מה אם" — הוספת הכנסה/הוצאה |
| 11.21 | What-If | שינוי ערכים — עדכון גרף בזמן אמת |
| 11.22 | What-If | Reset — חזרה לנתונים מקוריים |
| 11.23 | Series Visibility | Eye/EyeOff — הצגה/הסתרה של סדרות נתונים |
| 11.24 | Negative months | חודש שלילי — צבע רקע אדום (getBalanceGradientColor) |
| 11.25 | Negative months | first_negative_month — highlight מיוחד |
| 11.26 | i18n | תוויות חודש בפורמט עברי (he-IL) |
| 11.27 | i18n | כותרות טאבים בעברית |
| 11.28 | Dark/Light | גרפים מותאמים ל-dark |
| 11.29 | RTL | ציר X מימין לשמאל |
| 11.30 | מצב ריק | אין נתוני forecast — הודעה |
| 11.31 | Responsive | מובייל — גרף מצומצם |
| 11.32 | Auth guard | ללא auth — הפניה |
| 11.33 | ScrollReveal | אנימציות scroll reveal |

**סה"כ: 33 בדיקות**

---

## 12. BalancePage

**נתיב:** `/balance` (protected, AppLayout)
**API:** `balanceApi.getCurrent()`, `balanceApi.history()`, `balanceApi.create()`, `balanceApi.update()`
**State:** modalOpen, formData (balance, effective_date, notes)
**קומפוננטות:** CurrentBalanceCard, AreaChart (history), Modal (add/update), DatePicker, Trend indicator

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 12.1 | רינדור | העמוד עולה ללא קריסה |
| 12.2 | רינדור | כרטיס יתרה נוכחית מוצג עם סכום |
| 12.3 | רינדור | גרף היסטוריית יתרות (AreaChart) |
| 12.4 | רינדור | כפתור "עדכן יתרה" |
| 12.5 | רינדור | Trend indicator (up/down/flat) עם אחוז |
| 12.6 | אינטגרציית API | balanceApi.getCurrent בטעינה |
| 12.7 | אינטגרציית API | balanceApi.history |
| 12.8 | אינטגרציית API | Skeleton/Loader בטעינה |
| 12.9 | CRUD — Create | מודל: סכום, תאריך, הערות |
| 12.10 | CRUD — Create | balanceApi.create |
| 12.11 | CRUD — Update | עדכון יתרה — balanceApi.update |
| 12.12 | ולידציית טופס | סכום ריק — שגיאה |
| 12.13 | ולידציית טופס | תאריך ריק — שגיאה |
| 12.14 | Chart | Tooltip מציג תאריך וסכום |
| 12.15 | Chart | ReferenceLine — קו 0 |
| 12.16 | Chart | יתרה שלילית — צבע אדום |
| 12.17 | Chart | יתרה חיובית — צבע ירוק |
| 12.18 | Trend | computeTrend — חישוב נכון מ-2 נקודות אחרונות |
| 12.19 | Trend | TrendingUp/TrendingDown icons |
| 12.20 | i18n | תוויות בעברית |
| 12.21 | i18n | פורמט תאריך (formatDateShort) בעברי |
| 12.22 | Dark/Light | גרף ב-dark/light |
| 12.23 | RTL | תצוגה RTL |
| 12.24 | מצב ריק | אין היסטוריה — הודעה |
| 12.25 | מצב ריק | אין יתרה נוכחית — כפתור "הגדר יתרה ראשונית" |
| 12.26 | Modal | ESC/X/outside — סוגר |
| 12.27 | Responsive | מובייל — גרף מלא רוחב |
| 12.28 | Auth guard | ללא auth — הפניה |
| 12.29 | CountUp | אנימציית ספירה על סכום יתרה |
| 12.30 | CursorGlow | אפקט glow cursor על כרטיס |

**סה"כ: 30 בדיקות**

---

## 13. AlertsPage

**נתיב:** `/alerts` (protected, AppLayout)
**API:** `alertsApi.list()`, `.markRead()`, `.markUnread()`, `.markAllRead()`, `.dismiss()`, `settingsApi.get()` (notifications_enabled)
**State:** activeFilter (all/unread/critical/warning/info), soundEnabled
**קומפוננטות:** FilterTabs, AlertCard (severity-colored), NotificationSound hook, Refresh, MarkAllRead

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 13.1 | רינדור | העמוד עולה ללא קריסה |
| 13.2 | רינדור | טאבי פילטר: הכל, לא נקראו, קריטי, אזהרה, מידע |
| 13.3 | רינדור | כרטיסי התראות עם צבעי severity |
| 13.4 | רינדור | כפתור "סמן הכל כנקרא" |
| 13.5 | רינדור | כפתור רענון (RefreshCw) |
| 13.6 | רינדור | כפתור Sound toggle (Volume2/VolumeX) |
| 13.7 | אינטגרציית API | alertsApi.list בטעינה |
| 13.8 | אינטגרציית API | settingsApi.get (notifications_enabled) |
| 13.9 | אינטגרציית API | Skeleton בטעינה |
| 13.10 | Mark Read | לחיצה על Eye → alertsApi.markRead |
| 13.11 | Mark Unread | לחיצה על EyeOff → alertsApi.markUnread |
| 13.12 | Mark All Read | כפתור → alertsApi.markAllRead |
| 13.13 | Dismiss | כפתור X → alertsApi.dismiss |
| 13.14 | Refresh | כפתור → refetch alerts |
| 13.15 | Filtering | טאב "לא נקראו" — מציג רק is_read=false |
| 13.16 | Filtering | טאב "קריטי" — רק severity=critical |
| 13.17 | Filtering | טאב "אזהרה" — רק severity=warning |
| 13.18 | Filtering | טאב "מידע" — רק severity=info |
| 13.19 | Severity | critical — רקע אדום, אייקון ShieldAlert |
| 13.20 | Severity | warning — רקע צהוב, אייקון AlertTriangle |
| 13.21 | Severity | info — רקע כחול, אייקון Info |
| 13.22 | Time format | formatRelativeTime — "עכשיו", "לפני X דקות", "אתמול" |
| 13.23 | Sound | soundEnabled=true — playSound כשהתראה חדשה |
| 13.24 | Sound | soundEnabled=false — ללא צליל |
| 13.25 | i18n | כותרות, סטטוסים, זמנים יחסיים בעברית |
| 13.26 | Dark/Light | צבעי severity ב-dark mode |
| 13.27 | RTL | כרטיסים RTL |
| 13.28 | מצב ריק | אין התראות — הודעת "אין התראות" |
| 13.29 | מצב ריק | אין התראות בפילטר מסוים — הודעה |
| 13.30 | Responsive | מובייל — כרטיסים מלא רוחב |
| 13.31 | Auth guard | ללא auth — הפניה |
| 13.32 | Unread badge | ספירת unread_count מוצגת |

**סה"כ: 32 בדיקות**

---

## 14. SettingsPage

**נתיב:** `/settings` (protected, AppLayout)
**API:** `settingsApi.get()`, `settingsApi.update()`, `currencyApi.rates()`, `authApi.changePassword()`, `useAuth().logout()`
**State:** settings (from API), ThemeContext, password change state
**קומפוננטות:** ThemeCard (light/dark/system), LanguageToggle, CurrencySelector, NotificationToggle, ForecastDefaults, AlertThresholds, PasswordChange, Logout, ExchangeRates

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 14.1 | רינדור | העמוד עולה ללא קריסה |
| 14.2 | רינדור | סקציות: עיצוב, שפה, מטבע, התראות, תחזית, אבטחה, חשבון |
| 14.3 | רינדור | 3 כרטיסי theme עם mini-preview |
| 14.4 | רינדור | כפתור יציאה (Logout) |
| 14.5 | אינטגרציית API | settingsApi.get בטעינה |
| 14.6 | אינטגרציית API | currencyApi.rates |
| 14.7 | Theme | בחירת Light — setTheme('light') + settingsApi.update |
| 14.8 | Theme | בחירת Dark — setTheme('dark') |
| 14.9 | Theme | בחירת System — setTheme('system') |
| 14.10 | Theme | ThemeCard selected — border-focus |
| 14.11 | Language | toggle HE ↔ EN — i18n.changeLanguage + settingsApi.update |
| 14.12 | Language | שינוי שפה משנה dir של document |
| 14.13 | Currency | בחירת מטבע — settingsApi.update({currency}) |
| 14.14 | Currency | שערי המרה מוצגים (ExchangeRate) |
| 14.15 | Notifications | toggle on/off — settingsApi.update({notifications_enabled}) |
| 14.16 | Forecast | forecast_months_default — שמירה |
| 14.17 | Forecast | week_start_day — שמירה |
| 14.18 | Alert thresholds | alert_warning_threshold — שמירה |
| 14.19 | Alert thresholds | alert_critical_threshold — שמירה |
| 14.20 | Password | שדות: סיסמה נוכחית, סיסמה חדשה |
| 14.21 | Password | authApi.changePassword |
| 14.22 | Password | הצלחה — toast הצלחה |
| 14.23 | Password | כישלון — הודעת שגיאה |
| 14.24 | Password | Eye/EyeOff toggle |
| 14.25 | Logout | כפתור → useAuth().logout() + ניווט ל-/login |
| 14.26 | Auto-save | שינויים נשמרים אוטומטית (ללא כפתור "שמור") |
| 14.27 | i18n | כל סקציות בעברית |
| 14.28 | Dark/Light | ThemeCard preview משקף את הצבעים |
| 14.29 | RTL | סקציות RTL |
| 14.30 | Responsive | מובייל — עמודה אחת |
| 14.31 | Auth guard | ללא auth — הפניה |
| 14.32 | Date format | date_format נשמר בהגדרות |

**סה"כ: 32 בדיקות**

---

## 15. UsersPage

**נתיב:** `/users` (protected, AppLayout, admin only)
**API:** `usersApi.list()`, `.create()`, `.update()`, `.delete()`, `useAuth()` (user.is_admin check)
**State:** modalOpen, editingUser, formData, deleteTarget, searchQuery
**קומפוננטות:** UserTable, UserAvatar, AccessDenied, Modal (Create/Edit), DeleteConfirm

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 15.1 | רינדור | העמוד עולה ללא קריסה (למשתמש admin) |
| 15.2 | רינדור | טבלת משתמשים: שם, אימייל, תפקיד, סטטוס, פעולות |
| 15.3 | רינדור | כפתור "הוסף משתמש" |
| 15.4 | רינדור | UserAvatar — ראשי תיבות + צבע admin |
| 15.5 | Access Denied | משתמש רגיל — מוצג AccessDenied component |
| 15.6 | Access Denied | הודעת "אין הרשאה" |
| 15.7 | אינטגרציית API | usersApi.list בטעינה |
| 15.8 | אינטגרציית API | TableSkeleton בטעינה |
| 15.9 | CRUD — Create | שדות: username, email, password, is_admin |
| 15.10 | CRUD — Create | usersApi.create |
| 15.11 | CRUD — Update | Pencil → מודל → usersApi.update |
| 15.12 | CRUD — Delete | Trash2 → אישור → usersApi.delete |
| 15.13 | CRUD — Delete | לא ניתן למחוק את עצמך |
| 15.14 | Toggle Admin | ShieldCheck/ShieldOff — שינוי הרשאת admin |
| 15.15 | Toggle Active | UserCheck/UserX — הפעלה/השבתת משתמש |
| 15.16 | Search | שדה חיפוש — סינון לפי username/email |
| 15.17 | ולידציית טופס | username ריק — שגיאה |
| 15.18 | ולידציית טופס | email ריק — שגיאה |
| 15.19 | ולידציית טופס | password ריק ביצירה — שגיאה |
| 15.20 | i18n | כותרות, תפקידים בעברית |
| 15.21 | Dark/Light | טבלה ב-dark/light |
| 15.22 | RTL | טבלה RTL |
| 15.23 | מצב ריק | אין משתמשים (מלבד הנוכחי) — הודעה |
| 15.24 | Modal | ESC/X/outside — סוגר |
| 15.25 | Responsive | מובייל — כרטיסים במקום טבלה |
| 15.26 | Auth guard | ללא auth — הפניה ל-/login |
| 15.27 | Admin badge | Crown icon למשתמש admin |
| 15.28 | Eye/EyeOff | שדה סיסמה — toggle |

**סה"כ: 28 בדיקות**

---

## 16. BackupsPage

**נתיב:** `/backups` (protected, AppLayout, admin only)
**API:** `backupsApi.list()`, `.create()`, `.restore()`, `.delete()`, `.verify()`, `.schedule()`, `useAuth()` (admin check)
**State:** backups list, schedule info
**קומפוננטות:** BackupCard, StatusBadge, AccessDenied, BackupsSkeleton

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 16.1 | רינדור | העמוד עולה ללא קריסה (admin) |
| 16.2 | רינדור | רשימת גיבויים עם סטטוס |
| 16.3 | רינדור | כפתור "יצירת גיבוי חדש" |
| 16.4 | רינדור | StatusBadge: completed/failed/in_progress — צבעים |
| 16.5 | רינדור | פרטים: שם קובץ, גודל, משך, checksum |
| 16.6 | Access Denied | משתמש רגיל — AccessDenied |
| 16.7 | אינטגרציית API | backupsApi.list בטעינה |
| 16.8 | אינטגרציית API | backupsApi.schedule — מידע לוח זמנים |
| 16.9 | אינטגרציית API | BackupsSkeleton בטעינה |
| 16.10 | Create | כפתור → backupsApi.create |
| 16.11 | Create | toast "גיבוי נוצר" |
| 16.12 | Restore | כפתור שחזור → backupsApi.restore |
| 16.13 | Restore | אישור לפני שחזור |
| 16.14 | Delete | Trash2 → backupsApi.delete |
| 16.15 | Verify | כפתור אימות → backupsApi.verify |
| 16.16 | Verify | is_verified — ShieldCheck |
| 16.17 | File size | formatFileSize — B/KB/MB/GB |
| 16.18 | Duration | formatDuration — seconds/minutes |
| 16.19 | i18n | כותרות, סטטוסים בעברית |
| 16.20 | Dark/Light | כרטיסים ב-dark/light |
| 16.21 | RTL | תצוגה RTL |
| 16.22 | מצב ריק | אין גיבויים — הודעה |
| 16.23 | Responsive | מובייל — עמודה אחת |
| 16.24 | Auth guard | ללא auth — הפניה |
| 16.25 | Schedule | retention_days מוצג |

**סה"כ: 25 בדיקות**

---

## 17. OrganizationPage

**נתיב:** `/organizations` (protected, AppLayout)
**API:** `organizationsApi.list()`, `.create()`, `.get()`, `.update()`, `.delete()`, `.members()`, `.addMember()`, `.changeMemberRole()`, `.removeMember()`, `useOrganization()`, `useAuth()`
**State:** selectedOrg, members list, modalOpen (create org / add member), formData
**קומפוננטות:** OrgCard list, OrgDetail view, MembersList, RoleBadge, AddMember modal, PageSkeleton

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 17.1 | רינדור | העמוד עולה ללא קריסה |
| 17.2 | רינדור | רשימת ארגונים בכרטיסים |
| 17.3 | רינדור | OrgCard: שם, מספר חברים, תפקיד |
| 17.4 | רינדור | כפתור "צור ארגון חדש" |
| 17.5 | אינטגרציית API | organizationsApi.list בטעינה |
| 17.6 | אינטגרציית API | PageSkeleton בטעינה |
| 17.7 | CRUD — Create Org | מודל: שם ארגון |
| 17.8 | CRUD — Create Org | organizationsApi.create |
| 17.9 | CRUD — Update Org | עריכת שם → organizationsApi.update |
| 17.10 | CRUD — Delete Org | Trash2 → אישור → organizationsApi.delete |
| 17.11 | Detail view | לחיצה על OrgCard → מעבר לתצוגת פירוט |
| 17.12 | Detail view | ChevronLeft — חזרה לרשימה |
| 17.13 | Members — List | רשימת חברים עם RoleBadge |
| 17.14 | Members — Add | UserPlus → מודל: email + role |
| 17.15 | Members — Add | organizationsApi.addMember |
| 17.16 | Members — ChangeRole | dropdown role → organizationsApi.changeMemberRole |
| 17.17 | Members — Remove | UserMinus → אישור → organizationsApi.removeMember |
| 17.18 | Roles | owner — Crown, admin — Shield, member — Users, viewer — Eye |
| 17.19 | Roles | צבעים: owner=purple, admin=blue, member=green, viewer=gray |
| 17.20 | ולידציית טופס | שם ארגון ריק — שגיאה |
| 17.21 | ולידציית טופס | email חבר ריק — שגיאה |
| 17.22 | Permissions | viewer לא יכול להוסיף/מחוק חברים |
| 17.23 | Permissions | רק owner יכול למחוק ארגון |
| 17.24 | Context switch | useOrganization — החלפת הקשר ארגוני |
| 17.25 | i18n | תפקידים בעברית (role_owner, role_admin...) |
| 17.26 | Dark/Light | כרטיסים ב-dark/light |
| 17.27 | RTL | תצוגה RTL |
| 17.28 | מצב ריק | אין ארגונים — הודעה + כפתור יצירה |
| 17.29 | מצב ריק | ארגון בלי חברים (מלבד owner) — הודעה |
| 17.30 | Modal | ESC/X/outside — סוגר |
| 17.31 | Responsive | מובייל — כרטיסים בעמודה |
| 17.32 | Auth guard | ללא auth — הפניה |

**סה"כ: 32 בדיקות**

---

## 18. ErrorPage

**נתיב:** `*` (404), או component error boundary
**API:** אין
**State:** detailsOpen, copied, statusCode
**קומפוננטות:** Error display, Debug info (DEV), Copy, GoHome, Retry

| # | קטגוריה | תיאור בדיקה |
|---|---------|-------------|
| 18.1 | רינדור | העמוד עולה ללא קריסה |
| 18.2 | רינדור | קוד שגיאה (404/500/403) מוצג בגדול עם gradient |
| 18.3 | רינדור | כותרת שגיאה מותאמת לקוד |
| 18.4 | רינדור | הודעת שגיאה מותאמת |
| 18.5 | רינדור | לוגו מוצג |
| 18.6 | 404 | ניווט לנתיב לא קיים — מציג 404 |
| 18.7 | 404 | כותרת "עמוד לא נמצא" |
| 18.8 | 500 | שגיאת שרת — כותרת "שגיאת שרת" |
| 18.9 | 403 | אין הרשאה — כותרת "אין הרשאה" |
| 18.10 | ניווט | כפתור "חזור לדף הבית" → / |
| 18.11 | ניווט | כפתור "נסה שוב" → reload / onRetry |
| 18.12 | Debug (DEV) | במצב DEV — פרטי debug מוצגים |
| 18.13 | Debug (DEV) | toggle details — פתיחה/סגירה |
| 18.14 | Debug (DEV) | Copy — העתקת debugInfo ל-clipboard |
| 18.15 | Debug (DEV) | debugInfo כולל: error, status, URL, timestamp, user agent, stack |
| 18.16 | i18n | כותרות שגיאה מתורגמות |
| 18.17 | Dark/Light | צבעי רקע וטקסט מותאמים |
| 18.18 | RTL | תצוגה RTL |

**סה"כ: 18 בדיקות**

---

## 19. בדיקות רוחביות (Cross-Cutting Tests)

בדיקות שאינן ספציפיות לעמוד מסוים אלא חולשות על כל האפליקציה.

### 19.1 Auth Guard & Routing

| # | תיאור בדיקה |
|---|-------------|
| 19.1.1 | ProtectedRoute — redirect ל-/login כשאין token |
| 19.1.2 | ProtectedRoute — מאפשר גישה עם token תקין |
| 19.1.3 | / מפנה ל-/dashboard |
| 19.1.4 | נתיב לא קיים → ErrorPage 404 |
| 19.1.5 | Lazy loading — SuspenseWrapper מציג Loader2 |
| 19.1.6 | AppLayout — Sidebar, Header מוצגים בעמודי protected |
| 19.1.7 | Token refresh — refresh token מחדש access token שפג |
| 19.1.8 | Logout — מנקה tokens ומפנה ל-/login |

### 19.2 i18n

| # | תיאור בדיקה |
|---|-------------|
| 19.2.1 | ברירת מחדל — עברית |
| 19.2.2 | החלפה לאנגלית — כל הטקסטים מתורגמים |
| 19.2.3 | dir=rtl בעברית |
| 19.2.4 | dir=ltr באנגלית |
| 19.2.5 | lang attribute משתנה |
| 19.2.6 | שפה נשמרת ב-localStorage |
| 19.2.7 | רענון — שפה נשמרת |

### 19.3 Dark/Light Mode

| # | תיאור בדיקה |
|---|-------------|
| 19.3.1 | ThemeContext — light/dark/system |
| 19.3.2 | system — עוקב אחרי prefers-color-scheme |
| 19.3.3 | CSS custom properties משתנים (--bg-primary, --text-primary וכו') |
| 19.3.4 | theme נשמר ב-localStorage |
| 19.3.5 | רענון — theme נשמר |
| 19.3.6 | מעבר חלק (transition) בין themes |

### 19.4 RTL / LTR

| # | תיאור בדיקה |
|---|-------------|
| 19.4.1 | RTL — כל layout מימין לשמאל |
| 19.4.2 | LTR — כל layout משמאל לימין |
| 19.4.3 | מספרים — תמיד LTR (formatCurrency) |
| 19.4.4 | סכומים — סימן מטבע בצד הנכון |
| 19.4.5 | תאריכים — DD/MM/YYYY בעברית |
| 19.4.6 | Sidebar — צד ימין ב-RTL |
| 19.4.7 | Pagination arrows — מתהפכים ב-RTL |

### 19.5 Responsive

| # | תיאור בדיקה |
|---|-------------|
| 19.5.1 | Mobile (< 640px) — Sidebar נסתר |
| 19.5.2 | Mobile — Hamburger menu |
| 19.5.3 | Tablet (640-1024px) — layout 2 עמודות |
| 19.5.4 | Desktop (> 1024px) — layout 3 עמודות + sidebar |
| 19.5.5 | Charts — responsive container |

### 19.6 Org Context

| # | תיאור בדיקה |
|---|-------------|
| 19.6.1 | OrganizationContext — personal mode ברירת מחדל |
| 19.6.2 | החלפה לארגון — כל ה-queries מרעננות עם org_id |
| 19.6.3 | חזרה ל-personal — נתונים אישיים |
| 19.6.4 | ORG header badge — שם ארגון מוצג |

### 19.7 Toast Notifications

| # | תיאור בדיקה |
|---|-------------|
| 19.7.1 | useToast — הצגת הודעת הצלחה |
| 19.7.2 | useToast — הצגת הודעת שגיאה |
| 19.7.3 | Toast נסגר אוטומטית |
| 19.7.4 | Toast ניתן לסגירה ידנית |

### 19.8 Error Handling

| # | תיאור בדיקה |
|---|-------------|
| 19.8.1 | getApiErrorMessage — מחזיר הודעה ידידותית |
| 19.8.2 | 401 — redirect ל-login |
| 19.8.3 | 403 — הודעת "אין הרשאה" |
| 19.8.4 | 500 — הודעת "שגיאת שרת" |
| 19.8.5 | Network error — "אין חיבור לשרת" |
| 19.8.6 | Error Boundary — תופס קריסות React |

**סה"כ בדיקות רוחביות: 43 בדיקות**

---

## 20. סיכום כמותי

| # | עמוד | מספר בדיקות |
|---|------|------------|
| 1 | LoginPage | 22 |
| 2 | RegisterPage | 23 |
| 3 | OnboardingPage | 25 |
| 4 | DashboardPage | 30 |
| 5 | TransactionsPage | 53 |
| 6 | FixedPage | 30 |
| 7 | InstallmentsPage | 30 |
| 8 | LoansPage | 30 |
| 9 | SubscriptionsPage | 28 |
| 10 | CategoriesPage | 28 |
| 11 | ForecastPage | 33 |
| 12 | BalancePage | 30 |
| 13 | AlertsPage | 32 |
| 14 | SettingsPage | 32 |
| 15 | UsersPage | 28 |
| 16 | BackupsPage | 25 |
| 17 | OrganizationPage | 32 |
| 18 | ErrorPage | 18 |
| 19 | Cross-Cutting | 43 |
| | **סה"כ** | **562** |

---

## פילוח לפי קטגוריה

| קטגוריה | כמות (משוערת) |
|---------|-------------|
| רינדור בסיסי | ~75 |
| אינטגרציית API (loading/error/success) | ~95 |
| CRUD (Create/Read/Update/Delete) | ~85 |
| ולידציית טופס | ~55 |
| Pagination & Filtering & Sorting | ~35 |
| i18n (עברית/אנגלית) | ~45 |
| Dark/Light Mode | ~25 |
| RTL Layout | ~30 |
| מצב ריק (Empty State) | ~30 |
| Responsive | ~25 |
| Modal (ESC/X/outside) | ~20 |
| ניווט (Navigation) | ~20 |
| Auth Guard | ~20 |
| Org Context | ~7 |
| נגישות & אנימציות | ~15 |
| Toast & Error Handling | ~10 |

---

## עדיפויות לביצוע

### P0 — קריטי (ראשון)
- Auth guard & routing (19.1)
- CRUD flows לכל עמוד
- ולידציית טופס
- Error handling (19.8)

### P1 — חשוב
- אינטגרציית API (loading/error states)
- Pagination & filtering (TransactionsPage)
- i18n (עברית כברירת מחדל)
- RTL layout

### P2 — רגיל
- Dark/Light mode
- Responsive
- Empty states
- Modal behavior

### P3 — נמוך
- אנימציות (CountUp, ScrollReveal, Confetti)
- Sound notifications
- Cursor glow effects
- Debug info (ErrorPage DEV mode)

---

> **סה"כ: 562 בדיקות מתוכננות על 18 עמודים + בדיקות רוחביות**
