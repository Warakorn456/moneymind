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

---

## Infrastructure & Integrations

โปรเจกต์นี้เชื่อมต่อกับ external services หลายตัว:

| Service | รายละเอียด | หน้าที่ |
|---------|-----------|---------|
| **n8n** | `localhost:5678` (run ด้วย `npx n8n`) | Workflow automation |
| **Google Sheets** | "MoneyMind" (`1IdfyUExUkkDFK7es4mnUWE5gvXpspHx6PaOJtBR05zg`) | พักข้อมูล bank transactions |
| **Firebase Firestore** | config ใน `_ENC` (ต้นไฟล์ index.html) | Cloud sync ข้ามอุปกรณ์ |
| **GitHub** | repo นี้ | deploy via GitHub Pages |
| **Gmail (OAuth2)** | credential ID `v7EQvnFH4mbTwfHL` ใน n8n | ดัก bank email |
| **Telegram Bot** | `@moneymind_alert_bot` token: `8841603911:AAFz0JrEZcMTc5nxtxmzSAmg5y4w7odwi5o` chat_id: `8172260229` | แจ้งเตือนและตอบคำสั่ง |
| **Telegram Group** | MoneyMind Hub — group_id: `-1004296300749` topic หุ้น: thread_id=`3`, topic การเงิน: thread_id=`4` | รับแจ้งเตือนทุก script |
| **Google Cloud VM** | e2-micro, us-central1-a, IP: `34.16.55.125` project: `teak-perigee-497404-b7` | รัน Telegram bot 24/7 |

---

## Telegram Bot — ฟังก์ชันทั้งหมด

Bot รันบน **GCP VM** (ไม่ใช่โน้ตบุค) — ปิดเครื่องได้ bot ยังทำงาน

### Telegram Group — MoneyMind Hub (สร้าง 2026-05-30)
- Group ID (Bot API): `-1004296300749`
- topic `📈 หุ้น` → `message_thread_id=3`
- topic `💰 การเงิน` → `message_thread_id=4`
- Stock scripts (9 ตัว) ส่งไป thread 3, Finance scripts (7 ตัว) ส่งไป thread 4
- `stock_bot.py` รับคำสั่งจากทั้ง personal chat (`8172260229`) และ group แล้ว reply ใน thread เดิม

### คำสั่ง Interactive (พิมในแชท)
| คำสั่ง | คำที่ใช้ | ผลลัพธ์ |
|--------|---------|---------|
| ดูราคาหุ้น | `ราคา` / `หุ้น` / `price` / `stock` | ราคาหุ้น (dynamic จาก Firestore portfolio) เรียงตาม % change |
| ดูพอร์ต | `พอต` / `port` / `portfolio` | มูลค่าพอร์ตแต่ละตัว + กำไร/ขาดทุน |

### แจ้งเตือนอัตโนมัติ
| ฟังก์ชัน | ความถี่ | trigger |
|---------|---------|---------|
| รายงานราคาประจำวัน | ทุกวัน 09:00 Bangkok (cron 02:00 UTC) | อัตโนมัติ |
| แจ้งเตือนหุ้นแกว่ง ≥10% | ทุก 30 นาที จ.–ศ. (GCP cron) | stock_alert.py |
| แจ้งเตือนงบประมาณเกิน 80% | ทุก 12 ชั่วโมง (n8n workflow) | budget-alert-01 |

### หุ้นที่ติดตาม (28 ตัว)
```
ASTS, RKLB, MSFT, NVDA, META, TSLA, IREN, IONQ, AMD, OKLO,
GOOG, AMZN, LLY, TSM, AAPL, CRWD, PLTR, AVGO, MU, SNDK,
INTC, ARM, EOSE, RGTI, IBM, ORCL, CRWV, ONDS
```

### Source Files Mapping — โน้ตบุค → GCP VM

> **สำคัญ:** ไฟล์บนโน้ตบุคบางตัว **ล้าหลัง** VM เพราะ patch ทำตรงบน VM  
> วิธี deploy ที่ถูกต้อง: `gcloud compute scp <local_file> warakornbest6@moneymind-bot:/home/warakornbest6/moneymind/<file> --zone=us-central1-a`

| โน้ตบุค (`C:\Users\warakorn\Documents\`) | VM (`/home/warakornbest6/moneymind/`) | หมายเหตุ |
|------------------------------------------|--------------------------------------|----------|
| `gmail_bank_alert.py` | `gmail_bank_alert.py` | ✅ sync — ส่งไป group topic 💰 การเงิน (TG_CHAT=`-1004296300749`, TG_TOPIC=`4`) |
| `stock_bot.py` | `stock_bot.py` | ⚠️ VM version ใหม่กว่า (มี GROUP_ID, thread_id, dynamic stock count) |
| `stock_daily_report.py` | `stock_daily_report.py` | deploy ได้ตามปกติ |
| `stock_alert.py` | `stock_alert.py` | deploy ได้ตามปกติ |
| `daily_briefing.py` | `daily_briefing.py` | deploy ได้ตามปกติ |
| `health_monitor.py` | `health_monitor.py` | deploy ได้ตามปกติ |
| `monthly_report.py` | `monthly_report.py` | deploy ได้ตามปกติ |
| `weekly_ai_coach.py` | `weekly_ai_coach.py` | deploy ได้ตามปกติ |
| `news_sentiment.py` | `news_sentiment.py` | deploy ได้ตามปกติ |
| `calendar_reminder.py` | `calendar_reminder.py` | deploy ได้ตามปกติ |
| `bank_statement_analysis.py` | `bank_statement_analysis.py` | deploy ได้ตามปกติ |

### Firestore Paths — ที่ GCP Scripts ใช้

URL เดียวสำหรับทุก script:
```
https://firestore.googleapis.com/v1/projects/moneymind-d97f3/databases/(default)/documents/userdata/warakorn
```

| การใช้งาน | script | วิธีเข้าถึง |
|-----------|--------|------------|
| อ่าน symbols หุ้นในพอร์ต (USD, qty>0) | `stock_bot.py` → `get_symbols_from_firestore()` | `fields.db.stringValue` → JSON → `investments[].name` |
| อ่าน DB ทั้งหมด (budget/debt/saving/summary) | `stock_bot.py` → `_fetch_db()` | `fields.db.stringValue` → JSON |
| เขียน transaction ใหม่ | `stock_bot.py` → `save_to_firestore(tx)` | PATCH — append ใน `transactions[]` |
| อ่าน portfolio มูลค่า | `stock_bot.py` → `get_portfolio()` | `fields.db.stringValue` → `investments[]` |

`gmail_bank_alert.py` ไม่ได้ต่อ Firestore โดยตรง — เขียนลง `gmail_pending.json` แล้วให้ `stock_bot.py` จัดการเมื่อกดปุ่ม ✅

### โครงสร้าง stock_bot.py — Key Functions

| บรรทัด | ฟังก์ชัน | หน้าที่ |
|--------|----------|---------|
| ~16–24 | constants | `TOKEN`, `CHAT_ID`, `GROUP_ID`, `API`, `FIRESTORE_URL` |
| ~58 | `send(chat_id, text, thread_id=None)` | ส่ง Telegram message (รองรับ group topic) |
| ~71 | `fetch_quotes(symbols)` | ดึงราคาหุ้นจาก Yahoo Finance |
| ~82 | `get_symbols_from_firestore()` | อ่าน symbols USD จาก Firestore investments |
| ~97 | `get_prices(symbols=None)` | รวม quotes + format (รับ pre-fetched symbols ได้) |
| ~136 | `get_portfolio()` | ดึงพอร์ตพร้อมราคาปัจจุบัน + FX |
| ~211 | `get_summary()` | สรุปรายรับ-รายจ่ายเดือนนี้ |
| ~264 | `_fetch_db()` | อ่าน DB ทั้งหมดจาก Firestore |
| ~282 | `get_budget_data()` | งบแต่ละหมวด + % ที่ใช้ |
| ~312 | `get_debt_data()` | หนี้คงเหลือ |
| ~339 | `get_saving_data()` | เงินออมแต่ละกอง |
| ~410 | `save_to_firestore(tx)` | PATCH transaction ลง Firestore |
| ~459 | `load_dca()` / `save_dca()` | DCA tracker (JSON file) |
| ~542 | `load_targets()` / `save_targets()` | SL/TP targets (JSON file) |
| ~582 | `main()` | long-polling loop — getUpdates ทุก 30s |
| ~600 | callback handler | จัดการ inline button (confirm/skip/cat:) |
| ~681 | message handler | กรอง CHAT_ID/GROUP_ID → dispatch คำสั่ง |

### ไฟล์ Bot บนโน้ตบุค (C:\Users\warakorn\Documents\)
| ไฟล์ | หน้าที่ |
|------|---------|
| `stock_bot.py` | source สำรอง — **ล้าหลัง VM** อย่า deploy ทับโดยไม่ตรวจก่อน |
| `stock_daily_report.py` | ไม่ใช้แล้ว (ย้ายไป GCP) |
| `stock_alert.py` | แจ้งเตือนแกว่ง ≥10% — ย้ายไป GCP cron แล้ว |

### ไฟล์ Bot บน GCP VM (/home/warakornbest6/moneymind/)
| ไฟล์ | หน้าที่ |
|------|---------|
| `stock_bot.py` | Interactive bot (systemd service: moneymind-bot) — เวอร์ชัน canonical |
| `stock_daily_report.py` | Daily 09:00 report (cron) |
| `bot_offset.json` | Telegram update offset |
| `stock_bot.log` | Log file |

### วิธีจัดการ GCP Bot
```bash
# ดู status
gcloud compute ssh warakornbest6@moneymind-bot --zone=us-central1-a --command="sudo systemctl status moneymind-bot"

# ดู log
gcloud compute ssh warakornbest6@moneymind-bot --zone=us-central1-a --command="tail -20 ~/moneymind/stock_bot.log"

# restart bot
gcloud compute ssh warakornbest6@moneymind-bot --zone=us-central1-a --command="sudo systemctl restart moneymind-bot"

# อัพเดทไฟล์ bot (รันจาก PowerShell หลัง gcloud auth)
$content = Get-Content "C:\Users\warakorn\Documents\stock_bot.py" -Raw -Encoding UTF8
$encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))
gcloud compute ssh warakornbest6@moneymind-bot --zone=us-central1-a --command="echo '$encoded' | base64 -d > ~/moneymind/stock_bot.py && sudo systemctl restart moneymind-bot"
```

### gcloud CLI (ติดตั้งแล้วที่ C:\Users\warakorn\AppData\Local\Google\Cloud SDK\)
```powershell
# ต้อง set PATH ก่อนทุกครั้ง
$env:PATH += ";C:\Users\warakorn\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
# project และ zone ตั้งค่าไว้แล้ว: teak-perigee-497404-b7 / us-central1-a
```

---

## n8n Workflows

### "MoneyMind Gmail Import" (Workflow ID: `y6gGC6tBWqIeOKbR`)
- **Pipeline:** Gmail Trigger → Get Gmail Message → Parse Bank Email → Write to Google Sheets
- **Sheet/Tab:** "PendingTx" — columns: `id, bank, amount, type, desc, date, raw, status, ts`
- **MoneyMind poll URL:** ตั้งใน `DB.settings.gmailImportUrl` — app poll ทุก 1 นาที

### "MoneyMind Budget Alert" (Workflow ID: `budget-alert-01`)
- **Pipeline:** Schedule (12h) → Fetch Firestore → Calculate Budget → Has Alerts? → Send Email + Telegram
- **Firestore URL:** `https://firestore.googleapis.com/v1/projects/moneymind-d97f3/databases/(default)/documents/userdata/warakorn`
- **Alert threshold:** ≥80% ของงบแต่ละหมวด
- **Email:** `warakornbest6@gmail.com` | **Telegram:** chat_id `8172260229`

### "MoneyMind Monthly AI Analysis" (Workflow ID: `mm-gemini-monthly-01`)
- **Schedule:** `0 2 1 * *` (วันที่ 1 ของเดือน 09:00 Bangkok)
- **Pipeline:** Schedule → Fetch Firestore → Parse Spending (Code) → Gemini → Telegram
- **Gemini Model:** `gemini-2.5-flash` | **API Key project:** `gemini-n8n-3963`
- **GEMINI_KEY:** `AIzaSyBrG15Zg93k9FdO5Nh7tN4td5NYYrcX1uc`
- **Output:** สรุปการเงินประจำเดือน 4-5 ประโยค + คำแนะนำ

### "MoneyMind Daily Stock AI" (Workflow ID: `mm-gemini-stock-01`)
- **Schedule:** `5 2 * * 1-5` (วันจันทร์-ศุกร์ 09:05 Bangkok)
- **Pipeline:** Schedule → Yahoo Finance v7 → Prepare Prompt (Code) → Gemini → Telegram
- **Gemini Model:** `gemini-2.5-flash` | **API Key project:** `gemini-n8n-3963`
- **Stocks:** ASTS, RKLB, MSFT, NVDA, META, TSLA, IREN, IONQ, AMD, OKLO, GOOG, AMZN, LLY, TSM, AAPL, CRWD, PLTR, AVGO, MU, SNDK, INTC, ARM, EOSE, RGTI, IBM, ORCL, CRWV, ONDS
- **Script:** `C:\Users\warakorn\Documents\create_ai_workflows.py` (inject ใน n8n SQLite)

### Bank Email ที่รองรับ
| bank value | ตรวจจากคำ |
|-----------|-----------|
| `kbank` | kasikorn, kbank, kplus, k-plus |
| `scb` | siam commercial, @scb, scbeasy |
| `ktb` | krungthai, krung thai, ktb |
| `ttb` | ttb, tmb, thanachart |
| `bay` | krungsri, bank of ayudhya |
| `kkp` | kiatnakin, kkp |

### สิ่งที่เคยแก้ไข (อย่าทำซ้ำ)
- **Gmail Trigger v1 ไม่ส่ง body** — แก้โดยเพิ่ม "Get Gmail Message" node (resource=`message`, operation=`get`, messageId=`={{ $json.id }}`)
- **Regex ใน Code node มี Thai text** — ต้องใช้ `String.raw\`...\`` เมื่อ insert ผ่าน CodeMirror ไม่งั้น `\n`, `\d` จะถูก unescape
- **n8n SQLite อยู่ที่** `C:\Users\warakorn\.n8n\database.sqlite` — แก้ workflow ตรงได้ถ้า restart n8n หลัง
- **LINE Notify ปิดให้บริการแล้ว** — ใช้ Telegram Bot แทนทั้งหมด
- **Bot หลาย instance พร้อมกัน → 409 Conflict** — ต้องมี instance เดียวเท่านั้น (ปัจจุบันรันบน GCP)
- **yfinance regularMarketPrice** — ใช้เฉพาะ `regularMarketPrice` ห้ามใช้ preMarket/postMarket price
- **Gemini API free tier limit: 0** — เกิดจาก billing account ของ Google Cloud ปิด free tier โดยอัตโนมัติ แก้ไขโดยสร้าง project ใหม่ `gemini-n8n-3963` (ไม่มี billing) และใช้ `gemini-2.5-flash` แทน `gemini-2.0-flash`
- **Re-inject n8n workflows:** รัน `python C:\Users\warakorn\Documents\create_ai_workflows.py` แล้ว restart n8n
- **stock_bot.py "28 ตัว" hardcoded** — แก้แล้ว (2026-05-30): pre-fetch `get_symbols_from_firestore()` ก่อนส่งข้อความ แล้วส่งต่อให้ `get_prices(syms)` เพื่อไม่ให้ดึง Firestore ซ้ำ
- **gmail_bank_alert.py desc ยาว/ติด disclaimer** — แก้แล้ว (2026-05-30): `extract_merchant()` จำกัด 40 chars ต่อ pattern + KKP pattern `from account name : NAME to`; เพิ่ม `clean_desc(desc, max_len=70)` ตัด disclaimer keywords; `parse_email()` ใช้ `clean_desc(merchant or subject)`
- **Telegram group bot ต้องเป็น admin** — `createForumTopic` ต้องการสิทธิ์ can_manage_topics; group ID ใน Bot API ต้องมี prefix `-100` (URL `-4296300749` → API `-1004296300749`)

### Restart n8n
```powershell
# หา PID แล้ว kill
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*n8n*" } | Select-Object ProcessId
taskkill /F /PID <pid>
# รันใหม่
npx n8n
```
