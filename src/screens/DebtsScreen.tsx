import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import { Debt } from '../types';

const fmt = (n: number) => '฿' + (n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 });
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function DebtsScreen() {
  const { db, upsertDebt, removeDebt } = useApp();
  const debts = db.debts || [];
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  const [remaining, setRemaining] = useState('');
  const [rate, setRate] = useState('');
  const [pay, setPay] = useState('');

  const totalDebt = debts.reduce((s, d) => s + (d.remaining || 0), 0);
  const totalPaid = debts.reduce((s, d) => s + ((d.total || 0) - (d.remaining || 0)), 0);
  const grandTotal = debts.reduce((s, d) => s + (d.total || 0), 0);

  const openAdd = () => {
    setEditing(null);
    setName(''); setTotal(''); setRemaining(''); setRate(''); setPay('');
    setModalVisible(true);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setName(d.name);
    setTotal(String(d.total || ''));
    setRemaining(String(d.remaining || ''));
    setRate(String(d.rate || ''));
    setPay(String(d.pay || ''));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('แจ้งเตือน', 'กรุณาใส่ชื่อหนี้สิน'); return; }
    const totalVal = parseFloat(total) || 0;
    const debt: Debt = {
      ...(editing || {}), // รักษา startDate/dueDate และ field อื่นจากเว็บไว้
      id: editing?.id || uid(),
      name: name.trim(),
      total: totalVal,
      remaining: parseFloat(remaining) ?? totalVal,
      rate: parseFloat(rate) || undefined,
      pay: parseFloat(pay) || undefined,
    };
    await upsertDebt(debt);
    setModalVisible(false);
  };

  const handleDelete = (d: Debt) => {
    Alert.alert('ลบหนี้สิน', `ต้องการลบ "${d.name}" ใช่ไหม?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => removeDebt(d.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Summary hero */}
        {debts.length > 0 && (
          <View style={s.hero}>
            <View style={s.heroGlow} />
            <Text style={s.heroLabel}>หนี้คงเหลือทั้งหมด</Text>
            <Text style={[s.heroAmount, { color: totalDebt > 0 ? C.red : C.green }]}>{fmt(totalDebt)}</Text>
            <View style={s.heroRow}>
              <View style={s.heroHalf}>
                <Text style={s.heroSubLabel}>ยอดหนี้เดิม</Text>
                <Text style={s.heroSubVal}>{fmt(grandTotal)}</Text>
              </View>
              <View style={[s.heroHalf, { borderLeftWidth: 1, borderLeftColor: C.border }]}>
                <Text style={s.heroSubLabel}>ชำระไปแล้ว</Text>
                <Text style={[s.heroSubVal, { color: C.green }]}>{fmt(totalPaid)}</Text>
              </View>
            </View>
            {grandTotal > 0 && (
              <View style={{ marginTop: 10 }}>
                <View style={s.pbarBg}>
                  <View style={[s.pbarFill, {
                    width: `${Math.min(100, (totalPaid / grandTotal) * 100)}%` as any,
                    backgroundColor: C.green,
                  }]} />
                </View>
                <Text style={s.paidPct}>ชำระแล้ว {((totalPaid / grandTotal) * 100).toFixed(1)}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Debt list */}
        {debts.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={s.emptyTitle}>ยอดเยี่ยม! ไม่มีหนี้สิน</Text>
            <Text style={s.emptyText}>กดปุ่ม + เพื่อบันทึกหนี้สินที่มีอยู่</Text>
          </View>
        ) : (
          debts.map((d) => {
            const pct = d.total > 0 ? Math.min(100, ((d.total - d.remaining) / d.total) * 100) : 0;
            const monthsLeft = d.pay && d.pay > 0 ? Math.ceil(d.remaining / d.pay) : null;
            return (
              <TouchableOpacity key={d.id} style={s.card} onPress={() => openEdit(d)} onLongPress={() => handleDelete(d)}>
                <View style={s.cardTop}>
                  <Text style={s.cardName}>{d.name}</Text>
                  <Text style={[s.cardRemaining, { color: d.remaining > 0 ? C.red : C.green }]}>
                    {d.remaining > 0 ? fmt(d.remaining) : 'ชำระแล้ว ✓'}
                  </Text>
                </View>

                <View style={s.pbarBg}>
                  <View style={[s.pbarFill, { width: `${pct}%` as any, backgroundColor: d.remaining <= 0 ? C.green : C.red }]} />
                </View>

                <View style={s.cardMeta}>
                  <Text style={s.metaText}>ยอดทั้งหมด {fmt(d.total)}</Text>
                  {d.rate ? <Text style={s.metaText}>ดอกเบี้ย {d.rate}%/ปี</Text> : null}
                  {d.pay ? <Text style={s.metaText}>ผ่อน {fmt(d.pay)}/เดือน</Text> : null}
                  {monthsLeft ? <Text style={[s.metaText, { color: C.yellow }]}>~{monthsLeft} เดือน</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openAdd}>
        <Text style={{ color: '#fff', fontSize: 24, lineHeight: 28 }}>+</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={s.modal}>
              <Text style={s.modalTitle}>{editing ? 'แก้ไขหนี้สิน' : 'เพิ่มหนี้สิน'}</Text>

              <Text style={s.label}>ชื่อหนี้สิน</Text>
              <TextInput style={s.input} placeholder="เช่น บัตรเครดิต KTC, สินเชื่อรถ..." placeholderTextColor={C.muted} value={name} onChangeText={setName} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>ยอดหนี้ทั้งหมด (฿)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted} keyboardType="numeric" value={total} onChangeText={setTotal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>ยอดคงเหลือ (฿)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted} keyboardType="numeric" value={remaining} onChangeText={setRemaining} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>ดอกเบี้ย (%/ปี)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted} keyboardType="numeric" value={rate} onChangeText={setRate} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>ผ่อน/เดือน (฿)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted} keyboardType="numeric" value={pay} onChangeText={setPay} />
                </View>
              </View>

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.btnCancel} onPress={() => setModalVisible(false)}>
                  <Text style={{ color: C.muted, fontWeight: '600' }}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={handleSave}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>บันทึก</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: C.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    marginBottom: 12, overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: -30, right: -30, width: 120, height: 120,
    borderRadius: 60, backgroundColor: 'rgba(239,68,68,0.1)',
  },
  heroLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroAmount: { fontSize: 30, fontWeight: '800', marginVertical: 4 },
  heroRow: { flexDirection: 'row', marginTop: 8 },
  heroHalf: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  heroSubLabel: { fontSize: 11, color: C.muted, marginBottom: 2 },
  heroSubVal: { fontSize: 15, fontWeight: '700', color: C.text },
  pbarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  pbarFill: { height: 6, borderRadius: 3 },
  paidPct: { fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyText: { fontSize: 13, color: C.muted },
  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  cardRemaining: { fontSize: 15, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: C.muted },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 6,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: C.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 32,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  label: { fontSize: 12, color: C.muted, marginBottom: 4, marginTop: 10, fontWeight: '600' },
  input: {
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, padding: 12, fontSize: 15,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  btnSave: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: C.red, alignItems: 'center' },
});
