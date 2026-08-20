import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';

// เดิม app.json มีแค่ legacy top-level "splash" key เฉยๆ โดยไม่มี expo-splash-screen ติดตั้ง —
// SDK 54 deprecate ทางนี้แล้ว ทำให้ native launch screen จริงไม่มีกลไก hide/show ที่คุมได้เลย
// (ปล่อยให้ native template จัดการเองไม่แน่นอน) — เพิ่ม 2026-08-19 หลัง Apple reject 1.3.9/build
// 21 ด้วย "app stuck at splash screen" อีกรอบ: เรียก preventAutoHideAsync() ให้เร็วที่สุดเท่าที่
// ทำได้ (ก่อน import App ก็ยิ่งดี แต่ module import ทำงานตามลำดับอยู่แล้ว) แล้วให้ WebApp.tsx
// เป็นคน hideAsync() เองตอนหน้าเว็บโหลดเสร็จจริง (ดู comment ใน WebApp.tsx)
SplashScreen.preventAutoHideAsync().catch(() => {});

if (Platform.OS === 'web') {
  window.addEventListener('error', (e) => {
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace;white-space:pre-wrap;font-size:12px"><b>JS ERROR:</b>\n${e.message}\n\n${e.error?.stack || ''}</div>`;
  });
  window.addEventListener('unhandledrejection', (e) => {
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace;white-space:pre-wrap;font-size:12px"><b>PROMISE ERROR:</b>\n${e.reason}</div>`;
  });
}

registerRootComponent(App);
