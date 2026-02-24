---
phase: 5A-pre-deploy-fixes
plan: "02"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/i18n/locales/he.json
  - frontend/src/i18n/locales/en.json
  - frontend/src/pages/CreditCardsPage.tsx
  - frontend/src/pages/AlertsPage.tsx
autonomous: true
requirements:
  - FE-01
  - FE-02
  - FE-03

must_haves:
  truths:
    - "CreditCardsPage displays no raw translation keys (no untranslated t('...') output visible in UI)"
    - "The 'Add Card' button and all credit card labels render in Hebrew when language is Hebrew"
    - "The alerts snooze dropdown opens and displays options without being clipped by parent card overflow"
  artifacts:
    - path: "frontend/src/i18n/locales/he.json"
      provides: "Complete Hebrew translations for all keys used in CreditCardsPage"
      contains: "creditCards"
    - path: "frontend/src/i18n/locales/en.json"
      provides: "Complete English translations matching Hebrew keys 1:1"
      contains: "creditCards"
    - path: "frontend/src/pages/AlertsPage.tsx"
      provides: "Snooze dropdown with overflow-visible on parent card"
  key_links:
    - from: "frontend/src/pages/CreditCardsPage.tsx"
      to: "frontend/src/i18n/locales/he.json"
      via: "react-i18next t() function"
      pattern: "t\\('creditCards\\."
    - from: "frontend/src/pages/AlertsPage.tsx"
      to: "CSS overflow property"
      via: "Tailwind class on parent card wrapper"
      pattern: "overflow-hidden|overflow-visible"
---

<objective>
Fix three frontend UI bugs in the React application: missing/wrong Hebrew translation keys on CreditCardsPage (FE-01, FE-02) and a snooze dropdown clipping bug on AlertsPage (FE-03).

Purpose: The app must display correct Hebrew text with no raw translation key strings visible, and the snooze dropdown must be usable. These are visible defects that will be immediately apparent to any user.
Output: Updated he.json + en.json with all CreditCardsPage translation keys. Fixed AlertsPage overflow. TypeScript build passes.
</objective>

<execution_context>
@/Users/roeiedri/.claude/get-shit-done/workflows/execute-plan.md
@/Users/roeiedri/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/5A-pre-deploy-fixes/5A-CONTEXT.md
@.planning/phases/5A-pre-deploy-fixes/5A-RESEARCH.md

@frontend/src/pages/CreditCardsPage.tsx
@frontend/src/pages/AlertsPage.tsx
@frontend/src/i18n/locales/he.json
@frontend/src/i18n/locales/en.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: FE-01 + FE-02 — Audit and fix CreditCardsPage translation keys</name>
  <files>
    frontend/src/i18n/locales/he.json
    frontend/src/i18n/locales/en.json
    frontend/src/pages/CreditCardsPage.tsx
  </files>
  <action>
**AUDIT FIRST — do not assume bugs exist or are fixed:**

Step 1: Extract every translation key used in CreditCardsPage.tsx:
```bash
grep -o "t('[^']*')" /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend/src/pages/CreditCardsPage.tsx | sort -u
```

Step 2: Extract all keys currently in he.json under `creditCards`:
```bash
grep -A 200 '"creditCards"' /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend/src/i18n/locales/he.json | head -100
```

Step 3: Diff — identify keys used in the page but absent from he.json.

**FE-02 check:** Look for `t('creditCards.add')` in CreditCardsPage.tsx. Research says this is already `t('creditCards.addCard')`. If no `creditCards.add` usage found, FE-02 is already fixed — note in summary.

**FE-01 fix:** For each key found in step 3 (used in page, missing from he.json):
- Add it to `creditCards` object in he.json with a meaningful Hebrew translation
- Add the identical key to en.json with English translation
- Keys must be added in alphabetical order within the creditCards object to maintain consistency

Common missing keys to look for (from research): statusActive, statusInactive, billingDate, creditLimit, availableCredit, lastFourDigits, expiryDate, cardType, cardHolder.

For all additions, the Hebrew text must be grammatically correct RTL Hebrew. Example translations (adjust as needed based on actual keys found):
- statusActive → "פעיל"
- statusInactive → "לא פעיל"
- billingDate → "תאריך חיוב"
- creditLimit → "מסגרת אשראי"
- availableCredit → "אשראי זמין"
- lastFourDigits → "4 ספרות אחרונות"
- expiryDate → "תאריך תפוגה"
- cardType → "סוג כרטיס"
- cardHolder → "שם בעל הכרטיס"

Ensure he.json and en.json remain valid JSON after edits (no trailing commas, properly nested).

Step 4: After editing, verify TypeScript build catches no i18n issues:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -20
```
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -10</automated>
    <manual>Run `npm run dev` and navigate to the CreditCardsPage in the browser. Verify no raw t('...') keys are visible — all text is proper Hebrew or English depending on language setting.</manual>
  </verify>
  <done>TypeScript build passes. Every key used by t() in CreditCardsPage.tsx exists in both he.json and en.json under `creditCards`. FE-02 status documented (already fixed or fixed now).</done>
</task>

<task type="auto">
  <name>Task 2: FE-03 — Fix alerts snooze dropdown overflow clipping</name>
  <files>frontend/src/pages/AlertsPage.tsx</files>
  <action>
**AUDIT FIRST:**

Read AlertsPage.tsx. Find the snooze dropdown — search for "snooze" and related dropdown/select elements.

The issue: The parent card wrapper has `overflow-hidden` (from Tailwind) which clips the dropdown when it opens. The fix is to change the parent card container's overflow class.

Step 1: Find the parent container(s) that wrap the snooze dropdown. The research identified lines 162 and 1080 as having `overflow-hidden`. Read the component structure:
```bash
grep -n "overflow-hidden\|overflow-visible\|snooze\|dropdown\|select" /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend/src/pages/AlertsPage.tsx | head -40
```

Step 2: Identify the CARD-level container (the div wrapping the entire alert card that contains the snooze controls). Change its `overflow-hidden` to `overflow-visible`.

Important: Only change `overflow-hidden` to `overflow-visible` on containers that directly wrap the snooze dropdown. Do NOT change overflow on containers where `overflow-hidden` serves a legitimate purpose (e.g., image containers, skeleton loaders, scrollable areas with many alerts).

Step 3: If the snooze UI is inside a `<select>` HTML element: HTML selects render natively outside the DOM flow, so overflow-hidden should not clip them. In this case, look for a custom dropdown component (div-based with absolute positioning) — that would be clipped by overflow-hidden. Change overflow-hidden → overflow-visible on its parent and any grandparent card containers.

Step 4: Verify the fix does not break the overall alert card layout. Cards should still have proper containment for their main content area.

After fix, run TypeScript build:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -10
```
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | grep -E "error|Error|built in" | head -10</automated>
    <manual>Run the dev server and navigate to AlertsPage. Find an alert with a snooze option. Click the snooze dropdown. Verify it opens fully without being cut off. The dropdown should appear above the card boundary if necessary.</manual>
  </verify>
  <done>TypeScript build passes. AlertsPage.tsx has overflow-visible (not overflow-hidden) on the parent container of the snooze dropdown. Snooze dropdown is no longer clipped.</done>
</task>

</tasks>

<verification>
Final build check:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -5
```
Expected: "built in X.Xs" with no errors.

JSON validity check:
```bash
python3 -m json.tool /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend/src/i18n/locales/he.json > /dev/null && echo "he.json valid" && python3 -m json.tool /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend/src/i18n/locales/en.json > /dev/null && echo "en.json valid"
```
Expected: Both files parse as valid JSON.
</verification>

<success_criteria>
- frontend/src/i18n/locales/he.json and en.json contain all keys used by CreditCardsPage.tsx (FE-01)
- No `t('creditCards.add')` usage in CreditCardsPage.tsx — only `t('creditCards.addCard')` (FE-02 verified/fixed)
- AlertsPage.tsx parent card container uses overflow-visible, not overflow-hidden, for the snooze section (FE-03)
- `npm run build` passes with zero TypeScript errors
- Both JSON locale files are valid JSON
</success_criteria>

<output>
After completion, create `.planning/phases/5A-pre-deploy-fixes/5A-02-SUMMARY.md` with:
- List of translation keys added to he.json + en.json (or count if many)
- FE-02 status: already fixed or newly fixed (which 3 occurrences)
- FE-03 fix: which lines changed, from what to what
- Build status: passing
</output>
