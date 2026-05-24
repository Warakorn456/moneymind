# MoneyMind — CLAUDE.md

แอปจัดการการเงินส่วนตัวภาษาไทย เขียนเป็น Single HTML File ไม่มี build process ไม่มี framework ไม่มี dependencies ที่ต้อง install

## สถาปัตยกรรม

**ไฟล์เดียว:** `index.html` (~10,700 บรรทัด) — HTML + CSS + Vanilla JavaScript ทั้งหมดอยู่ในไฟล์เดียว

```
index.html
├── <head>         — CDN links (Chart.js, Firebase, Font Awesome, Sarabun)
├── <style>        — CSS ทั้งหมด (บรรทัด 9–840 โดยประมาณ)
├── <body>         — HTML structure, sidebar nav, หน้าทุกหน้า
└── <script>       — JavaScript ทั้งหมด (บรรทัด 2364–11429)
```

ไม่มี `package.json`, `node_modules`, build tool, หรือ test suite — เปิดไฟล์ใน browser ได้เลย

## External Dependencies (CDN เท่านั้น)

| Library | Version | ใช้ทำอะไร |
|---------|---------|-----------|
| Chart.js | 4.4.0 | กราฟ Pie, Bar, Area |
| Firebase App + Firestore | 9.23.0 | Cloud sync ข้ามอุปกรณ์ |
| Font Awesome | 6.5.1 | Icons |
| Google Fonts (Sarabun) | — | ฟอนต์ภาษาไทย |
| Google Gemini API | v1beta | AI สแกนใบเสร็จ, AI Chat |
| CoinGecko API | v3 | ราคาคริปโตเรียลไทม์ |

## Data Model

Global object `DB` เก็บข้อมูลทั้งหมดในหน่วยความจำ:

```js
DB = {
  transactions: [],     // {id, date, type, amount, category, description, tags, isFixed, bankId, ...}
  savings: [],          // {id, name, target, current, ...}
  debts: [],            // {id, name, total, remaining, dueDate, pay, ...}
  investments: [],      // {id, name, type, value, ...}
  subscriptions: [],    // {id, name, price, cycle, nextDate, cat, color, active}
  calNotes: {},         // {"YYYY-MM-DD": [{id, text, color}]}
  forecastCfg: {},      // {startBal, dailyExp, scenario, customEvents}
  wishlist: [],         // (legacy — ไม่แสดง UI แล้ว ข้อมูลยังอยู่ใน DB)
  settings: {
    apiKey: '',         // Google Gemini API Key
    geminiModel: '',
    customIncCats: [],
    customExpCats: [],
    fixedExpCats: [],   // categories ที่ถือว่าเป็นค่าใช้จ่ายคงที่
    dashOrder: [],      // ลำดับ section บน Dashboard
    navOrder: [],       // ลำดับ nav items ใน sidebar
  },
  tax: {},
  plan: { monthlyIncome:0, otherAssets:0, items:[], extraAssets:[], extraDebts:[] },
  profile: {},
  retire: { retireAge:60, lifeAge:85, monthlyExpense:30000, inflation:3, returnRate:7,
            postReturnRate:4, sso:750, pvd:0, portOverride:null, curAgeOverride:null },
  _savedAt: 0,          // timestamp สำหรับ conflict resolution กับ Firestore
}
```

## Storage Layer

| Storage | Key | ใช้เก็บ |
|---------|-----|---------|
| `localStorage` | `mm_users` | `[{username, salt, hash}]` — user list |
| `localStorage` | `mm_session` | `{username, ts}` — session ปัจจุบัน |
| `localStorage` | `mm_data_<username>` | DB object ของแต่ละ user |
| Firebase Firestore | `users/<username>` | Cloud backup — sync 2 ทาง |

ลำดับ sync: localStorage → Firestore (ถ้า login) → conflict resolution ด้วย `_savedAt`

## Pages & Navigation

`const PAGE_TITLE` อยู่บรรทัด ~3215 — รวมทุก page key ไว้ที่เดียว  
Navigation ผ่าน `nav(page)` — routing อยู่ใน `renderPage(p)` บรรทัด ~3233:

| Page key | หน้า | render function |
|----------|------|----------------|
| `dashboard` | Dashboard | `renderDash()` |
| `transactions` | รายรับ-รายจ่าย | `renderTx()` |
| `recurring` | รายการซ้ำ | `renderRecurring()` |
| `ot` | คำนวณ OT | `renderOT()` |
| `loan` | คำนวณสินเชื่อ | `renderLoan()` |
| `subscriptions` | Subscriptions | `renderSubscriptions()` |
| `calendar` | ปฏิทิน | `renderCalendarPage()` |
| `savings` | เงินออม | — |
| `banks` | ธนาคาร | — |
| `debts` | หนี้สิน | — |
| `investments` | พอร์ตลงทุน | `renderInv()` |
| `tax` | ภาษีเงินได้ | `renderTax()` |
| `balance` | งบดุล & แผน | — |
| `retire` | แผนเกษียณ | `renderRetire()` |
| `profile` | ประวัติส่วนตัว | — |
| `settings` | ตั้งค่า | `renderSettings()` |
| `admin` | Admin Dashboard | `renderAdmin()` |
| `forecast` | พยากรณ์กระแสเงินสด | `renderForecast()` (ไม่มีใน nav แต่ยังใช้งานได้) |

**Sidebar nav** — items มี `data-nav="<key>"` และ `draggable="true"` รองรับ drag-and-drop reorder  
ลำดับถูกบันทึกใน `DB.settings.navOrder` — ดูโค้ดที่ `// NAV SORTABLE` บรรทัด ~11332

## UI/CSS Conventions

- **CSS Variables:** `--primary`, `--primary-l`, `--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--red`
- **Dark mode** เป็นค่าเริ่มต้น, toggle ด้วย class `body.light-mode`
- **Responsive:** breakpoints ที่ 860px และ 768px
- **Component classes:** `.card`, `.btn`, `.finput`, `.fselect`, `.flabel`, `.ftab`, `.pbar/.pfill`
- **Toast:** `toast(message, type)` — type: `'success'` | `'error'` | `'info'`

## Helper Functions สำคัญ

```js
fmt(number)              // format ตัวเลขเป็น ฿X,XXX
saveDB()                 // save localStorage + sync Firestore
saveLocalOnly()          // save เฉพาะ localStorage
loadDB()                 // load จาก localStorage
nav(page)                // navigate ไปหน้า
monthTx(m, y)            // กรอง transactions ของเดือน/ปีที่ระบุ
calcNetWorth()           // คำนวณ Net Worth ปัจจุบัน
getCat(id, type)         // ดึง category object
toast(msg, type)         // แสดง notification
uid()                    // สร้าง unique ID
_escHtml(s)              // escape HTML string (บรรทัด ~11428)
```

## โครงสร้าง Script Block (บรรทัด 2364–11429)

```
~2364–3215   Auth, DB helpers, nav, renderPage, PAGE_TITLE
~3216–7390   Core renders: renderDash, renderTx, renderTx, renderInv, renderTax,
             renderSettings, renderRetire, renderBalance, renderBanks, ...
~7391–7395   INIT block — checkLogin() + renderDash() on load
~7396–7500   AI Chat (buildFinanceContext, toggleChat, sendChat, rulesAI)
~7500–8948   Features 1–9: notifications, categories, recurring, export, OT, ฯลฯ
~8949–10300  PATCHES: renderDash, renderSettings, saveTx, renderTx
             + Quick Add, Bank Transfer, YTD, Savings Rate, Top Merchants,
               NW Milestone, Heatmap, Monthly Comparison, RVV, Loan Calc
~10305–10440 Dashboard Section Reorder (drag-and-drop, DB.settings.dashOrder)
~10441–10840 RVV (Recurring vs Variable), YTD Summary
~10841–11150 Calendar Page (renderCalendarPage, calNav, calSelectDay, ฯลฯ)
~11151–11330 Subscription Manager (renderSubscriptions, saveSub, ฯลฯ)
~11332–11428 Nav Sortable (drag-and-drop sidebar reorder)
```

## ฟีเจอร์ทั้งหมด

| กลุ่ม | ฟีเจอร์ |
|-------|---------|
| Core | รายรับ-รายจ่าย (Fixed/Variable toggle), เงินออม, ธนาคาร, หนี้สิน, พอร์ตลงทุน |
| Core | ภาษีเงินได้, งบดุล, แผนเกษียณ, รายการซ้ำ, Subscriptions |
| Tools | คำนวณ OT (×1/×1.5/×3), คำนวณสินเชื่อ (ตาราง amortization) |
| Calendar | ปฏิทินพร้อมโน้ต, แสดง transactions/recurring/debt due, month/year picker |
| AI | แชทกับ Maya (Gemini + rule-based), สแกนใบเสร็จ/สลิปภาษี |
| Dashboard | Health Score, NW History, Monthly Comparison, Spending Heatmap, YTD Summary |
| Dashboard | RVV (Fixed vs Variable), 50/30/20, Emergency Fund, Pay Yourself First |
| Dashboard | Drag-and-drop reorder sections (DB.settings.dashOrder) |
| Transactions | Tags, Search, Export CSV, Quick Add, Undo, Category Budget |
| Advanced | Cash Flow Forecast, Debt Payoff Planner, Investment Rebalancing |
| System | PIN Lock, Dark/Light mode, Multi-currency, Bank Transfer, NW Milestones |
| System | Sidebar nav reorder (DB.settings.navOrder) |

## Pattern การเพิ่มฟีเจอร์ใหม่

ฟีเจอร์ใหม่ **ไม่แก้โค้ดเดิม** — ใช้ monkey-patch แทน:

```js
const _orig = renderDash;
renderDash = function(){
  _orig();
  renderMyNewFeature();
};
```

เพิ่มใหม่ที่ **ท้าย script block** (ก่อน `_escHtml`) หรือต่อจาก section สุดท้าย  
**ระวัง:** อย่า redeclare `let`/`const` ที่มีอยู่แล้ว — จะเกิด SyntaxError

## ข้อควรระวัง (Gotchas)

- **TDZ:** `let`/`const` ที่ declare หลัง INIT block (~7391) จะ error ถ้า renderDash เรียกก่อน — declare ก่อน `checkLogin()` เสมอ
- **Gemini response:** กรอง thinking parts ด้วย `.filter(p=>!p.thought)` — `gemini-2.5-flash` ส่ง thinking parts มาด้วย
- **ไฟล์ใหญ่:** ต้อง Grep หาตำแหน่งก่อนทุกครั้ง ห้าม Read ทั้งไฟล์ ใช้ offset/limit เสมอ
- **Firebase config:** เข้ารหัสใน `_ENC` object (บรรทัดยาวมากใกล้ต้นไฟล์) — ไม่ต้องแตะ
- **Single `<script>` block:** บรรทัด 2364–11429 — อย่า add `<script>` tag ใหม่
- **Admin nav:** แสดงเฉพาะ owner (`currentUser === _ENC.user`) — จัดการโดย `_syncAdminNav()`
- **Dashboard flash fix:** `renderDash` ซ่อน container ก่อน reorder แล้ว restore เพื่อไม่ให้กระพริบ

## วิธี Deploy

Static file — ไม่ต้อง build:
- เปิด `index.html` ใน browser โดยตรง
- หรือ host บน GitHub Pages, Netlify, Firebase Hosting
