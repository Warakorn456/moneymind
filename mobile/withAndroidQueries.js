const { withAndroidManifest } = require('@expo/config-plugins');

// Android 11+ (API 30) กรอง package visibility: แอปเรา "มองไม่เห็น" แอปอื่นในเครื่องเลย เว้นแต่
// ประกาศไว้ใน <queries> — ทำให้ Intent.resolveActivity()/Linking.canOpenURL() คืนค่าว่าไม่มีแอป
// รองรับ ทั้งที่ติดตั้งอยู่จริง (ดู https://developer.android.com/training/package-visibility)
//
// จำเป็นสำหรับปุ่ม "Log-in with LINE app" (เพิ่ม 2026-08-14): เมื่อ WebView เจอ Intent URI ของ LINE
// เราต้องยิง IntentLauncher.startActivityAsync({ packageName: 'jp.naver.line.android' }) เปิดแอป
// LINE ตรงๆ — ถ้าไม่ประกาศไว้ที่นี่ การ resolve จะพลาดเงียบๆ
//
// app.json ไม่มี field ให้ตั้ง <queries> และโปรเจกต์นี้เป็น CNG (ไม่มีโฟลเดอร์ android/ ใน repo —
// EAS generate ตอน build) จึงต้องแก้ผ่าน config plugin เท่านั้น แก้ AndroidManifest ด้วยมือไม่ได้
module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // manifest.queries เป็น array ของ <queries> element (ปกติมีตัวเดียว) — merge เข้าของเดิม
    // ถ้ามีอยู่แล้ว (plugin อื่นอาจเพิ่มไว้) ไม่เขียนทับทิ้ง
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const queries = manifest.queries[0];

    if (!Array.isArray(queries.package)) queries.package = [];
    const LINE_PKG = 'jp.naver.line.android';
    const hasLinePkg = queries.package.some(
      (p) => p && p.$ && p.$['android:name'] === LINE_PKG,
    );
    if (!hasLinePkg) queries.package.push({ $: { 'android:name': LINE_PKG } });

    // เผื่อกรณี Intent URI ของ LINE ใช้ scheme `line://` แต่ระบุ package มาผิด/ไม่ระบุ —
    // ประกาศ intent filter ไว้ให้ resolve ตาม scheme ได้ด้วย
    if (!Array.isArray(queries.intent)) queries.intent = [];
    const hasLineScheme = queries.intent.some(
      (i) => i && Array.isArray(i.data) &&
        i.data.some((d) => d && d.$ && d.$['android:scheme'] === 'line'),
    );
    if (!hasLineScheme) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'line' } }],
      });
    }

    return config;
  });
};
