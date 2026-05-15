# MoneyMind — CLAUDE.md

แอปจัดการการเงินส่วนตัวภาษาไทย เขียนเป็น Single HTML File ไม่มี build process ไม่มี framework ไม่มี dependencies ที่ต้อง install

## สถาปัตยกรรม

**ไฟล์เดียว:** `index.html` (~736KB) — HTML + CSS + Vanilla JavaScript ทั้งหมดอยู่ในไฟล์เดียว

```
index.html
├── <head>         — CDN links (Chart.js, Firebase, Font Awesome, Sarabun)
├── <style>        — CSS ทั้งหมด (inline, บรรทัด 9–840 โดยประมาณ)
├── <body>         — HTML structure, sidebar nav, หน้าทุกหน้า
└── <script>       — JavaScript ทั้งหมด (บรรทัด 2217+ โดยประมาณ)
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

Global object `DB` เก็บข้อมูลทั้งหมดในหน่วยความจำ — serialize/deserialize ผ่าน JSON:

```js
DB = {
  transactions: [],   // รายรับ-รายจ่าย {id, date, type, amount, category, note, tags, ...}
  savings: [],        // เป้าออมเงิน {id, name, target, current, ...}
  debts: [],          // หนี้สิน {id, name, total, remaining, ...}
  investments: [],    // พอร์ตลงทุน {id, name, type, value, ...}
  settings: {
    apiKey: '',       // Google Gemini API Key
    geminiModel: '',  // โมเดล Gemini ที่เลือก
    customIncCats: [],
    customExpCats: [],
  },
  tax: {},            // ข้อมูลภาษีเงินได้
  plan: {             // งบดุลและแผนการเงิน
    monthlyIncome: 0,
    otherAssets: 0,
    items: [],
    extraAssets: [],
    extraDebts: [],
  },
  profile: {},        // ประวัติส่วนตัว (DOB ใช้คำนวณแผนเกษียณ)
  retire: {           // แผนเกษียณ
    retireAge: 60,
    lifeAge: 85,
    monthlyExpense: 30000,
    inflation: 3,
    returnRate: 7,
    postReturnRate: 4,
    sso: 750,
    pvd: 0,
    portOverride: null,
    curAgeOverride: null,
  },
  _savedAt: 0,        // timestamp สำหรับ conflict resolution กับ Firestore
}
```

## Storage Layer

| Storage | Key | ใช้เก็บ |
|---------|-----|---------|
| `localStorage` | `mm_users` | `[{username, salt, hash}]` — user list |
| `localStorage` | `mm_session` | `{username, ts}` — session ปัจจุบัน |
| `localStorage` | `mm_data_<username>` | DB object ของแต่ละ user |
| Firebase Firestore | `users/<username>` | Cloud backup — sync 2 ทาง |

ลำดับ sync: localStorage (ออฟไลน์) → Firestore (ถ้า login) → conflict resolution ด้วย `_savedAt` timestamp

## Pages & Navigation

Navigation ผ่านฟังก์ชัน `nav(page)` — ทุกหน้า render ใหม่ทุกครั้งที่ navigate:

| Page key | หน้า | render function |
|----------|------|----------------|
| `dashboard` | แดชบอร์ด | `renderDash()` |
| `transactions` | รายรับ-รายจ่าย | `renderTx()` |
| `recurring` | รายการซ้ำ | `renderRecurring()` |
| `wishlist` | Wishlist | `renderWishlist()` |
| `savings` | เงินออม | — |
| `banks` | ธนาคาร | — |
| `debts` | หนี้สิน | — |
| `investments` | พอร์ตลงทุน | `renderInv()` |
| `tax` | ภาษีเงินได้ | `renderTax()` |
| `balance` | งบดุล & แผน | — |
| `forecast` | พยากรณ์กระแสเงิน | `renderForecast()` |
| `retire` | แผนเกษียณ | `renderRetire()` |
| `profile` | ประวัติส่วนตัว | — |
| `settings` | ตั้งค่า | `renderSettings()` |

## UI/CSS Conventions

- **CSS Variables:** `--primary`, `--primary-l`, `--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--red`
- **Dark mode** เป็นค่าเริ่มต้น, toggle ด้วย class `body.light-mode`
- **Responsive:** breakpoints ที่ 860px และ 768px
- **Component classes:** `.card`, `.btn`, `.finput`, `.fselect`, `.flabel`, `.ftab`, `.pbar/.pfill`
- **Toast notifications:** `toast(message, type)` — type: `'success'` | `'error'` | `'info'`

## Helper Functions สำคัญ

```js
fmt(number)              // format ตัวเลขเป็น ฿X,XXX
saveDB()                 // save localStorage + sync Firestore
saveLocalOnly()          // save เฉพาะ localStorage
loadDB()                 // load จาก localStorage (พร้อม fallback)
nav(page)                // navigate ไปหน้า
monthTx(m, y)            // กรอง transactions ของเดือน/ปีที่ระบุ
calcNetWorth()           // คำนวณ Net Worth ปัจจุบัน
getCat(id, type)         // ดึง category object จาก id
toast(msg, type)         // แสดง notification
getUsers()               // ดึง user list จาก localStorage
```

## Gemini AI Integration

- เรียกผ่าน REST API: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
- API Key เก็บใน `DB.settings.apiKey`
- ฟังก์ชัน `callGemini(prompt, imageParts?)` — รองรับ multimodal (รูป + text)
- Auto-detect model ที่ดีที่สุดจาก API ถ้าไม่ได้ set `DB.settings.geminiModel`
- Filter model ที่ไม่รองรับ: `/tts|embedding|aqa|gemini-1\.5/i`

## การแก้ไขโค้ด

- **แก้ CSS:** หา selector ใน `<style>` block ด้วย Grep แล้ว Edit
- **แก้ Logic:** JavaScript อยู่ใน `<script>` block เดียวตั้งแต่บรรทัด ~2217
- **แก้ HTML:** แต่ละหน้าอยู่ใน `<div id="pg-<page>" class="page">` 
- ไม่มี minification — โค้ดอ่านได้ปกติ แต่บางบรรทัดยาวมาก ใช้ Grep แทน Read โดยตรง
- ไฟล์ใหญ่ (~736KB / ~149K tokens) — **ต้องใช้ Grep หาตำแหน่งก่อนเสมอ** ก่อน Read ด้วย offset/limit

## วิธี Deploy

Static file — ไม่ต้อง build:
- เปิด `index.html` ใน browser โดยตรง
- หรือ host บน GitHub Pages, Netlify, Firebase Hosting
- Firebase config อยู่ใน `<script>` block ต่อจาก CDN imports (บรรทัด ~30)
