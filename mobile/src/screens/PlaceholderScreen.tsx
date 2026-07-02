import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { C } from '../config/colors';

// ข้อมูลหน้าที่ยังไม่ได้พัฒนา (จับคู่กับเมนูเว็บหลัก)
export const PLACEHOLDER_INFO: Record<string, { icon: string; title: string; desc: string }> = {
  Inbox:         { icon: '📥', title: 'AI Inbox',        desc: 'กล่องข้อความอัจฉริยะ — สรุปและจัดการรายการจาก AI' },
  Recurring:     { icon: '🔁', title: 'รายการซ้ำ',       desc: 'จัดการรายรับ-รายจ่ายที่เกิดซ้ำเป็นประจำ' },
  OT:            { icon: '⏱️', title: 'คำนวณ OT',        desc: 'คำนวณค่าล่วงเวลาและรายได้พิเศษ' },
  Loan:          { icon: '🤝', title: 'คำนวณสินเชื่อ',   desc: 'คำนวณยอดผ่อน ดอกเบี้ย และตารางการชำระ' },
  Subscriptions: { icon: '💳', title: 'Subscriptions',   desc: 'ติดตามค่าบริการรายเดือน/รายปีที่สมัครไว้' },
  Banks:         { icon: '🏦', title: 'ธนาคาร',          desc: 'จัดการบัญชีธนาคารและยอดเงินแต่ละบัญชี' },
  Insurance:     { icon: '🛡️', title: 'ประกัน',          desc: 'จัดเก็บกรมธรรม์และเบี้ยประกัน' },
  Tax:           { icon: '🧾', title: 'ภาษีเงินได้',     desc: 'คำนวณและวางแผนภาษีเงินได้บุคคลธรรมดา' },
  Balance:       { icon: '⚖️', title: 'งบดุล & แผน',     desc: 'ภาพรวมสินทรัพย์ หนี้สิน และความมั่งคั่งสุทธิ' },
  Calendar:      { icon: '📅', title: 'ปฏิทิน',          desc: 'มุมมองปฏิทินของรายการและกำหนดชำระ' },
  Travel:        { icon: '✈️', title: 'ท่องเที่ยว',       desc: 'วางแผนงบประมาณและค่าใช้จ่ายการเดินทาง' },
  Retire:        { icon: '🏖️', title: 'แผนเกษียณ',       desc: 'วางแผนเงินออมและการลงทุนเพื่อการเกษียณ' },
  Profile:       { icon: '🪪', title: 'ประวัติส่วนตัว',   desc: 'ข้อมูลส่วนตัวและการตั้งค่าโปรไฟล์' },
  AIUsage:       { icon: '🤖', title: 'AI Usage',         desc: 'สรุปการใช้งานและค่าใช้จ่าย AI (Gemini/Claude)' },
};

export default function PlaceholderScreen() {
  const route = useRoute();
  const info = PLACEHOLDER_INFO[route.name] || { icon: '🚧', title: route.name, desc: 'กำลังพัฒนา' };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.icon}>{info.icon}</Text>
      <Text style={s.title}>{info.title}</Text>
      <Text style={s.desc}>{info.desc}</Text>
      <View style={s.badge}>
        <Text style={s.badgeText}>🚧 กำลังพัฒนา</Text>
      </View>
      <Text style={s.hint}>ฟีเจอร์นี้มีในเว็บหลักแล้ว{'\n'}กำลังย้ายมาที่แอปมือถือ</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  badge: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)',
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18, marginBottom: 24,
  },
  badgeText: { color: C.primaryL, fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18, opacity: 0.7 },
});
