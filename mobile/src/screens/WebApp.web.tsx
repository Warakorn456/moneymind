import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../config/colors';

export const WEB_URL = 'https://warakorn456.github.io/moneymind/';

// บนเว็บ (Expo web) ใช้ iframe ฝังเว็บหลักโดยตรง
export default function WebApp() {
  return (
    <View style={s.wrap}>
      {React.createElement('iframe', {
        src: WEB_URL,
        style: { border: 'none', width: '100%', height: '100%' },
        title: 'MoneyMind',
        allow: 'clipboard-read; clipboard-write',
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
});
