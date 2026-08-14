import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform, Text, Alert, Linking, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent, ShouldStartLoadRequest, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Notifications from 'expo-notifications';
import * as StoreReview from 'expo-store-review';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as IntentLauncher from 'expo-intent-launcher';
import { C } from '../config/colors';

// แจ้งเตือนที่มาถึงตอนแอปเปิดอยู่ (foreground) ให้โชว์แบนเนอร์+เสียงเหมือนตอนแอปปิดอยู่
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const WEB_URL = 'https://app.moneymindth.com/';
const WEB_HOST = 'app.moneymindth.com';

// เวอร์ชันแอป native ปัจจุบัน (app.json) — ส่งเข้าเว็บให้เช็คว่า action ไหนเรียกได้
// เพราะเว็บ deploy ใหม่ทุกวันแต่แอปในเครื่อง user เป็นเวอร์ชันเก่ากว่าได้เสมอ
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

// ─────────────────────────────────────────────────────────────────────────
// Android "Intent URI" — ใช้โดย LINE (ปุ่ม "Log-in with LINE app") และ identity provider
// ส่วนใหญ่บน Android เพื่อเปิดแอป native จากหน้าเว็บ
//
// รูปแบบ:  intent://<host><path>?<query>#Intent;scheme=xxx;package=yyy;S.browser_fallback_url=zzz;end
//    หรือ:  intent:<data>#Intent;...;end   (ไม่มี //)
//
// ทำไมต้อง parse เอง (ยืนยันจากการอ่าน source จริง ไม่ใช่เดา):
//  1. Chromium (เครื่องยนต์ของ Android System WebView) ไม่รู้จัก "intent" เป็น network scheme
//     ถ้าปล่อยให้โหลดตรงๆ จะพังด้วย net::ERR_UNKNOWN_URL_SCHEME
//  2. react-native-webview 13.15.0 **ไม่มีโค้ดจัดการ non-http scheme เลยแม้แต่บรรทัดเดียว**
//     (grep แล้ว: ไม่มี Intent.parseUri, ไม่มี startActivity, ไม่มี browser_fallback_url) —
//     ทุกอย่างต้องทำใน JS
//  3. RN's Linking.openURL ทำแค่ `Intent(ACTION_VIEW, Uri.parse(url))` (IntentModule.kt:110-125)
//     **ไม่เคยเรียก Intent.parseUri(url, URI_INTENT_SCHEME)** ซึ่งเป็นฟังก์ชันเดียวที่ decode
//     composite format นี้ได้ → ส่ง intent:// ดิบให้มันไม่มีทางสำเร็จ (Android จะ route ไป
//     เบราว์เซอร์ ซึ่งก็โหลด intent:// ไม่ได้เหมือนกัน = อาการที่ user เจอในวิดีโอ 2026-08-14)
//
// 🐛 parser เวอร์ชันก่อน (resolveIntentUrl) พังเพราะถ้าหา `scheme=` ไม่เจอมันคืน URL เดิมกลับไป
// เฉยๆ แล้วโค้ดข้างนอกก็ยิง Linking.openURL ด้วย URL ดิบ + ทิ้ง package= และ
// S.browser_fallback_url ไปทั้งคู่ — เวอร์ชันนี้อ่านครบทุก field และมี fallback chain จริง
type ParsedIntent = {
  scheme: string | null;
  pkg: string | null;
  action: string | null;
  dataUri: string | null;     // URL ที่เอาไปเปิดแอปได้จริง เช่น line://... หรือ https://...
  fallbackUrl: string | null;  // S.browser_fallback_url — หน้าเว็บสำรองถ้าเปิดแอปไม่ได้
};

function parseIntentUri(url: string): ParsedIntent | null {
  if (!/^intent:/i.test(url)) return null;
  const hashIdx = url.indexOf('#Intent;');
  const head = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const frag = hashIdx >= 0 ? url.slice(hashIdx + '#Intent;'.length) : '';

  const params: Record<string, string> = {};
  for (const seg of frag.split(';')) {
    if (!seg || seg === 'end') continue;
    const i = seg.indexOf('=');
    if (i > 0) params[seg.slice(0, i)] = seg.slice(i + 1);
  }

  // ตัด prefix ออกให้เหลือ host+path+query — รองรับทั้ง `intent://` และ `intent:` (ไม่มี //)
  const rest = head.replace(/^intent:(\/\/)?/i, '');
  const scheme = params.scheme || null;
  let dataUri: string | null = null;
  if (scheme) dataUri = `${scheme}://${rest}`;
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rest)) dataUri = rest; // เป็น full URI มาแล้ว

  let fallbackUrl: string | null = params['S.browser_fallback_url'] || null;
  if (fallbackUrl) { try { fallbackUrl = decodeURIComponent(fallbackUrl); } catch { /* ใช้ค่าดิบ */ } }

  return { scheme, pkg: params.package || null, action: params.action || null, dataUri, fallbackUrl };
}

// ยิง launcher แล้วตัดสินว่า "เปิดสำเร็จ" หรือไม่ — ต้อง race กับ timeout สั้นๆ เพราะ
// startActivityAsync จะ resolve ตอน activity ปลายทาง**จบ**แล้ว (คือตอน user กลับมาจากแอป LINE
// ซึ่งอาจเป็นนาที) ถ้า await ตรงๆ จะค้าง — แต่ถ้าเปิดไม่ได้จริง (ActivityNotFoundException)
// มันจะ reject เกือบทันที เลยใช้ "ไม่ reject ภายใน 800ms = เปิดสำเร็จ" เป็นเกณฑ์
async function launchedOk(fn: () => Promise<unknown>): Promise<boolean> {
  let rejected = false;
  const p = fn().catch((e) => { rejected = true; throw e; });
  p.catch(() => {}); // กัน unhandled rejection
  await new Promise((r) => setTimeout(r, 800));
  return !rejected;
}

// ─────────────────────────────────────────────────────────────────────────
// Google Sign-In ผ่าน native SDK (@react-native-google-signin) — ไม่ใช้ browser
// redirect flow แบบ expo-auth-session (ซึ่ง Google กำลัง deprecate + redirect
// custom-scheme ไม่กลับเข้าแอปใน standalone build)
//
// webClientId = Web client ID (Firebase Auth → Google → Web SDK configuration)
// → idToken ที่ได้จะมี audience ตรงกับที่ Firebase.signInWithCredential ต้องการ
// (Android OAuth client + SHA-1 ต้องมีใน GCP ด้วยเพื่อให้ SDK verify แอปได้)
// iosClientId = iOS OAuth client จาก Firebase iOS app (registered 2026-08-10, GoogleService-Info.plist)
// จำเป็นสำหรับ iOS โดยเฉพาะ — ไม่มีค่านี้ Google Sign-In จะเปิดไม่ได้บน iOS เลย (ไม่เคยตั้งมาก่อน)
// ─────────────────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID = '668138190451-6nufstl3plvt62lf64ianq8ffa3qb1kh.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '668138190451-j0uc44mu6jhke92tl2njsdgbcb0erqo6.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
});

// บอก web app ว่ากำลังรันบนแพลตฟอร์มไหน — เดิม hardcode _isAndroidApp=true ทั้ง 2 แพลตฟอร์ม
// ทำให้ฝั่ง iOS คิดว่าตัวเองเป็น Android เสมอ (ปุ่ม Sign in with Apple ใน index.html
// เช็ค window._isIOSApp ซึ่งไม่เคยเป็น true เลย จึงไม่มีวันทำงาน)
const PLATFORM_FLAG = Platform.OS === 'ios' ? 'window._isIOSApp = true;' : 'window._isAndroidApp = true;';

// Script ที่ inject ก่อน page load — บอก web app ว่าอยู่ใน native + define callback
const INJECT = `(function(){
  ${PLATFORM_FLAG}
  window._appVersion = ${JSON.stringify(APP_VERSION)};

  // เรียกจาก native เมื่อ Google Sign-In สำเร็จ
  window.handleNativeGoogleAuth = function(idToken, accessToken) {
    try {
      function doSignIn() {
        // ⚠️ _auth ประกาศด้วย "let _auth=null" ที่ top-level ของ index.html script — ตัวแปร
        // let/const แบบนี้ไม่ผูกเข้ากับ window object เอง (ต่างจาก var/function declaration)
        // ใช้ window._auth เช็คแล้วเป็น undefined เสมอไม่ว่า login สำเร็จแค่ไหน ทำให้ loop นี้วนตลอดไป
        // เงียบๆ ไม่มี error (เจอบั๊กเดียวกันมาแล้วที่ mayaAgent()/_subGetIdToken() ใน index.html
        // แก้ไปแล้ว 2026-07-06 แต่ไม่เคยแก้ใน INJECT script นี้ — ต้องอ้างตัวแปรตรงๆ ไม่ใช่ window._auth)
        if (typeof _auth === 'undefined' || !_auth || !window.firebase) { setTimeout(doSignIn, 300); return; }
        var credential = firebase.auth.GoogleAuthProvider.credential(
          idToken || null,
          accessToken || null
        );
        _auth.signInWithCredential(credential)
          .then(function(result) {
            if (window._handleOAuthResult) window._handleOAuthResult(result, 'google');
          })
          .catch(function(err) {
            console.error('[nativeGoogle]', err);
            var el = window._activeLoginErr ? window._activeLoginErr() : null;
            if (el) el.textContent = 'เกิดข้อผิดพลาด: ' + (err.code || err.message);
            document.querySelectorAll('.google-btn,.apple-btn').forEach(function(b){
              b.disabled=false; b.style.opacity='';
            });
          });
      }
      doSignIn();
    } catch(e) { console.error('[nativeGoogle setup]', e); }
  };

  // เรียกจาก native เมื่อ Google Sign-In ยกเลิก/error
  window.handleNativeGoogleError = function(msg) {
    var el = window._activeLoginErr ? window._activeLoginErr() : null;
    if (el) el.textContent = msg === 'cancel' ? '' : ('Google Sign-In ล้มเหลว: ' + msg);
    document.querySelectorAll('.google-btn,.apple-btn').forEach(function(b){
      b.disabled=false; b.style.opacity='';
    });
  };

  // เรียกจาก native เมื่อ Apple Sign-In สำเร็จ — idToken + rawNonce (ไม่ hash) ตามที่
  // Firebase OAuthProvider('apple.com').credential({idToken, rawNonce}) ต้องการ
  window.handleNativeAppleAuth = function(idToken, rawNonce) {
    try {
      function doSignIn() {
        // ดู comment เดียวกันใน handleNativeGoogleAuth ด้านบน — _auth เป็น let-declared ไม่ผูก window
        if (typeof _auth === 'undefined' || !_auth || !window.firebase) { setTimeout(doSignIn, 300); return; }
        var provider = new firebase.auth.OAuthProvider('apple.com');
        var credential = provider.credential({ idToken: idToken, rawNonce: rawNonce });
        _auth.signInWithCredential(credential)
          .then(function(result) {
            if (window._handleOAuthResult) window._handleOAuthResult(result, 'apple');
          })
          .catch(function(err) {
            console.error('[nativeApple]', err);
            var el = window._activeLoginErr ? window._activeLoginErr() : null;
            if (el) el.textContent = 'เกิดข้อผิดพลาด: ' + (err.code || err.message);
            document.querySelectorAll('.google-btn,.apple-btn').forEach(function(b){
              b.disabled=false; b.style.opacity='';
            });
          });
      }
      doSignIn();
    } catch(e) { console.error('[nativeApple setup]', e); }
  };

  // เรียกจาก native เมื่อ Apple Sign-In ยกเลิก/error
  window.handleNativeAppleError = function(msg) {
    var el = window._activeLoginErr ? window._activeLoginErr() : null;
    if (el) el.textContent = msg === 'cancel' ? '' : ('Apple Sign-In ล้มเหลว: ' + msg);
    document.querySelectorAll('.google-btn,.apple-btn').forEach(function(b){
      b.disabled=false; b.style.opacity='';
    });
  };
})(); true;`;

export default function WebApp() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // เปลี่ยน key เพื่อ force remount WebView — ต้องทำแบบนี้หลัง renderer crash
  // (แค่ .reload() ไม่พอ เพราะ process ที่ตายไปแล้วไม่รับคำสั่งอะไรอีก)
  const [webViewKey, setWebViewKey] = useState(0);
  const canGoBack = useRef(false);
  // source เป็น state (ไม่ใช่ literal คงที่) เพื่อให้ error-recovery พากลับไปหน้า http(s) ล่าสุด
  // ที่ user ค้างอยู่ได้ (เช่นหน้า login ของ LINE) แทนที่จะเด้งกลับหน้าแรกของแอปเสมอ
  const [webSource, setWebSource] = useState<{ uri: string }>({ uri: WEB_URL });
  const lastGoodUrlRef = useRef<string>(WEB_URL);

  // Safety-net สำหรับ Apple Guideline 2.1.0 "App launches into a blank screen":
  // onLoadEnd ของ WebView บอกแค่ว่า HTML โหลดเสร็จ ไม่ได้แปลว่าเว็บแอป render UI สำเร็จจริง
  // ถ้า JS ฝั่งเว็บ crash ระหว่าง init (ก่อน checkLogin()/render เสร็จ) หน้าจอจะว่างเปล่าค้างถาวร
  // โดยที่ native ไม่รู้ตัวเลยเพราะ onLoadEnd ยิงไปแล้ว — ใช้ 'appReady' ping จากเว็บ (ยิงหลัง
  // checkLogin() เสร็จ) เป็นสัญญาณยืนยัน ถ้าไม่ได้รับภายใน timeout ให้ถือว่าล้มเหลวและโชว์ retry
  const appReadyRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const handleRetry = useCallback(() => {
    clearWatchdog();
    appReadyRef.current = false;
    setLoadError(null);
    setLoading(true);
    setWebSource({ uri: WEB_URL });
    setWebViewKey((k) => k + 1);
  }, [clearWatchdog]);

  // จุดเดียวที่ทุก call site ใช้เปิดอะไรก็ตามที่ไม่ใช่หน้าเว็บของเราเอง — มี fallback chain
  // เรียงลำดับชัดเจน ถ้าขั้นไหนพลาดจะไล่ลงขั้นถัดไปเสมอ ไม่มีทางตายเงียบเหมือนโค้ดเวอร์ชันก่อน
  // (ซึ่ง .catch(()=>{}) กลืน error ทุกจุดจนไม่มีใครรู้ว่าพลาดตรงไหน)
  const openExternalUrl = useCallback(async (url: string) => {
    const parsed = Platform.OS === 'android' ? parseIntentUri(url) : null;

    // ลิงก์ภายนอกทั่วไป (ไม่ใช่ intent URI) — พฤติกรรมเดิม
    if (!parsed) {
      Linking.openURL(url).catch(() => {});
      return;
    }

    const tried: string[] = [];
    console.log('[MM-INTENT] parsed', JSON.stringify(parsed));

    // (1) ยิงแบบระบุ package ปลายทางตรงๆ — เส้นทางหลักที่ควรเปิดแอป LINE สำเร็จ
    //     นี่คือสิ่งที่ Linking.openURL ทำไม่ได้ (มันตั้ง package ไม่ได้เลย)
    if (parsed.dataUri && parsed.pkg) {
      try {
        const ok = await launchedOk(() => IntentLauncher.startActivityAsync(
          parsed.action || 'android.intent.action.VIEW',
          { data: parsed.dataUri as string, packageName: parsed.pkg as string },
        ));
        if (ok) return;
        tried.push('pkg-intent: rejected');
      } catch (e) { tried.push(`pkg-intent: ${String(e)}`); }
    }

    // (2) ยิงซ้ำแบบไม่ pin package (เผื่อ package ในลิงก์ผิด/ไม่ได้ติดตั้ง แต่มีแอปอื่นรับ scheme นี้)
    if (parsed.dataUri) {
      try {
        const ok = await launchedOk(() => IntentLauncher.startActivityAsync(
          parsed.action || 'android.intent.action.VIEW',
          { data: parsed.dataUri as string },
        ));
        if (ok) return;
        tried.push('intent: rejected');
      } catch (e) { tried.push(`intent: ${String(e)}`); }

      try {
        const ok = await launchedOk(() => Linking.openURL(parsed.dataUri as string));
        if (ok) return;
        tried.push('linking: rejected');
      } catch (e) { tried.push(`linking: ${String(e)}`); }
    }

    // (3) เปิดแอปไม่ได้ → โหลด browser_fallback_url ใน WebView เดิม (คือสิ่งที่ Chrome ทำเอง
    //     ตามธรรมชาติ) — พา user ไปหน้า login แบบกรอกอีเมล/QR แทน ไม่หลุดออกนอกแอป
    if (parsed.fallbackUrl && webViewRef.current) {
      console.log('[MM-INTENT] using browser_fallback_url');
      webViewRef.current.injectJavaScript(
        `window.location.replace(${JSON.stringify(parsed.fallbackUrl)});true;`,
      );
      return;
    }

    // (4) หมดทุกทาง → โชว์ให้เห็นกับตา (หน้า login ยังไม่มี Firebase auth จึงส่ง _sendReport
    //     เข้า Firestore ไม่ได้) user แคปหน้าจอส่งมาได้เลย รอบหน้าจะรู้สาเหตุแน่นอนไม่ต้องเดา
    console.log('[MM-INTENT] all fallbacks failed', tried.join(' | '));
    Alert.alert('เปิดแอปไม่สำเร็จ', `${url}\n\n${tried.join('\n')}`);
  }, []);

  // ⚠️ ห้ามรีเซ็ต appReadyRef ที่นี่เด็ดขาด — inline script ของเว็บรันระหว่าง parse หน้า
  // ทำให้ 'appReady' มาถึง *ก่อน* onLoadEnd เสมอบนเน็ตปกติ ถ้ารีเซ็ตทับตรงนี้ flag ที่เพิ่งตั้ง
  // จะหาย แล้ว watchdog จะเตะผู้ใช้ออกจากแอปที่ทำงานปกติไปหน้า error หลัง 15 วิ
  // (คือบั๊กที่ทำให้ Apple reject รอบสอง 2026-07-16: "app redirects to an error page")
  // จุดรีเซ็ต flag ที่ถูกต้องมีแค่ตอน WebView remount จริง: handleRetry / handleRenderProcessGone
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    clearWatchdog();
    if (!appReadyRef.current) {
      watchdogRef.current = setTimeout(() => {
        if (!appReadyRef.current) {
          setLoadError('แอปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
      }, 15000);
    }
  }, [clearWatchdog]);

  useEffect(() => () => clearWatchdog(), [clearWatchdog]);

  // onError ยิงเฉพาะตอน navigation หลักของ WebView ล้มเหลว (เช่น ไม่มีเน็ต, DNS ล้มเหลว)
  // ไม่ยิงตอน sub-resource (CDN script/font) โหลดพลาด — นั่นเป็นเรื่องของหน้าเว็บเอง
  //
  // 🐛 (เจอ+แก้ 2026-08-14) Android: แตะ "Log-in with LINE app" แล้วเจอ net::ERR_UNKNOWN_URL_SCHEME
  // เต็มจอ — react-native-webview's Android shouldOverrideUrlLoading ใช้ synchronous bridge call
  // ที่มี timeout (ดู RNCWebViewClient.java "Did not receive response...defaulting to allow
  // loading") ถ้าตอบไม่ทันหรือตกไปทาง fallback path, WebView native จะพยายามโหลด intent://
  // URL ตรงๆ เอง (ก่อนที่ handleShouldStartLoad ด้านล่างจะทันดักไว้) แล้วพังด้วย error นี้ — ดักซ้ำ
  // เป็น safety net ชั้นที่ 2 ที่นี่: ถ้า URL ที่ล้มเหลวไม่ใช่ http(s) ไม่ต้องโชว์หน้า error เต็มจอ
  // (ดูเหมือนแอปพังทั้งแอปทั้งที่จริงแค่ปุ่มลัดเปิดแอปอื่นพลาด) ให้ลองส่งต่อ Linking.openURL() แทน
  // แล้ว reload กลับเข้าหน้าเว็บปกติเงียบๆ
  const handleLoadError = useCallback((e: WebViewErrorEvent) => {
    const failedUrl = e.nativeEvent.url;
    if (failedUrl && !/^https?:\/\//i.test(failedUrl)) {
      // 🐛 แก้ 2026-08-14: เดิมเรียก handleRetry() ซึ่ง remount WebView กลับไป WEB_URL —
      // ทำลายหน้า LINE OAuth ที่ user ค้างอยู่ทิ้งทั้งที่เพิ่งเปิดแอปสำเร็จ. เปลี่ยนเป็นพากลับ
      // ไปหน้า http(s) ล่าสุดที่ user อยู่จริงแทน (โดยปกติคือหน้า login ของ LINE)
      openExternalUrl(failedUrl);
      clearWatchdog();
      appReadyRef.current = false;
      setLoadError(null);
      setLoading(true);
      setWebSource({ uri: lastGoodUrlRef.current });
      setWebViewKey((k) => k + 1);
      return;
    }
    clearWatchdog();
    setLoading(false);
    setLoadError(e.nativeEvent.description || 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต');
  }, [clearWatchdog, openExternalUrl]);

  const handleHttpError = useCallback((e: WebViewHttpErrorEvent) => {
    if (e.nativeEvent.statusCode >= 400) {
      setLoading(false);
      setLoadError(`เซิร์ฟเวอร์ตอบกลับผิดพลาด (${e.nativeEvent.statusCode})`);
    }
  }, []);

  // Android เท่านั้น — WebView renderer crash (เจอได้จริงบนเครื่อง RAM น้อยกับ Chart.js/3D globe หนักๆ)
  // ไม่ remount จอจะขาวค้างถาวรจนกว่า user จะ force close เอง
  const handleRenderProcessGone = useCallback(() => {
    clearWatchdog();
    appReadyRef.current = false;
    setLoading(true);
    setLoadError(null);
    setWebViewKey((k) => k + 1);
  }, [clearWatchdog]);

  // จำกัดให้ WebView นำทางเฉพาะโดเมนของแอปเอง — ลิงก์ภายนอก (ข่าว, external link ในหน้าเว็บ)
  // เปิดด้วยเบราว์เซอร์นอกแทน กัน user หลุดออกจากแอปไปติดอยู่หน้าเว็บอื่นที่ไม่มีทางกลับ
  //
  // 🐛 (เจอ+แก้ 2026-07-31) เดิม check นี้ครอบทุก navigation request รวมถึง iframe ที่หน้าเว็บ
  // สร้างเองในพื้นหลัง (ไม่ใช่ user แตะลิงก์) — Firebase Auth SDK โหลด hidden iframe ไปที่
  // authDomain (`moneymind-d97f3.firebaseapp.com`, คนละ host กับ WEB_HOST) เองอัตโนมัติทุกครั้ง
  // ที่ auth เริ่มทำงาน (ทุกครั้งที่เปิดแอป) ทำให้แอปทั้งแอปถูกเด้งออกไป Safari ทันทีที่เปิด
  // (isTopFrame:false ก็ยังโดน host-check เดิมเหมือน user แตะลิงก์จริง) — แก้โดยเช็ค isTopFrame
  // ก่อนเสมอ: อนุญาต iframe ทุกกรณีให้โหลดในตัวเอง ไม่ผ่าน host allowlist เลย บล็อกเฉพาะ
  // top-level navigation (คือที่ user แตะลิงก์จริง เปลี่ยนทั้งหน้าออกจากแอป) เท่านั้น
  const handleShouldStartLoad = useCallback((req: ShouldStartLoadRequest) => {
    const { url } = req;
    const isInert = url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:');
    // 🐛 แก้ 2026-08-14: เดิมเป็น `if (!req.isTopFrame) return true;` แบบไม่มีเงื่อนไข ซึ่งปล่อยให้
    // iframe โหลด scheme อะไรก็ได้รวมถึง intent:// (LINE ใช้ iframe probe หาแอปที่ติดตั้ง) →
    // WebView โหลดเองแล้วพัง ERR_UNKNOWN_URL_SCHEME. ตอนนี้ปล่อยเฉพาะ iframe ที่เป็น http(s)/
    // about:/data:/blob: — ยังคงแก้บั๊ก Firebase Auth iframe เดิมไว้ครบ (hidden iframe ไป
    // moneymind-d97f3.firebaseapp.com ที่เคยทำให้ทั้งแอปเด้งออก Safari) เพราะนั่นเป็น https
    if (!req.isTopFrame) {
      if (isInert || /^https?:\/\//i.test(url)) return true;
      setTimeout(() => { openExternalUrl(url); }, 0);
      return false;
    }
    if (isInert) return true;
    const m = /^https?:\/\/([^/]+)/i.exec(url);
    const host = m ? m[1].toLowerCase() : null;
    if (host === WEB_HOST) return true;
    // LINE Login (เพิ่ม 2026-08-11) — ต่างจาก Google ที่บล็อก OAuth ใน embedded WebView
    // (disallowed_useragent policy, เป็นเหตุผลที่ Google/Apple ต้องใช้ native SDK bridge)
    // LINE ไม่มีนโยบายแบบนี้ อนุญาตให้ access.line.me (และ subdomain อื่นๆ ของ line.me ที่
    // อาจใช้ระหว่าง flow เช่น การยืนยัน 2FA) โหลด inline ในแอปได้เลย ไม่ต้องเด้งออก external
    // browser เหมือนลิงก์ทั่วไป — ผู้ใช้ authorize เสร็จแล้ว LINE redirect กลับมาที่ WEB_HOST
    // ตามปกติ (ตรงกับ allowlist เดิมด้านบนอยู่แล้ว ไม่ต้องแก้อะไรเพิ่ม)
    if (host && (host === 'line.me' || host.endsWith('.line.me'))) return true;
    // ⚠️ ต้อง return false แบบ synchronous ทันที — native ฝั่ง Android block UI thread รอ JS ตอบ
    // แค่ 250ms (RNCWebViewClient.java: SHOULD_OVERRIDE_URL_LOADING_TIMEOUT) ถ้าตอบไม่ทันมันจะ
    // "ปล่อยให้โหลด" เองแล้วพัง — งานเปิดแอปจึงต้องโยนออกไปนอก call stack นี้เสมอ
    setTimeout(() => { openExternalUrl(url); }, 0);
    return false;
  }, [openExternalUrl]);

  // Android เท่านั้น — ดัก window.open()/<a target="_blank"> ที่ LINE's "Log-in with LINE app"
  // อาจใช้เปิด (เพิ่ม 2026-08-14, คู่กับ safety net ใน handleLoadError ด้านบน): ต่างจาก
  // handleShouldStartLoad ตรงที่ navigation แบบนี้ไปคนละ "window" เลยไม่ผ่าน
  // onShouldStartLoadWithRequest — ถ้าไม่ตั้ง onOpenWindow ไว้ react-native-webview จะสร้าง
  // WebView เปล่าที่ไม่มี interceptor ใดๆ มารับแทน (ดู RNCWebChromeClient.java onCreateWindow)
  // ปล่อยให้พังเงียบๆ อยู่ข้างใน — ใช้ logic เดียวกับ handleShouldStartLoad ทุกประการ
  const handleOpenWindow = useCallback((e: WebViewOpenWindowEvent) => {
    const { targetUrl } = e.nativeEvent;
    if (!targetUrl) return;
    const m = /^https?:\/\/([^/]+)/i.exec(targetUrl);
    const host = m ? m[1].toLowerCase() : null;
    if (host === WEB_HOST || (host && (host === 'line.me' || host.endsWith('.line.me')))) {
      webViewRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(targetUrl)};true;`);
      return;
    }
    openExternalUrl(targetUrl);
  }, [openExternalUrl]);

  // ส่งผลกลับเข้า WebView — retry จนกว่าจะยืนยันว่า deliver สำเร็จจริง (postMessage กลับมา)
  // เจอบั๊กจริง 2026-08-11: Face ID/Apple sheet สำเร็จแล้ว แต่ webViewRef.current อาจยัง null
  // ชั่วคราว หรือ window.handleNativeXxx ยังไม่ทัน define ตอนกลับมาจาก native modal — เดิมยิงครั้งเดียว
  // ด้วย optional chaining (?.injectJavaScript) + injected code เช็ค if(window.fn) เงียบๆ ทั้งคู่
  // ไม่มี error ให้เห็นเลยถ้าพลาด ทำให้ค้างถาวรจนกว่า timeout ฝั่งเว็บ (25 วิ) จะเตะ — retry ทุก 400ms
  // สูงสุด 10 ครั้ง (4 วิ) จนกว่าจะได้ deliveryId ยืนยันกลับ กันเคสที่ยังไม่พร้อมตอนแรกไปพร้อมกัน
  const pendingDeliveries = useRef<Set<string>>(new Set());

  const injectReliable = useCallback((deliveryId: string, fnName: string, args: string) => {
    pendingDeliveries.current.add(deliveryId);
    const js = `(function(){
      if(window.${fnName}){
        window.${fnName}(${args});
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({action:'nativeAuthDelivered', deliveryId:${JSON.stringify(deliveryId)}}));
      }
    })(); true;`;
    let attempts = 0;
    const tryInject = () => {
      if (!pendingDeliveries.current.has(deliveryId)) return;
      attempts += 1;
      webViewRef.current?.injectJavaScript(js);
      if (attempts < 10) setTimeout(tryInject, 400);
    };
    tryInject();
  }, []);

  const injectAuth = useCallback((idToken: string | null, accessToken: string | null) => {
    injectReliable(`google-auth-${Date.now()}`, 'handleNativeGoogleAuth', `${JSON.stringify(idToken)},${JSON.stringify(accessToken)}`);
  }, [injectReliable]);

  const injectError = useCallback((msg: string) => {
    injectReliable(`google-error-${Date.now()}`, 'handleNativeGoogleError', `${JSON.stringify(msg)}`);
  }, [injectReliable]);

  // เริ่ม native Google Sign-In
  const startGoogleSignIn = useCallback(async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // sign out ก่อน เพื่อให้ account picker แสดงทุกครั้ง (ไม่ auto-login บัญชีเดิม)
      try { await GoogleSignin.signOut(); } catch (_) {}
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken ?? null;
        if (!idToken) {
          injectError('ไม่ได้รับ idToken — ตรวจสอบ webClientId/SHA-1');
          return;
        }
        injectAuth(idToken, null);
      } else {
        // ผู้ใช้กดยกเลิก
        injectError('cancel');
      }
    } catch (err: any) {
      let msg = 'error';
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) { injectError('cancel'); return; }
        // เดิมทำแค่ return เฉยๆ ไม่เรียก injectError() เลย — ฝั่งเว็บ (tryGoogleLogin) disable ปุ่ม
        // + รอ callback จาก native ตลอดไปไม่มี timeout ทำให้ปุ่มค้างถาวรถ้าเจอ error code นี้
        // (เช่น user แตะปุ่มซ้ำเร็วๆ ระหว่าง sign-in flow เดิมยังไม่จบ) — ต้อง inject เสมอ
        if (err.code === statusCodes.IN_PROGRESS) { injectError('กำลังลงชื่อเข้าใช้อยู่ ลองใหม่อีกครั้ง'); return; }
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) msg = 'Google Play Services ไม่พร้อมใช้งาน';
        else msg = String(err.code);
      } else {
        msg = err?.message || 'error';
      }
      injectError(msg);
    }
  }, [injectAuth, injectError]);

  // ส่งผล Apple Sign-In กลับเข้า WebView (retry-until-confirmed เหมือน Google — ดู injectReliable ด้านบน)
  const injectAppleAuth = useCallback((idToken: string, rawNonce: string) => {
    injectReliable(`apple-auth-${Date.now()}`, 'handleNativeAppleAuth', `${JSON.stringify(idToken)},${JSON.stringify(rawNonce)}`);
  }, [injectReliable]);

  const injectAppleError = useCallback((msg: string) => {
    injectReliable(`apple-error-${Date.now()}`, 'handleNativeAppleError', `${JSON.stringify(msg)}`);
  }, [injectReliable]);

  // เริ่ม native Apple Sign-In (iOS เท่านั้น) — แทนที่ signInWithPopup() ฝั่งเว็บที่ใช้ไม่ได้ใน
  // WebView (Apple reject 2.1(a) 2026-07-19: "app only displayed a blank screen when we tapped
  // the Sign in with Apple button" — เพราะ WebView ไม่รองรับ true popup window)
  // nonce: ต้อง hash (SHA-256) ก่อนส่งให้ Apple เป็น anti-replay, แล้วส่ง raw nonce (ไม่ hash)
  // ให้ Firebase ตรวจสอบตอนแลก credential — ตาม spec ของ Sign in with Apple + Firebase
  const startAppleSignIn = useCallback(async () => {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        injectAppleError('Apple Sign-In ไม่รองรับบนอุปกรณ์นี้');
        return;
      }
      const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        injectAppleError('ไม่ได้รับ identityToken จาก Apple');
        return;
      }
      injectAppleAuth(credential.identityToken, rawNonce);
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        injectAppleError('cancel');
        return;
      }
      injectAppleError(err?.message || String(err));
    }
  }, [injectAppleAuth, injectAppleError]);

  // บันทึกไฟล์ (CSV/JSON/PNG) ที่ web ส่ง base64 มาให้ ผ่าน expo-file-system + แชร์/บันทึกด้วย expo-sharing
  // (จำเป็นเพราะ <a download> ของ blob: URL ใน react-native-webview ไม่ทำงาน — ไม่มี download listener ให้ blob URI)
  const saveFile = useCallback(async (filename: string, mime: string, base64: string) => {
    try {
      const { File, Paths } = FileSystem;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(base64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename });
      } else {
        Alert.alert(
          'บันทึกไฟล์ไม่สำเร็จ',
          `เครื่องนี้ไม่รองรับการแชร์ไฟล์ (${filename}) — ลองเปิดแอปผ่านเบราว์เซอร์แทน`
        );
      }
    } catch (e) {
      console.warn('[saveFile]', e);
      Alert.alert('บันทึกไฟล์ไม่สำเร็จ', String((e as Error)?.message || e));
    }
  }, []);

  // พิมพ์/บันทึกเป็น PDF จาก HTML ที่ web ส่งมา (window.print()/window.open() ใช้ไม่ได้ใน WebView)
  const printHtml = useCallback(async (html: string) => {
    try {
      await Print.printAsync({ html });
    } catch (e) {
      console.warn('[printHtml]', e);
    }
  }, []);

  // ส่ง Expo push token เข้า WebView ให้เว็บเก็บลง Firestore (members/{user}.expoPushToken)
  const injectPushToken = useCallback((token: string | null) => {
    const js = `(function(){ if(window.handleNativePushToken) window.handleNativePushToken(${JSON.stringify(token)}); })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  // ส่ง error กลับเข้าเว็บให้บันทึกผ่าน _sendReport() เดิม (Firestore 'reports') — เพราะ debug
  // native code จากเครื่องจริงโดยไม่มี USB/logcat ทำไม่ได้ ใช้ pipeline error-report ที่มีอยู่แล้วแทน
  const injectPushError = useCallback((msg: string) => {
    const js = `(function(){ if(window._sendReport) window._sendReport({kind:'error',message:${JSON.stringify('push register: ' + msg)}}); })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  // ขอ permission + ดึง Expo push token — เรียกจากเว็บหลัง login สำเร็จ (action: 'requestPushToken')
  // ใช้ Expo push service (ครอบ FCM/APNs ให้) แทน raw FCM เพราะแอปนี้เป็น Expo managed workflow อยู่แล้ว
  const registerForPushNotifications = useCallback(async () => {
    try {
      if (!Device.isDevice) {
        injectPushError('ต้องใช้เครื่องจริง ไม่ใช่ simulator/emulator');
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#7c3aed',
        });
      }
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        injectPushError('ผู้ใช้ไม่อนุญาต notification permission (status=' + status + ')');
        return;
      }
      // projectId: ลอง extra.eas ก่อน (SDK ปกติ) fallback easConfig (บาง build type ไม่มี expoConfig เต็ม)
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        injectPushError('ไม่พบ projectId จาก Constants (ทั้ง expoConfig และ easConfig)');
        return;
      }
      const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
      injectPushToken(tokenResp.data);
    } catch (e: any) {
      injectPushError(String(e?.message || e));
    }
  }, [injectPushToken, injectPushError]);

  // รับ message จาก WebView (action: 'googleSignIn' | 'appleSignIn' | 'exitApp' | 'saveFile' | 'printHtml' | 'requestPushToken' | 'requestReview')
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'googleSignIn') {
        startGoogleSignIn();
      } else if (data.action === 'appleSignIn') {
        startAppleSignIn();
      } else if (data.action === 'exitApp') {
        BackHandler.exitApp();
      } else if (data.action === 'saveFile') {
        saveFile(data.filename, data.mime, data.base64);
      } else if (data.action === 'printHtml') {
        printHtml(data.html);
      } else if (data.action === 'requestPushToken') {
        registerForPushNotifications();
      } else if (data.action === 'requestReview') {
        // SKStoreReviewController — iOS เองเป็นคนตัดสินใจว่าจะโชว์ prompt จริงไหม (จำกัดจำนวนครั้ง/ปีต่อผู้ใช้)
        // เว็บแค่ "ขอ" ตอนจังหวะดี ไม่มีวัน throw/error กลับไปให้เว็บรู้ว่าโชว์จริงหรือเปล่า
        StoreReview.isAvailableAsync().then((ok) => { if (ok) StoreReview.requestReview(); });
      } else if (data.action === 'appReady') {
        appReadyRef.current = true;
        clearWatchdog();
      } else if (data.action === 'nativeAuthDelivered') {
        pendingDeliveries.current.delete(data.deliveryId);
      }
    } catch (_) {}
  }, [startGoogleSignIn, startAppleSignIn, saveFile, printHtml, registerForPushNotifications, clearWatchdog]);

  // Android hardware back button — ถามหน้าเว็บก่อนเสมอว่ามี modal/หน้าย่อยให้ปิด/ย้อนกลับไหม
  // (SPA ไม่ใช้ pushState ทำให้ webView.canGoBack() เป็น false เกือบตลอด — ถ้าใช้ default
  // behavior ปุ่ม back จะออกจากแอปทันทีแม้มี modal เปิดอยู่ ต้องส่งให้ handleBackButton() ในเว็บตัดสินใจ)
  const injectBackPress = useCallback(() => {
    const js = `(function(){
      var handled = (typeof window.handleBackButton==='function') ? window.handleBackButton() : false;
      if(!handled && window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({action:'exitApp'})); }
    })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current && webViewRef.current) { webViewRef.current.goBack(); return true; }
      injectBackPress();
      return true; // consume เสมอ — ออกจากแอปเฉพาะตอน web ส่ง exitApp message กลับมา
    });
    return () => sub.remove();
  }, [injectBackPress]);

  // LINE Login hand-off (เพิ่ม 2026-08-13) — แก้บั๊ก "เชื่อมต่อ LINE ไม่ได้": user แตะ "Log-in
  // with LINE app" บนหน้า access.line.me (ทางลัดของ LINE เอง) → สลับไปแอป LINE จริง → auth
  // สำเร็จ → LINE redirect กลับมาที่ redirect_uri แต่ไม่มี iOS Universal Links ให้ route กลับเข้า
  // WebView นี้ เลยเปิดเป็น external browser แยกแทน (สังเกตจากวิดีโอ user ส่งมา) — MoneyMind app
  // ตัวนี้ยัง backgrounded อยู่เสมอ (ไม่ถูกปิด) ไม่ได้หายไปไหน — index.html's _handleLineCallback()
  // เจอว่าตัวเองรันอยู่นอกแอป (ไม่มี window._isIOSApp/_isAndroidApp) แล้วโชว์ปุ่ม "กลับไปแอป
  // MoneyMind" ที่ยิง `moneymind://line-callback?code=...&state=...` (scheme ตั้งไว้แล้วใน
  // app.json) — ดักที่นี่แล้วสั่งให้ WebView **เดิม** (ยังมี sessionStorage/Firebase Auth ของ
  // origin app.moneymindth.com ครบเหมือนก่อนสลับไป LINE ทุกประการ เพราะไม่เคยถูกทำลาย) navigate
  // กลับไปที่ WEB_URL พร้อม code/state แนบท้าย ให้ index.html ประมวลผลผ่าน flow ปกติทุกอย่าง
  // (ไม่ต้องเขียน handler ใหม่ฝั่งเว็บ — แค่โหลด URL เดิมที่มี query string ก็พอ)
  const handleLineDeepLink = useCallback((url: string) => {
    if (!url || !url.startsWith('moneymind://line-callback')) return;
    const query = url.split('?')[1] || '';
    if (!query) return;
    const target = `${WEB_URL}?${query}`;
    const js = `window.location.replace(${JSON.stringify(target)}); true;`;
    // WebView อาจยังไม่ mount เสร็จตอน cold-start ผ่าน deep link (Linking.getInitialURL) —
    // retry เบาๆ เหมือน injectReliable ด้านบน กันเคส ref ยัง null ชั่วคราว
    let attempts = 0;
    const tryInject = () => {
      attempts += 1;
      if (webViewRef.current) { webViewRef.current.injectJavaScript(js); return; }
      if (attempts < 10) setTimeout(tryInject, 300);
    };
    tryInject();
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => { if (url) handleLineDeepLink(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleLineDeepLink(url));
    return () => sub.remove();
  }, [handleLineDeepLink]);

  return (
    <View style={s.wrap}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        onLoadEnd={handleLoadEnd}
        onError={handleLoadError}
        onHttpError={handleHttpError}
        onRenderProcessGone={handleRenderProcessGone}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onOpenWindow={handleOpenWindow}
        onNavigationStateChange={(n) => { canGoBack.current = n.canGoBack; }}
        onMessage={handleMessage}
        startInLoadingState
        domStorageEnabled
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={INJECT}
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        style={s.web}
      />
      {loading && !loadError && (
        <View style={s.loader} pointerEvents="none">
          <Text style={s.logo}>💰 MoneyMind</Text>
          <ActivityIndicator size="large" color={C.primaryL} />
        </View>
      )}
      {loadError && (
        <View style={s.loader}>
          <Text style={s.logo}>💰 MoneyMind</Text>
          <Text style={s.errTitle}>เชื่อมต่อไม่ได้</Text>
          <Text style={s.errMsg}>{loadError}</Text>
          <Pressable style={s.retryBtn} onPress={handleRetry}>
            <Text style={s.retryText}>ลองใหม่</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: C.bg },
  web:    { flex: 1, backgroundColor: C.bg },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  logo: { fontSize: 22, fontWeight: '800', color: C.primaryL },
  errTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  errMsg: { fontSize: 13, color: C.muted, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: C.primary,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
