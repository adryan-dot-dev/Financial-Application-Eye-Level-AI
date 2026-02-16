# Frontend Design Prompt - Cash Flow Management App

> **הוראות שימוש:**
> 1. העתק את כל מה שמתחת לקו `---` (כולל הקו)
> 2. פתח סשן חדש של Claude Code בתיקיית הפרויקט
> 3. הדבק את הפרומפט
> 4. גרור לצ'אט את צילומי המסך של הרפרנסים (Rentax + Fretnex)
> 5. שלח

---

אתה מעצב Frontend בכיר עם ניסיון ב-fintech. השתמש ב-frontend-design skill.
קרא את `.claude/skills/frontend-design/SKILL.md` לפני שאתה מתחיל.

## הפרויקט

אפליקציית **Cash Flow Management** (ניהול תזרים מזומנים) בעברית ואנגלית.
אפליקציית fintech מלאה: הכנסות, הוצאות, הלוואות, תשלומים קבועים, צפי תזרים, התראות, דשבורד.
קהל יעד: בעלי עסקים ישראליים. שפה ראשית: עברית (RTL). שפה משנית: אנגלית (LTR).

## Tech Stack - לא לשנות!

- React 19 + TypeScript 5.9 + Vite 7
- Tailwind CSS v4 (`@theme` directive ב-`index.css`)
- React Query (TanStack Query) - server state
- Recharts - גרפים
- lucide-react - אייקונים
- i18next - עברית (default, RTL) + אנגלית (LTR)
- CSS custom properties ב-`index.css` = ה-design system
- ThemeContext: light / dark / system
- AuthContext: JWT tokens
- `@/` = path alias ל-`src/`
- `verbatimModuleSyntax: true` - use `import type` for type-only imports

## כללי ברזל

1. **לוגיקה עסקית** - useQuery, useMutation, API calls = לא לגעת
2. **Contexts** - AuthContext, ThemeContext, ToastContext = לא לגעת
3. **Routing** - router.tsx = לא לגעת
4. **Types** - types/index.ts = לא לגעת (אלא אם צריך שדה UI)
5. **RTL + LTR** - כל שינוי חייב לעבוד מושלם בשתי השפות (ראה סקשן RTL למטה)
6. **Dark + Light mode** - כל שינוי חייב לעבוד בשני המצבים
7. **i18n** - כל טקסט למשתמש עובר דרך `t()`. אף פעם hardcoded text
8. **Mobile responsive** - כל עמוד עובד גם במובייל
9. **Accessibility** - focus states, ARIA labels, semantic HTML, prefers-reduced-motion
10. **index.css = design system** - עדכן tokens שם, לא inline styles

## רפרנס עיצובי

אני מצרף צילומי מסך של שני אתרים שאני אוהב את הסגנון שלהם. תפיק מהם את עקרונות העיצוב:

### Rentax (אפליקציית חשבונאות נדל"ן)
מה אני אוהב:
- **רקע בהיר ונקי** עם הרבה white space
- **כרטיסי features** עם אייקונים צבעוניים בעיגולים + כותרת + תיאור
- **טבלת transactions** נקייה: rows מרווחים, status badges צבעוניים (COMPLETE ירוק, PENDING כתום)
- **Sidebar** מינימלי עם אייקונים בלבד + labels
- **Donut chart** לסיכום עם legend נקי (Revenue, Income, Expense)
- **פאלטה**: סגול-כחול כ-accent, ירוק ל-CTA, הרבה לבן ואפור בהיר

### Fretnex (דשבורד logistics פיננסי)
מה אני אוהב:
- **Typography מרשימה**: כותרות גדולות ובולדות, מספרים ענקיים (30%, $700K)
- **כרטיסים expandable** עם accordion - שם + סכום + status badge + chevron
- **Financial Insights chart**: קו גרף אלגנטי עם tooltip בולט (עיגול + label)
- **Status badges**: Active = כחול-כהה מלא, Pending = אפור pill
- **Progress bars** עם צבעים שונים לכל סטטוס (Pending/In progress/Completed)
- **פאלטה**: navy-blue כהה + cream/beige רקע, coral/salmon accents
- **Spacious layout**: הרבה מרחב נשימה בין אלמנטים
- **Metadata pills**: תגיות אפורות עגולות (ID, אחוז, מיקום, תאריך)

### סינתזה - מה לקחת משני הרפרנסים

| אלמנט | מה ליישם |
|--------|----------|
| **Cards** | כרטיסים נקיים עם צלליות עדינות, הרבה padding פנימי, hover lift עדין |
| **Typography** | מספרים פיננסיים גדולים ובולדים (JetBrains Mono), כותרות חדות |
| **Status Badges** | Pills מעוגלים: Active=ירוק/כחול מלא, Pending=אפור, Completed=ירוק בהיר |
| **Tables** | Rows מרווחים, zebra striping עדין מאוד, status badges inline |
| **Charts** | קווים אלגנטיים, tooltips בולטים עם עיגול, gradient fill עדין |
| **Spacing** | הרבה white space, מרחב נשימה, לא עמוס |
| **Colors** | brand blue/purple כ-accent על רקע בהיר ונקי, semantic colors (ירוק/אדום) |
| **Icons** | אייקונים בעיגולים צבעוניים, pastel backgrounds |
| **Progress** | bars עם gradient או multi-color לפי סטטוס |
| **Expandable** | Accordion-style cards עם smooth animation |

## RTL/LTR - דו-לשוניות (קריטי!)

האפליקציה עובדת בעברית (RTL) ואנגלית (LTR). כל שינוי חייב לעבוד בשתי השפות.

### כללים:

1. **CSS Logical Properties בלבד** - לעולם לא `left/right/margin-left/margin-right/padding-left/padding-right`
   - `margin-inline-start` במקום `margin-left`
   - `padding-inline-end` במקום `padding-right`
   - `inset-inline-start` במקום `left`
   - Tailwind: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-` (לא `ml-`, `mr-`, `pl-`, `pr-`)

2. **אייקוני כיוון** - חצים ו-chevrons חייבים להתהפך:
   ```typescript
   const ChevronIcon = isRtl ? ChevronLeft : ChevronRight
   ```

3. **Recharts** - גרפים תמיד עטופים ב-`dir="ltr"` (כבר קיים, לא לשנות).
   מספרים ב-tooltips: השתמש ב-class `ltr-nums` שקיים ב-index.css

4. **Border directional** - `border-inline-start` במקום `border-left` (למשל color indicator על cards)

5. **Animations** - slide animations צריכים להיות direction-aware:
   ```css
   [dir="rtl"] .slide-in { transform: translateX(20px); }   /* הפוך */
   [dir="ltr"] .slide-in { transform: translateX(-20px); }
   ```

6. **Text alignment** - `text-start` / `text-end` (לא `text-left` / `text-right`)

### באגי RTL קיימים - לתקן!

1. **index.css tooltip** - `.tooltip-wrap::after` משתמש ב-`left: 50%` hardcoded
   → שנה ל-`inset-inline-start: 50%`

2. **index.css onboarding background** - `.onboarding-bg-decoration` משתמש ב-`left: -25%`
   → שנה ל-`inset-inline-start: -25%`

3. **Recharts tooltip numbers** - בדוק שמספרים ב-tooltips מיושרים נכון ב-RTL
   → וודא שיש `ltr-nums` class על כל מספר פיננסי

## מה לשפר - עמוד אחרי עמוד

### 1. index.css - Design System (ראשון! הבסיס של הכל)

עדכן את ה-design tokens לפני כל שאר העמודים:

- **Brand gradient**: הגדר CSS variable: `--gradient-brand: linear-gradient(135deg, #06B6D4, #3B82F6, #8B5CF6, #EC4899)`
- **Shadows**: scale מדורג - xs (subtle), sm, md, lg, xl (dramatic). רכים, לא harsh
- **Border radius**: scale אחיד - sm(6px), md(10px), lg(14px), xl(20px), full
- **Animation durations**: `--duration-fast: 150ms`, `--duration-normal: 300ms`, `--duration-slow: 500ms`
- **Focus states**: global `focus-visible` ring - brand color, 2px offset, subtle glow
- **Cards**: `.card` class - white bg, subtle shadow, border, hover:lift+shadow, smooth transition
- **Buttons**: `.btn-primary` (brand gradient + white text + hover glow), `.btn-secondary`, `.btn-ghost`
- **Inputs**: `.input` class - clean border, focus:brand glow, error:red border+bg, disabled:gray
- **Modal**: `.modal-backdrop` blur(8px)+fade, `.modal-panel` scale+fade entrance
- **Badges**: `.badge-active`(ירוק), `.badge-pending`(אפור/צהוב), `.badge-completed`(כחול)
- **Skeleton**: shimmer animation יותר organic וטבעי
- **תקן RTL bugs**: tooltip `left:50%` → `inset-inline-start:50%`, onboarding decoration
- כל `left/right` hardcoded → `inset-inline-start/end`

### 2. Sidebar.tsx (ניווט ראשי)

כמו Rentax sidebar - מינימלי, אלגנטי:
- Active item: background glow עדין + indicator bar בולט בצד (inline-end)
- Hover: smooth bg transition (200ms), לא רק opacity
- Groups: headers קטנים באפור עם separator עדין
- Collapsed tooltips: styled tooltips (לא browser native), pill shape
- Logo area: clean, centered, אולי עם gradient border-bottom עדין
- Logout: icon בלבד, subtle, tooltip on hover

### 3. LoginPage.tsx + RegisterPage.tsx (רושם ראשוני)

- Brand panel (שמאל ב-LTR, ימין ב-RTL): animated gradient mesh, לא צבע שטוח
- Form: staggered fade-in animation (כל input מופיע 100ms אחרי הקודם)
- Inputs: large, rounded, clean border, icon inside, floating label on focus
- Submit button: full-width, brand gradient, hover scale(1.02) + shadow
- Error: shake animation + red border + fade-in message
- Language toggle + theme toggle בפינה (כבר קיימים - רק לשפר styling)
- Logo: centered, large, with subtle shadow

### 4. DashboardPage.tsx (העמוד המרכזי)

בהשראת Fretnex dashboard:
- **KPI Cards**: הכרטיס הראשי (יתרה) = גדול ובולט עם brand gradient subtle bg. השאר 3 = קטנים יותר
- **מספרים**: ענקיים, bold, JetBrains Mono. trend arrow + אחוז בולט (כמו ה-30% של Fretnex)
- **Monthly chart**: קו אלגנטי עם gradient fill, tooltip עם bullet + label (כמו Fretnex)
- **Widget cards**: כמו Rentax feature cards - אייקון בעיגול צבעוני + כותרת + תוכן
- **Financial Health**: gauge/ring chart ויזואלי עם אחוז במרכז
- **Alerts panel**: severity = border-inline-start צבעוני (כחול/צהוב/אדום)
- **Quick Actions**: כפתורים עם אייקונים, hover background subtle
- **Loading**: skeleton שמתאים לצורת הכרטיסים

### 5. TransactionsPage.tsx (הכי בשימוש)

בהשראת Rentax transactions table:
- **Table**: clean rows, generous padding, hover row highlight עדין
- **Amount**: JetBrains Mono, bold. ירוק להכנסה עם חץ למעלה, אדום להוצאה עם חץ למטה
- **Status/Type badges**: pills מעוגלים כמו Fretnex (Active/Pending style)
- **Filters**: compact bar עם pill-shaped active filter chips
- **Category badge**: אייקון + צבע circle (כמו שכבר יש, רק לשפר)
- **Modals**: backdrop blur, scale-in animation, form inputs premium
- **Pagination**: minimal, clear
- **Empty state**: illustration-style icon + message + CTA button
- **Bulk actions**: sticky bottom bar, prominent but not aggressive

### 6. FixedPage.tsx (הכנסות/הוצאות קבועות)

- Cards עם `border-inline-start` צבעוני: ירוק=הכנסה, אדום=הוצאה (4px solid)
- Pause/Resume: animated toggle switch
- Day of month: calendar-style badge (מספר בתוך ריבוע מעוגל)
- Card grid: consistent gap, hover lift, expand for details (accordion כמו Fretnex)

### 7. InstallmentsPage.tsx (תשלומים)

- **Progress bar**: animated fill, gradient, אחוז מוצג מעל
- **Payment timeline**: stepper/timeline ויזואלי עם dots + lines (לא טבלה שטוחה)
- **Cards**: expandable accordion כמו Fretnex (שם + סכום + badge + chevron)
- **Completed payments**: checkmark, muted styling

### 8. LoansPage.tsx (הלוואות)

- **Status badges**: Active = dark pill, Completed = green pill, Paused = amber pill (כמו Fretnex)
- **Payment progress**: mini donut/ring בכל כרטיס
- **Metadata pills**: אפור מעוגל עם info (ריבית, תאריך, מספר תשלום) כמו Fretnex
- **Amortization**: expandable section עם visual breakdown
- **Cards**: accordion-style expand/collapse

### 9. CategoriesPage.tsx

- Color picker: grid 6x4 של עיגולים צבעוניים, selected = ring + checkmark
- Icon picker: grid מסודר, selected = bg highlight
- Category preview: real-time preview של אייקון+צבע בכרטיס
- Archived: section נפרד, dimmed (opacity 0.6), clear "ארכיון" header

### 10. ForecastPage.tsx (צפי)

- Area chart: gradient fill מתחת לקו (brand blue fading to transparent)
- Negative forecast zone: red gradient fill
- Tabs: segment control מלוטש עם sliding active indicator
- Summary cards: compact, icon בעיגול + number bold + label small
- Tooltip on chart: prominent, rounded, shadow

### 11. BalancePage.tsx

- Hero card: large centered card, brand gradient border or subtle bg
- Balance number: extra large, JetBrains Mono, bold
- History chart: interactive line chart, hover crosshair + tooltip
- Update: inline edit button, modal only if needed

### 12. AlertsPage.tsx

- Severity border: border-inline-start 4px (info=blue, warning=amber, critical=red)
- Unread: bold text + dot indicator
- Dismiss: fade-out + slide animation (300ms)
- Empty state: happy illustration, "אין התראות" celebration

### 13. SettingsPage.tsx

- Theme: visual toggle, dark/light/system with icons
- Language: toggle button with he/en labels
- Sections: grouped in cards with clear titles
- Auto-save: subtle checkmark animation on change

### 14. OnboardingPage.tsx

- Step transitions: direction-aware slide (RTL-aware!)
- Progress: horizontal stepper bar with labels (not just dots)
- Each step: large icon/illustration + clear instruction
- Buttons: brand gradient, large, prominent
- Completion: celebration animation (confetti, already exists - polish it)

## סדר עבודה

עבוד בסדר הזה, עמוד אחרי עמוד:

```
1. index.css          ← Design tokens + RTL fixes (הבסיס!)
2. Sidebar.tsx        ← ניווט ראשי
3. LoginPage.tsx      ← רושם ראשוני
4. RegisterPage.tsx   ← המשך auth flow
5. DashboardPage.tsx  ← העמוד המרכזי
6. TransactionsPage   ← הכי בשימוש
7. FixedPage          ← הכנסות/הוצאות קבועות
8. InstallmentsPage   ← תשלומים
9. LoansPage          ← הלוואות
10. ForecastPage      ← צפי
11. BalancePage       ← יתרה
12. CategoriesPage    ← קטגוריות
13. AlertsPage        ← התראות
14. SettingsPage      ← הגדרות
15. OnboardingPage    ← onboarding (אחרון כי נבדק רק פעם ראשונה)
```

**אחרי כל עמוד**:
1. תגיד "סיימתי [שם העמוד]" כדי שאבדוק בדפדפן
2. תן סיכום קצר של מה שינית
3. חכה לפידבק שלי לפני שאתה ממשיך לעמוד הבא

## בדיקות שאתה חייב לעשות אחרי כל שינוי

לפני שאתה אומר "סיימתי", וודא:
- [ ] Light mode - נראה טוב?
- [ ] Dark mode - נראה טוב?
- [ ] עברית (RTL) - layout לא שבור? טקסט מיושר נכון?
- [ ] אנגלית (LTR) - layout עובד? ניווט בצד הנכון?
- [ ] Mobile (< 768px) - responsive, לא חתוך?
- [ ] מספרים פיננסיים - `ltr-nums` class, מיושרים נכון ב-RTL?
- [ ] אנימציות - חלקות, לא קופצות?
- [ ] Hover states - עובדים על כל אלמנט אינטראקטיבי?

---

> **END OF PROMPT**
