import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../config/colors';

export default function InvestmentsScreen() {
  return (
    <View style={s.container}>
      <Text style={s.icon}>📈</Text>
      <Text style={s.title}>พอร์ตลงทุน</Text>
      <Text style={s.sub}>กำลังพัฒนา — Coming Soon</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  icon: { fontSize: 52 },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  sub: { fontSize: 14, color: C.muted },
});
