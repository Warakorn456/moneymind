import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import { Saving } from '../types';

const fmt = (n: number) => '฿' + (n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 });
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const COLORS = ['#06b6d4', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'];

export default function SavingsScreen() {
  const { db, upsertSaving, removeSaving } = useApp();
  const savings = db.savings || [];
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Saving | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const totalSaved = savings.reduce((s, sv) => s + (sv.current || 0), 0);
  const totalTarget = savings.reduce((s, sv) => s + (sv.target || 0), 0);

  const openAdd = () => {
    setEditing(null);
    setName(''); setTarget(''); setCurrent(''); setDeadline(''); setColor(COLORS[0]);
    setModalVisible(true);
  };

  const openEdit = (sv: Saving) => {
    setEditing(sv);
    setName(sv.name);
    setTarget(String(sv.target || ''));
    setCurrent(String(sv.current || ''));
    setDeadline(sv.deadline || '');
    setColor(sv.color || COLORS[0]);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('แจ้งเตือน', 'กรุณาใส่ชื่อเป้าหมาย'); return; }
    const sv: Saving = {
      ...(editing || {}), // รักษา linkedPortId และ field อื่นจากเว็บไว้
      id: editing?.id || uid(),
      name: name.trim(),
      target: parseFloat(target) || 0,
      current: parseFloat(current) || 0,
      deadline: deadline || undefined,
      color,
    };
    await upsertSaving(sv);
    setModalVisible(false);
  };

  const handleDelete = (sv: Saving) => {
    Alert.alert('ลบเป้าหมาย', `ต้องการลบ "${sv.name}" ใช่ไหม?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => removeSaving(sv.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Summary header */}
        {savings.length > 0 && (
          <View style={s.hero}>
            <View style={s.heroGlow} />
            <Text style={s.heroLabel}>ออมสะสมแล้ว</Text>
            <Text style={[s.heroAmount, { color: C.cyan }]}>{fmt(totalSaved)}</Text>
            <Text style={s.heroSub}>จากเป้าหมายทั้งหมด {fmt(totalTarget)}</Text>
            <View style={s.pbarBg}>
              <View
                style={[s.pbarFill, {
                  width: totalTarget > 0 ? `${Math.min(100, (totalSaved / totalTarget) * 100)}%` as any : '0%',
                  backgroundColor: C.cyan,
                }]}
              />
            </View>
          </View>
        )}

        {/* Savings list */}
        {savings.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🐷</Text>
            <Text style={s.emptyTitle}>ยังไม่มีเป้าหมายออมเงิน</Text>
            <Text style={s.emptyText}>เริ่มตั้งเป้าหมายออมเงินเพื่อให้บรรลุเป้าหมายทางการเงิน</Text>
          </View>
        ) : (
          savings.map((sv) => {
            const pct = sv.target > 0 ? Math.min(100, (sv.current / sv.target) * 100) : 0;
            const done = pct >= 100;
            return (
              <TouchableOpacity key={sv.id} style={s.card} onPress={() => openEdit(sv)} onLongPress={() => handleDelete(sv)}>
                <View style={[s.cardAccent, { backgroundColor: sv.color || C.cyan }]} />
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName}>{sv.name}</Text>
                      {sv.deadline && <Text style={s.cardDeadline}>ครบกำหนด {sv.deadline}</Text>}
                    </View>
                    {done && <Text style={s.doneBadge}>✓ สำเร็จ</Text>}
                  </View>
                  <View style={s.amtRow}>
                    <Text style={[s.amtCur, { color: sv.color || C.cyan }]}>
                      {fmt(sv.current)}
                    </Text>
                    <Text style={s.amtSep}> / </Text>
                    <Text style={s.amtTarget}>{fmt(sv.target)}</Text>
                    <Text style={[s.pct, { color: sv.color || C.cyan }]}>{pct.toFixed(0)}%</Text>
                  </View>
                  <View style={s.pbarBg}>
                    <View style={[s.pbarFill, { width: `${pct}%` as any, backgroundColor: sv.color || C.cyan }]} />
                  </View>
                  {sv.target > sv.current && (
                    <Text style={s.remaining}>ขาดอีก {fmt(sv.target - sv.current)}</Text>
                  )}
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

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={s.modal}>
              <Text style={s.modalTitle}>{editing ? 'แก้ไขเป้าหมาย' : 'เพิ่มเป้าหมายออมเงิน'}</Text>

              <Text style={s.label}>ชื่อเป้าหมาย</Text>
              <TextInput
                style={s.input}
                placeholder="เช่น ซื้อรถ, ท่องเที่ยว..."
                placeholderTextColor={C.muted}
                value={name}
                onChangeText={setName}
              />

              <Text style={s.label}>เป้าหมาย (บาท)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor={C.muted}
                keyboardType="numeric"
                value={target}
                onChangeText={setTarget}
              />

              <Text style={s.label}>ออมแล้ว (บาท)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor={C.muted}
                keyboardType="numeric"
                value={current}
                onChangeText={setCurrent}
              />

              <Text style={s.label}>ครบกำหนด (YYYY-MM-DD)</Text>
              <TextInput
                style={s.input}
                placeholder="2026-12-31"
                placeholderTextColor={C.muted}
                value={deadline}
                onChangeText={setDeadline}
              />

              <Text style={s.label}>สี</Text>
              <View style={s.colorRow}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]}
                    onPress={() => setColor(c)}
                  />
                ))}
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
    borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)',
    marginBottom: 12, overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  heroLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroAmount: { fontSize: 30, fontWeight: '800', marginVertical: 4 },
  heroSub: { fontSize: 12, color: C.muted, marginBottom: 10 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 240 },
  card: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 10, flexDirection: 'row', overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.text },
  cardDeadline: { fontSize: 11, color: C.muted, marginTop: 2 },
  doneBadge: { fontSize: 11, color: C.green, fontWeight: '700', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  amtRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  amtCur: { fontSize: 16, fontWeight: '700' },
  amtSep: { color: C.muted },
  amtTarget: { fontSize: 13, color: C.muted, flex: 1 },
  pct: { fontSize: 13, fontWeight: '700' },
  pbarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  pbarFill: { height: 6, borderRadius: 3 },
  remaining: { fontSize: 11, color: C.muted, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 6,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: C.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 32,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16 },
  label: { fontSize: 12, color: C.muted, marginBottom: 4, marginTop: 8, fontWeight: '600' },
  input: {
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, padding: 12, fontSize: 15,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  btnSave: {
    flex: 2, padding: 14, borderRadius: 12,
    backgroundColor: C.primary, alignItems: 'center',
  },
});
