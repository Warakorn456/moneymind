import React, { useRef, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../config/colors';

export const WEB_URL = 'https://warakorn456.github.io/moneymind/';

export default function WebApp() {
  const ref = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const canGoBack = useRef(false);

  // ปุ่มย้อนกลับของ Android → ย้อนหน้าใน WebView ก่อนปิดแอป
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current && ref.current) {
        ref.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={s.wrap}>
      <WebView
        ref={ref}
        source={{ uri: WEB_URL }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(n) => { canGoBack.current = n.canGoBack; }}
        startInLoadingState
        domStorageEnabled
        javaScriptEnabled
        originWhitelist={['*']}
        // ให้ Firebase auth / popup ทำงานได้
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
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
  wrap: { flex: 1, backgroundColor: C.bg },
  web: { flex: 1, backgroundColor: C.bg },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  logo: { fontSize: 22, fontWeight: '800', color: C.primaryL },
});
