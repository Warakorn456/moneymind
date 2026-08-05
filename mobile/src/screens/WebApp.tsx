import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform, Text, Alert, Linking, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent, ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
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
// Google Sign-In ผ่าน native SDK (@react-native-google-signin) — ไม่ใช้ browser
// redirect flow แบบ expo-auth-session (ซึ่ง Google กำลัง deprecate + redirect
// custom-scheme ไม่กลับเข้าแอปใน standalone build)
//
// webClientId = Web client ID (Firebase Auth → Google → Web SDK configuration)
// → idToken ที่ได้จะมี audience ตรงกับที่ Firebase.signInWithCredential ต้องการ
// (Android OAuth client + SHA-1 ต้องมีใน GCP ด้วยเพื่อให้ SDK verify แอปได้)
// ─────────────────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID = '668138190451-6nufstl3plvt62lf64ianq8ffa3qb1kh.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
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
        if (!window._auth || !window.firebase) { setTimeout(doSignIn, 300); return; }
        var credential = firebase.auth.GoogleAuthProvider.credential(
          idToken || null,
          accessToken || null
        );
        window._auth.signInWithCredential(credential)
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
        if (!window._auth || !window.firebase) { setTimeout(doSignIn, 300); return; }
        var provider = new firebase.auth.OAuthProvider('apple.com');
        var credential = provider.credential({ idToken: idToken, rawNonce: rawNonce });
        window._auth.signInWithCredential(credential)
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
    setWebViewKey((k) => k + 1);
  }, [clearWatchdog]);

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
  const handleLoadError = useCallback((e: WebViewErrorEvent) => {
    clearWatchdog();
    setLoading(false);
    setLoadError(e.nativeEvent.description || 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต');
  }, [clearWatchdog]);

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
    if (!req.isTopFrame) return true;
    const { url } = req;
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
    const m = /^https?:\/\/([^/]+)/i.exec(url);
    const host = m ? m[1].toLowerCase() : null;
    if (host === WEB_HOST) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  // ส่งผลกลับเข้า WebView
  const injectAuth = useCallback((idToken: string | null, accessToken: string | null) => {
    const js = `(function(){ if(window.handleNativeGoogleAuth) window.handleNativeGoogleAuth(${JSON.stringify(idToken)},${JSON.stringify(accessToken)}); })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const injectError = useCallback((msg: string) => {
    const js = `(function(){ if(window.handleNativeGoogleError) window.handleNativeGoogleError(${JSON.stringify(msg)}); })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

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
        if (err.code === statusCodes.IN_PROGRESS) return;
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) msg = 'Google Play Services ไม่พร้อมใช้งาน';
        else msg = String(err.code);
      } else {
        msg = err?.message || 'error';
      }
      injectError(msg);
    }
  }, [injectAuth, injectError]);

  // ส่งผล Apple Sign-In กลับเข้า WebView
  const injectAppleAuth = useCallback((idToken: string, rawNonce: string) => {
    const js = `(function(){ if(window.handleNativeAppleAuth) window.handleNativeAppleAuth(${JSON.stringify(idToken)},${JSON.stringify(rawNonce)}); })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const injectAppleError = useCallback((msg: string) => {
    const js = `(function(){ if(window.handleNativeAppleError) window.handleNativeAppleError(${JSON.stringify(msg)}); })(); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

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
