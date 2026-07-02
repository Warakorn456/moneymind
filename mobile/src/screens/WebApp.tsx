import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
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

export const WEB_URL = 'https://warakorn456.github.io/moneymind/';

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
})(); true;`;

export default function WebApp() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const canGoBack = useRef(false);

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

  // รับ message จาก WebView (action: 'googleSignIn' | 'exitApp' | 'saveFile' | 'printHtml' | 'requestPushToken')
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'googleSignIn') {
        startGoogleSignIn();
      } else if (data.action === 'exitApp') {
        BackHandler.exitApp();
      } else if (data.action === 'saveFile') {
        saveFile(data.filename, data.mime, data.base64);
      } else if (data.action === 'printHtml') {
        printHtml(data.html);
      } else if (data.action === 'requestPushToken') {
        registerForPushNotifications();
      }
    } catch (_) {}
  }, [startGoogleSignIn, saveFile, printHtml, registerForPushNotifications]);

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
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        onLoadEnd={() => setLoading(false)}
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
      {loading && (
        <View style={s.loader} pointerEvents="none">
          <Text style={s.logo}>💰 MoneyMind</Text>
          <ActivityIndicator size="large" color={C.primaryL} />
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
});
