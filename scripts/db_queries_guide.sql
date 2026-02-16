-- ==============================================
-- מדריך שאילתות pgAdmin - CashFlow Management
-- ==============================================
-- העתק והדבק שאילתות אלו ב-Query Tool של pgAdmin
-- (לחץ על Tools → Query Tool בתפריט העליון)
--
-- כל שאילתה עומדת בפני עצמה - אפשר להריץ כל אחת בנפרד.
-- סמן את השאילתה שאתה רוצה להריץ ולחץ F5 (או כפתור ▶ Run)

-- ============================================
-- 1. סקירה כללית - כמה רשומות יש בכל טבלה
-- ============================================
SELECT 'משתמשים' as "טבלה", count(*) as "כמות" FROM users
UNION ALL SELECT 'הגדרות', count(*) FROM settings
UNION ALL SELECT 'קטגוריות', count(*) FROM categories
UNION ALL SELECT 'תנועות', count(*) FROM transactions
UNION ALL SELECT 'הוצאות/הכנסות קבועות', count(*) FROM fixed_income_expenses
UNION ALL SELECT 'תשלומים', count(*) FROM installments
UNION ALL SELECT 'הלוואות', count(*) FROM loans
UNION ALL SELECT 'יתרות בנק', count(*) FROM bank_balances
UNION ALL SELECT 'התראות', count(*) FROM alerts
UNION ALL SELECT 'הכנסות צפויות', count(*) FROM expected_income
ORDER BY "כמות" DESC;

-- ============================================
-- 2. בדיקת משתמש חדש - האם נרשם בהצלחה?
-- (אחרי שמישהו נרשם, הריצו את זה)
-- ============================================
SELECT 
  u.username as "שם משתמש",
  u.email as "אימייל", 
  u.full_name as "שם מלא",
  u.is_admin as "מנהל?",
  u.created_at as "תאריך הרשמה",
  CASE WHEN s.id IS NOT NULL THEN 'כן' ELSE 'לא' END as "יש הגדרות?",
  CASE WHEN s.onboarding_completed THEN 'כן' ELSE 'לא' END as "סיים אונבורדינג?"
FROM users u
LEFT JOIN settings s ON u.id = s.user_id
ORDER BY u.created_at DESC;

-- ============================================
-- 3. בדיקת תנועות של משתמש מסוים
-- (שנו את שם המשתמש בשורה האחרונה)
-- ============================================
SELECT 
  t.date as "תאריך",
  t.type as "סוג",
  t.amount as "סכום",
  t.currency as "מטבע",
  c.name as "קטגוריה",
  t.description as "תיאור",
  t.entry_pattern as "סוג רשומה"
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
JOIN users u ON t.user_id = u.id
WHERE u.username = 'demo_user'  -- <-- שנה את שם המשתמש כאן
ORDER BY t.date DESC;

-- ============================================
-- 4. סיכום הכנסות/הוצאות לפי חודש
-- ============================================
SELECT 
  to_char(date, 'YYYY-MM') as "חודש",
  type as "סוג",
  count(*) as "מספר תנועות",
  sum(amount) as "סכום כולל",
  round(avg(amount), 2) as "ממוצע"
FROM transactions
GROUP BY to_char(date, 'YYYY-MM'), type
ORDER BY "חודש" DESC, type;

-- ============================================
-- 5. הוצאות/הכנסות קבועות פעילות
-- ============================================
SELECT
  fe.name as "שם",
  fe.type as "סוג",
  fe.amount as "סכום",
  fe.currency as "מטבע",
  fe.day_of_month as "יום בחודש",
  fe.is_active as "פעיל?",
  fe.start_date as "תאריך התחלה",
  fe.end_date as "תאריך סיום",
  u.username as "משתמש"
FROM fixed_income_expenses fe
JOIN users u ON fe.user_id = u.id
WHERE fe.is_active = true
ORDER BY fe.type, fe.day_of_month;

-- ============================================
-- 6. מצב תשלומים (Installments)
-- ============================================
SELECT
  i.name as "שם",
  i.total_amount as "סכום כולל",
  i.monthly_amount as "תשלום חודשי",
  i.currency as "מטבע",
  i.number_of_payments as "סה""כ תשלומים",
  i.payments_completed as "תשלומים שבוצעו",
  (i.number_of_payments - i.payments_completed) as "תשלומים שנותרו",
  i.type as "סוג",
  i.start_date as "תאריך התחלה",
  u.username as "משתמש"
FROM installments i
JOIN users u ON i.user_id = u.id
ORDER BY i.start_date DESC;

-- ============================================
-- 7. מצב הלוואות
-- ============================================
SELECT
  l.name as "שם",
  l.original_amount as "סכום מקורי",
  l.monthly_payment as "תשלום חודשי",
  l.currency as "מטבע",
  l.interest_rate as "ריבית %",
  l.total_payments as "סה""כ תשלומים",
  l.payments_made as "תשלומים שבוצעו",
  l.remaining_balance as "יתרה",
  l.status as "סטטוס",
  l.start_date as "תאריך התחלה",
  u.username as "משתמש"
FROM loans l
JOIN users u ON l.user_id = u.id
ORDER BY l.start_date DESC;

-- ============================================
-- 8. יתרת בנק נוכחית
-- ============================================
SELECT 
  bb.balance as "יתרה",
  bb.currency as "מטבע",
  bb.effective_date as "תאריך",
  bb.is_current as "נוכחי?",
  bb.notes as "הערות",
  u.username as "משתמש"
FROM bank_balances bb
JOIN users u ON bb.user_id = u.id
ORDER BY bb.effective_date DESC;

-- ============================================
-- 9. קטגוריות פעילות
-- ============================================
SELECT 
  name as "שם (EN)",
  name_he as "שם (HE)",
  type as "סוג",
  icon as "אייקון",
  color as "צבע",
  is_archived as "בארכיון?",
  display_order as "סדר תצוגה"
FROM categories
ORDER BY type, display_order;

-- ============================================
-- 10. התראות אחרונות
-- ============================================
SELECT
  a.title as "כותרת",
  a.alert_type as "סוג התראה",
  a.severity as "חומרה",
  a.message as "הודעה",
  a.is_read as "נקרא?",
  a.is_dismissed as "נדחה?",
  a.created_at as "תאריך",
  u.username as "משתמש"
FROM alerts a
JOIN users u ON a.user_id = u.id
ORDER BY a.created_at DESC
LIMIT 20;

-- ============================================
-- 11. הכנסות צפויות
-- ============================================
SELECT
  ei.month as "חודש",
  ei.expected_amount as "סכום צפוי",
  ei.notes as "הערות",
  u.username as "משתמש"
FROM expected_income ei
JOIN users u ON ei.user_id = u.id
ORDER BY ei.month DESC;

-- ============================================
-- 12. בדיקת בריאות DB - אינדקסים
-- ============================================
SELECT 
  tablename as "טבלה",
  indexname as "אינדקס",
  indexdef as "הגדרה"
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- ============================================
-- 13. בדיקת בריאות DB - constraints
-- ============================================
SELECT 
  tc.table_name as "טבלה",
  tc.constraint_name as "שם constraint",
  tc.constraint_type as "סוג"
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- ============================================
-- 14. גודל הטבלאות
-- ============================================
SELECT 
  relname as "טבלה",
  pg_size_pretty(pg_total_relation_size(relid)) as "גודל כולל",
  n_live_tup as "שורות חיות"
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- ============================================
-- 15. בדיקה: האם יש משתמשים בלי הגדרות?
-- (זה לא אמור לקרות - אם יש, זה באג!)
-- ============================================
SELECT 
  u.username as "משתמש ללא הגדרות",
  u.email as "אימייל",
  u.created_at as "תאריך הרשמה"
FROM users u
LEFT JOIN settings s ON u.id = s.user_id
WHERE s.id IS NULL;

-- ============================================
-- 16. בדיקה: תנועות ללא קטגוריה
-- ============================================
SELECT 
  t.id,
  t.description as "תיאור",
  t.amount as "סכום",
  t.date as "תאריך",
  u.username as "משתמש"
FROM transactions t
JOIN users u ON t.user_id = u.id
WHERE t.category_id IS NULL;
