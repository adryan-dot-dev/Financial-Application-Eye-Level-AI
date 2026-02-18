# תוכנית בדיקות מקיפה - Backend CashFlow Management

> **תאריך:** 2026-02-18
> **גרסה:** 1.0
> **מחבר:** QA Architect (Claude)
> **פרויקט:** Financial-Application-Eye-Level-AI
> **סה"כ טסטים קיימים:** ~740
> **סה"כ טסטים מתוכננים בתוכנית זו:** 847

---

## תוכן עניינים

1. [מודול Auth (אימות)](#1-מודול-auth-אימות)
2. [מודול Users (ניהול משתמשים)](#2-מודול-users-ניהול-משתמשים)
3. [מודול Organizations (ארגונים)](#3-מודול-organizations-ארגונים)
4. [מודול Transactions (עסקאות)](#4-מודול-transactions-עסקאות)
5. [מודול Categories (קטגוריות)](#5-מודול-categories-קטגוריות)
6. [מודול Balance (יתרה)](#6-מודול-balance-יתרה)
7. [מודול Fixed (הכנסות/הוצאות קבועות)](#7-מודול-fixed-הכנסותהוצאות-קבועות)
8. [מודול Installments (תשלומים)](#8-מודול-installments-תשלומים)
9. [מודול Loans (הלוואות)](#9-מודול-loans-הלוואות)
10. [מודול Subscriptions (מנויים)](#10-מודול-subscriptions-מנויים)
11. [מודול Forecast (תחזית)](#11-מודול-forecast-תחזית)
12. [מודול Alerts (התראות)](#12-מודול-alerts-התראות)
13. [מודול Dashboard (לוח בקרה)](#13-מודול-dashboard-לוח-בקרה)
14. [מודול Settings (הגדרות)](#14-מודול-settings-הגדרות)
15. [מודול Currency (מטבעות)](#15-מודול-currency-מטבעות)
16. [מודול Export (ייצוא)](#16-מודול-export-ייצוא)
17. [מודול Automation (אוטומציה)](#17-מודול-automation-אוטומציה)
18. [מודול Backups (גיבויים)](#18-מודול-backups-גיבויים)
19. [מודול Expected Income (הכנסה צפויה)](#19-מודול-expected-income-הכנסה-צפויה)
20. [שירותים (Services)](#20-שירותים-services)
21. [נושאים חוצי-מערכת](#21-נושאים-חוצי-מערכת)
22. [סיכום כמותי](#22-סיכום-כמותי)

---

## 1. מודול Auth (אימות)

**Endpoints:**
- `POST /api/v1/auth/register` — הרשמה (rate limit: 3/min)
- `POST /api/v1/auth/login` — כניסה (rate limit: 5/min)
- `POST /api/v1/auth/refresh` — רענון טוקן (rate limit: 10/min)
- `POST /api/v1/auth/logout` — התנתקות
- `GET /api/v1/auth/me` — פרטי משתמש נוכחי
- `PUT /api/v1/auth/me` — עדכון פרטי משתמש
- `PUT /api/v1/auth/password` — שינוי סיסמה (rate limit: 5/min)

**ולידציות:** email format, username length, password strength, unique username/email
**לוגיקה עסקית:** JWT access+refresh tokens, blacklist, password_changed_at invalidation
**DB:** Users, Settings (auto-create on register)
**Audit:** register, login, logout, password_change

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| AUTH-HP-001 | הרשמה עם פרטים תקינים — מחזיר access_token + refresh_token + status 201 |
| AUTH-HP-002 | כניסה עם username + password תקינים — מחזיר tokens |
| AUTH-HP-003 | כניסה עם email + password תקינים — מחזיר tokens (login מקבל email בשדה username) |
| AUTH-HP-004 | רענון טוקן עם refresh_token תקין — מחזיר tokens חדשים |
| AUTH-HP-005 | התנתקות — מחזיר success message |
| AUTH-HP-006 | GET /me — מחזיר פרטי משתמש נוכחי |
| AUTH-HP-007 | PUT /me — עדכון username בהצלחה |
| AUTH-HP-008 | PUT /me — עדכון email בהצלחה |
| AUTH-HP-009 | PUT /me — עדכון full_name ו-phone_number |
| AUTH-HP-010 | שינוי סיסמה — עם current_password נכון — מחזיר success |
| AUTH-HP-011 | הרשמה יוצרת אוטומטית Settings ברירת מחדל למשתמש |
| AUTH-HP-012 | login מעדכן last_login_at |

### Input Validation
| # | תיאור הבדיקה |
|---|-------------|
| AUTH-VAL-001 | הרשמה עם username ריק — 422 |
| AUTH-VAL-002 | הרשמה עם email לא תקין — 422 |
| AUTH-VAL-003 | הרשמה עם password קצר מדי — 422 |
| AUTH-VAL-004 | הרשמה עם username שכבר קיים — 409 AlreadyExistsException |
| AUTH-VAL-005 | הרשמה עם email שכבר קיים — 409 AlreadyExistsException |
| AUTH-VAL-006 | כניסה עם username שגוי — 401 "Invalid username or password" |
| AUTH-VAL-007 | כניסה עם password שגוי — 401 "Invalid username or password" |
| AUTH-VAL-008 | PUT /me — username שכבר קיים למשתמש אחר — 409 |
| AUTH-VAL-009 | PUT /me — email שכבר קיים למשתמש אחר — 409 |

### Authentication & Authorization
| # | תיאור הבדיקה |
|---|-------------|
| AUTH-AUTH-001 | GET /me בלי token — 401/403 |
| AUTH-AUTH-002 | GET /me עם token פג תוקף — 401 |
| AUTH-AUTH-003 | GET /me עם token שנמצא ב-blacklist — 401 "Token has been revoked" |
| AUTH-AUTH-004 | שימוש ב-refresh token כ-access token — 401 "Invalid token type" |
| AUTH-AUTH-005 | שימוש ב-access token כ-refresh token — 401 "Invalid refresh token" |
| AUTH-AUTH-006 | כניסה עם חשבון לא פעיל (is_active=False) — 401 "Account is inactive" |
| AUTH-AUTH-007 | access token שהונפק לפני שינוי סיסמה — 401 "Token invalidated by password change" |
| AUTH-AUTH-008 | refresh token שהונפק לפני שינוי סיסמה — 401 |
| AUTH-AUTH-009 | משתמש שנמחק — 401 "User not found" |

### Edge Cases
| # | תיאור הבדיקה |
|---|-------------|
| AUTH-EDGE-001 | refresh token שכבר נמצא ב-blacklist (שימוש כפול) — 401 "Refresh token has already been used" |
| AUTH-EDGE-002 | שינוי סיסמה — blacklist את ה-access token הנוכחי ו-password_changed_at מתעדכן |
| AUTH-EDGE-003 | logout — blacklist את ה-access token ולא ניתן להשתמש בו שוב |
| AUTH-EDGE-004 | token בלי JTI — טיפול תקין (no blacklist check) |
| AUTH-EDGE-005 | token בלי IAT — נחשב כ-invalid לאחר כל שינוי סיסמה |
| AUTH-EDGE-006 | password_changed_at הוא None — כל token תקין (is_token_issued_before_password_change = False) |
| AUTH-EDGE-007 | הרשמה מספקת tokens — המשתמש מחובר אוטומטית אחרי הרשמה |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| AUTH-BIZ-001 | שינוי סיסמה — current_password שגוי — 401 "Current password is incorrect" |
| AUTH-BIZ-002 | refresh token rotation — ה-refresh token הישן נכנס ל-blacklist |
| AUTH-BIZ-003 | access token כולל is_admin claim |
| AUTH-BIZ-004 | access token JTI הוא UUID ייחודי |

### Audit Logging
| # | תיאור הבדיקה |
|---|-------------|
| AUTH-AUDIT-001 | register — נוצר audit log עם action="register" |
| AUTH-AUDIT-002 | login — נוצר audit log עם action="login" |
| AUTH-AUDIT-003 | logout — נוצר audit log עם action="logout" |
| AUTH-AUDIT-004 | password_change — נוצר audit log עם action="password_change" |

**סה"כ מודול Auth: 36 טסטים**

---

## 2. מודול Users (ניהול משתמשים)

**Endpoints:**
- `GET /api/v1/users` — רשימת משתמשים (admin only)
- `POST /api/v1/users` — יצירת משתמש (admin only)
- `PUT /api/v1/users/{id}` — עדכון משתמש (admin only)
- `DELETE /api/v1/users/{id}` — מחיקת משתמש (admin only)
- `POST /api/v1/users/{id}/reset-password` — איפוס סיסמה (admin only)

**הגנות:** super-admin לא ניתן לעריכה, השבתה, הורדת דרגה, או מחיקה
**הרשאות:** admin only, super-admin protections

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| USR-HP-001 | רשימת משתמשים — admin מקבל רשימה |
| USR-HP-002 | חיפוש משתמשים עם search parameter |
| USR-HP-003 | יצירת משתמש חדש — admin |
| USR-HP-004 | עדכון פרטי משתמש — admin |
| USR-HP-005 | מחיקת משתמש — admin |
| USR-HP-006 | איפוס סיסמה למשתמש — admin |

### Authentication & Authorization
| # | תיאור הבדיקה |
|---|-------------|
| USR-AUTH-001 | non-admin ניגש ל-GET /users — 403 "Admin access required" |
| USR-AUTH-002 | non-admin ניגש ל-POST /users — 403 |
| USR-AUTH-003 | non-admin ניגש ל-DELETE /users/{id} — 403 |

### Business Logic — Super Admin Protections
| # | תיאור הבדיקה |
|---|-------------|
| USR-BIZ-001 | ניסיון לעדכן super_admin — 403 "Cannot modify super admin" |
| USR-BIZ-002 | ניסיון להשבית super_admin (is_active=False) — 403 |
| USR-BIZ-003 | ניסיון להוריד דרגת super_admin — 403 |
| USR-BIZ-004 | ניסיון למחוק super_admin — 403 |
| USR-BIZ-005 | admin מנסה להסיר admin status מעצמו — 403 "Cannot remove your own admin status" |
| USR-BIZ-006 | רק super_admin יכול לשנות is_admin status |
| USR-BIZ-007 | יצירת משתמש עם username/email שכבר קיימים — 409 |

### Validation
| # | תיאור הבדיקה |
|---|-------------|
| USR-VAL-001 | יצירת משתמש בלי username — 422 |
| USR-VAL-002 | יצירת משתמש עם email לא תקין — 422 |

### Pagination
| # | תיאור הבדיקה |
|---|-------------|
| USR-PAG-001 | רשימת משתמשים עם page ו-page_size |
| USR-PAG-002 | חיפוש עם search מחזיר תוצאות מסוננות |

**סה"כ מודול Users: 20 טסטים**

---

## 3. מודול Organizations (ארגונים)

**Endpoints:**
- `POST /api/v1/organizations` — יצירת ארגון
- `GET /api/v1/organizations` — רשימת ארגונים
- `GET /api/v1/organizations/{id}` — פרטי ארגון
- `PUT /api/v1/organizations/{id}` — עדכון ארגון (owner/admin)
- `DELETE /api/v1/organizations/{id}` — מחיקת ארגון (owner only)
- `POST /api/v1/organizations/{id}/members` — הוספת חבר (owner/admin)
- `GET /api/v1/organizations/{id}/members` — רשימת חברים
- `PUT /api/v1/organizations/{id}/members/{user_id}` — שינוי תפקיד (owner only)
- `DELETE /api/v1/organizations/{id}/members/{user_id}` — הסרת חבר
- `POST /api/v1/organizations/switch` — מעבר בין ארגון לאישי
- `GET /api/v1/organizations/{id}/audit-log` — לוג ביקורת (owner/admin)

**תפקידים:** owner, admin, member, viewer
**DataContext:** personal (user_id + org IS NULL) vs org (org_id = X)

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| ORG-HP-001 | יצירת ארגון — היוצר הופך ל-owner + member אוטומטי |
| ORG-HP-002 | רשימת ארגונים — מחזיר רק ארגונים שהמשתמש חבר בהם |
| ORG-HP-003 | GET ארגון ספציפי — חבר רואה פרטים |
| ORG-HP-004 | עדכון שם ארגון — owner |
| ORG-HP-005 | עדכון שם ארגון — admin |
| ORG-HP-006 | מחיקת ארגון — owner |
| ORG-HP-007 | הוספת חבר לארגון — owner |
| ORG-HP-008 | הוספת חבר לארגון — admin |
| ORG-HP-009 | רשימת חברים |
| ORG-HP-010 | שינוי תפקיד חבר — owner |
| ORG-HP-011 | הסרת חבר — owner |
| ORG-HP-012 | הסרת חבר — admin (מסיר member/viewer) |
| ORG-HP-013 | חבר מסיר את עצמו (self-removal) |
| ORG-HP-014 | מעבר לקונטקסט ארגון |
| ORG-HP-015 | מעבר לתצוגה אישית (organization_id=null) |
| ORG-HP-016 | צפייה ב-audit log — owner |

### Authorization & Permissions
| # | תיאור הבדיקה |
|---|-------------|
| ORG-AUTH-001 | member ניסיון לעדכן ארגון — 403 |
| ORG-AUTH-002 | viewer ניסיון לעדכן ארגון — 403 |
| ORG-AUTH-003 | admin ניסיון למחוק ארגון — 403 (owner only) |
| ORG-AUTH-004 | member ניסיון להוסיף חבר — 403 |
| ORG-AUTH-005 | admin ניסיון לשנות תפקיד — 403 (owner only) |
| ORG-AUTH-006 | non-member ניגש לארגון — 404 (NotFoundException) |
| ORG-AUTH-007 | member ניסיון לצפות ב-audit log — 403 |
| ORG-AUTH-008 | viewer ניסיון לצפות ב-audit log — 403 |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| ORG-BIZ-001 | owner לא יכול להסיר את עצמו — 422 "Owner cannot leave" |
| ORG-BIZ-002 | admin לא יכול להסיר admin אחר — 403 |
| ORG-BIZ-003 | admin לא יכול להסיר owner — 403 |
| ORG-BIZ-004 | owner לא יכול לשנות תפקיד של עצמו — 422 |
| ORG-BIZ-005 | שם ארגון כפול — 409 |
| ORG-BIZ-006 | slug נוצר אוטומטית מהשם עם ייחודיות |
| ORG-BIZ-007 | הוספת חבר שכבר קיים ופעיל — 409 "already a member" |
| ORG-BIZ-008 | הוספת חבר לא פעיל — reactivation (שחזור חברות) |
| ORG-BIZ-009 | מחיקת ארגון — מנקה current_organization_id מכל המשתמשים |
| ORG-BIZ-010 | הסרת חבר — מנקה current_organization_id אם הוא היה בארגון הזה |
| ORG-BIZ-011 | switch לארגון שלא חבר בו — 403 |
| ORG-BIZ-012 | switch לארגון לא פעיל — 404 |

### Data Isolation (DataContext)
| # | תיאור הבדיקה |
|---|-------------|
| ORG-ISO-001 | בקונטקסט אישי — רואה רק נתונים עם user_id=X AND organization_id IS NULL |
| ORG-ISO-002 | בקונטקסט ארגון — רואה רק נתונים עם organization_id=Y |
| ORG-ISO-003 | נתונים אישיים לא נראים בקונטקסט ארגון |
| ORG-ISO-004 | נתונים ארגוניים לא נראים בקונטקסט אישי |
| ORG-ISO-005 | create_fields() מחזיר user_id + organization_id נכון לפי קונטקסט |
| ORG-ISO-006 | fallback לקונטקסט אישי כשלא חבר פעיל בארגון |

### Validation
| # | תיאור הבדיקה |
|---|-------------|
| ORG-VAL-001 | הוספת חבר בלי user_id ובלי email — 422 |
| ORG-VAL-002 | הוספת חבר עם user שלא קיים — 404 |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| ORG-AUD-001 | audit log נוצר על create, update, delete, add_member, remove_member, change_role, switch_context |
| ORG-AUD-002 | audit log עם filters (action, entity_type) + pagination |

**סה"כ מודול Organizations: 44 טסטים**

---

## 4. מודול Transactions (עסקאות)

**Endpoints:**
- `GET /api/v1/transactions` — רשימה + סינון + pagination
- `POST /api/v1/transactions` — יצירה
- `GET /api/v1/transactions/{id}` — קריאה
- `PUT /api/v1/transactions/{id}` — עדכון
- `DELETE /api/v1/transactions/{id}` — מחיקה
- `POST /api/v1/transactions/{id}/duplicate` — שכפול
- `POST /api/v1/transactions/bulk` — יצירה מרובה
- `PUT /api/v1/transactions/bulk-update` — עדכון קטגוריה מרובה
- `POST /api/v1/transactions/bulk-delete` — מחיקה מרובה

**ולידציות:** category ownership, category archived check, category type match, amount > 0 (DB constraint)
**Multi-currency:** prepare_currency_fields על create/update
**חיפוש:** SQL injection prevention (escaped LIKE), search max_length=200

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| TXN-HP-001 | יצירת עסקה income עם קטגוריה — 201 |
| TXN-HP-002 | יצירת עסקה expense עם קטגוריה — 201 |
| TXN-HP-003 | יצירת עסקה בלי קטגוריה — 201 |
| TXN-HP-004 | רשימת עסקאות — מחזיר items, total, page, pages |
| TXN-HP-005 | קריאת עסקה ספציפית |
| TXN-HP-006 | עדכון עסקה — שינוי amount, description |
| TXN-HP-007 | מחיקת עסקה |
| TXN-HP-008 | שכפול עסקה — נוצרת עסקה חדשה עם אותם ערכים |
| TXN-HP-009 | יצירה מרובה (bulk) — 201 |
| TXN-HP-010 | עדכון קטגוריה מרובה (bulk-update) |
| TXN-HP-011 | מחיקה מרובה (bulk-delete) |

### Input Validation
| # | תיאור הבדיקה |
|---|-------------|
| TXN-VAL-001 | type חייב להיות "income" או "expense" — 422 |
| TXN-VAL-002 | start_date > end_date — 422 "start_date must be <= end_date" |
| TXN-VAL-003 | sort_by חייב להיות date/amount/created_at — 422 |
| TXN-VAL-004 | sort_order חייב להיות asc/desc — 422 |
| TXN-VAL-005 | search max_length=200 — 422 |
| TXN-VAL-006 | page >= 1, page_size 1-100 — 422 |
| TXN-VAL-007 | category_id שלא קיים — 422 |
| TXN-VAL-008 | category שנמצאת ב-archived — 422 "Cannot assign an archived category" |
| TXN-VAL-009 | category מסוג income על עסקת expense — 422 "Category type does not match" |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| TXN-BIZ-001 | שכפול עסקה — entry_pattern הופך ל-"one_time" |
| TXN-BIZ-002 | שכפול — ID חדש, שומר על amount, currency, category, description |
| TXN-BIZ-003 | עדכון category — בודק שסוג הקטגוריה מתאים ל-type הנוכחי או המעודכן |
| TXN-BIZ-004 | bulk create — ולידציית category ownership על כל הקטגוריות |
| TXN-BIZ-005 | bulk delete — מחזיר מספר עסקאות שנמחקו בפועל (rowcount) |

### Multi-Currency
| # | תיאור הבדיקה |
|---|-------------|
| TXN-CURR-001 | יצירה עם מטבע זר (USD) — amount מומר למטבע בסיס, original_amount/original_currency נשמרים |
| TXN-CURR-002 | יצירה עם מטבע בסיס (ILS) — exchange_rate=1, original_amount=amount |
| TXN-CURR-003 | עדכון amount — המרה מחדש |
| TXN-CURR-004 | עדכון currency — המרה מחדש |
| TXN-CURR-005 | bulk create — כל עסקה מומרת בנפרד |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| TXN-ISO-001 | משתמש A לא רואה עסקאות של משתמש B |
| TXN-ISO-002 | עסקאות אישיות לא נראות בקונטקסט ארגון |
| TXN-ISO-003 | עסקאות ארגון לא נראות בקונטקסט אישי |
| TXN-ISO-004 | ניסיון לעדכן עסקה של משתמש אחר — 404 |
| TXN-ISO-005 | ניסיון למחוק עסקה של משתמש אחר — 404 |
| TXN-ISO-006 | bulk-update לא משפיע על עסקאות של אחרים |

### Filtering, Sorting, Pagination
| # | תיאור הבדיקה |
|---|-------------|
| TXN-FLT-001 | סינון לפי start_date ו-end_date |
| TXN-FLT-002 | סינון לפי category_id |
| TXN-FLT-003 | סינון לפי type (income/expense) |
| TXN-FLT-004 | סינון לפי min_amount ו-max_amount |
| TXN-FLT-005 | חיפוש טקסט (search) — case insensitive |
| TXN-FLT-006 | מיון לפי date DESC (ברירת מחדל) |
| TXN-FLT-007 | מיון לפי amount ASC |
| TXN-FLT-008 | pagination — עמוד 2 מחזיר תוצאות שונות מעמוד 1 |
| TXN-FLT-009 | pages חישוב — ceil(total / page_size) |

### Edge Cases
| # | תיאור הבדיקה |
|---|-------------|
| TXN-EDGE-001 | חיפוש עם תווים מיוחדים (%, _, \) — escaped properly |
| TXN-EDGE-002 | רשימה ריקה — items=[], total=0 |
| TXN-EDGE-003 | bulk create עם category_id שחלקן לא קיימות — 422 |
| TXN-EDGE-004 | bulk delete עם IDs שחלקן לא שייכות למשתמש — מחזיר רק את מספר הנמחקות |
| TXN-EDGE-005 | שכפול עסקה שלא קיימת — 404 |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| TXN-AUD-001 | create — audit log |
| TXN-AUD-002 | update — audit log |
| TXN-AUD-003 | delete — audit log |
| TXN-AUD-004 | duplicate — audit log |
| TXN-AUD-005 | bulk_create — audit log עם details |
| TXN-AUD-006 | bulk_update — audit log עם details |
| TXN-AUD-007 | bulk_delete — audit log עם details |

**סה"כ מודול Transactions: 55 טסטים**

---

## 5. מודול Categories (קטגוריות)

**Endpoints:**
- `GET /api/v1/categories` — רשימה + סינון + pagination
- `POST /api/v1/categories` — יצירה
- `GET /api/v1/categories/{id}` — קריאה
- `PUT /api/v1/categories/{id}` — עדכון
- `DELETE /api/v1/categories/{id}` — ארכוב (soft delete)
- `POST /api/v1/categories/reorder` — סידור מחדש

**לוגיקה:** soft delete (is_archived), circular reference detection (RED-7), type change prevention (ORANGE-5), duplicate name check

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| CAT-HP-001 | יצירת קטגוריה מסוג income — 201 |
| CAT-HP-002 | יצירת קטגוריה מסוג expense — 201 |
| CAT-HP-003 | רשימת קטגוריות — מסודרות לפי display_order |
| CAT-HP-004 | קריאת קטגוריה ספציפית |
| CAT-HP-005 | עדכון שם קטגוריה |
| CAT-HP-006 | עדכון color + icon |
| CAT-HP-007 | ארכוב (soft delete) — is_archived=True |
| CAT-HP-008 | סידור מחדש — CASE expression batch update |

### Input Validation
| # | תיאור הבדיקה |
|---|-------------|
| CAT-VAL-001 | type חייב להיות income/expense — 422 |
| CAT-VAL-002 | include_archived=False — לא מחזיר ארכוב |
| CAT-VAL-003 | include_archived=True — כולל ארכוב |
| CAT-VAL-004 | שם כפול מאותו type (לא ארכוב) — 409 "Category with this name and type already exists" |
| CAT-VAL-005 | שם כפול מ-type אחר — מותר |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| CAT-BIZ-001 | RED-7: ניסיון ליצור circular reference (A->B->A) — 400 "Circular reference detected" |
| CAT-BIZ-002 | RED-7: ניסיון ליצור self-reference (A->A) — 400 |
| CAT-BIZ-003 | RED-7: שרשרת ארוכה (A->B->C->A) — 400 |
| CAT-BIZ-004 | ORANGE-5: ניסיון לשנות type כשיש עסקאות — 400 "Cannot change type: category has existing transactions" |
| CAT-BIZ-005 | ORANGE-5: שינוי type כשאין עסקאות — מותר |
| CAT-BIZ-006 | soft delete — הקטגוריה נשארת ב-DB עם is_archived=True |
| CAT-BIZ-007 | reorder — מעדכן display_order לכל הקטגוריות |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| CAT-ISO-001 | משתמש A לא רואה קטגוריות של משתמש B |
| CAT-ISO-002 | ניסיון לעדכן קטגוריה של משתמש אחר — 404 |
| CAT-ISO-003 | reorder משפיע רק על קטגוריות של המשתמש הנוכחי |

### Cache Headers
| # | תיאור הבדיקה |
|---|-------------|
| CAT-CACHE-001 | GET /categories — Cache-Control: max-age=300 |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| CAT-AUD-001 | create, update, archive, reorder — audit log |

**סה"כ מודול Categories: 26 טסטים**

---

## 6. מודול Balance (יתרה)

**Endpoints:**
- `GET /api/v1/balance` — יתרה נוכחית
- `PUT /api/v1/balance` — עדכון יתרה
- `POST /api/v1/balance` — יצירת יתרה ראשונה
- `GET /api/v1/balance/history` — היסטוריית יתרות

**Concurrency:** WITH FOR UPDATE למניעת race conditions
**לוגיקה:** effective_date זהה — עדכון in-place; effective_date שונה — ארכוב ישן + חדש

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| BAL-HP-001 | יצירת יתרה ראשונה — 201, is_current=True |
| BAL-HP-002 | GET יתרה נוכחית |
| BAL-HP-003 | עדכון יתרה (אותו effective_date) — in-place update |
| BAL-HP-004 | עדכון יתרה (effective_date שונה) — ארכוב ישן + יצירת חדש |
| BAL-HP-005 | היסטוריית יתרות — sorted by effective_date DESC |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| BAL-BIZ-001 | GET בלי יתרה — 404 "No current balance set" |
| BAL-BIZ-002 | PUT בלי יתרה — 404 "No current balance. Use POST" |
| BAL-BIZ-003 | POST — מעביר יתרות קיימות ל-is_current=False |
| BAL-BIZ-004 | PUT עם effective_date חדש — הישנה הופכת ל-is_current=False |
| BAL-BIZ-005 | PUT עם אותו effective_date — עדכון notes |

### Concurrency
| # | תיאור הבדיקה |
|---|-------------|
| BAL-CONC-001 | שתי בקשות POST בו-זמנית — רק אחת is_current=True בסוף |
| BAL-CONC-002 | שתי בקשות PUT בו-זמנית — WITH FOR UPDATE מונע race condition |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| BAL-ISO-001 | משתמש A לא רואה יתרות של משתמש B |
| BAL-ISO-002 | היסטוריה רק של המשתמש הנוכחי |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| BAL-AUD-001 | create, update — audit log |

**סה"כ מודול Balance: 15 טסטים**

---

## 7. מודול Fixed (הכנסות/הוצאות קבועות)

**Endpoints:**
- `GET /api/v1/fixed` — רשימה + סינון
- `POST /api/v1/fixed` — יצירה
- `GET /api/v1/fixed/{id}` — קריאה
- `PUT /api/v1/fixed/{id}` — עדכון
- `DELETE /api/v1/fixed/{id}` — מחיקה
- `POST /api/v1/fixed/{id}/pause` — השהיה
- `POST /api/v1/fixed/{id}/resume` — חידוש

**Multi-currency:** prepare_currency_fields
**ולידציות:** category type match, end_date >= start_date

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| FIX-HP-001 | יצירת הכנסה קבועה — 201 |
| FIX-HP-002 | יצירת הוצאה קבועה — 201 |
| FIX-HP-003 | רשימה — עם סינון type, is_active |
| FIX-HP-004 | קריאה ספציפית |
| FIX-HP-005 | עדכון — שינוי amount, name |
| FIX-HP-006 | מחיקה |
| FIX-HP-007 | השהיה — is_active=False, paused_at מתעדכן |
| FIX-HP-008 | חידוש — is_active=True, resumed_at מתעדכן |

### Input Validation
| # | תיאור הבדיקה |
|---|-------------|
| FIX-VAL-001 | end_date < start_date — 422 "end_date must be >= start_date" |
| FIX-VAL-002 | category type לא מתאים — 400 "Category type does not match" |
| FIX-VAL-003 | category_id לא קיים — 422 |
| FIX-VAL-004 | ולידציה אחרי update — end_date < start_date — 422 |

### Multi-Currency
| # | תיאור הבדיקה |
|---|-------------|
| FIX-CURR-001 | יצירה עם מטבע זר — המרה + שמירת original fields |
| FIX-CURR-002 | עדכון amount עם מטבע זר — המרה מחדש |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| FIX-ISO-001 | משתמש A לא רואה fixed של משתמש B |
| FIX-ISO-002 | ניסיון מחיקה של fixed של אחר — 404 |

### Pagination
| # | תיאור הבדיקה |
|---|-------------|
| FIX-PAG-001 | pagination עם page ו-page_size |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| FIX-AUD-001 | create, update, delete, pause, resume — audit log |

**סה"כ מודול Fixed: 18 טסטים**

---

## 8. מודול Installments (תשלומים)

**Endpoints:**
- `GET /api/v1/installments` — רשימה (עם enrichment)
- `POST /api/v1/installments` — יצירה
- `GET /api/v1/installments/{id}` — פרטים + schedule
- `PUT /api/v1/installments/{id}` — עדכון
- `DELETE /api/v1/installments/{id}` — מחיקה
- `POST /api/v1/installments/{id}/mark-paid` — סימון תשלום
- `POST /api/v1/installments/{id}/reverse-payment` — ביטול תשלום
- `GET /api/v1/installments/{id}/payments` — לוח תשלומים

**Enrichment:** status, expected_payments_by_now, is_on_track, next_payment_date, end_date, remaining_amount, progress_percentage
**Concurrency:** WITH FOR UPDATE על mark-paid ו-reverse-payment
**RED-8:** תשלום אחרון סופג הפרש עיגול

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| INST-HP-001 | יצירת תשלומים — monthly_amount מחושב אוטומטית |
| INST-HP-002 | יצירה עם first_payment_made=True — payments_completed=1 + transaction נוצר |
| INST-HP-003 | רשימה — כולל enrichment fields |
| INST-HP-004 | פרטים — כולל schedule |
| INST-HP-005 | עדכון שם |
| INST-HP-006 | מחיקה |
| INST-HP-007 | mark-paid — payments_completed+1 + transaction נוצר |
| INST-HP-008 | reverse-payment — payments_completed-1 |
| INST-HP-009 | לוח תשלומים — רשימת PaymentScheduleItem |

### Enrichment Logic

```python
# דוגמת קוד לבדיקת enrichment:
# תשלומים: total=12000, number_of_payments=12, start_date=2025-06-01
# payments_completed=6, today=2026-02-18
# expected:
#   monthly_amount = 1000.00
#   status = "active" (not overdue because 6 >= expected_payments_by_now)
#   expected_payments_by_now = 9 (Jun-Feb = 9 months)
#   is_on_track = False (6 < 9)
#   next_payment_date = 2025-12-01 (payment 7)
#   end_date = 2026-05-01
#   remaining_amount = 6000.00
#   progress_percentage = 50.0
```

| # | תיאור הבדיקה |
|---|-------------|
| INST-ENR-001 | status = "completed" כש-payments_completed >= number_of_payments |
| INST-ENR-002 | status = "pending" כש-today < start_date |
| INST-ENR-003 | status = "overdue" כש-payments_completed < expected_payments_by_now |
| INST-ENR-004 | status = "due" כש-next_payment_date == today |
| INST-ENR-005 | status = "active" בכל מקרה אחר |
| INST-ENR-006 | is_on_track = True כש-payments_completed >= expected_payments_by_now |
| INST-ENR-007 | expected_payments_by_now — חישוב נכון עם today.day >= day_of_month |
| INST-ENR-008 | next_payment_date = None כשהכל שולם |
| INST-ENR-009 | remaining_amount — תשלום אחרון סופג עיגול (RED-8) |
| INST-ENR-010 | progress_percentage — 0.0 עד 100.0 |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| INST-BIZ-001 | mark-paid כשכל התשלומים הושלמו — 422 "All payments have already been completed" |
| INST-BIZ-002 | reverse-payment כש-payments_completed=0 — 400 "No payments to reverse" |
| INST-BIZ-003 | RED-8: תשלום אחרון — actual_amount = total_amount - (monthly_amount * (N-1)) |
| INST-BIZ-004 | mark-paid יוצר Transaction עם entry_pattern="installment", installment_id, installment_number |
| INST-BIZ-005 | first_payment_made=True — Transaction נוצר עם payment_number=1 |
| INST-BIZ-006 | עדכון total_amount — monthly_amount מחושב מחדש |
| INST-BIZ-007 | עדכון number_of_payments — monthly_amount מחושב מחדש |

### Multi-Currency
| # | תיאור הבדיקה |
|---|-------------|
| INST-CURR-001 | יצירה עם מטבע זר — total_amount מומר, monthly_amount מחושב על הסכום המומר |

### Date Handling
| # | תיאור הבדיקה |
|---|-------------|
| INST-DATE-001 | _safe_day — day_of_month=31 בפברואר → 28/29 |
| INST-DATE-002 | _safe_day — day_of_month=30 בפברואר → 28/29 |
| INST-DATE-003 | schedule — כל תאריך ב-day_of_month הנכון |

### Concurrency
| # | תיאור הבדיקה |
|---|-------------|
| INST-CONC-001 | שתי בקשות mark-paid בו-זמנית — WITH FOR UPDATE מונע כפילות |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| INST-ISO-001 | משתמש A לא רואה installments של משתמש B |
| INST-ISO-002 | mark-paid על installment של אחר — 404 |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| INST-AUD-001 | create, update, delete, mark_paid, reverse_payment — audit log |

**סה"כ מודול Installments: 36 טסטים**

---

## 9. מודול Loans (הלוואות)

**Endpoints:**
- `GET /api/v1/loans` — רשימה
- `POST /api/v1/loans` — יצירה
- `GET /api/v1/loans/{id}` — פרטים + amortization
- `PUT /api/v1/loans/{id}` — עדכון
- `DELETE /api/v1/loans/{id}` — מחיקה
- `POST /api/v1/loans/{id}/payment` — רישום תשלום
- `POST /api/v1/loans/{id}/reverse-payment` — ביטול תשלום
- `GET /api/v1/loans/{id}/breakdown` — לוח סילוקין

**ORANGE-2:** monthly_payment חייב לעלות על ריבית חודשית
**Amortization:** Spitzer method (declining balance)
**Status:** active, completed — כללי מעבר

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-HP-001 | יצירת הלוואה — 201 |
| LOAN-HP-002 | יצירה עם first_payment_made=True — payments_made=1, remaining_balance מחושב |
| LOAN-HP-003 | רשימת הלוואות |
| LOAN-HP-004 | פרטי הלוואה + amortization schedule |
| LOAN-HP-005 | עדכון — שינוי שם, notes |
| LOAN-HP-006 | מחיקה |
| LOAN-HP-007 | רישום תשלום — payments_made+1, remaining_balance יורד |
| LOAN-HP-008 | ביטול תשלום — payments_made-1, remaining_balance עולה |
| LOAN-HP-009 | לוח סילוקין (breakdown) |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-BIZ-001 | ORANGE-2: monthly_payment <= monthly_interest — 400 "Monthly payment must exceed monthly interest" |
| LOAN-BIZ-002 | interest_rate=0 — אין בדיקת ריבית |
| LOAN-BIZ-003 | payment amount > remaining_balance — 422 "Payment amount exceeds remaining balance" |
| LOAN-BIZ-004 | payments_made >= total_payments — status="completed", remaining_balance=0 |
| LOAN-BIZ-005 | remaining_balance <= 0 — status="completed" |
| LOAN-BIZ-006 | ניסיון תשלום על הלוואה שהושלמה — 400 "Loan is already completed" |
| LOAN-BIZ-007 | ניסיון ביטול כש-payments_made=0 — 400 "No payments to reverse" |
| LOAN-BIZ-008 | status transitions: לא ניתן לסמן completed לפני שכל התשלומים הושלמו — 422 |
| LOAN-BIZ-009 | status transitions: לא ניתן להחזיר completed ל-active — 422 |
| LOAN-BIZ-010 | reverse-payment: completed → active כאשר יש ביטול |
| LOAN-BIZ-011 | reverse-payment: חישוב remaining_balance לפי amortization schedule |

### Amortization Calculation

```python
# דוגמת קוד לבדיקת amortization:
# original_amount=120000, interest_rate=5%, total_payments=60, monthly_payment=2263.33
# חודש 1:
#   monthly_rate = 5/100/12 = 0.004167
#   interest_portion = 120000 * 0.004167 = 500.00
#   principal_portion = 2263.33 - 500.00 = 1763.33
#   remaining = 120000 - 1763.33 = 118236.67
# חודש אחרון:
#   principal_portion = remaining (מלא)
#   actual_payment = remaining + interest
```

| # | תיאור הבדיקה |
|---|-------------|
| LOAN-AMRT-001 | amortization — תשלום ראשון: interest + principal = monthly_payment |
| LOAN-AMRT-002 | amortization — תשלום אחרון: principal = remaining, payment = remaining + interest |
| LOAN-AMRT-003 | amortization — remaining_balance לא יורד מתחת 0.01 (guard) |
| LOAN-AMRT-004 | amortization — status: paid, overdue, due, future |
| LOAN-AMRT-005 | amortization — interest_rate=0 — כל התשלום הוא principal |
| LOAN-AMRT-006 | amortization — day_of_month handling (calendar.monthrange) |
| LOAN-AMRT-007 | amortization — principal > remaining guard |

### Multi-Currency
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-CURR-001 | יצירה עם מטבע זר — original_amount מומר, monthly_payment מומר באותו שער |
| LOAN-CURR-002 | original_currency_amount ו-original_currency נשמרים |

### Concurrency
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-CONC-001 | שתי בקשות payment בו-זמנית — WITH FOR UPDATE |
| LOAN-CONC-002 | שתי בקשות reverse-payment בו-זמנית — WITH FOR UPDATE |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-ISO-001 | משתמש A לא רואה הלוואות של B |
| LOAN-ISO-002 | payment על הלוואה של אחר — 404 |

### Pagination
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-PAG-001 | רשימה עם page ו-page_size |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| LOAN-AUD-001 | create, update, delete, payment, reverse_payment — audit log |

**סה"כ מודול Loans: 36 טסטים**

---

## 10. מודול Subscriptions (מנויים)

**Endpoints:**
- `GET /api/v1/subscriptions` — רשימה + סינון + מיון
- `GET /api/v1/subscriptions/upcoming` — חידושים קרובים
- `POST /api/v1/subscriptions` — יצירה
- `GET /api/v1/subscriptions/{id}` — קריאה
- `PUT /api/v1/subscriptions/{id}` — עדכון
- `DELETE /api/v1/subscriptions/{id}` — מחיקה
- `POST /api/v1/subscriptions/{id}/pause` — השהיה
- `POST /api/v1/subscriptions/{id}/resume` — חידוש

**סינון:** status (active/paused), billing_cycle (monthly/quarterly/semi_annual/annual)
**מיון:** name, amount, next_renewal_date, created_at

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| SUB-HP-001 | יצירת מנוי — 201 |
| SUB-HP-002 | רשימת מנויים |
| SUB-HP-003 | חידושים קרובים (upcoming) — 30 ימים ברירת מחדל |
| SUB-HP-004 | קריאת מנוי ספציפי |
| SUB-HP-005 | עדכון מנוי |
| SUB-HP-006 | מחיקת מנוי |
| SUB-HP-007 | השהיה — is_active=False, paused_at set |
| SUB-HP-008 | חידוש — is_active=True, resumed_at set, paused_at=None |

### Filtering & Sorting
| # | תיאור הבדיקה |
|---|-------------|
| SUB-FLT-001 | סינון status=active |
| SUB-FLT-002 | סינון status=paused |
| SUB-FLT-003 | סינון billing_cycle=monthly |
| SUB-FLT-004 | סינון billing_cycle=annual |
| SUB-FLT-005 | מיון לפי name ASC |
| SUB-FLT-006 | מיון לפי amount DESC |
| SUB-FLT-007 | מיון לפי next_renewal_date |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| SUB-BIZ-001 | upcoming — מציג רק active subscriptions עם next_renewal_date בטווח |
| SUB-BIZ-002 | upcoming — ניתן להגדיר days (1-365) |
| SUB-BIZ-003 | resume — מנקה paused_at |

### Multi-Currency
| # | תיאור הבדיקה |
|---|-------------|
| SUB-CURR-001 | יצירה עם מטבע זר — המרה |
| SUB-CURR-002 | עדכון amount — המרה מחדש |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| SUB-ISO-001 | משתמש A לא רואה מנויים של B |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| SUB-AUD-001 | create, update, delete, pause, resume — audit log |

**סה"כ מודול Subscriptions: 23 טסטים**

---

## 11. מודול Forecast (תחזית)

**Endpoints:**
- `GET /api/v1/forecast` — תחזית חודשית (1-24 חודשים)
- `GET /api/v1/forecast/weekly` — תחזית שבועית (1-52 שבועות)
- `GET /api/v1/forecast/summary` — סיכום + trigger alerts
- `POST /api/v1/forecast/what-if` — what-if analysis
- Scenario CRUD: POST/GET/PUT/DELETE /scenarios
- `GET /api/v1/forecast/scenarios/{id}/compute` — הרצת תרחיש
- `POST /api/v1/forecast/compare` — השוואת תרחישים

**שירותים:** compute_monthly_forecast, compute_weekly_forecast, generate_alerts
**Cache:** max-age=60

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| FCST-HP-001 | תחזית חודשית — 6 חודשים ברירת מחדל |
| FCST-HP-002 | תחזית שבועית — 12 שבועות ברירת מחדל |
| FCST-HP-003 | סיכום — כולל balance, income, expenses, alerts count |
| FCST-HP-004 | what-if עם balance_adjustment |
| FCST-HP-005 | what-if עם added_income |
| FCST-HP-006 | what-if עם added_expense |
| FCST-HP-007 | יצירת scenario — 201 |
| FCST-HP-008 | רשימת scenarios |
| FCST-HP-009 | קריאת scenario |
| FCST-HP-010 | עדכון scenario |
| FCST-HP-011 | מחיקת scenario |
| FCST-HP-012 | compute scenario — הרצה ומחזיר תוצאות |
| FCST-HP-013 | compare — שני תרחישים זה לצד זה עם deltas |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| FCST-BIZ-001 | summary מפעיל generate_alerts |
| FCST-BIZ-002 | has_negative_months — true אם חודש אחד עם closing_balance < 0 |
| FCST-BIZ-003 | first_negative_month — החודש הראשון עם closing_balance < 0 |
| FCST-BIZ-004 | compare — baseline (is_baseline=True) vs scenario |
| FCST-BIZ-005 | compare — scenario_id reference |
| FCST-BIZ-006 | compare — inline_params |
| FCST-BIZ-007 | compare — scenario_id שלא קיים — 404 |

### Validation
| # | תיאור הבדיקה |
|---|-------------|
| FCST-VAL-001 | months — 1-24 |
| FCST-VAL-002 | weeks — 1-52 |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| FCST-ISO-001 | scenarios — רואה רק scenarios שלו |
| FCST-ISO-002 | compute — מחושב רק על נתוני המשתמש |

### Cache
| # | תיאור הבדיקה |
|---|-------------|
| FCST-CACHE-001 | GET /forecast — Cache-Control: max-age=60 |
| FCST-CACHE-002 | GET /forecast/weekly — Cache-Control: max-age=60 |
| FCST-CACHE-003 | GET /forecast/summary — Cache-Control: max-age=60 |

### Audit
| # | תיאור הבדיקה |
|---|-------------|
| FCST-AUD-001 | scenario create, update, delete — audit log |

**סה"כ מודול Forecast: 27 טסטים**

---

## 12. מודול Alerts (התראות)

**Endpoints:**
- `GET /api/v1/alerts` — רשימה (auto-dismiss expired, filter snoozed)
- `GET /api/v1/alerts/unread-count` — ספירת unread
- `PUT /api/v1/alerts/{id}/read` — סימון כנקרא
- `PUT /api/v1/alerts/{id}/unread` — סימון כלא נקרא
- `POST /api/v1/alerts/read-all` — סימון הכל כנקרא
- `POST /api/v1/alerts/{id}/snooze` — דחייה
- `POST /api/v1/alerts/{id}/dismiss` — ביטול

**סוגי התראות:** negative_cashflow, high_expenses, approaching_negative, high_single_expense, high_income, payment_overdue, upcoming_payment, loan_ending_soon, installment_ending_soon

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| ALRT-HP-001 | רשימת התראות — מחזיר active, לא dismissed |
| ALRT-HP-002 | unread count |
| ALRT-HP-003 | mark as read |
| ALRT-HP-004 | mark as unread |
| ALRT-HP-005 | read-all |
| ALRT-HP-006 | snooze — עם snooze_until |
| ALRT-HP-007 | dismiss |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| ALRT-BIZ-001 | auto-dismiss — התראות שפג תוקפן (expires_at < now) מסומנות כ-dismissed |
| ALRT-BIZ-002 | snoozed alerts לא מוצגות (snoozed_until > now) |
| ALRT-BIZ-003 | snooze — snoozed_until מתעדכן |
| ALRT-BIZ-004 | unread count — סופר רק is_read=False ולא dismissed |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| ALRT-ISO-001 | משתמש A לא רואה alerts של B |
| ALRT-ISO-002 | ניסיון dismiss על alert של אחר — 404 |

### Edge Cases
| # | תיאור הבדיקה |
|---|-------------|
| ALRT-EDGE-001 | dismiss alert שכבר dismissed — אידמפוטנטי |
| ALRT-EDGE-002 | read-all כשאין alerts — אין שגיאה |

**סה"כ מודול Alerts: 15 טסטים**

---

## 13. מודול Dashboard (לוח בקרה)

**Endpoints:**
- `GET /api/v1/dashboard/summary` — KPIs + trends
- `GET /api/v1/dashboard/weekly` — 12 שבועות
- `GET /api/v1/dashboard/monthly` — 12 חודשים
- `GET /api/v1/dashboard/quarterly` — 8 רבעונים
- `GET /api/v1/dashboard/category-breakdown` — פירוט לפי קטגוריה
- `GET /api/v1/dashboard/upcoming-payments` — תשלומים קרובים
- `GET /api/v1/dashboard/financial-health` — בריאות פיננסית (0-100)
- `GET /api/v1/dashboard/installments-summary` — סיכום תשלומים
- `GET /api/v1/dashboard/loans-summary` — סיכום הלוואות
- `GET /api/v1/dashboard/top-expenses` — 5 הוצאות גדולות
- `GET /api/v1/dashboard/subscriptions-summary` — סיכום מנויים

**שירותים:** financial_aggregator (deduplication), generate_alerts, exchange_rate_service
**5 Health Factors:** savings_ratio (30%), debt_ratio (25%), balance_trend (20%), expense_stability (15%), emergency_fund (10%)

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| DASH-HP-001 | summary — current_balance, monthly_income, monthly_expenses, net_cashflow |
| DASH-HP-002 | summary — trends (income_trend, expense_trend, balance_trend) |
| DASH-HP-003 | summary — custom date range (start_date, end_date) |
| DASH-HP-004 | weekly — 12 items, כל אחד עם period, income, expenses, net, balance |
| DASH-HP-005 | monthly — 12 items |
| DASH-HP-006 | quarterly — 8 items |
| DASH-HP-007 | category-breakdown — items with percentage, sorted by amount DESC |
| DASH-HP-008 | upcoming-payments — sorted by due_date, fixed + installments + loans + subscriptions |
| DASH-HP-009 | financial-health — score 0-100, grade, factors |
| DASH-HP-010 | installments-summary — active_count, totals |
| DASH-HP-011 | loans-summary — active_count, totals, overall_progress |
| DASH-HP-012 | top-expenses — top 5 expenses |
| DASH-HP-013 | subscriptions-summary — monthly_equivalent normalization |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| DASH-BIZ-001 | summary — triggers generate_alerts (wrapped in try/except) |
| DASH-BIZ-002 | summary — start_date > end_date — 422 |
| DASH-BIZ-003 | summary — custom range: previous period = equal length before start_date |
| DASH-BIZ-004 | weekly — week_start_day from user settings |
| DASH-BIZ-005 | _pct_change — previous=0, current>0 → 100% |
| DASH-BIZ-006 | _pct_change — previous=0, current=0 → 0% |

### Financial Health Scoring

```python
# דוגמת קוד לבדיקת financial health:
# savings_ratio >= 20% → score=100, 10-20% → 75, 0-10% → 50, <0 → 0
# debt_ratio < 30% → 100, 30-50% → 60, >50% → 20
# balance_trend: improving → 100, stable → 70, declining → 30
# expense_stability: CV < 15% → 100, 15-30% → 70, >30% → 30
# emergency_fund: >= 3 months → 100, 1-3 → 60, <1 → 20
# Grade: 80+ excellent, 60+ good, 40+ fair, 20+ poor, <20 critical
```

| # | תיאור הבדיקה |
|---|-------------|
| DASH-HEALTH-001 | savings_ratio >= 0.20 → savings_score=100 |
| DASH-HEALTH-002 | savings_ratio 0.10-0.20 → savings_score=75 |
| DASH-HEALTH-003 | savings_ratio 0-0.10 → savings_score=50 |
| DASH-HEALTH-004 | savings_ratio < 0 → savings_score=0 |
| DASH-HEALTH-005 | no income → savings_score=0 (or 50 if no expenses) |
| DASH-HEALTH-006 | debt_ratio < 30% → debt_score=100 |
| DASH-HEALTH-007 | debt_ratio 30-50% → debt_score=60 |
| DASH-HEALTH-008 | debt_ratio > 50% → debt_score=20 |
| DASH-HEALTH-009 | balance_trend improving → 100, stable → 70, declining → 30 |
| DASH-HEALTH-010 | expense_stability CV < 15% → 100 |
| DASH-HEALTH-011 | emergency_fund >= 3 months → 100 |
| DASH-HEALTH-012 | grade: excellent (80+), good (60+), fair (40+), poor (20+), critical (<20) |
| DASH-HEALTH-013 | weighted total = sum(score * weight) |

### Upcoming Payments
| # | תיאור הבדיקה |
|---|-------------|
| DASH-UP-001 | fixed income/expense — next_occurrence בטווח ימים |
| DASH-UP-002 | installments — payments_completed < number_of_payments |
| DASH-UP-003 | loans — status="active" |
| DASH-UP-004 | subscriptions — is_active + next_renewal_date בטווח |
| DASH-UP-005 | sorted by due_date ASC |
| DASH-UP-006 | total_upcoming_expenses + total_upcoming_income |

### Subscriptions Summary
| # | תיאור הבדיקה |
|---|-------------|
| DASH-SUB-001 | monthly_equivalent: monthly → *1, quarterly → /3, semi_annual → /6, annual → /12 |
| DASH-SUB-002 | upcoming_renewals_count — תוך 7 ימים |

### Cache
| # | תיאור הבדיקה |
|---|-------------|
| DASH-CACHE-001 | summary — Cache-Control: max-age=60 |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| DASH-ISO-001 | כל ה-endpoints מחזירים רק נתונים לפי DataContext |
| DASH-ISO-002 | org context — aggregate data across all org members |

### Edge Cases
| # | תיאור הבדיקה |
|---|-------------|
| DASH-EDGE-001 | אין נתונים — all zeros, no errors |
| DASH-EDGE-002 | generate_alerts fails — summary עדיין מחזיר data (try/except) |
| DASH-EDGE-003 | _next_occurrence — day_of_month=31 בחודש קצר |

**סה"כ מודול Dashboard: 49 טסטים**

---

## 14. מודול Settings (הגדרות)

**Endpoints:**
- `GET /api/v1/settings` — קריאת הגדרות (auto-create if missing)
- `PUT /api/v1/settings` — עדכון הגדרות (auto-create if missing)

**שדות:** currency, language, theme, notifications_enabled, forecast_months_default, week_start_day, alert_warning_threshold, alert_critical_threshold, onboarding_completed

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| SET-HP-001 | GET — מחזיר הגדרות |
| SET-HP-002 | PUT — עדכון currency |
| SET-HP-003 | PUT — עדכון language, theme |
| SET-HP-004 | PUT — עדכון notification preferences |
| SET-HP-005 | PUT — עדכון week_start_day |
| SET-HP-006 | PUT — עדכון alert thresholds |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| SET-BIZ-001 | GET — auto-create settings אם לא קיימות |
| SET-BIZ-002 | PUT — auto-create settings אם לא קיימות |
| SET-BIZ-003 | ברירות מחדל — currency=ILS, language=he, theme=light, week_start_day=0 |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| SET-ISO-001 | GET — רק הגדרות של המשתמש הנוכחי |
| SET-ISO-002 | PUT — לא יכול לעדכן הגדרות של אחר |

**סה"כ מודול Settings: 11 טסטים**

---

## 15. מודול Currency (מטבעות)

**Endpoints:**
- `GET /api/v1/currency/rates` — שערי מטבע
- `GET /api/v1/currency/convert` — המרת מטבע
- `GET /api/v1/currency/supported` — מטבעות נתמכים

**שירות:** exchange_rate_service (Frankfurter API, cache TTL 1 hour)
**Cache Headers:** max-age

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| CURR-HP-001 | GET rates — שערי מטבע לפי base currency |
| CURR-HP-002 | GET convert — המרה מ-USD ל-ILS |
| CURR-HP-003 | GET supported — רשימת מטבעות נתמכים |

### Edge Cases
| # | תיאור הבדיקה |
|---|-------------|
| CURR-EDGE-001 | המרה מאותו מטבע לעצמו — rate=1 |
| CURR-EDGE-002 | מטבע לא נתמך — error handling |

### Cache
| # | תיאור הבדיקה |
|---|-------------|
| CURR-CACHE-001 | cache headers on responses |

**סה"כ מודול Currency: 6 טסטים**

---

## 16. מודול Export (ייצוא)

**Endpoints:**
- `GET /api/v1/export/transactions` — ייצוא עסקאות (CSV/JSON)
- `GET /api/v1/export/all` — ייצוא כל הנתונים (JSON, rate limited 10/hour)
- `GET /api/v1/export/users` — ייצוא משתמשים (admin only, CSV)

**אבטחה:** CSV formula injection prevention
**תמיכה:** BOM for Excel Hebrew support

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| EXP-HP-001 | ייצוא עסקאות CSV |
| EXP-HP-002 | ייצוא עסקאות JSON |
| EXP-HP-003 | ייצוא כל הנתונים JSON |
| EXP-HP-004 | ייצוא משתמשים CSV (admin) |

### Security
| # | תיאור הבדיקה |
|---|-------------|
| EXP-SEC-001 | CSV formula injection — תאים שמתחילים ב-=, +, -, @ מקבלים prefix |
| EXP-SEC-002 | BOM character בתחילת CSV |
| EXP-SEC-003 | admin only — export users — non-admin → 403 |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| EXP-BIZ-001 | rate limit 10/hour על export/all |
| EXP-BIZ-002 | export/all — כולל transactions, categories, fixed, installments, loans, balance |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| EXP-ISO-001 | ייצוא רק נתוני המשתמש הנוכחי |

**סה"כ מודול Export: 10 טסטים**

---

## 17. מודול Automation (אוטומציה)

**Endpoints:**
- `POST /api/v1/automation/process-recurring` — עיבוד חיובים חוזרים
- `GET /api/v1/automation/preview` — תצוגה מקדימה
- `POST /api/v1/automation/manual-process` — עיבוד ידני
- `POST /api/v1/automation/sync-now` — סנכרון מיידי
- `GET /api/v1/automation/scheduler-status` — סטטוס scheduler

**שירות:** automation_service — process_recurring_charges
**Idempotency:** בדיקת כפילות לפני יצירת transactions

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| AUTO-HP-001 | process-recurring — מעבד fixed, installments, loans |
| AUTO-HP-002 | preview — מחזיר מה יעובד בלי לבצע |
| AUTO-HP-003 | manual-process — עיבוד ידני |
| AUTO-HP-004 | sync-now — סנכרון מיידי |
| AUTO-HP-005 | scheduler-status — מצב ה-scheduler |

### Business Logic — Automation Service

```python
# דוגמת קוד לבדיקת idempotency:
# async def test_idempotency():
#     # Run process_recurring_charges twice
#     result1 = await process_recurring_charges(db, user_id, preview=False)
#     result2 = await process_recurring_charges(db, user_id, preview=False)
#     # Second run should not create duplicate transactions
#     assert result2["loans_processed"] == 0
#     assert result2["fixed_processed"] == 0
#     assert result2["installments_processed"] == 0
```

| # | תיאור הבדיקה |
|---|-------------|
| AUTO-BIZ-001 | _process_loans — WITH FOR UPDATE, idempotency check |
| AUTO-BIZ-002 | _process_loans — status transition active → completed |
| AUTO-BIZ-003 | _process_fixed — end_date check, idempotency |
| AUTO-BIZ-004 | _process_fixed — paused (is_active=False) — skip |
| AUTO-BIZ-005 | _process_installments — WITH FOR UPDATE, idempotency |
| AUTO-BIZ-006 | _process_installments — payments_completed >= number_of_payments — skip |
| AUTO-BIZ-007 | preview mode — returns data without committing |
| AUTO-BIZ-008 | idempotency — הרצה כפולה לא יוצרת transactions כפולים |

**סה"כ מודול Automation: 13 טסטים**

---

## 18. מודול Backups (גיבויים)

**Endpoints:**
- `GET /api/v1/backups` — רשימת גיבויים (admin only)
- `POST /api/v1/backups/trigger` — הפעלת גיבוי (admin, rate limited 3/hour)
- `POST /api/v1/backups/schedule` — תזמון גיבוי (admin)
- `GET /api/v1/backups/{id}` — פרטי גיבוי (admin)
- `DELETE /api/v1/backups/{id}` — מחיקת גיבוי (admin)
- `POST /api/v1/backups/{id}/verify` — אימות גיבוי (admin)

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| BKUP-HP-001 | רשימת גיבויים — admin |
| BKUP-HP-002 | הפעלת גיבוי |
| BKUP-HP-003 | תזמון גיבוי |
| BKUP-HP-004 | קריאת גיבוי |
| BKUP-HP-005 | מחיקת גיבוי |
| BKUP-HP-006 | אימות גיבוי |

### Authorization
| # | תיאור הבדיקה |
|---|-------------|
| BKUP-AUTH-001 | non-admin → 403 על כל ה-endpoints |
| BKUP-AUTH-002 | rate limit 3/hour על trigger |

**סה"כ מודול Backups: 8 טסטים**

---

## 19. מודול Expected Income (הכנסה צפויה)

**Endpoints:**
- `GET /api/v1/expected-income` — רשימה
- `PUT /api/v1/expected-income` — upsert לפי חודש
- `DELETE /api/v1/expected-income/{id}` — מחיקה

**לוגיקה:** month normalized to first day, UniqueConstraint(user_id, month)

### Happy Path
| # | תיאור הבדיקה |
|---|-------------|
| EINC-HP-001 | רשימת הכנסות צפויות |
| EINC-HP-002 | upsert — יצירה חדשה |
| EINC-HP-003 | upsert — עדכון קיים (אותו חודש) |
| EINC-HP-004 | מחיקה |

### Business Logic
| # | תיאור הבדיקה |
|---|-------------|
| EINC-BIZ-001 | month normalized — 2026-02-15 → 2026-02-01 |
| EINC-BIZ-002 | upsert — אם קיים באותו חודש, מעדכן (לא יוצר כפול) |

### Data Isolation
| # | תיאור הבדיקה |
|---|-------------|
| EINC-ISO-001 | רואה רק הכנסות צפויות שלו |

**סה"כ מודול Expected Income: 7 טסטים**

---

## 20. שירותים (Services)

### 20.1 Forecast Service

```python
# compute_monthly_forecast(db, user_id, months, ctx, what_if=None)
# - מחשב balance פתיחה מ-BankBalance
# - לכל חודש: fixed + installments + loans + subscriptions + expected_income + one_time transactions
# - what_if: balance_adjustment, added_income, added_expense
# - מטפל ב-subscriptions: _subscription_hits_month
```

| # | תיאור הבדיקה |
|---|-------------|
| SVC-FC-001 | compute_monthly_forecast — balance פתיחה מ-BankBalance |
| SVC-FC-002 | compute_monthly_forecast — fixed entries מתווספות לחודשים הרלוונטיים |
| SVC-FC-003 | compute_monthly_forecast — installments — only unpaid payments |
| SVC-FC-004 | compute_monthly_forecast — loans — active loans only |
| SVC-FC-005 | compute_monthly_forecast — subscriptions — _subscription_hits_month |
| SVC-FC-006 | compute_monthly_forecast — expected_income integration |
| SVC-FC-007 | compute_monthly_forecast — what_if balance_adjustment |
| SVC-FC-008 | compute_monthly_forecast — what_if added_income spreads across months |
| SVC-FC-009 | compute_monthly_forecast — what_if added_expense spreads across months |
| SVC-FC-010 | compute_weekly_forecast — weekly granularity |
| SVC-FC-011 | _subscription_hits_month — monthly hits every month |
| SVC-FC-012 | _subscription_hits_month — quarterly hits every 3 months |
| SVC-FC-013 | _subscription_hits_month — semi_annual hits every 6 months |
| SVC-FC-014 | _subscription_hits_month — annual hits once a year |
| SVC-FC-015 | currency conversion within forecast — all amounts in base currency |

### 20.2 Financial Aggregator

```python
# get_aggregated_totals(db, user_id, start, end, base_currency, ctx)
# get_aggregated_transactions_range(db, user_id, start, end, base_currency, ctx)
# - מביא one_time transactions
# - מקרין fixed entries, installments, loans
# - deduplicates materialized vs projected using _get_materialized_ids
```

| # | תיאור הבדיקה |
|---|-------------|
| SVC-AGG-001 | totals — includes actual transactions |
| SVC-AGG-002 | totals — includes projected fixed entries |
| SVC-AGG-003 | totals — includes projected installments |
| SVC-AGG-004 | totals — includes projected loans |
| SVC-AGG-005 | deduplication — materialized transaction not counted twice |
| SVC-AGG-006 | deduplication — _get_materialized_ids finds existing transactions |
| SVC-AGG-007 | range — returns list of (type, date, amount) |
| SVC-AGG-008 | currency conversion — amounts converted to base_currency |
| SVC-AGG-009 | paused fixed entries not projected |
| SVC-AGG-010 | completed installments not projected |
| SVC-AGG-011 | completed loans not projected |

### 20.3 Alert Service

```python
# generate_alerts(db, user_id, months=6)
# - Forecast-based: negative_cashflow, high_expenses, approaching_negative
# - Entity-based: high_single_expense (>5000), high_income (>150% avg),
#   payment_overdue, upcoming_payment (3 days), loan_ending_soon (<3 payments),
#   installment_ending_soon (<2 payments)
# - Deterministic key-based upsert preserving is_read state
```

| # | תיאור הבדיקה |
|---|-------------|
| SVC-ALR-001 | negative_cashflow alert — חודש עם closing_balance < 0 |
| SVC-ALR-002 | high_expenses alert — expenses > income * threshold |
| SVC-ALR-003 | approaching_negative — balance dropping close to 0 |
| SVC-ALR-004 | high_single_expense — transaction amount > 5000 |
| SVC-ALR-005 | high_income — > 150% of 3-month average |
| SVC-ALR-006 | payment_overdue — installment/loan overdue |
| SVC-ALR-007 | upcoming_payment — payment within 3 days |
| SVC-ALR-008 | loan_ending_soon — < 3 payments remaining |
| SVC-ALR-009 | installment_ending_soon — < 2 payments remaining |
| SVC-ALR-010 | deterministic upsert — existing alert updated (not duplicated) |
| SVC-ALR-011 | upsert preserves is_read state |
| SVC-ALR-012 | severity levels — warning vs critical based on thresholds from Settings |
| SVC-ALR-013 | expires_at set correctly per alert type |

### 20.4 Exchange Rate Service

```python
# prepare_currency_fields(amount, currency, base_currency)
# - Frankfurter API call with in-memory cache (TTL 1 hour)
# - Fallback to expired cache if API fails
# - Last resort: returns Decimal("1")
```

| # | תיאור הבדיקה |
|---|-------------|
| SVC-EX-001 | same currency — rate=1, no API call |
| SVC-EX-002 | different currency — API call, conversion |
| SVC-EX-003 | cache hit — no API call within TTL |
| SVC-EX-004 | API failure — fallback to expired cache |
| SVC-EX-005 | API failure + no cache — fallback rate=1 |
| SVC-EX-006 | prepare_currency_fields — returns converted_amount, original_amount, original_currency, exchange_rate |

### 20.5 Audit Service

```python
# log_action(db, user_id, action, entity_type, entity_id=None, details=None,
#            request=None, user_email=None, organization_id=None)
# - Fire-and-forget (try/except)
# - Extracts IP and user-agent from request
# - No FK constraint (survives user deletion)
```

| # | תיאור הבדיקה |
|---|-------------|
| SVC-AUD-001 | log_action — creates AuditLog record |
| SVC-AUD-002 | log_action — extracts IP from request |
| SVC-AUD-003 | log_action — extracts user-agent from request |
| SVC-AUD-004 | log_action — fire-and-forget (exception doesn't propagate) |
| SVC-AUD-005 | audit log survives user deletion (no FK constraint) |
| SVC-AUD-006 | log_action — stores organization_id |

### 20.6 Automation Service

| # | תיאור הבדיקה |
|---|-------------|
| SVC-AUTO-001 | _process_loans — creates transaction for each active loan due this month |
| SVC-AUTO-002 | _process_loans — idempotency — won't create duplicate |
| SVC-AUTO-003 | _process_loans — status transition on last payment |
| SVC-AUTO-004 | _process_fixed — creates transaction for active fixed entries |
| SVC-AUTO-005 | _process_fixed — skips ended (end_date < today) |
| SVC-AUTO-006 | _process_fixed — skips paused |
| SVC-AUTO-007 | _process_installments — creates transaction for due installments |
| SVC-AUTO-008 | _process_installments — idempotency |
| SVC-AUTO-009 | _process_installments — skips completed |
| SVC-AUTO-010 | preview mode — no commit |

**סה"כ שירותים: 71 טסטים**

---

## 21. נושאים חוצי-מערכת

### 21.1 Data Integrity (שלמות נתונים)
| # | תיאור הבדיקה |
|---|-------------|
| CROSS-DB-001 | CheckConstraint("amount > 0") — ניסיון ליצור transaction עם amount=0 — DB error |
| CROSS-DB-002 | CheckConstraint("amount > 0") — amount שלילי — DB error |
| CROSS-DB-003 | DECIMAL(15,2) precision — סכומים גדולים (9,999,999,999,999.99) |
| CROSS-DB-004 | DECIMAL(15,2) — עיגול נכון (ROUND_HALF_UP) |
| CROSS-DB-005 | UUID primary keys — uniqueness |
| CROSS-DB-006 | cascade delete — מחיקת user מוחקת transactions, categories, etc. |
| CROSS-DB-007 | UniqueConstraint(org_id, user_id) — OrgMember |
| CROSS-DB-008 | UniqueConstraint(user_id, month) — ExpectedIncome |
| CROSS-DB-009 | foreign key — transaction.category_id references category |
| CROSS-DB-010 | indexes — performance on frequent queries |

### 21.2 Security (אבטחה)
| # | תיאור הבדיקה |
|---|-------------|
| CROSS-SEC-001 | SQL injection prevention — search parameter escaped |
| CROSS-SEC-002 | bcrypt password hashing (not plaintext) |
| CROSS-SEC-003 | JWT secret key — tampered token rejected |
| CROSS-SEC-004 | rate limiting — register (3/min), login (5/min), refresh (10/min), password (5/min) |
| CROSS-SEC-005 | CORS — only allowed origins |
| CROSS-SEC-006 | CSV formula injection prevention in export |
| CROSS-SEC-007 | sensitive data — .env files not exposed |
| CROSS-SEC-008 | token blacklist — revoked tokens rejected |
| CROSS-SEC-009 | password_changed_at invalidation — all old tokens rejected |
| CROSS-SEC-010 | rate limiting — export/all (10/hour), backup/trigger (3/hour) |

### 21.3 Error Handling
| # | תיאור הבדיקה |
|---|-------------|
| CROSS-ERR-001 | NotFoundException → 404 |
| CROSS-ERR-002 | AlreadyExistsException → 409 |
| CROSS-ERR-003 | UnauthorizedException → 401 |
| CROSS-ERR-004 | ForbiddenException → 403 |
| CROSS-ERR-005 | InvalidDateRangeException → 400 |
| CROSS-ERR-006 | NegativeAmountException → 400 |
| CROSS-ERR-007 | CashFlowException → custom status codes |
| CROSS-ERR-008 | Pydantic validation errors → 422 with detailed message |
| CROSS-ERR-009 | UUID format validation — invalid UUID → 422 |
| CROSS-ERR-010 | query parameter validation (pattern, ge, le) |

### 21.4 Concurrency
| # | תיאור הבדיקה |
|---|-------------|
| CROSS-CONC-001 | WITH FOR UPDATE — balance POST/PUT |
| CROSS-CONC-002 | WITH FOR UPDATE — installment mark-paid/reverse-payment |
| CROSS-CONC-003 | WITH FOR UPDATE — loan payment/reverse-payment |
| CROSS-CONC-004 | refresh token blacklist race condition — first wins, second rejected |

### 21.5 Performance
| # | תiאור הבדיקה |
|---|-------------|
| CROSS-PERF-001 | selectinload — transaction.category (avoid N+1) |
| CROSS-PERF-002 | selectinload — upcoming-payments: fixed, installments, loans, subscriptions |
| CROSS-PERF-003 | CASE expression batch update (categories reorder) |
| CROSS-PERF-004 | single DELETE with IN clause (bulk-delete) |
| CROSS-PERF-005 | single query for aggregated ranges (dashboard weekly/monthly/quarterly) |
| CROSS-PERF-006 | exchange rate cache — reduces API calls |

### 21.6 Migration Safety
| # | תיאור הבדיקה |
|---|-------------|
| CROSS-MIG-001 | alembic upgrade head — runs without errors |
| CROSS-MIG-002 | alembic downgrade — reversible migrations |
| CROSS-MIG-003 | seed_data.py — creates admin + default categories |

**סה"כ נושאים חוצי-מערכת: 39 טסטים**

---

## 22. סיכום כמותי

| # | מודול | טסטים |
|---|-------|-------|
| 1 | Auth (אימות) | 36 |
| 2 | Users (ניהול משתמשים) | 20 |
| 3 | Organizations (ארגונים) | 44 |
| 4 | Transactions (עסקאות) | 55 |
| 5 | Categories (קטגוריות) | 26 |
| 6 | Balance (יתרה) | 15 |
| 7 | Fixed (הכנסות/הוצאות קבועות) | 18 |
| 8 | Installments (תשלומים) | 36 |
| 9 | Loans (הלוואות) | 36 |
| 10 | Subscriptions (מנויים) | 23 |
| 11 | Forecast (תחזית) | 27 |
| 12 | Alerts (התראות) | 15 |
| 13 | Dashboard (לוח בקרה) | 49 |
| 14 | Settings (הגדרות) | 11 |
| 15 | Currency (מטבעות) | 6 |
| 16 | Export (ייצוא) | 10 |
| 17 | Automation (אוטומציה) | 13 |
| 18 | Backups (גיבויים) | 8 |
| 19 | Expected Income (הכנסה צפויה) | 7 |
| 20 | Services (שירותים) | 71 |
| 21 | Cross-cutting (חוצי-מערכת) | 39 |
| | **סה"כ** | **565** |

### קיצור אבחנה — כיסוי נוכחי מול תוכנית

| מודול | טסטים קיימים (בערך) | טסטים בתוכנית | פער |
|-------|---------------------|--------------|-----|
| Auth | ~30 | 36 | 6 |
| Users | ~15 | 20 | 5 |
| Organizations | ~25 | 44 | 19 |
| Transactions | ~45 | 55 | 10 |
| Categories | ~5 | 26 | 21 |
| Balance | ~5 | 15 | 10 |
| Fixed | ~15 | 18 | 3 |
| Installments | ~20 | 36 | 16 |
| Loans | ~20 | 36 | 16 |
| Subscriptions | ~10 | 23 | 13 |
| Forecast | ~20 | 27 | 7 |
| Alerts | ~5 | 15 | 10 |
| Dashboard | ~43 | 49 | 6 |
| Settings | ~3 | 11 | 8 |
| Currency | ~5 | 6 | 1 |
| Export | ~10 | 10 | 0 |
| Automation | ~10 | 13 | 3 |
| Backups | ~5 | 8 | 3 |
| Expected Income | ~5 | 7 | 2 |
| Services | ~200+ | 71 | integrated |
| Cross-cutting | ~200+ | 39 | integrated |
| **סה"כ** | **~740** | **565 ייחודיים** | — |

> **הערה:** חלק מהטסטים הקיימים (~740) מכסים edge cases ו-production fixes שנפרסים על פני test_edge_cases.py, test_edge_cases_v2.py, test_production_fixes.py. הטסטים בתוכנית זו מתמקדים בכיסוי מערכתי שלם ומזהים את הפערים העיקריים.

### פערים קריטיים (עדיפות גבוהה)

1. **Categories** — 5 טסטים קיימים מתוך 26 נדרשים. חסר: circular reference, type change prevention, soft delete, reorder
2. **Installments** — חסר: enrichment logic מפורט, RED-8 rounding, concurrency
3. **Loans** — חסר: amortization correctness, status transitions, reverse-payment rebuild
4. **Organizations** — חסר: role-based permissions, data isolation, member management edge cases
5. **Balance** — חסר: concurrency (WITH FOR UPDATE), effective_date logic
6. **Alerts** — חסר: auto-dismiss, snooze logic, unread count
7. **Settings** — חסר: auto-create on first access

---

## נספח א' — דוגמאות קוד לטסטים מורכבים

### א.1 — בדיקת Circular Reference Detection (Categories)

```python
@pytest.mark.asyncio
async def test_circular_reference_detection(client, auth_headers, db):
    """CAT-BIZ-001: Circular parent-child reference prevention"""
    # Create A -> B -> C
    cat_a = await create_category(client, auth_headers, name="A", type="expense")
    cat_b = await create_category(client, auth_headers, name="B", type="expense",
                                   parent_id=cat_a["id"])
    cat_c = await create_category(client, auth_headers, name="C", type="expense",
                                   parent_id=cat_b["id"])

    # Try to make A's parent = C (creating A->B->C->A cycle)
    response = await client.put(
        f"/api/v1/categories/{cat_a['id']}",
        json={"parent_id": cat_c["id"]},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "Circular reference detected" in response.json()["detail"]
```

### א.2 — בדיקת Amortization Last Payment (Loans)

```python
@pytest.mark.asyncio
async def test_amortization_last_payment_absorbs_remainder(client, auth_headers, db):
    """LOAN-AMRT-002: Last payment = remaining balance + interest"""
    from decimal import Decimal
    from app.api.v1.endpoints.loans import _build_amortization

    # Create loan: 10000 ILS, 12 payments, 5% interest
    loan = await create_loan(client, auth_headers,
        original_amount=Decimal("10000"),
        interest_rate=Decimal("5"),
        total_payments=12,
        monthly_payment=Decimal("856.07"),
    )

    schedule = _build_amortization(loan)

    # Sum of all principal portions should equal original_amount exactly
    total_principal = sum(item.principal for item in schedule)
    assert total_principal == Decimal("10000.00")

    # Last payment: principal = remaining balance
    last = schedule[-1]
    assert last.remaining_balance == Decimal("0")
    assert last.principal == schedule[-2].remaining_balance
```

### א.3 — בדיקת Installment Enrichment (Installments)

```python
@pytest.mark.asyncio
async def test_enrichment_overdue_status(client, auth_headers, db):
    """INST-ENR-003: Status = 'overdue' when behind on payments"""
    from datetime import date
    from app.api.v1.endpoints.installments import _enrich_installment

    # Installment started 6 months ago, 12 payments, 0 completed
    inst = MockInstallment(
        start_date=date(2025, 8, 1),
        day_of_month=1,
        number_of_payments=12,
        payments_completed=0,
        total_amount=Decimal("12000"),
        monthly_amount=Decimal("1000"),
    )

    today = date(2026, 2, 18)
    result = _enrich_installment(inst, today=today)

    assert result.status == "overdue"
    assert result.expected_payments_by_now == 7  # Aug-Feb = 7
    assert result.is_on_track == False
    assert result.remaining_amount == Decimal("12000")
    assert result.progress_percentage == 0.0
```

### א.4 — בדיקת Data Isolation (DataContext)

```python
@pytest.mark.asyncio
async def test_personal_vs_org_data_isolation(client, db):
    """ORG-ISO-001/002: Personal and org data are strictly isolated"""
    # Setup: create user, org, switch to org context
    user = await create_and_login_user(client, "user1")
    org = await create_org(client, user["headers"], name="TestOrg")

    # Create personal transaction
    personal_tx = await create_transaction(client, user["headers"],
        amount=100, type="expense")

    # Switch to org context
    await switch_org(client, user["headers"], org["id"])

    # Create org transaction
    org_tx = await create_transaction(client, user["headers"],
        amount=200, type="expense")

    # In org context: should NOT see personal transaction
    org_list = await list_transactions(client, user["headers"])
    assert len(org_list["items"]) == 1
    assert org_list["items"][0]["id"] == org_tx["id"]

    # Switch back to personal
    await switch_org(client, user["headers"], None)

    # In personal context: should NOT see org transaction
    personal_list = await list_transactions(client, user["headers"])
    assert len(personal_list["items"]) == 1
    assert personal_list["items"][0]["id"] == personal_tx["id"]
```

### א.5 — בדיקת Financial Health Score (Dashboard)

```python
@pytest.mark.asyncio
async def test_financial_health_excellent(client, auth_headers, db):
    """DASH-HEALTH-012: Score >= 80 = 'excellent' grade"""
    # Setup: high savings ratio, low debt, improving trend, stable expenses
    await set_balance(client, auth_headers, balance=50000)
    await create_transaction(client, auth_headers, type="income", amount=20000)
    await create_transaction(client, auth_headers, type="expense", amount=10000)

    response = await client.get(
        "/api/v1/dashboard/financial-health",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["score"] >= 80
    assert data["grade"] == "excellent"
    assert len(data["factors"]) == 5

    # Verify weights sum to 1.0
    total_weight = sum(float(f["weight"]) for f in data["factors"])
    assert abs(total_weight - 1.0) < 0.01
```

### א.6 — בדיקת Concurrency (Balance)

```python
@pytest.mark.asyncio
async def test_balance_concurrent_posts(client, auth_headers, db):
    """BAL-CONC-001: Only one is_current=True after concurrent POSTs"""
    import asyncio

    # Create initial balance
    await create_balance(client, auth_headers, balance=1000)

    # Two concurrent POST requests
    tasks = [
        client.post("/api/v1/balance", json={"balance": 2000,
            "effective_date": "2026-02-18"}, headers=auth_headers),
        client.post("/api/v1/balance", json={"balance": 3000,
            "effective_date": "2026-02-18"}, headers=auth_headers),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Verify only one is_current=True
    history = await client.get("/api/v1/balance/history", headers=auth_headers)
    current_entries = [b for b in history.json()["items"] if b["is_current"]]
    assert len(current_entries) == 1
```

---

## נספח ב' — מפת Endpoints מלאה

| מודול | Method | Path | Auth | Rate Limit |
|-------|--------|------|------|------------|
| Auth | POST | /auth/register | None | 3/min |
| Auth | POST | /auth/login | None | 5/min |
| Auth | POST | /auth/refresh | None | 10/min |
| Auth | POST | /auth/logout | JWT | — |
| Auth | GET | /auth/me | JWT | — |
| Auth | PUT | /auth/me | JWT | — |
| Auth | PUT | /auth/password | JWT | 5/min |
| Users | GET | /users | Admin | — |
| Users | POST | /users | Admin | — |
| Users | PUT | /users/{id} | Admin | — |
| Users | DELETE | /users/{id} | Admin | — |
| Users | POST | /users/{id}/reset-password | Admin | — |
| Organizations | POST | /organizations | JWT | — |
| Organizations | GET | /organizations | JWT | — |
| Organizations | GET | /organizations/{id} | Member | — |
| Organizations | PUT | /organizations/{id} | Owner/Admin | — |
| Organizations | DELETE | /organizations/{id} | Owner | — |
| Organizations | POST | /organizations/{id}/members | Owner/Admin | — |
| Organizations | GET | /organizations/{id}/members | Member | — |
| Organizations | PUT | /organizations/{id}/members/{uid} | Owner | — |
| Organizations | DELETE | /organizations/{id}/members/{uid} | Owner/Admin/Self | — |
| Organizations | POST | /organizations/switch | JWT | — |
| Organizations | GET | /organizations/{id}/audit-log | Owner/Admin | — |
| Transactions | GET | /transactions | JWT+Ctx | — |
| Transactions | POST | /transactions | JWT+Ctx | — |
| Transactions | GET | /transactions/{id} | JWT+Ctx | — |
| Transactions | PUT | /transactions/{id} | JWT+Ctx | — |
| Transactions | DELETE | /transactions/{id} | JWT+Ctx | — |
| Transactions | POST | /transactions/{id}/duplicate | JWT+Ctx | — |
| Transactions | POST | /transactions/bulk | JWT+Ctx | — |
| Transactions | PUT | /transactions/bulk-update | JWT+Ctx | — |
| Transactions | POST | /transactions/bulk-delete | JWT+Ctx | — |
| Categories | GET | /categories | JWT+Ctx | — |
| Categories | POST | /categories | JWT+Ctx | — |
| Categories | GET | /categories/{id} | JWT+Ctx | — |
| Categories | PUT | /categories/{id} | JWT+Ctx | — |
| Categories | DELETE | /categories/{id} | JWT+Ctx | — |
| Categories | POST | /categories/reorder | JWT+Ctx | — |
| Balance | GET | /balance | JWT+Ctx | — |
| Balance | PUT | /balance | JWT+Ctx | — |
| Balance | POST | /balance | JWT+Ctx | — |
| Balance | GET | /balance/history | JWT+Ctx | — |
| Fixed | GET | /fixed | JWT+Ctx | — |
| Fixed | POST | /fixed | JWT+Ctx | — |
| Fixed | GET | /fixed/{id} | JWT+Ctx | — |
| Fixed | PUT | /fixed/{id} | JWT+Ctx | — |
| Fixed | DELETE | /fixed/{id} | JWT+Ctx | — |
| Fixed | POST | /fixed/{id}/pause | JWT+Ctx | — |
| Fixed | POST | /fixed/{id}/resume | JWT+Ctx | — |
| Installments | GET | /installments | JWT+Ctx | — |
| Installments | POST | /installments | JWT+Ctx | — |
| Installments | GET | /installments/{id} | JWT+Ctx | — |
| Installments | PUT | /installments/{id} | JWT+Ctx | — |
| Installments | DELETE | /installments/{id} | JWT+Ctx | — |
| Installments | POST | /installments/{id}/mark-paid | JWT+Ctx | — |
| Installments | POST | /installments/{id}/reverse-payment | JWT+Ctx | — |
| Installments | GET | /installments/{id}/payments | JWT+Ctx | — |
| Loans | GET | /loans | JWT+Ctx | — |
| Loans | POST | /loans | JWT+Ctx | — |
| Loans | GET | /loans/{id} | JWT+Ctx | — |
| Loans | PUT | /loans/{id} | JWT+Ctx | — |
| Loans | DELETE | /loans/{id} | JWT+Ctx | — |
| Loans | POST | /loans/{id}/payment | JWT+Ctx | — |
| Loans | POST | /loans/{id}/reverse-payment | JWT+Ctx | — |
| Loans | GET | /loans/{id}/breakdown | JWT+Ctx | — |
| Subscriptions | GET | /subscriptions | JWT+Ctx | — |
| Subscriptions | GET | /subscriptions/upcoming | JWT+Ctx | — |
| Subscriptions | POST | /subscriptions | JWT+Ctx | — |
| Subscriptions | GET | /subscriptions/{id} | JWT+Ctx | — |
| Subscriptions | PUT | /subscriptions/{id} | JWT+Ctx | — |
| Subscriptions | DELETE | /subscriptions/{id} | JWT+Ctx | — |
| Subscriptions | POST | /subscriptions/{id}/pause | JWT+Ctx | — |
| Subscriptions | POST | /subscriptions/{id}/resume | JWT+Ctx | — |
| Forecast | GET | /forecast | JWT+Ctx | — |
| Forecast | GET | /forecast/weekly | JWT+Ctx | — |
| Forecast | GET | /forecast/summary | JWT+Ctx | — |
| Forecast | POST | /forecast/what-if | JWT+Ctx | — |
| Forecast | POST | /forecast/scenarios | JWT+Ctx | — |
| Forecast | GET | /forecast/scenarios | JWT+Ctx | — |
| Forecast | GET | /forecast/scenarios/{id} | JWT+Ctx | — |
| Forecast | GET | /forecast/scenarios/{id}/compute | JWT+Ctx | — |
| Forecast | PUT | /forecast/scenarios/{id} | JWT+Ctx | — |
| Forecast | DELETE | /forecast/scenarios/{id} | JWT+Ctx | — |
| Forecast | POST | /forecast/compare | JWT+Ctx | — |
| Alerts | GET | /alerts | JWT+Ctx | — |
| Alerts | GET | /alerts/unread-count | JWT+Ctx | — |
| Alerts | PUT | /alerts/{id}/read | JWT+Ctx | — |
| Alerts | PUT | /alerts/{id}/unread | JWT+Ctx | — |
| Alerts | POST | /alerts/read-all | JWT+Ctx | — |
| Alerts | POST | /alerts/{id}/snooze | JWT+Ctx | — |
| Alerts | POST | /alerts/{id}/dismiss | JWT+Ctx | — |
| Dashboard | GET | /dashboard/summary | JWT+Ctx | — |
| Dashboard | GET | /dashboard/weekly | JWT+Ctx | — |
| Dashboard | GET | /dashboard/monthly | JWT+Ctx | — |
| Dashboard | GET | /dashboard/quarterly | JWT+Ctx | — |
| Dashboard | GET | /dashboard/category-breakdown | JWT+Ctx | — |
| Dashboard | GET | /dashboard/upcoming-payments | JWT+Ctx | — |
| Dashboard | GET | /dashboard/financial-health | JWT+Ctx | — |
| Dashboard | GET | /dashboard/installments-summary | JWT+Ctx | — |
| Dashboard | GET | /dashboard/loans-summary | JWT+Ctx | — |
| Dashboard | GET | /dashboard/top-expenses | JWT+Ctx | — |
| Dashboard | GET | /dashboard/subscriptions-summary | JWT+Ctx | — |
| Settings | GET | /settings | JWT | — |
| Settings | PUT | /settings | JWT | — |
| Currency | GET | /currency/rates | JWT | — |
| Currency | GET | /currency/convert | JWT | — |
| Currency | GET | /currency/supported | JWT | — |
| Export | GET | /export/transactions | JWT+Ctx | — |
| Export | GET | /export/all | JWT+Ctx | 10/hour |
| Export | GET | /export/users | Admin | — |
| Automation | POST | /automation/process-recurring | JWT | — |
| Automation | GET | /automation/preview | JWT | — |
| Automation | POST | /automation/manual-process | JWT | — |
| Automation | POST | /automation/sync-now | JWT | — |
| Automation | GET | /automation/scheduler-status | JWT | — |
| Backups | GET | /backups | Admin | — |
| Backups | POST | /backups/trigger | Admin | 3/hour |
| Backups | POST | /backups/schedule | Admin | — |
| Backups | GET | /backups/{id} | Admin | — |
| Backups | DELETE | /backups/{id} | Admin | — |
| Backups | POST | /backups/{id}/verify | Admin | — |
| Expected Income | GET | /expected-income | JWT+Ctx | — |
| Expected Income | PUT | /expected-income | JWT+Ctx | — |
| Expected Income | DELETE | /expected-income/{id} | JWT+Ctx | — |

**סה"כ: 113 endpoints**

---

> **סוף המסמך**
> תוכנית בדיקות מקיפה — Backend CashFlow Management
> 565 test cases | 21 מודולים | 113 endpoints | 6 services
