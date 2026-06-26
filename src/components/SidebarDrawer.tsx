import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, TouchableWithoutFeedback, Alert, Platform,
} from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import { useDrawer } from '../contexts/DrawerContext';
import { navigate as navRefNavigate, getCurrentRouteName } from '../navigation/navRef';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { name: 'Dashboard',     icon: '🏠', label: 'Dashboard' },
  { name: 'Transactions',  icon: '↔️', label: 'รายรับ-รายจ่าย' },
  { name: 'Add',           icon: '✏️', label: 'บันทึกรายการ' },
  { name: 'Inbox',         icon: '📥', label: 'AI Inbox' },
  { name: 'Recurring',     icon: '🔁', label: 'รายการซ้ำ' },
  { name: 'OT',            icon: '⏱️', label: 'คำนวณ OT' },
  { name: 'Loan',          icon: '🤝', label: 'คำนวณสินเชื่อ' },
  { name: 'Subscriptions', icon: '💳', label: 'Subscriptions' },
  { name: 'Savings',       icon: '🐷', label: 'เงินออม' },
  { name: 'Banks',         icon: '🏦', label: 'ธนาคาร' },
  { name: 'Debts',         icon: '💳', label: 'หนี้สิน' },
  { name: 'Insurance',     icon: '🛡️', label: 'ประกัน' },
  { name: 'Investments',   icon: '📈', label: 'พอร์ตลงทุน' },
  { name: 'Tax',           icon: '🧾', label: 'ภาษีเงินได้' },
  { name: 'Balance',       icon: '⚖️', label: 'งบดุล & แผน' },
  { name: 'Calendar',      icon: '📅', label: 'ปฏิทิน' },
  { name: 'Travel',        icon: '✈️', label: 'ท่องเที่ยว' },
  { name: 'Retire',        icon: '🏖️', label: 'แผนเกษียณ' },
  { name: 'Profile',       icon: '🪪', label: 'ประวัติส่วนตัว' },
  { name: 'History',       icon: '🗓️', label: 'ประวัติรายเดือน' },
];

const NAV_BOTTOM = [
  { name: 'AIUsage', icon: '🤖', label: 'AI Usage' },
  { name: 'More',    icon: '⚙️', label: 'ตั้งค่า' },
];

export default function SidebarDrawer() {
  const { isOpen, close } = useDrawer();
  const { username, db, onLogout } = useApp();

  // Read the active route on each render. The drawer re-renders whenever it
  // opens (isOpen changes), so highlighting stays in sync without a navigator hook.
  const currentRoute = getCurrentRouteName();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  const isNative = Platform.OS !== 'web';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -DRAWER_WIDTH,
        duration: 240,
        useNativeDriver: isNative,
      }),
      Animated.timing(bgAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 240,
        useNativeDriver: isNative,
      }),
    ]).start();
  }, [isOpen]);

  const txCount = (db.transactions || []).length;
  const totalSaved = (db.savings || []).reduce((s, sv) => s + (sv.current || 0), 0);

  const navigate = (screen: string) => {
    navRefNavigate(screen);
    close();
  };

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', `ออกจากบัญชี @${username}?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ', style: 'destructive',
        onPress: async () => {
          close();
          try { await signOut(auth); } catch (_) {}
          onLogout();
        },
      },
    ]);
  };

  const renderItem = (item: typeof NAV_ITEMS[0]) => {
    const active = currentRoute === item.name;
    return (
      <TouchableOpacity
        key={item.name}
        style={[s.navItem, active && s.navItemActive]}
        onPress={() => navigate(item.name)}
        activeOpacity={0.7}
      >
        {active && <View style={s.activeBar} />}
        <Text style={s.navIcon}>{item.icon}</Text>
        <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: bgAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* Logo */}
        <View style={s.logo}>
          <Text style={s.logoTitle}>💰 MoneyMind</Text>
          <Text style={s.logoSub}>การเงินส่วนบุคคล</Text>
        </View>

        <ScrollView style={s.navWrap} showsVerticalScrollIndicator={false}>
          {NAV_ITEMS.map(renderItem)}
          <View style={s.navSep} />
          {NAV_BOTTOM.map(renderItem)}
        </ScrollView>

        {/* Footer */}
        <View style={s.foot}>
          <View style={s.footUser}>
            <Text style={s.footIcon}>👤</Text>
            <View>
              <Text style={s.footUsername}>@{username}</Text>
              <Text style={s.footStats}>
                {txCount} รายการ · ออมแล้ว ฿{totalSaved.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>🚪 ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    zIndex: 100,
  },
  logo: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logoTitle: { fontSize: 20, fontWeight: '800', color: C.primaryL },
  logoSub: { fontSize: 11, color: C.muted, marginTop: 3, letterSpacing: 0.5 },
  navWrap: { flex: 1, paddingVertical: 10 },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 20, gap: 12, position: 'relative',
  },
  navItemActive: { backgroundColor: 'rgba(124,58,237,0.15)' },
  activeBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: C.primary,
    borderTopRightRadius: 2, borderBottomRightRadius: 2,
  },
  navIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  navLabel: { fontSize: 14, fontWeight: '500', color: C.muted },
  navLabelActive: { color: C.primaryL, fontWeight: '600' },
  navSep: {
    height: 1, backgroundColor: C.border,
    marginHorizontal: 20, marginVertical: 8,
  },
  foot: {
    borderTopWidth: 1, borderTopColor: C.border,
    padding: 16, gap: 10,
  },
  footUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footIcon: { fontSize: 24 },
  footUsername: { fontSize: 13, fontWeight: '700', color: C.text },
  footStats: { fontSize: 11, color: C.muted, marginTop: 1 },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 10, paddingVertical: 9, alignItems: 'center',
  },
  logoutText: { fontSize: 13, color: C.red, fontWeight: '600' },
});
