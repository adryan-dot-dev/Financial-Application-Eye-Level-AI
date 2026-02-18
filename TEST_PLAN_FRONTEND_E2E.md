# תוכנית בדיקות Frontend — רכיבים משותפים, Hooks, Contexts ותרחישי E2E

> **פרויקט:** CashFlow Management — Eye Level AI
> **תאריך:** 18/02/2026
> **גרסה:** 1.0
> **כלי בדיקה:** Vitest + React Testing Library (Unit/Integration) | Playwright (E2E)
> **סטאטוס:** טיוטה לאישור

---

## תוכן עניינים

- [A] רכיבי Layout — סרגל צד, כותרת, ניווט מובייל
- [B] רכיבי UI משותפים — DatePicker, PeriodSelector, CategoryIcon, Skeleton, CurrencySelector
- [C] רכיבים כלליים — Toast, ErrorBoundary, AnimatedPage, CommandPalette, OrgSwitcher, ProtectedRoute
- [D] ווידג'טים (Dashboard Widgets)
- [E] Hooks מותאמים אישית
- [F] Contexts / Providers
- [G] ספריות עזר (lib/utils)
- [H] תרחישי E2E — 10 זרימות משתמש מלאות
- [I] בדיקות חוצות — שגיאות API, Cache, Concurrent, Bundle, נגישות
- [J] סיכום כללי

---

## [A] רכיבי Layout

### A1 — Sidebar (`src/components/layout/Sidebar.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| A1.1 | רנדור תקין של כל פריטי הניווט (14 פריטים: dashboard, transactions, balance, fixed, installments, loans, subscriptions, forecast, categories, organizations, alerts, settings, users, backups) | Unit | גבוהה |
| A1.2 | פריט ניווט פעיל מקבל עיצוב active לפי הנתיב הנוכחי (pathname) | Unit | גבוהה |
| A1.3 | פריטים עם adminOnly=true (users, backups) לא מוצגים למשתמש רגיל | Unit | גבוהה |
| A1.4 | פריטים עם adminOnly מוצגים למשתמש admin | Unit | גבוהה |
| A1.5 | לחיצה על כפתור collapse מצמצם את הסרגל הצדדי ומציג רק אייקונים | Unit | בינונית |
| A1.6 | tooltip מופיע בהשהיה בעת ריחוף כשהסרגל מצומצם | Unit | נמוכה |
| A1.7 | כפתור שינוי שפה מחליף בין he ל-en ומעדכן dir ו-lang על documentElement | Integration | גבוהה |
| A1.8 | כפתור שינוי ערכת נושא עובר בין light/dark/system | Integration | בינונית |
| A1.9 | כפתור logout מנקה טוקנים ומנווט ל-/login | Integration | גבוהה |
| A1.10 | במצב מובייל (mobileOpen=true) הסרגל מוצג כ-overlay עם אנימציה | Unit | בינונית |
| A1.11 | לחיצה על כפתור X סוגר את הסרגל במובייל (קריאה ל-onMobileClose) | Unit | בינונית |
| A1.12 | OrgSwitcher מרונדר בתוך הסרגל הצדדי | Integration | בינונית |
| A1.13 | תמיכת RTL — סרגל צדדי מוצג בצד ימין בעברית | Visual | גבוהה |
| A1.14 | קבוצות הניווט (main, finance, system) מופרדות ויזואלית | Unit | נמוכה |

### A2 — Header (`src/components/layout/Header.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| A2.1 | Header מוצג רק במובייל (class md:hidden) | Unit | בינונית |
| A2.2 | לחיצה על כפתור Menu קוראת ל-onMenuClick | Unit | גבוהה |
| A2.3 | לוגו ושם האפליקציה מוצגים | Unit | בינונית |
| A2.4 | כפתור Menu מכיל aria-label מתורגם | Unit | בינונית |

### A3 — DesktopHeader (`src/components/layout/DesktopHeader.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| A3.1 | breadcrumb מציג את שם הדף הנוכחי לפי routeLabels | Unit | בינונית |
| A3.2 | ספירת התראות לא נקראות מוצגת (badge) מתוך query של alerts | Integration | גבוהה |
| A3.3 | אפקט glass מופעל בעת גלילה (scrolled > 8px) | Unit | נמוכה |
| A3.4 | תפריט dropdown של משתמש נפתח ונסגר בלחיצה | Unit | בינונית |
| A3.5 | dropdown נסגר בלחיצה מחוץ לאלמנט | Unit | בינונית |
| A3.6 | dropdown נסגר בלחיצת Escape | Unit | בינונית |
| A3.7 | initials מחושבים נכון — שם מלא מחזיר אות ראשונה+אחרונה, username מחזיר 2 תווים | Unit | בינונית |
| A3.8 | כפתורי logout, settings, alerts בתפריט עובדים ומנווטים | Integration | גבוהה |

### A4 — MobileBottomNav (`src/components/layout/MobileBottomNav.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| A4.1 | 4 טאבים ראשיים מוצגים (dashboard, transactions, fixed, forecast) | Unit | גבוהה |
| A4.2 | טאב פעיל מקבל עיצוב active | Unit | גבוהה |
| A4.3 | כפתור "More" פותח bottom sheet עם פריטים נוספים (balance, installments, loans, categories, alerts, settings, users) | Unit | גבוהה |
| A4.4 | bottom sheet נסגר עם אנימציה בלחיצה על X | Unit | בינונית |
| A4.5 | bottom sheet נסגר אוטומטית בשינוי route | Integration | בינונית |
| A4.6 | כשפריט מ-"More" פעיל — כפתור More מקבל עיצוב מיוחד (isMoreActive) | Unit | נמוכה |
| A4.7 | אפשרות הסתרת הניווט (hidden) נשמרת ב-localStorage | Unit | בינונית |
| A4.8 | callback onVisibilityChange נקרא בשינוי מצב הסתרה | Unit | בינונית |
| A4.9 | אנימציית כפתור toggle (ChevronUp/Down) מתחלפת בהתאם למצב | Unit | נמוכה |

### A5 — AppLayout (`src/components/layout/AppLayout.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| A5.1 | dir נקבע כ-rtl בעברית ו-ltr באנגלית | Unit | גבוהה |
| A5.2 | Sidebar, Header, DesktopHeader, MobileBottomNav כולם מרונדרים | Integration | גבוהה |
| A5.3 | Cmd+K / Ctrl+K פותח את CommandPalette | Integration | בינונית |
| A5.4 | קישור Skip-to-content קיים ונגיש ב-Tab | Unit | בינונית |
| A5.5 | אזור תוכן ראשי מקבל margin-inline-start דינמי (RTL aware) | Unit | בינונית |
| A5.6 | bottomNavHidden state נשמר ב-localStorage ונטען בעת mount | Unit | נמוכה |
| A5.7 | Outlet מרונדר (תוכן הדף הנוכחי) | Integration | גבוהה |
| A5.8 | רקע gradient orbs מרונדרים עם aria-hidden="true" | Unit | נמוכה |
| A5.9 | באנר ארגון מוצג כש-isOrgView=true עם שם הארגון | Integration | בינונית |

---

## [B] רכיבי UI משותפים

### B1 — DatePicker (`src/components/ui/DatePicker.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| B1.1 | רנדור עם ערך ריק מציג placeholder | Unit | בינונית |
| B1.2 | רנדור עם ערך YYYY-MM-DD מציג תאריך מעוצב | Unit | גבוהה |
| B1.3 | לחיצה על כפתור פותח לוח שנה ב-portal | Unit | גבוהה |
| B1.4 | בחירת תאריך קוראת ל-onChange עם הפורמט YYYY-MM-DD | Unit | גבוהה |
| B1.5 | ניווט חודש קדימה/אחורה מעדכן את התצוגה | Unit | בינונית |
| B1.6 | היום מסומן כ-"today" בלוח | Unit | נמוכה |
| B1.7 | התאריך הנבחר מודגש (selected) | Unit | בינונית |
| B1.8 | סגירת הלוח בלחיצה מחוץ לאזור | Unit | בינונית |
| B1.9 | סגירת הלוח בלחיצת Escape | Unit | בינונית |
| B1.10 | תמיכת RTL — שמות ימים ושמות חודשים בעברית כש-lang=he | Unit | גבוהה |
| B1.11 | מיקום popup מתחשב בגבולות המסך (viewport boundary) | Unit | נמוכה |
| B1.12 | תמיכת aria — aria-describedby, aria-invalid מועברים כראוי | Unit | בינונית |

### B2 — PeriodSelector (`src/components/ui/PeriodSelector.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| B2.1 | כל ה-presets מוצגים (7D, 1M, 3M, 6M, 1Y, YTD, CUSTOM) | Unit | גבוהה |
| B2.2 | preset נבחר מודגש (active state) | Unit | בינונית |
| B2.3 | בחירת preset (למשל 3M) קוראת ל-onChange עם טווח תאריכים נכון | Unit | גבוהה |
| B2.4 | getDateRangeForPreset('7D') מחזיר 7 ימים אחורה | Unit | גבוהה |
| B2.5 | getDateRangeForPreset('YTD') מחזיר מ-1 בינואר של השנה הנוכחית | Unit | גבוהה |
| B2.6 | בחירת CUSTOM פותח popover עם 2 שדות DatePicker (from/to) | Unit | גבוהה |
| B2.7 | שינוי תאריכים ב-CUSTOM קורא ל-onChange עם הטווח המותאם | Unit | גבוהה |
| B2.8 | popover נסגר בלחיצה מחוץ לאזור | Unit | בינונית |
| B2.9 | סנכרון תאריכי custom כשהערך משתנה חיצונית | Unit | בינונית |

### B3 — CategoryIcon (`src/components/ui/CategoryIcon.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| B3.1 | emoji כאייקון — מוצג כ-emoji בתוך עיגול צבעוני | Unit | בינונית |
| B3.2 | טקסט כאייקון (כמו "car") — מוצגת האות הראשונה בלבד | Unit | בינונית |
| B3.3 | ללא אייקון — מוצג אייקון Tag כ-fallback | Unit | בינונית |
| B3.4 | גדלים (sm/md/lg) מחילים מידות שונות | Unit | נמוכה |
| B3.5 | צבע רקע מחושב מהצבע שהועבר (18% שקיפות) | Unit | נמוכה |

### B4 — Skeleton (`src/components/ui/Skeleton.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| B4.1 | Skeleton, SkeletonText, SkeletonHeading, SkeletonCircle מקבלים className | Unit | נמוכה |
| B4.2 | KpiCardSkeleton מרונדר עם animationDelay מבוסס index | Unit | נמוכה |
| B4.3 | WidgetSkeleton מרונדר עם מבנה header + body | Unit | נמוכה |
| B4.4 | TableRowSkeleton מרונדר עם מספר עמודות מותאם | Unit | נמוכה |

### B5 — CurrencySelector (`src/components/CurrencySelector.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| B5.1 | מציג 3 מטבעות: ILS, USD, EUR עם דגל וסימן | Unit | בינונית |
| B5.2 | ערך ברירת מחדל מסומן | Unit | בינונית |
| B5.3 | שינוי בחירה קורא ל-onChange עם קוד המטבע | Unit | גבוהה |
| B5.4 | aria-label מתורגם קיים | Unit | נמוכה |

---

## [C] רכיבים כלליים

### C1 — Toast (`src/components/Toast.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| C1.1 | toast מסוג success מציג אייקון CheckCircle וצבעי הצלחה | Unit | בינונית |
| C1.2 | toast מסוג error מציג אייקון XCircle וצבעי שגיאה | Unit | בינונית |
| C1.3 | toast מסוג warning מציג אייקון AlertTriangle | Unit | נמוכה |
| C1.4 | toast מסוג info מציג אייקון Info | Unit | נמוכה |
| C1.5 | כפתור X סוגר את ה-toast עם אנימציית exit | Unit | בינונית |
| C1.6 | פס התקדמות (progress bar) מונפש לפי duration | Unit | נמוכה |
| C1.7 | role="status" ו-aria-live="polite" קיימים לנגישות | Unit | בינונית |

### C2 — ErrorBoundary (`src/components/ErrorBoundary.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| C2.1 | כשאין שגיאה — הילדים מרונדרים כרגיל | Unit | גבוהה |
| C2.2 | כששגיאה נזרקת — ErrorPage מוצג עם statusCode=500 | Unit | גבוהה |
| C2.3 | כששגיאה נזרקת ו-fallback מוגדר — ה-fallback מוצג | Unit | בינונית |
| C2.4 | כפתור Retry מאפס את השגיאה ומנסה לרנדר שוב | Unit | גבוהה |
| C2.5 | componentStack נשמר ומועבר ל-ErrorPage | Unit | נמוכה |
| C2.6 | במצב DEV — console.group נקרא עם פרטי השגיאה | Unit | נמוכה |

### C3 — AnimatedPage (`src/components/AnimatedPage.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| C3.1 | motion.div מרונדר עם variants מתאימים (initial, animate, exit) | Unit | נמוכה |
| C3.2 | children מרונדרים בתוך ה-wrapper | Unit | נמוכה |

### C4 — CommandPalette (`src/components/CommandPalette.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| C4.1 | כש-open=true, הפלטה מוצגת עם שדה חיפוש | Unit | גבוהה |
| C4.2 | כש-open=false, הפלטה לא מוצגת | Unit | גבוהה |
| C4.3 | חיפוש מסנן את פריטי הניווט לפי מילת מפתח | Unit | גבוהה |
| C4.4 | לחיצה על פריט מנווטת ליעד וסוגרת את הפלטה | Integration | גבוהה |
| C4.5 | פריטי adminOnly מוסתרים ממשתמש רגיל | Unit | בינונית |
| C4.6 | פקודת Toggle Theme מחליפה light/dark | Integration | בינונית |
| C4.7 | פקודת Change Language מחליפה he/en | Integration | בינונית |
| C4.8 | קבוצות (main, finance, system) מופרדות ויזואלית | Unit | נמוכה |
| C4.9 | פריט "Create Transaction" (אם קיים) מנווט ל-/transactions עם פרמטר | Integration | נמוכה |

### C5 — OrgSwitcher (`src/components/OrgSwitcher.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| C5.1 | לא מוצג כש-isLoading או כשאין ארגונים | Unit | גבוהה |
| C5.2 | מציג שם הארגון הנוכחי או "אישי" | Unit | גבוהה |
| C5.3 | לחיצה פותחת dropdown עם רשימת ארגונים + אפשרות "אישי" | Unit | גבוהה |
| C5.4 | בחירת ארגון קוראת ל-switchOrg ומציגה toast הצלחה | Integration | גבוהה |
| C5.5 | שגיאת switch מציגה toast שגיאה | Integration | בינונית |
| C5.6 | dropdown נסגר בלחיצה מחוץ לאזור | Unit | בינונית |
| C5.7 | במצב collapsed — רק אייקון מוצג עם title | Unit | נמוכה |
| C5.8 | Loader מוצג בזמן switching | Unit | נמוכה |

### C6 — ProtectedRoute (`src/components/auth/ProtectedRoute.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| C6.1 | כשלא מאומת — מפנה ל-/login | Integration | גבוהה |
| C6.2 | כשמאומת ו-onboarding הושלם — מציג Outlet | Integration | גבוהה |
| C6.3 | כשמאומת ו-onboarding לא הושלם — מפנה ל-/onboarding | Integration | גבוהה |
| C6.4 | בזמן טעינת auth — מציג loader (spinner) | Unit | בינונית |
| C6.5 | sessionStorage cache — אם onboarding_completed=true לא נשלחת בקשה נוספת | Integration | בינונית |
| C6.6 | נתיב /onboarding מרונדר Outlet ישירות ללא בדיקת onboarding | Integration | בינונית |
| C6.7 | שגיאת settings API מעבירה ל-onboarding כ-fallback | Integration | נמוכה |

---

## [D] ווידג'טים (Dashboard Widgets)

### D1 — FinancialHealthWidget (`src/components/dashboard/FinancialHealthWidget.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| D1.1 | gauge מציג ציון בריאות פיננסית (0-100) עם צבע מותאם | Unit | בינונית |
| D1.2 | דירוג (excellent/good/fair/poor/critical) מתורגם ומוצג | Unit | בינונית |
| D1.3 | גורמים (factors) מוצגים עם שם, ציון ופס התקדמות | Unit | בינונית |
| D1.4 | בזמן טעינה — skeleton מוצג | Unit | נמוכה |
| D1.5 | שגיאת API — מצב שגיאה מוצג | Unit | בינונית |

### D2 — MonthlyComparisonChart (`src/components/dashboard/MonthlyComparisonChart.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| D2.1 | Bar chart מרונדר עם נתוני הכנסות והוצאות | Integration | בינונית |
| D2.2 | עד 6 חודשים אחרונים מוצגים | Unit | בינונית |
| D2.3 | tooltip מציג ערכים מעוצבים עם מטבע | Unit | נמוכה |
| D2.4 | בזמן טעינה — skeleton מוצג | Unit | נמוכה |
| D2.5 | formatMonthLabel ממיר תאריך YYYY-MM לשם חודש קצר | Unit | בינונית |

### D3 — InstallmentsSummaryWidget (`src/components/dashboard/InstallmentsSummaryWidget.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| D3.1 | סיכום תשלומים מוצג — total, paid, remaining | Unit | בינונית |
| D3.2 | פס התקדמות כללי מוצג | Unit | נמוכה |
| D3.3 | בזמן טעינה — skeleton מוצג | Unit | נמוכה |

### D4 — LoansSummaryWidget (`src/components/dashboard/LoansSummaryWidget.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| D4.1 | סיכום הלוואות מוצג — total outstanding, monthly payment | Unit | בינונית |
| D4.2 | בזמן טעינה — skeleton מוצג | Unit | נמוכה |

### D5 — TopExpensesWidget (`src/components/dashboard/TopExpensesWidget.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| D5.1 | רשימת הוצאות מובילות מוצגת עם סכום וקטגוריה | Unit | בינונית |
| D5.2 | בזמן טעינה — skeleton מוצג | Unit | נמוכה |

---

## [E] Hooks מותאמים אישית

### E1 — useCountUp (`src/hooks/useCountUp.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| E1.1 | אנימציה מ-0 לערך היעד (target) תוך duration | Unit | בינונית |
| E1.2 | כש-target=0, הערך מוחזר מיידית ללא אנימציה | Unit | בינונית |
| E1.3 | כש-prefers-reduced-motion=reduce, הערך מוחזר מיידית | Unit | בינונית |
| E1.4 | שינוי target מפעיל אנימציה חדשה | Unit | בינונית |
| E1.5 | unmount מבטל requestAnimationFrame (ללא memory leak) | Unit | גבוהה |

### E2 — useCurrency (`src/hooks/useCurrency.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| E2.1 | ברירת מחדל ILS כשאין settings ב-cache | Unit | גבוהה |
| E2.2 | קורא currency מתוך React Query cache (settings) | Unit | גבוהה |
| E2.3 | formatAmount(1234.56) מחזיר סכום מעוצב עם מטבע ההגדרות | Unit | גבוהה |
| E2.4 | formatAmount(1234.56, 'USD') דורס את מטבע ההגדרות | Unit | גבוהה |

### E3 — useCursorGlow (`src/hooks/useCursorGlow.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| E3.1 | מחזיר ref ו-onMouseMove | Unit | נמוכה |
| E3.2 | onMouseMove מעדכן CSS custom properties (--mouse-x, --mouse-y) | Unit | נמוכה |

### E4 — useModalA11y (`src/hooks/useModalA11y.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| E4.1 | כש-isOpen=true, focus עובר לאלמנט הראשון הניתן למיקוד | Unit | גבוהה |
| E4.2 | focus trap — Tab ו-Shift+Tab מסתובבים בתוך ה-modal | Unit | גבוהה |
| E4.3 | Escape קורא ל-requestClose (עם אנימציית exit) | Unit | גבוהה |
| E4.4 | requestClose מסמן closing=true, ואחרי EXIT_DURATION (150ms) קורא ל-onClose | Unit | גבוהה |
| E4.5 | כש-prefers-reduced-motion, requestClose קורא ל-onClose מיידית | Unit | בינונית |
| E4.6 | בעת סגירה, focus חוזר לאלמנט הקודם (previousFocusRef) | Unit | גבוהה |
| E4.7 | unmount כש-isOpen משתנה מנקה טיימרים ומאפס closing | Unit | בינונית |

### E5 — usePeriodSelector (`src/hooks/usePeriodSelector.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| E5.1 | ברירת מחדל 1M כשאין search params | Unit | גבוהה |
| E5.2 | קריאת preset מ-search param "period" | Unit | גבוהה |
| E5.3 | CUSTOM preset קורא גם "from" ו-"to" מה-URL | Unit | גבוהה |
| E5.4 | setPeriod מעדכן search params עם replace | Unit | גבוהה |
| E5.5 | setPeriod עם CUSTOM שומר from ו-to ב-params | Unit | גבוהה |
| E5.6 | setPeriod עם preset רגיל מוחק from ו-to מה-params | Unit | בינונית |
| E5.7 | preset לא תקין חוזר לברירת מחדל 1M | Unit | בינונית |
| E5.8 | תאריך לא תקין ב-CUSTOM חוזר לברירת מחדל | Unit | בינונית |

### E6 — useScrollReveal (`src/hooks/useScrollReveal.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| E6.1 | מוסיף class "in-view" לאלמנטים עם .scroll-reveal כשנכנסים ל-viewport | Unit | נמוכה |
| E6.2 | כש-prefers-reduced-motion, כל האלמנטים מקבלים in-view מיידית | Unit | נמוכה |
| E6.3 | observer מתנתק ב-unmount (ללא memory leak) | Unit | בינונית |

---

## [F] Contexts / Providers

### F1 — AuthContext (`src/contexts/AuthContext.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| F1.1 | מצב ראשוני: user=null, isLoading=true, isAuthenticated=false | Unit | גבוהה |
| F1.2 | כשיש access_token ב-localStorage — קורא ל-getMe() ומעדכן user | Integration | גבוהה |
| F1.3 | כש-getMe() נכשל — מנקה טוקנים ומעמיד user=null | Integration | גבוהה |
| F1.4 | login() — שומר טוקנים ב-localStorage, קורא getMe(), מעדכן user | Integration | גבוהה |
| F1.5 | login() — מנקה sessionStorage('onboarding_completed') | Unit | בינונית |
| F1.6 | register() — שומר טוקנים, קורא getMe(), מעדכן user | Integration | גבוהה |
| F1.7 | logout() — מנקה localStorage (access_token, refresh_token), sessionStorage, user=null, queryClient.clear() | Unit | גבוהה |
| F1.8 | useAuth() מחוץ ל-AuthProvider זורק שגיאה | Unit | בינונית |
| F1.9 | isAuthenticated = user !== null — מתעדכן אוטומטית | Unit | בינונית |

### F2 — ThemeContext (`src/contexts/ThemeContext.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| F2.1 | מצב ראשוני: theme מ-localStorage, או 'system' כברירת מחדל | Unit | גבוהה |
| F2.2 | setTheme('dark') — מעדכן state ושומר ב-localStorage | Unit | גבוהה |
| F2.3 | setTheme('light') — מסיר class 'dark' מ-documentElement | Unit | גבוהה |
| F2.4 | setTheme('dark') — מוסיף class 'dark' ל-documentElement | Unit | גבוהה |
| F2.5 | theme='system' — resolvedTheme נקבע לפי matchMedia prefers-color-scheme | Unit | גבוהה |
| F2.6 | theme='system' — שינוי system preference מעדכן את הכיתה בזמן אמת | Integration | בינונית |
| F2.7 | useTheme() מחוץ ל-ThemeProvider זורק שגיאה | Unit | בינונית |
| F2.8 | resolvedTheme תמיד 'light' או 'dark' (לא 'system') | Unit | בינונית |

### F3 — ToastContext (`src/contexts/ToastContext.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| F3.1 | addToast() — מוסיף toast עם id ייחודי | Unit | גבוהה |
| F3.2 | removeToast() — מסיר toast לפי id ומנקה טיימר | Unit | גבוהה |
| F3.3 | auto-dismiss — toast מוסר אוטומטית אחרי duration (ברירת מחדל: success=4000, error=6000, warning=5000, info=4000) | Unit | גבוהה |
| F3.4 | MAX_VISIBLE=3 — הוספת toast רביעי מסיר את הישן ביותר | Unit | גבוהה |
| F3.5 | useToast() מחוץ ל-ToastProvider זורק שגיאה | Unit | בינונית |
| F3.6 | duration מותאם אישית דורס את ברירת המחדל | Unit | בינונית |

### F4 — OrganizationContext (`src/contexts/OrganizationContext.tsx`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| F4.1 | טוען רשימת ארגונים רק כשהמשתמש מאומת (enabled: isAuthenticated) | Integration | גבוהה |
| F4.2 | currentOrg נגזר מ-currentOrgId וממערך orgs | Unit | גבוהה |
| F4.3 | switchOrg(orgId) — קורא ל-API, מעדכן state, שומר ב-localStorage | Integration | גבוהה |
| F4.4 | switchOrg(null) — חוזר לתצוגה אישית, מוחק מ-localStorage | Integration | גבוהה |
| F4.5 | switchOrg מבטל (invalidate) את כל ה-queries הרלוונטיים (transactions, dashboard, forecast, balance, alerts, fixed, installments, loans, categories, subscriptions) | Integration | גבוהה |
| F4.6 | אם orgId שמור כבר לא תקף (משתמש הוסר מהארגון) — מאפס לאישי | Integration | בינונית |
| F4.7 | logout (isAuthenticated=false) — מנקה currentOrgId ו-localStorage | Integration | בינונית |
| F4.8 | isOrgView = currentOrg !== null | Unit | בינונית |
| F4.9 | useOrganization() מחוץ ל-Provider זורק שגיאה | Unit | בינונית |

### F5 — i18n

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| F5.1 | שפת ברירת מחדל: עברית (he) | Unit | גבוהה |
| F5.2 | שינוי ל-en — כל המפתחות מתורגמים | Unit | גבוהה |
| F5.3 | שינוי ל-he — כל המפתחות מתורגמים | Unit | גבוהה |
| F5.4 | שינוי שפה מעדכן dir=rtl/ltr על documentElement | Integration | גבוהה |
| F5.5 | שינוי שפה מעדכן lang attribute על documentElement | Integration | בינונית |
| F5.6 | קובצי תרגום en.json ו-he.json מכילים את אותם מפתחות | Unit | גבוהה |
| F5.7 | fallback — מפתח חסר מחזיר את המפתח עצמו (לא שגיאה) | Unit | נמוכה |

---

## [G] ספריות עזר (lib/utils)

### G1 — utils.ts (`src/lib/utils.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| G1.1 | cn() — ממזג class names עם clsx | Unit | בינונית |
| G1.2 | formatCurrency(1234.56, 'ILS') — מחזיר "1,234.56 ₪" (פורמט he-IL) | Unit | גבוהה |
| G1.3 | formatCurrency(1234.56, 'USD') — מחזיר "$1,234.56" (פורמט en-US) | Unit | גבוהה |
| G1.4 | formatCurrency(undefined) — מחזיר ערך ברירת מחדל (0 ILS) | Unit | גבוהה |
| G1.5 | formatCurrency('not-a-number') — מטפל ב-NaN ומחזיר 0 | Unit | בינונית |
| G1.6 | getCurrencySymbol('ILS')='₪', ('USD')='$', ('EUR')='€' | Unit | בינונית |
| G1.7 | getCurrencyFlag('ILS') מחזיר דגל ישראל | Unit | נמוכה |
| G1.8 | formatDate('2026-02-18', 'he-IL') מחזיר תאריך מעוצב בעברית | Unit | בינונית |
| G1.9 | formatDate(undefined) מחזיר מחרוזת ריקה | Unit | בינונית |
| G1.10 | formatDate('invalid-date') מחזיר מחרוזת ריקה | Unit | בינונית |

### G2 — queryKeys.ts (`src/lib/queryKeys.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| G2.1 | queryKeys.transactions.all מחזיר ['transactions'] | Unit | נמוכה |
| G2.2 | queryKeys.transactions.list({page:1}) מחזיר מערך עם הפרמטרים | Unit | נמוכה |
| G2.3 | queryKeys.dashboard.summary('2026-01','2026-02') כולל תאריכים | Unit | נמוכה |
| G2.4 | כל ה-query keys הם ייחודיים (אין התנגשויות) | Unit | בינונית |

### G3 — queryClient.ts (`src/lib/queryClient.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| G3.1 | staleTime = 5 דקות | Unit | נמוכה |
| G3.2 | retry = 1 | Unit | נמוכה |
| G3.3 | refetchOnWindowFocus = false | Unit | נמוכה |

### G4 — API Client (`src/api/client.ts`)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| G4.1 | Request interceptor מוסיף Authorization header עם token | Unit | גבוהה |
| G4.2 | getApiErrorMessage — שגיאת רשת (אין response) מחזיר networkError | Unit | גבוהה |
| G4.3 | getApiErrorMessage — 422 עם detail מערך מחזיר את ההודעה הראשונה (ללא prefix) | Unit | גבוהה |
| G4.4 | getApiErrorMessage — 404 עם detail string מחזיר את ה-detail | Unit | גבוהה |
| G4.5 | getApiErrorMessage — סטטוס ידוע (401,403,404,500) מחזיר מפתח תרגום | Unit | גבוהה |
| G4.6 | Response interceptor — 401 מפעיל refresh token ומנסה שוב | Integration | גבוהה |
| G4.7 | Response interceptor — 401 על auth endpoints לא מפעיל refresh | Integration | גבוהה |
| G4.8 | Response interceptor — refresh נכשל: מנקה טוקנים ומפנה ל-/login | Integration | גבוהה |

---

## [H] תרחישי E2E — זרימות משתמש מלאות

### H1 — Login -> Dashboard -> Transaction CRUD

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H1.1 | פתיחת /login — טופס מוצג עם שדות username ו-password | E2E | גבוהה |
| H1.2 | הזנת פרטים תקינים ולחיצת "התחבר" — הפניה ל-/dashboard | E2E | גבוהה |
| H1.3 | Dashboard מציג KPI cards (הכנסות, הוצאות, יתרה, תחזית) | E2E | גבוהה |
| H1.4 | ניווט ל-/transactions דרך Sidebar | E2E | גבוהה |
| H1.5 | לחיצה על "הוסף תנועה" — מודל יצירה נפתח | E2E | גבוהה |
| H1.6 | מילוי כל השדות (סכום, תאריך, קטגוריה, תיאור, סוג) ושמירה | E2E | גבוהה |
| H1.7 | התנועה החדשה מופיעה ברשימה | E2E | גבוהה |
| H1.8 | לחיצה על תנועה לעריכה — מודל עריכה נפתח עם הנתונים | E2E | גבוהה |
| H1.9 | שינוי סכום ושמירה — הערך המעודכן מוצג ברשימה | E2E | גבוהה |
| H1.10 | מחיקת התנועה — התנועה נעלמת מהרשימה | E2E | גבוהה |
| H1.11 | חזרה ל-Dashboard — KPIs מתעדכנים (cache invalidation) | E2E | גבוהה |

### H2 — Category -> Transaction -> Dashboard Breakdown

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H2.1 | ניווט ל-/categories | E2E | בינונית |
| H2.2 | יצירת קטגוריה חדשה עם שם, צבע ואייקון | E2E | גבוהה |
| H2.3 | הקטגוריה מופיעה ברשימה | E2E | גבוהה |
| H2.4 | ניווט ל-/transactions ויצירת תנועה עם הקטגוריה החדשה | E2E | גבוהה |
| H2.5 | חזרה ל-Dashboard — הקטגוריה מופיעה בפירוט לפי קטגוריות | E2E | גבוהה |
| H2.6 | ארכוב (archive) הקטגוריה — לא מופיעה ביצירת תנועה חדשה אך תנועות קיימות לא נפגעות | E2E | בינונית |

### H3 — Loan CRUD -> Payments -> Amortization -> Complete

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H3.1 | ניווט ל-/loans | E2E | בינונית |
| H3.2 | יצירת הלוואה חדשה (סכום, ריבית, מספר תשלומים, תאריך התחלה) | E2E | גבוהה |
| H3.3 | ההלוואה מופיעה ברשימה עם סטטוס "פעיל" | E2E | גבוהה |
| H3.4 | פתיחת פרטי הלוואה — לוח סילוקין (amortization) מוצג | E2E | גבוהה |
| H3.5 | רישום תשלום — יתרת ההלוואה מתעדכנת | E2E | גבוהה |
| H3.6 | אחרי כל התשלומים — סטטוס משתנה ל-"הושלם" | E2E | גבוהה |
| H3.7 | Dashboard — סיכום הלוואות מתעדכן | E2E | בינונית |

### H4 — Fixed Income -> Forecast -> Pause -> Verify

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H4.1 | ניווט ל-/fixed | E2E | בינונית |
| H4.2 | יצירת הכנסה קבועה חדשה (סכום, תדירות, תאריך התחלה) | E2E | גבוהה |
| H4.3 | ההכנסה הקבועה מופיעה ברשימה עם סטטוס "פעיל" | E2E | גבוהה |
| H4.4 | ניווט ל-/forecast — ההכנסה הקבועה משפיעה על התחזית | E2E | גבוהה |
| H4.5 | חזרה ל-/fixed — השהיית (pause) ההכנסה הקבועה | E2E | גבוהה |
| H4.6 | ניווט ל-/forecast — התחזית מתעדכנת ללא ההכנסה המושהית | E2E | גבוהה |
| H4.7 | חידוש (resume) ההכנסה הקבועה — התחזית חוזרת למצבה הקודם | E2E | בינונית |

### H5 — Installment -> Track Payments -> Progress

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H5.1 | ניווט ל-/installments | E2E | בינונית |
| H5.2 | יצירת תשלום בפריסה חדש (סכום כולל, מספר תשלומים, תאריך התחלה) | E2E | גבוהה |
| H5.3 | פריסה מופיעה ברשימה עם פס התקדמות 0% | E2E | גבוהה |
| H5.4 | סימון תשלום כ-"שולם" — פס התקדמות מתעדכן | E2E | גבוהה |
| H5.5 | לוח תשלומים (payment schedule) מציג את כל התשלומים עם תאריכים | E2E | בינונית |
| H5.6 | אחרי כל התשלומים — סטטוס משתנה ל-"הושלם" ופס התקדמות 100% | E2E | גבוהה |

### H6 — Organization: Create -> Add Member -> Switch -> Data Isolation

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H6.1 | ניווט ל-/organizations | E2E | בינונית |
| H6.2 | יצירת ארגון חדש עם שם | E2E | גבוהה |
| H6.3 | הארגון מופיע ברשימה | E2E | גבוהה |
| H6.4 | הוספת חבר לארגון (הזמנה) | E2E | בינונית |
| H6.5 | מעבר לארגון דרך OrgSwitcher — toast מוצג "עברת לארגון X" | E2E | גבוהה |
| H6.6 | Dashboard מציג נתוני ארגון (ריק אם חדש) | E2E | גבוהה |
| H6.7 | יצירת תנועה בתצוגת ארגון — התנועה שייכת לארגון | E2E | גבוהה |
| H6.8 | מעבר חזרה לאישי — התנועה של הארגון לא מוצגת | E2E | גבוהה |
| H6.9 | ווידוא שנתונים אישיים קודמים עדיין קיימים | E2E | גבוהה |
| H6.10 | באנר ארגון מוצג ב-AppLayout כש-isOrgView=true | E2E | בינונית |

### H7 — Settings: Theme -> Language -> Persistence

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H7.1 | ניווט ל-/settings | E2E | בינונית |
| H7.2 | שינוי ערכת נושא ל-dark — ה-UI משתנה מיידית | E2E | גבוהה |
| H7.3 | רענון הדף — ערכת נושא dark נשמרה | E2E | גבוהה |
| H7.4 | שינוי שפה ל-English — כל הטקסטים משתנים, כיוון LTR | E2E | גבוהה |
| H7.5 | רענון הדף — שפה אנגלית נשמרה | E2E | גבוהה |
| H7.6 | שינוי מטבע ברירת מחדל ל-USD — כל הסכומים מוצגים ב-$ | E2E | גבוהה |
| H7.7 | חזרה ל-theme=system — מתחשב ב-system preference | E2E | בינונית |
| H7.8 | שינוי הגדרות auto-save (ללא כפתור שמירה) — toast הצלחה | E2E | בינונית |

### H8 — Forecast: View -> What-If -> Verify Changes

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H8.1 | ניווט ל-/forecast | E2E | בינונית |
| H8.2 | תחזית חודשית מוצגת עם גרף | E2E | גבוהה |
| H8.3 | מעבר לתצוגה שבועית — הגרף מתעדכן | E2E | בינונית |
| H8.4 | מעבר לתצוגת סיכום — סיכום חודשי מוצג | E2E | בינונית |
| H8.5 | שינוי PeriodSelector (3M, 6M, 1Y) — טווח התחזית משתנה | E2E | גבוהה |
| H8.6 | CUSTOM period — בחירת תאריכים ידנית מעדכנת תחזית | E2E | בינונית |
| H8.7 | חזרה ל-/fixed ויצירת הוצאה קבועה → חזרה ל-forecast → גרף מתעדכן | E2E | גבוהה |
| H8.8 | URL search params משקפים את ה-period הנבחר | E2E | בינונית |

### H9 — Alerts: Generate -> View -> Mark Read -> Dismiss

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H9.1 | ניווט ל-/alerts | E2E | בינונית |
| H9.2 | התראות מוצגות עם severity (info, warning, critical) | E2E | גבוהה |
| H9.3 | סינון לפי severity — רק ההתראות המתאימות מוצגות | E2E | בינונית |
| H9.4 | סימון התראה כנקראה — מספר ה-unread ב-DesktopHeader יורד | E2E | גבוהה |
| H9.5 | ביטול (dismiss) התראה — נעלמת מהרשימה | E2E | גבוהה |
| H9.6 | badge התראות ב-Sidebar מתעדכן אחרי mark read | E2E | בינונית |
| H9.7 | יצירת מצב תזרים שלילי → בדיקה שהתראה אוטומטית נוצרה | E2E | גבוהה |

### H10 — Balance: Set -> Dashboard -> Forecast

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| H10.1 | ניווט ל-/balance | E2E | בינונית |
| H10.2 | הגדרת יתרת פתיחה (סכום + תאריך) | E2E | גבוהה |
| H10.3 | כרטיס יתרה נוכחית מציג את הסכום | E2E | גבוהה |
| H10.4 | גרף היסטוריית יתרות מוצג | E2E | בינונית |
| H10.5 | ניווט ל-/dashboard — KPI יתרה מציג את הערך שהוגדר | E2E | גבוהה |
| H10.6 | ניווט ל-/forecast — התחזית מתחילה מהיתרה שהוגדרה | E2E | גבוהה |
| H10.7 | עדכון יתרה → חזרה ל-dashboard → ערך מתעדכן | E2E | גבוהה |

---

## [I] בדיקות חוצות (Cross-cutting)

### I1 — טיפול בשגיאות API

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| I1.1 | 401 Unauthorized — redirect ל-/login אחרי ניסיון refresh | E2E | גבוהה |
| I1.2 | 401 על auth endpoints (login/register) — לא מפעיל refresh, מציג שגיאה | Integration | גבוהה |
| I1.3 | 403 Forbidden — toast שגיאה עם הודעה מתאימה | Integration | גבוהה |
| I1.4 | 404 Not Found — toast או עמוד שגיאה מתאים | Integration | גבוהה |
| I1.5 | 422 Validation Error — הודעת שגיאה מפורטת מ-Pydantic | Integration | גבוהה |
| I1.6 | 500 Server Error — toast שגיאה כללית | Integration | גבוהה |
| I1.7 | Network Error (אין חיבור) — toast "שגיאת רשת" | Integration | גבוהה |
| I1.8 | Token refresh מוצלח — הבקשה המקורית נשלחת שוב שקוף למשתמש | Integration | גבוהה |
| I1.9 | Token refresh נכשל — ניקוי טוקנים והפניה ל-/login | Integration | גבוהה |

### I2 — ביטול Cache אחרי Mutations

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| I2.1 | אחרי יצירת transaction — רשימת transactions מתרעננת | Integration | גבוהה |
| I2.2 | אחרי עדכון transaction — item ספציפי מתרענן | Integration | גבוהה |
| I2.3 | אחרי מחיקת transaction — רשימה מתרעננת, dashboard מתעדכן | Integration | גבוהה |
| I2.4 | אחרי switchOrg — כל ה-queries מתבטלים ומתרעננים (10 domains) | Integration | גבוהה |
| I2.5 | logout — queryClient.clear() מנקה הכל | Unit | גבוהה |
| I2.6 | staleTime 5 דקות — בקשה חוזרת תוך 5 דקות מגיעה מ-cache | Integration | בינונית |

### I3 — בקשות מקביליות (Concurrent)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| I3.1 | Dashboard טוען מספר widgets במקביל — כולם מגיבים | Integration | בינונית |
| I3.2 | ניווט מהיר בין דפים — בקשות קודמות לא גורמות לבעיות | Integration | בינונית |
| I3.3 | Double-click על submit — מניעת שליחה כפולה | E2E | גבוהה |
| I3.4 | Race condition — switchOrg בזמן שבקשה עדיין פנדינג | Integration | בינונית |

### I4 — Bundle Size ו-Lazy Loading

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| I4.1 | דפים נטענים ב-lazy loading (React.lazy) | Performance | בינונית |
| I4.2 | ניווט לדף — chunk נטען דינמית | Performance | בינונית |
| I4.3 | גודל bundle ראשוני לא חורג מסף מוגדר (TBD) | Performance | נמוכה |
| I4.4 | Recharts נטען רק כש-chart component מרונדר | Performance | נמוכה |

### I5 — נגישות (Accessibility)

| # | תיאור הבדיקה | סוג | עדיפות |
|---|-------------|------|--------|
| I5.1 | ניווט מקלדת — Tab מעביר בין אלמנטים אינטראקטיביים בסדר הגיוני | E2E | גבוהה |
| I5.2 | Skip-to-content link — Tab מהתחלה מגיע ל-skip link, Enter מעביר לתוכן | E2E | בינונית |
| I5.3 | כל הכפתורים והאייקונים מכילים aria-label | Unit | גבוהה |
| I5.4 | מודלים — focus trap פעיל, Escape סוגר, focus חוזר | E2E | גבוהה |
| I5.5 | Toasts — role="status" ו-aria-live="polite" | Unit | בינונית |
| I5.6 | טפסים — labels מקושרים ל-inputs (htmlFor/id), שגיאות עם aria-describedby | E2E | גבוהה |
| I5.7 | prefers-reduced-motion — אנימציות מבוטלות/מופחתות | Unit | בינונית |
| I5.8 | ניגודיות צבעים — WCAG AA לפחות על טקסט ראשי | Visual | בינונית |
| I5.9 | כיוון RTL — כל הרכיבים נכונים ויזואלית בעברית | Visual | גבוהה |
| I5.10 | DesktopHeader dropdown — ניתן לפתיחה וסגירה במקלדת | E2E | בינונית |

---

## [J] סיכום כללי

### סיכום לפי קטגוריה

| קטגוריה | סעיף | מספר בדיקות |
|---------|------|-------------|
| **[A] Layout** | A1-A5 | 44 |
| **[B] UI משותפים** | B1-B5 | 30 |
| **[C] רכיבים כלליים** | C1-C6 | 38 |
| **[D] Dashboard Widgets** | D1-D5 | 14 |
| **[E] Hooks** | E1-E6 | 27 |
| **[F] Contexts/Providers** | F1-F5 | 36 |
| **[G] ספריות עזר** | G1-G4 | 21 |
| **[H] E2E Flows** | H1-H10 | 69 |
| **[I] Cross-cutting** | I1-I5 | 28 |

### סה"כ בדיקות: 307

### סיכום לפי סוג

| סוג בדיקה | כמות |
|-----------|------|
| Unit | ~150 |
| Integration | ~80 |
| E2E | ~65 |
| Performance | ~4 |
| Visual | ~8 |

### סיכום לפי עדיפות

| עדיפות | כמות |
|--------|------|
| גבוהה | ~155 |
| בינונית | ~115 |
| נמוכה | ~37 |

### המלצות ליישום

1. **שלב 1 (Week 1-2):** Unit tests לכל ה-Contexts, Hooks, ו-utils — בסיס יציב
2. **שלב 2 (Week 2-3):** Unit + Integration tests לרכיבים משותפים (Layout, UI, Toast, ErrorBoundary)
3. **שלב 3 (Week 3-4):** E2E flows בעדיפות גבוהה (H1 Transaction CRUD, H6 Org Isolation, H7 Settings)
4. **שלב 4 (Week 4+):** E2E flows נוספים, נגישות, performance

### כלים מומלצים

| כלי | שימוש |
|-----|-------|
| Vitest | Unit + Integration tests |
| React Testing Library | Component testing |
| MSW (Mock Service Worker) | API mocking |
| Playwright | E2E tests |
| axe-core | Accessibility audits |
| Lighthouse CI | Performance budgets |

---

> נוצר אוטומטית על ידי QA Architect Agent | 18/02/2026
