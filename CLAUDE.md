# MoneyMind — CLAUDE.md

แอปจัดการการเงินส่วนตัวภาษาไทย เขียนเป็น Single HTML File ไม่มี build process ไม่มี framework ไม่มี dependencies ที่ต้อง install

## กฎการทำงาน (ทำทุกครั้งโดยไม่ต้องรอให้สั่ง)

- **หลังแก้ไข/deploy ทุกครั้ง:** อัปเดต CLAUDE.md และ memory files ที่เกี่ยวข้องทันที ไม่ต้องรอให้สั่ง
- **Memory path:** `C:\Users\warakorn\.claude\projects\D--wabbest\memory\`
- อัปเดตเฉพาะส่วนที่เปลี่ยนจริง — ไม่เขียนซ้ำสิ่งที่มีอยู่แล้ว

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
             — sendChat ใช้ mayaAgent() (tool calling) เมื่อมี apiKey, fallback rulesAI
~ก่อน _escHtml  MAYA AGENT — mayaAgent()/MAYA_TOOLS/MAYA_IMPLS (tool calling ใน browser)
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
| AI | แชทกับ Maya (Gemini agent + tool calling + rule-based), สแกนใบเสร็จ/สลิปภาษี |
| AI | Maya agent สั่งงานได้ (10 tools): บันทึก/แก้/ลบ/ค้นหารายการ, เพิ่มออม/จ่ายหนี้, ตั้งงบ, สร้างเป้าออม/หนี้, what-if (tools ทำงานกับ DB ใน browser, ใช้ apiKey ของ user, Gemini OpenAI-compat) |
| AI | Bot agent 19 tools (ai_agent.py): read (summary/budget/debt/saving/portfolio/prices) + write (add/edit/delete tx, create goal/debt, set SL-TP, dca) + search_transactions + what_if_saving + detect_subscriptions |
| AI | จัดหมวดเรียนรู้ได้ — `_learn_cat()` จำ desc→หมวดจากที่ user เลือกเอง (callback `cat:`) / แก้หมวด; `_detect_cat` เช็ค learned cache ก่อน keyword |
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
| ดูพอร์ต | `พอต` / `port` / `portfolio` | มูลค่าพอร์ต + กำไร/ขาดทุน + **vs Benchmark (SPY/QQQ วันนี้)** |
| ดูสรุป | `สรุป` / `summary` | สรุปรายรับ-รายจ่ายเดือนนี้ + Net Worth |
| ดูงบ | `งบ` / `budget` | รายจ่ายแต่ละหมวดเดือนนี้ + progress bar |
| ดูหนี้ | `หนี้` / `debt` | หนี้คงเหลือแต่ละรายการ + due date |
| ดูออม | `ออม` / `saving` | เป้าหมายเงินออมแต่ละกอง + % ที่ถึง |
| ดู Top | `top` / `ใช้มาก` | Top 5 หมวดรายจ่ายเดือนนี้ |
| DCA | `dca` / `dca add SYM N PRICE` | ดู DCA tracker หรือเพิ่มรายการ |
| SL/TP ตั้งค่า | `sl SYM PRICE` / `tp SYM PRICE` | ตั้ง Stop Loss / Take Profit (บันทึกใน stock_targets.json) |
| SL/TP ดู | `/target` / `/targets` | ดู targets ที่ตั้งไว้ทั้งหมด + ราคาปัจจุบัน |
| **Quick Add** | `"ข้าว 120"` / `"120 กาแฟ"` | บันทึก expense ลง Firestore ทันที (auto-detect หมวด) |
| **รูปสลิป** | ส่งรูปสลิป/ใบเสร็จในแชท | Gemini Vision อ่าน → บันทึก Firestore (tag `slip-scan`) |
| **เสียง** | ส่งข้อความเสียง (พูดรายการ/คำถาม) | Gemini ถอดเสียง → บันทึกหลายรายการ หรือตอบคำถาม (tag `voice-add`) |
| **AI Chat** | พิมพ์คำถามอะไรก็ได้ (personal chat) | Gemini + Firestore context ตอบเป็นภาษาคน (มายา) |

### Telegram Bot — 3 ฟีเจอร์ใหม่ (2026-06-15)
อยู่ใน `stock_bot.py` ทั้งหมด (systemd รันตลอด ไม่ต้อง cron):
- **รับรูปสลิป**: `analyze_slip(file_id)` → Gemini Vision → `save_to_firestore` (photo handler ก่อน Quick Add)
- **รับเสียง**: `analyze_voice(file_id)` → Gemini audio (`audio/ogg` inlineData) → JSON `{kind:tx/question}` → บันทึกหลายรายการหรือ route ไป AI chat
- **AI Chat free-form**: `build_finance_context()` สรุป DB → `gemini_chat(q)` ตอบ; fallback ใน Quick Add else block (เฉพาะ `chat_id == CHAT_ID`, text ≥ 4 ตัว)
- **หมายเหตุ:** AI chat จำกัดเฉพาะ personal chat เพื่อไม่ให้ตอบทุกข้อความใน group; backup เดิม `stock_bot.py.bak` อยู่บน VM

### แจ้งเตือนอัตโนมัติ (GCP cron)
| ฟังก์ชัน | เวลา Bangkok | script |
|---------|------------|--------|
| Daily Briefing (อากาศ + Top Movers + การเงิน) | 08:01 ทุกวัน | `daily_briefing.py` → topic 💰 |
| รายงานราคาประจำวัน | 09:00 ทุกวัน | `stock_daily_report.py` → topic 📈 |
| Earnings Calendar (หุ้นในพอร์ตที่จะรายงานผลใน 7 วัน) | 09:00 จ.–ศ. | `earnings_calendar.py` → topic 📈 |
| News Sentiment | 09:10 จ.–ศ. | `news_sentiment.py` → topic 📈 |
| แจ้งเตือนหุ้นแกว่ง ≥10% | ทุก 30 นาที จ.–ศ. | `stock_alert.py` → topic 📈 |
| **SL/TP Alert** (user-defined targets) | ทุก 30 นาที จ.–ศ. US market | `sltp_alert.py` → topic 📈 + personal |
| **Bill Reminder** (subscriptions ครบใน 3 วัน) | 09:00 ทุกวัน | `bill_reminder.py` → topic 💰 |
| **Net Worth Weekly** | จันทร์ 09:00 | `networth_weekly.py` → topic 💰 |
| **Stock Price Sync** | 22:30 จ.–ศ. (US market close) | `sync_prices.py` → topic 📈 + อัปเดต Firestore |
| Weekly AI Coach | วันอาทิตย์ 09:00 | `weekly_ai_coach.py` → topic 💰 |
| Monthly Report | วันที่ 1 ของเดือน 09:00 | `monthly_report.py` → topic 💰 |
| **Financial Journal** (Gemini + NotebookLM) | วันที่ 2 ของเดือน 09:00 | `financial_journal.py` → topic 💰 + save .md |
| **Tax Notebook** | 1 พ.ย. ทุกปี 09:00 | `tax_notebook.py` → topic 💰 + save .md |
| **Gmail PDF/DOCX/ZIP → Drive** (auto-upload attachments) | ทุก 2 ชั่วโมง | `gmail_pdf_to_drive.py` → Drive `Email PDFs/Documents/Archives/` + topic 💰 |
| **Gmail CSV/Excel → Firestore** (bank statement import) | 09:00 ทุกวัน | `gmail_statement_import.py` → Drive `Email Spreadsheets/` + Firestore + topic 💰 |
| **Gmail Image → Gemini Vision → Firestore** (สลิป/ใบเสร็จ) | ทุก 4 ชั่วโมง | `gmail_image_import.py` → Drive `Email Images/` + Firestore + topic 💰 |
| **Gmail Body Parser** (ค่าบริการ/Shopping/ประกัน/สลิป HTML) | 08:30 ทุกวัน | `gmail_body_parser.py` → Firestore + topic 💰 |
| **RSS News Digest** (MarketWatch/Yahoo/CNBC → Gemini → หุ้นในพอร์ต) | 08:30 จ.–ศ. | `rss_news.py` → topic 📈 |
| **Firestore → Google Sheets** (Transactions/Monthly/NW/Portfolio) | 23:00 ทุกวัน | `firestore_to_sheets.py` → Sheets (Looker Studio) |
| **NotebookLM Export** (Q&A snapshot ทั้งหมด) | วันที่ 1 ของเดือน 00:00 | `notebooklm_export.py` → Drive `moneymind_qa_snapshot.md` |
| **Firestore Backup → Drive** (JSON snapshot, เก็บ 90 วัน) | 01:00 ทุกวัน | `firestore_backup.py` → Drive `Backups/` (แจ้ง TG จันทร์) |
| **Proactive AI Insights** (anomaly detection) | เสาร์ 10:00 | `proactive_insights.py` → topic 💰 |
| **AI Coach** (pace warning กลางเดือน — projection vs avg 3 เดือน + หมวดพุ่ง, AI เรียบเรียง) | พุธ+เสาร์ 19:00 | `ai_coach.py` → topic 💰 |
| **Subscription Detect** (หา recurring charge ที่ลืมบันทึก) | วันที่ 3 ของเดือน 09:00 | `subscription_detect.py` → topic 💰 |
| **Cron Health Monitor** (log เก่า + crash ของ ~30 cron) | 11:00 ทุกวัน | `cron_health.py` → topic 💰 (dedup 2 วัน) |
| **Token Watchdog** (refresh gmail/drive token) | 11:30 ทุกวัน | `token_watchdog.py` → topic 💰 (เตือนก่อน revoke) |
| **Duplicate Check** (txn ซ้ำจาก 4 pipelines) | อาทิตย์ 09:00 | `dup_cleanup.py` → topic 💰 (report-only ไม่ลบ) |
| แจ้งเตือนงบประมาณเกิน 80% | ทุก 12 ชั่วโมง | n8n budget-alert-01 → personal + email |

### Reliability Layer (2026-06-15)
- **`cron_health.py`** — non-invasive: เช็ค `.log` mtime (เก่ากว่า max_age = ไม่รัน) + scan `Traceback` ใน 15 บรรทัดท้าย (เฉพาะรอบล่าสุด — recover แล้วไม่ alert); `REGISTRY` map log→max_age_hours; dedup ผ่าน `cron_health_state.json` (เตือนซ้ำทุก ≥2 วัน) ป้องกัน spam
- **`token_watchdog.py`** — ทำ OAuth refresh จริงกับ `gmail_token.json` + `drive_token.json`; `invalid_grant` = ถูก revoke → เตือนด่วน + บอก scripts ที่กระทบ
- **`dup_cleanup.py`** — หา dup 2 ระดับ: HIGH (date+amount+desc เป๊ะ) + MED (date+amount ตรง คนละ `_import` source); report Telegram **ไม่ลบอัตโนมัติ** (ลบเองในเว็บแอป); ตรวจ 120 วันล่าสุด
- **เหตุผล:** ระบบมี ~30 cron + 4 import pipelines → script พังเงียบ/token ตาย/data ซ้ำ เป็นความเสี่ยงจริง (เคยเจอ bug เงียบหลายตัว)

### หุ้นที่ติดตาม (dynamic — ดึงจาก Firestore, ปัจจุบัน ~43 ตัว)
ไม่ใช่ hardcode แล้ว — bot ดึง symbols จาก `get_symbols_from_firestore()` (investments ที่มี qty > 0 และ type = USD)
ตัวอย่างหุ้นที่เห็นใน Telegram เมื่อ 30-31/05/2026:
```
ASTS, RKLB, MSFT, NVDA, META, TSLA, IREN, IONQ, AMD, OKLO,
GOOG, AMZN, LLY, TSM, AAPL, CRWD, PLTR, MU, SNDK,
INTC, ARM, EOSE, RGTI, IBM, ORCL, CRWV,
SOFI, PL, ALAB, STX, NBIS, LUNR, VSAT, SATS, ASML, BE, CEG, GLW, AAOI, FLY, QUCY, AXTI
```

### Source Files Mapping — โน้ตบุค → GCP VM

> **Git repo (Python scripts):** `Warakorn456/moneymind-bot` (private ได้/public ได้แล้วหลัง refactor) — สร้าง 2026-06-15  
> Local: `C:\Users\warakorn\Documents\moneymind-bot\` (git, branch `main`)  
> ⚠️ source-of-truth ของ scripts ยังเป็น `C:\Users\warakorn\Documents\*.py` (โฟลเดอร์ moneymind-bot เป็น copy ที่ commit) — แก้ที่ Documents แล้ว copy เข้า moneymind-bot ก่อน commit  
> `.gitignore` กัน `*_token.json`, `*_seen.json`, `*_state.json`, `*.log`, `.env` — secrets ไม่ขึ้น GitHub  
> Web app repo แยกต่างหาก: `Warakorn456/moneymind` (index.html + CLAUDE.md)

> **🔑 Secrets ผ่าน `.env` (refactor 2026-06-15):** Telegram token + Gemini key **ไม่ hardcode แล้ว** — อยู่ใน `.env` (gitignore)  
> ทุก script: `import mm_secrets` แล้วอ้าง `mm_secrets.TG_TOKEN`, `mm_secrets.GEMINI_KEY`, `mm_secrets.GEMINI_KEY_OLD`  
> `mm_secrets.py` อ่าน `.env` เอง (ไม่พึ่ง python-dotenv) จากโฟลเดอร์เดียวกับ script — ใช้ `os.path.dirname(__file__)` รองรับทั้ง cron + systemd  
> `.env` keys: `MM_TG_TOKEN`, `MM_GEMINI_KEY`, `MM_GEMINI_KEY_OLD`, `MM_TG_CHAT_ID`, `MM_TG_GROUP_ID`, `MM_FIRESTORE_URL`, `MM_OPENROUTER_KEY`, `MM_AGENT_PROVIDER` (gemini|openrouter), `MM_HERMES_MODEL`  
> **VM:** `.env` + `mm_secrets.py` อยู่ที่ `/home/warakornbest6/moneymind/` — deploy script ใหม่ต้องมี `mm_secrets.py` + `.env` คู่กันเสมอ  
> chat IDs **ไม่ใช่ secret** (ไม่มี bot token ก็ใช้ไม่ได้) — ยัง hardcode ในบาง script ได้  
> **เพิ่ม script ใหม่:** ใช้ `import mm_secrets` + `mm_secrets.GEMINI_KEY` แทน hardcode เสมอ

> **สำคัญ:** ไฟล์บนโน้ตบุคบางตัว **ล้าหลัง** VM เพราะ patch ทำตรงบน VM  
> วิธี deploy ที่ถูกต้อง: `gcloud compute scp <local_file> warakornbest6@moneymind-bot:/home/warakornbest6/moneymind/<file> --zone=us-central1-a`

| โน้ตบุค (`C:\Users\warakorn\Documents\`) | VM (`/home/warakornbest6/moneymind/`) | หมายเหตุ |
|------------------------------------------|--------------------------------------|----------|
| `gmail_bank_alert.py` | `gmail_bank_alert.py` | ✅ sync — ส่งไป group topic 💰 (TG_CHAT=`-1004296300749`, TG_TOPIC=`4`) |
| `stock_bot.py` | `stock_bot.py` | ✅ sync (อัปเดต 2026-06-15: **รับรูปสลิป Telegram → Gemini Vision → Firestore**) |
| `ai_agent.py` | `ai_agent.py` | ✅ deploy แล้ว — **AI agent (tool calling)** AI chat ใน bot; entry point `ai_agent.chat(text)`; lazy-import `stock_bot` กัน circular; **provider สลับได้ (default gemini-2.5-flash, OpenRouter fallback)** |
| `rss_news.py` | `rss_news.py` | ✅ sync — ใหม่ 2026-06-15, cron `30 1 * * 1-5` (08:30 Bangkok) |
| `firestore_to_sheets.py` | `firestore_to_sheets.py` | ✅ sync — ใหม่ 2026-06-15, cron `0 16 * * *` (23:00 Bangkok) |
| `notebooklm_export.py` | `notebooklm_export.py` | ✅ sync — ใหม่ 2026-06-15, cron `0 17 1 * *` |
| `sltp_alert.py` | `sltp_alert.py` | ✅ sync — ใหม่ 2026-06-01, cron ทุก 30 นาที US market |
| `bill_reminder.py` | `bill_reminder.py` | ✅ sync — ใหม่ 2026-06-01, cron 09:00 ทุกวัน |
| `earnings_calendar.py` | `earnings_calendar.py` | ✅ sync — cron `0 2 * * 1-5` (09:00 Bangkok จ.–ศ.) |
| `sync_prices.py` | `sync_prices.py` | ✅ sync — ใหม่ 2026-06-01, cron `30 15 * * 1-5` (22:30 Bangkok) |
| `tax_notebook.py` | `tax_notebook.py` | ✅ sync — ใหม่ 2026-06-01, cron `0 2 1 11 *` (1 พ.ย.) |
| `networth_weekly.py` | `networth_weekly.py` | ✅ sync — cron `0 2 * * 1` (จันทร์ 09:00) |
| `drive_upload.py` | `drive_upload.py` | ✅ sync — shared module upload ไฟล์ขึ้น Drive (ใช้ `drive_token.json`) |
| `drive_auth_local.py` | — | รันบนโน้ตบุคครั้งเดียวเพื่อ generate `drive_token.json` |
| `gmail_pdf_to_drive.py` | `gmail_pdf_to_drive.py` | ✅ sync — ใหม่ 2026-06-11, cron `0 */2 * * *` (ทุก 2 ชั่วโมง) PDF → Drive |
| `gmail_statement_import.py` | `gmail_statement_import.py` | ✅ sync — ใหม่ 2026-06-11, cron `0 9 * * *` (09:00 ทุกวัน) CSV/Excel → Firestore |
| `gmail_image_import.py` | `gmail_image_import.py` | ✅ sync — ใหม่ 2026-06-12, cron ทุก 4 ชม. PNG/JPG → Gemini Vision → Firestore |
| `gmail_body_parser.py` | `gmail_body_parser.py` | ✅ sync — ใหม่ 2026-06-12, cron 08:30 email body → Gemini → Firestore |
| `monthly_report.py` | `monthly_report.py` | ✅ sync (thinkingBudget: 0, maxOutputTokens: 600) |
| `weekly_ai_coach.py` | `weekly_ai_coach.py` | ✅ sync (thinkingBudget: 0, maxOutputTokens: 600) |
| `stock_daily_report.py` | `stock_daily_report.py` | deploy ได้ตามปกติ |
| `stock_alert.py` | `stock_alert.py` | deploy ได้ตามปกติ |
| `daily_briefing.py` | `daily_briefing.py` | deploy ได้ตามปกติ |
| `health_monitor.py` | `health_monitor.py` | deploy ได้ตามปกติ |
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

### โครงสร้าง stock_bot.py — Key Functions (อัปเดต 2026-06-01)

| ฟังก์ชัน | หน้าที่ |
|----------|---------|
| `_parse_quick_add(text)` | Parse "ข้าว 120" / "120 กาแฟ" → (desc, amount) |
| `_detect_cat(desc)` | Auto-detect หมวดหมู่: keyword ก่อน → ถ้าเดาไม่ได้เรียก `_detect_cat_ai()` (LLM) → fallback other_exp |
| `_detect_cat_ai(desc)` | AI จัดหมวด (Phase 2) — `ai_agent.simple_complete()`, cache ใน `cat_cache.json`, fallback None เมื่อ 429/error |
| `fetch_quotes(symbols)` | ดึงราคาจาก Yahoo Finance (รวม SPY, QQQ, USDTHB=X) |
| `get_symbols_from_firestore()` | อ่าน symbols USD จาก Firestore investments (dynamic) |
| `get_portfolio()` | ดึงพอร์ต + FX + **benchmark** → return 5 values |
| `build_portfolio_message(..., benchmark)` | แสดงพอร์ต + **vs SPY/QQQ วันนี้** |
| `get_summary()` | สรุปรายรับ-รายจ่ายเดือนนี้ + Net Worth |
| `_fetch_db()` | อ่าน DB ทั้งหมดจาก Firestore |
| `get_budget_data()` | งบแต่ละหมวด + % ที่ใช้ |
| `get_debt_data()` / `get_saving_data()` | หนี้ / เงินออม |
| `save_to_firestore(tx)` | PATCH transaction ลง Firestore (ใช้ทั้ง gmail-import และ quick-add) |
| `load_dca()` / `save_dca()` | DCA tracker (JSON file) |
| `load_targets()` / `save_targets()` | SL/TP targets → `stock_targets.json` |
| `main()` | long-polling loop — getUpdates → dispatch commands + Quick Add else clause |

**Quick Add flow:** `else` clause สุดท้ายใน message handler → `_parse_quick_add()` → `_detect_cat()` → `save_to_firestore()`  
**vs Benchmark:** `get_portfolio()` fetch SPY+QQQ พร้อมกัน → คืน `benchmark` dict → แสดงใน footer

### ไฟล์ Bot บนโน้ตบุค (C:\Users\warakorn\Documents\)
| ไฟล์ | หน้าที่ |
|------|---------|
| `stock_bot.py` | ✅ sync กับ VM (2026-06-01) — Quick Add + Benchmark |
| `sltp_alert.py` | ✅ sync — ตรวจ stock_targets.json แจ้งเตือน SL/TP |
| `bill_reminder.py` | ✅ sync — ตรวจ subscriptions ครบใน 3 วัน |
| `earnings_calendar.py` | ✅ sync — ตรวจ earnings dates ใน 7 วัน |
| `stock_daily_report.py` | ย้ายไป GCP cron แล้ว |
| `stock_alert.py` | ย้ายไป GCP cron แล้ว |

### ไฟล์ Bot บน GCP VM (/home/warakornbest6/moneymind/)
| ไฟล์ | หน้าที่ |
|------|---------|
| `stock_bot.py` | Interactive bot (systemd: moneymind-bot) — canonical version + **รับรูปสลิป → Gemini Vision → Firestore** (2026-06-15) |
| `rss_news.py` | RSS News Digest — cron `30 1 * * 1-5` (08:30 Bangkok จ.–ศ.) → topic 📈 |
| `firestore_to_sheets.py` | Firestore → Google Sheets 4 tabs (Transactions/Monthly/NW/Portfolio) — cron `0 16 * * *` |
| `notebooklm_export.py` | สร้าง Q&A snapshot .md → Drive → NotebookLM — cron `0 17 1 * *` |
| `sltp_alert.py` | SL/TP alert — cron `*/30 13-21 * * 1-5` |
| `bill_reminder.py` | Bill reminder — cron `0 2 * * *` (09:00 Bangkok) |
| `earnings_calendar.py` | Earnings calendar — standalone (เทสได้ตรงๆ) |
| `stock_daily_report.py` | Daily 09:00 price report — cron `0 2 * * *` |
| `stock_targets.json` | SL/TP targets ที่ user ตั้งผ่าน bot |
| `drive_upload.py` | Shared module upload Google Drive — ใช้ `drive_token.json` (user OAuth) |
| `drive_token.json` | OAuth token สำหรับ Google Drive — สร้างด้วย `drive_auth_local.py` บนโน้ตบุค |
| `bot_offset.json` | Telegram update offset |
| `gmail_pdf_to_drive.py` | Gmail PDF → Drive auto-upload — cron `0 */2 * * *` (ทุก 2 ชั่วโมง) |
| `pdf_seen.json` | Message IDs ที่ upload ไปแล้ว (ป้องกัน duplicate) |
| `pdf_drive.log` | Log file ของ gmail_pdf_to_drive.py |
| `gmail_statement_import.py` | Gmail CSV/Excel (bank domain) → parse transactions → Firestore + Drive (cron 09:00) |
| `statement_seen.json` | ไฟล์ที่ process แล้ว (dedup) |
| `statement_import.log` | Log ของ gmail_statement_import.py |
| `gmail_image_import.py` | PNG/JPG สลิป/ใบเสร็จ → Gemini Vision → Firestore + Drive (cron ทุก 4 ชม.) |
| `image_import_seen.json` | dedup ของ image_import |
| `image_import.log` | log ของ gmail_image_import.py |
| `gmail_body_parser.py` | parse email body (AIS/Shopee/ประกัน/สลิป HTML) → Gemini → Firestore (cron 08:30) |
| `body_parser_seen.json` | dedup ของ body_parser |
| `body_parser.log` | log ของ gmail_body_parser.py |
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
- **gmail_bank_alert.py ส่งไป personal chat** — ย้ายไป group topic 💰 การเงิน แล้ว (2026-05-30): `TG_CHAT = '-1004296300749'`, `TG_TOPIC = 4`, เพิ่ม `message_thread_id` ใน sendMessage payload
- **news_sentiment.py ข้อความสั้นเกิน** — แก้แล้ว (2026-05-30): `maxOutputTokens` 350→700, prompt เปลี่ยนเป็นวิเคราะห์รายหุ้นพร้อม sentiment icon 🟢🔴⚪, และเพิ่ม `thinkingConfig: {thinkingBudget: 0}` เพื่อ disable thinking
- **Gemini 2.5 Flash thinking tokens กิน budget** — ถ้า response สั้นผิดปกติ ให้เพิ่ม `'thinkingConfig': {'thinkingBudget': 0}` ใน `generationConfig` — ใช้กับทุก script ที่ส่ง Gemini request และไม่ต้องการ deep reasoning
- **Telegram group bot ต้องเป็น admin** — `createForumTopic` ต้องการสิทธิ์ can_manage_topics; group ID ใน Bot API ต้องมี prefix `-100` (URL `-4296300749` → API `-1004296300749`)
- **Bot 409 Conflict หลัง restart** — `sudo systemctl stop moneymind-bot; sleep 2; sudo systemctl start moneymind-bot` (ไม่ใช้ restart เพราะอาจ overlap)
- **stock_bot.py อัปเดต 2026-05-31:** เพิ่ม Quick Add (`กาแฟ 65`), vs Benchmark (SPY/QQQ), `get_portfolio()` return 5 values แล้ว (เพิ่ม benchmark dict)
- **New scripts 2026-05-31:** `sltp_alert.py` (cron ทุก 30 นาที US market), `bill_reminder.py` (cron ทุกวัน 09:00), `earnings_calendar.py` (standalone)
- **stock_bot.py อัปเดต 2026-06-01:** เพิ่ม `/help`, `วันนี้`, `networth_weekly.py`, `financial_journal.py`, `investment_research.py`; Short-poll (timeout=0) แทน long-poll; logging non-200 ใน send()
- **New scripts 2026-06-01:** `sync_prices.py` (cron 22:30 จ.–ศ.), `tax_notebook.py` (cron 1 พ.ย.), `upload_to_drive.py` (manual/ต้อง setup Drive API ก่อน)
- **Gemini API key leaked** — key `AIzaSy...` ถูก flag; scripts ใหม่ใช้ key จาก `monthly_report.py` บน VM แทน และเปลี่ยนมาใช้ HTTP requests แทน `google.generativeai` SDK ที่ deprecated แล้ว
- **Gmail email pipeline ครบชุด ✅ (2026-06-12)** — 4 scripts ดักข้อมูลจาก Gmail: (1) `gmail_pdf_to_drive.py` รองรับ PDF+DOCX+ZIP (unzip ใน memory); (2) `gmail_statement_import.py` CSV/XLSX → Firestore; (3) `gmail_image_import.py` PNG/JPG → Gemini Vision → Firestore; (4) `gmail_body_parser.py` email body (AIS/Shopee/ประกัน/สลิป HTML) → Gemini extract → Firestore; ทุก script มี dedup (date+amount) + Telegram แจ้ง; Gemini 429 แก้ด้วย retry backoff + sleep 3s ระหว่าง calls
- **Gmail CSV/Excel → Firestore ✅ (2026-06-11)** — `gmail_statement_import.py`: ดึง CSV/Excel จาก bank domain เท่านั้น (kasikornbank, scb.co.th, krungthai, dime.co.th ฯลฯ) → parse หา transactions → upload Drive `Email Spreadsheets/{BANK}/` + บันทึก Firestore พร้อม dedup (date+amount); cron 09:00 ทุกวัน; openpyxl ติดตั้งแล้วบน VM; รองรับ KBank, SCB, TTB, generic Thai bank format
- **Gmail PDF → Drive ✅ (2026-06-11)** — `gmail_pdf_to_drive.py`: ดึง PDF จาก Gmail (30 วันล่วงหน้า) → อัปโหลด Drive `MoneyMind Notebooks/Email PDFs/` จัดโฟลเดอร์ตาม Bank Statements / Bills & Invoices / Tax Documents / Other; cron ทุก 2 ชั่วโมง; test รันครั้งแรกอัปโหลด 19 ไฟล์
- **Google Drive auto-upload ✅ setup เสร็จแล้ว (2026-06-11)** — Drive Folder: `MoneyMind Notebooks` (ID: `1xhHD3KMvGyk0ts7UmXlBfnh0YEj845ny`); ใช้ `drive_upload.py` + `drive_token.json` (user OAuth); scripts ที่ upload Drive: `news_sentiment.py`, `financial_journal.py`, `monthly_report.py`, `tax_notebook.py`, `earnings_calendar.py`
- **Service Account ไม่มี Drive quota** — GCP Compute Engine service account ไม่สามารถ upload ไปยัง personal Drive ได้ (403: "Service Accounts do not have storage quota"); แก้โดยใช้ OAuth user token แทน — รัน `drive_auth_local.py` บนโน้ตบุค ได้ `drive_token.json` แล้ว deploy ไป VM
- **drive_token.json หมดอายุ** — ถ้า upload ไม่ได้อนาคต (401 error) ให้รัน `drive_auth_server.py` บนโน้ตบุค ทำ OAuth ใหม่แล้ว deploy `drive_token.json` ไป VM อีกครั้ง; redirect URI `http://localhost:9876` ลงทะเบียนใน GCP OAuth client แล้ว
- **financial_journal.py bug — `last_month_first` NameError** — แก้แล้ว (2026-06-11): เปลี่ยน `archive_name = f'financial_journal_{last_month_first.strftime("%Y_%m")}.md'` → `f'financial_journal_{y}_{m:02d}.md'`
- **earnings_calendar.py bug — KeyError `timing`/`eps_est`** — แก้แล้ว (2026-06-11): markdown template ใช้ key ที่ไม่มีใน dict; เปลี่ยนเป็น `f'- **{s["sym"]}**: รายงาน {s["date"]} (อีก {s["days_left"]} วัน)'`
- **`build_help_message()` bug — `'string' '─'*28`** — Python implicit concatenation ทำให้ `'string─'*28` → ข้อความยาวเกิน 4096 chars → Telegram 400 ไม่มี log; แก้ด้วย `sep='─'*28; '\n'.join([...])`
- **409 Conflict สาเหตุจริง — `health_monitor.py` restart ซ้ำกับ systemd** — `health_monitor.py` (cron */5) เรียก `sudo systemctl restart moneymind-bot` ซ้ำกับ systemd `Restart=always` ทำให้มี 2 instances ชั่วคราว; แก้ด้วยการเอา `moneymind-bot` ออกจาก `SERVICES` list ใน health_monitor.py (บน VM แล้ว)
- **gmail_body_parser.py Gemini 429 — `import urllib.error` ขาด** — ทำให้ `except urllib.error.HTTPError` ไม่ catch ได้, exception propagate ออกจาก retry loop ทันที, script วิ่ง 50 emails ใน 14 วินาที ทุก request 429; แก้: (1) เพิ่ม `import urllib.error` (2) sleep 7s แทน 3s (3) เพิ่ม retry 65s เมื่อ 429 (4) เพิ่ม subject pre-filter ใน Gmail query เพื่อลด Gemini calls
- **gmail_body_parser.py Firestore 403 — gmail_token ไม่มี datastore scope** — แก้: ลบ `Authorization` header ออกจาก Firestore calls ทั้งหมด (Firestore rules เป็น public access เหมือน stock_bot.py); ใช้กับ `gmail_image_import.py` และ `gmail_statement_import.py` ด้วย
- **gmail_body_parser.py body keyword pre-filter + MAX_GEMINI_CALLS=5** — เพิ่ม `has_money_keywords()` check ก่อนถึง Gemini เพื่อตัด shipping/security emails ออก; `MAX_GEMINI_CALLS=5` จำกัด calls/run ป้องกัน throttle ระยะยาว; email ที่ยังไม่ได้ process จะถูก retry run ถัดไป (ไม่ add to seen.json ถ้า limit reached)
- **Hermes agent (tool calling) เพิ่ม 2026-06-15** — `ai_agent.py` ใหม่: AI chat แบบ tool calling ผ่าน OpenRouter (`chat()` entry point), ห่อ 12 function เดิมใน stock_bot เป็น tools (get_summary/budget/debt/saving/portfolio/prices/add_transaction/set_target/dca ฯลฯ), agent loop เรียกได้หลาย tool ต่อคำถาม; `stock_bot.py` เพิ่ม `import ai_agent` (optional, try/except) + AI-chat fallback ใน else-block (เฉพาะ `chat_id == CHAT_ID`, text ≥ 4 ตัว, ใช้ข้อความต้นฉบับไม่ใช่ `.lower()`); secrets ผ่าน `mm_secrets.OPENROUTER_KEY` / `HERMES_MODEL`
- **⚠️ Hermes บน OpenRouter ไม่เปิด `tools` API** — ทุกรุ่น (hermes-3/hermes-4) มี `supported_parameters` ไม่มี `'tools'` → ทำ OpenAI-style tool calling ไม่ได้แม้ตัวโมเดลจะเทรนมา; ถ้าจะใช้ Hermes จริงต้องเขียน native `<tool_call>` parser เพิ่ม (ยังไม่ทำ)
- **✅ Agent provider เปลี่ยนเป็น Gemini แล้ว 2026-06-16** — `ai_agent.py` รองรับ provider สลับผ่าน `.env -> MM_AGENT_PROVIDER` (gemini|openrouter); **default = gemini** ใช้ **OpenAI-compatible endpoint ของ Gemini** (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) + `MM_GEMINI_KEY` เดิม → รองรับ tool calling เต็มรูปแบบ, ไม่เจอ rate limit 429 แบบ OpenRouter free tier, ใช้ key เดียวกับสคริปต์อื่น; default model `gemini-2.5-flash`; OpenRouter (`openai/gpt-oss-120b:free`) เก็บเป็น fallback; โครง agent loop เดิมใช้ได้ทั้ง 2 provider เพราะฟอร์แมต tool_calls เหมือนกัน
- **OpenRouter account สร้างแล้ว 2026-06-15** — login ผ่าน Google (`warakornbest6@gmail.com`), Individual/Personal workspace, free tier ($0 credit); key auto-gen ตอน onboarding เก็บใน `.env` -> `MM_OPENROUTER_KEY`; free tier มี rate limit (โมเดล `:free` โดน 429 บ่อยตอน peak — เติม ~$10 จะปลดล็อก rate limit สูงขึ้น); เช็ค key/usage: `GET https://openrouter.ai/api/v1/key`
- **Hermes agent deploy เสร็จ + ทดสอบ VM ผ่าน 2026-06-15** — deploy: scp `stock_bot.py` + `ai_agent.py` + `mm_secrets.py` ขึ้น VM, เพิ่ม `MM_OPENROUTER_KEY` + `MM_HERMES_MODEL` ใน VM `.env`, stop+start `moneymind-bot`; ทดสอบ `ai_agent.chat()` บน VM ตอบไทยพร้อมข้อมูล Firestore จริง; **หมายเหตุแก้ความเข้าใจผิด:** ตรวจ diff แล้วพบ VM `stock_bot.py` = laptop เป๊ะ — **ไม่มี** `analyze_slip`/`analyze_voice`/`gemini_chat` ในไฟล์จริง (เอกสารเดิมคลาดเคลื่อน); slip/voice/AI-chat ที่อ้างถึงก่อนหน้าไม่เคยอยู่ใน stock_bot.py จริง
- **เปลี่ยนชื่อ `hermes_agent.py` → `ai_agent.py` 2026-06-16** — ชื่อเดิมชวนสับสนเพราะตอนนี้ใช้ Gemini ไม่ใช่ Hermes; แก้ references ใน stock_bot.py (`import ai_agent`, `ai_agent.chat/simple_complete`), log prefix `[hermes]`→`[ai-agent]`, tags `hermes-agent`→`ai-agent`; **env var `MM_HERMES_MODEL` คงชื่อเดิม** (ยังใช้ได้ ไม่อยากแตะ .env หลายที่); deploy: scp ai_agent.py+stock_bot.py, `rm hermes_agent.py` บน VM, restart; commit `929955b` (Hermes ไม่เคยถูกใช้งานจริง — เป็นแค่ชื่อตั้งต้น)

### Restart n8n
```powershell
# หา PID แล้ว kill
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*n8n*" } | Select-Object ProcessId
taskkill /F /PID <pid>
# รันใหม่
npx n8n
```
