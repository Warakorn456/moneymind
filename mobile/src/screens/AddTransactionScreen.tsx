import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import { INC_CATS, EXP_CATS } from '../config/categories';
import { Transaction } from '../types';

type TabType = 'expense' | 'income';

export default function AddTransactionScreen() {
  const { addTx } = useApp();
  const [tab, setTab] = useState<TabType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const cats = tab === 'income' ? INC_CATS : EXP_CATS;

  const handleSave = async () => {
    const num = parseFloat(amount.replace(/,/g, ''));
    if (!num || num <= 0) { Alert.alert('แจ้งเตือน', 'กรุณากรอกจำนวนเงิน'); return; }
    if (!category) { Alert.alert('แจ้งเตือน', 'กรุณาเลือกหมวดหมู่'); return; }
    setLoading(true);
    try {
      const tx: Transaction = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        type: tab,
        amount: num,
        category,
        description: note.trim(),
        date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD เหมือนเว็บ
        carryover: false,
        bankId: null,
      };
      await addTx(tx);
      setAmount('');
      setCategory('');
      setNote('');
      Alert.alert('สำเร็จ', 'บันทึกรายการเรียบร้อย');
    } catch {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถบันทึกได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        {/* Tab */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tab, tab === 'expense' && s.tabExpense]}
            onPress={() => { setTab('expense'); setCategory(''); }}
          >
            <Text style={[s.tabText, tab === 'expense' && { color: '#fff' }]}>รายจ่าย</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'income' && s.tabIncome]}
            onPress={() => { setTab('income'); setCategory(''); }}
          >
            <Text style={[s.tabText, tab === 'income' && { color: '#fff' }]}>รายรับ</Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={s.amountCard}>
          <Text style={s.amountLabel}>จำนวนเงิน</Text>
          <View style={s.amountRow}>
            <Text style={s.currency}>฿</Text>
            <TextInput
              style={s.amountInput}
              placeholder="0.00"
              placeholderTextColor={C.muted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Categories */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>หมวดหมู่</Text>
          <View style={s.catGrid}>
            {cats.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[s.catItem, category === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '20' }]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={s.catIcon}>{cat.icon}</Text>
                <Text style={[s.catLabel, category === cat.id && { color: cat.color }]} numberOfLines={1}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Note */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>หมายเหตุ (ไม่จำเป็น)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="เพิ่มหมายเหตุ..."
            placeholderTextColor={C.muted}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: tab === 'expense' ? C.expense : C.income }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>บันทึกรายการ</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tabRow: {
    flexDirection: 'row', margin: 16, backgroundColor: C.surface,
    borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabExpense: { backgroundColor: C.expense },
  tabIncome: { backgroundColor: C.income },
  tabText: { fontSize: 15, fontWeight: '700', color: C.muted },
  amountCard: {
    marginHorizontal: 16, backgroundColor: C.surface, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  amountLabel: { fontSize: 12, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 28, color: C.muted, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '800', color: C.text },
  section: { marginHorizontal: 16, marginTop: 12 },
  sectionTitle: { fontSize: 13, color: C.muted, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catItem: {
    width: '30%', backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    padding: 10, alignItems: 'center',
  },
  catIcon: { fontSize: 22, marginBottom: 4 },
  catLabel: { fontSize: 11, color: C.muted, textAlign: 'center' },
  noteInput: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, fontSize: 14, color: C.text, minHeight: 72,
    textAlignVertical: 'top',
  },
  saveBtn: {
    margin: 16, marginTop: 20, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
