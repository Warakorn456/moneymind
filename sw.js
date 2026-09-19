// MoneyMind service worker (2026-09-19)
// เป้าหมาย: (1) เปิดแอปครั้งถัดไปไม่ต้องดึง CDN ~500 KB ซ้ำ (chart.js/firebase/font awesome/ฟอนต์ pin เวอร์ชันอยู่แล้ว)
//          (2) ออฟไลน์/เน็ตล่มยังเปิดหน้า login + ข้อมูลใน localStorage ได้ แทนหน้าขาว
// ไม่แตะ: Firestore, ai_proxy (sslip.io), Gemini, CoinGecko, analytics — ผ่านตรงเสมอ (ไม่ใช่ GET ก็ผ่านตรง)
// index.html/admin.js = network-first (ได้เวอร์ชันใหม่ทันทีที่ push, ล่มค่อยใช้ cache)
// CDN/ฟอนต์ = stale-while-revalidate (เร็วทันที แล้วอัปเดตเงียบๆ)
// แอปมือถือ (RN WebView) ไม่ register SW — ดู index.html
const VERSION='mm-sw-v1';
const PAGE_CACHE=VERSION+'-pages';
const CDN_CACHE=VERSION+'-cdn';
const CDN_HOSTS=['cdn.jsdelivr.net','cdnjs.cloudflare.com','www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'];

self.addEventListener('install',e=>{ self.skipWaiting(); });
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('mm-sw-')&&!k.startsWith(VERSION)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

function isCdn(url){ return CDN_HOSTS.includes(url.hostname); }
function isOwnPage(url){ return url.origin===self.location.origin&&(url.pathname==='/'||/\.(html|js|css|png|json)$/.test(url.pathname)); }

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  let url; try{ url=new URL(req.url); }catch(err){ return; }
  if(req.mode==='navigate'||(url.origin===self.location.origin&&isOwnPage(url))){
    e.respondWith(networkFirst(req,url));
  } else if(isCdn(url)){
    e.respondWith(staleWhileRevalidate(req));
  }
  // อื่นๆ (API/analytics/รูปจากที่อื่น) ปล่อยผ่านตามปกติ
});

async function networkFirst(req,url){
  const cache=await caches.open(PAGE_CACHE);
  const key=url.origin+url.pathname; // ตัด query (?a=direct ฯลฯ) ให้ใช้ cache ร่วมกัน
  try{
    const res=await fetch(req);
    if(res&&res.ok&&(res.type==='basic'||res.type==='default')) cache.put(key,res.clone());
    return res;
  }catch(err){
    const hit=await cache.match(key);
    if(hit) return hit;
    if(req.mode==='navigate'){ const home=await cache.match(url.origin+'/index.html')||await cache.match(url.origin+'/'); if(home) return home; }
    throw err;
  }
}

async function staleWhileRevalidate(req){
  const cache=await caches.open(CDN_CACHE);
  const hit=await cache.match(req);
  const refresh=fetch(req).then(res=>{ if(res&&(res.ok||res.type==='opaque')) cache.put(req,res.clone()); return res; }).catch(()=>null);
  return hit||(await refresh)||fetch(req);
}
