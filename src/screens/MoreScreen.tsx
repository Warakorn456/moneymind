import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

export default function MoreScreen() {
  const { username, db, onLogout } = useApp();
  const navigation = useNavigation<any>();

  const totalDebt = (db.debts || []).reduce((s, d) => s + (d.remaining || 0), 0);
  const totalSaved = (db.savings || []).reduce((s, sv) => s + (sv.current || 0), 0);

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', `ออกจากบัญชี @${username}?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ', style: 'destructive',
        onPress: async () => {
          try { await signOut(auth); } catch (_) {}
          onLogout();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Profile */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{username?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View>
          <Text style={s.username}>@{username}</Text>
          <Text style={s.usersub}>MoneyMind</Text>
        </View>
      </View>

      {/* Quick stats */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: C.cyan }]}>฿{totalSaved.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</Text>
          <Text style={s.statLabel}>ออมแล้ว</Text>
        </View>
        <View style={[s.stat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border }]}>
          <Text style={[s.statVal, { color: totalDebt > 0 ? C.red : C.green }]}>
            {totalDebt > 0 ? `฿${totalDebt.toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '—'}
          </Text>
          <Text style={s.statLabel}>หนี้คงเหลือ</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: C.primaryL }]}>{(db.transactions || []).length}</Text>
          <Text style={s.statLabel}>รายการ</Text>
        </View>
      </View>

      {/* Navigation shortcuts */}
      <Text style={s.secTitle}>เมนูด่วน</Text>
      <View style={s.menuCard}>
        {[
          { icon: '💸', label: 'รายรับ-รายจ่าย', screen: 'Transactions' },
          { icon: '🐷', label: 'เงินออม', screen: 'Savings' },
          { icon: '💳', label: 'หนี้สิน', screen: 'Debts' },
          { icon: '📅', label: 'ประวัติรายเดือน', screen: 'History' },
          { icon: '📈', label: 'พอร์ตลงทุน', screen: 'Investments' },
        ].map((item, idx, arr) => (
          <TouchableOpacity
            key={item.screen}
            style={[s.menuItem, idx < arr.length - 1 && s.menuDivider]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={s.menuIcon}>{item.icon}</Text>
            <Text style={s.menuLabel}>{item.label}</Text>
            <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>🚪 ออกจากระบบ</Text>
      </TouchableOpacity>

      <Text style={s.version}>MoneyMind v1.1.0</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  username: { fontSize: 16, fontWeight: '700', color: C.text },
  usersub: { fontSize: 12, color: C.muted, marginTop: 2 },
  statsRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statVal: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2 },
  secTitle: {
    fontSize: 11, color: C.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  menuCard: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 16,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  menuIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: C.text },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    marginBottom: 8,
  },
  logoutText: { fontSize: 14, color: C.red, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 8 },
});
