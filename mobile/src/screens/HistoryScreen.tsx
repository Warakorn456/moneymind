import React, { useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert } from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import TransactionItem from '../components/TransactionItem';
import { Transaction } from '../types';

function groupByDate(transactions: Transaction[]): { title: string; data: Transaction[] }[] {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const d = new Date(tx.date);
    const key = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function HistoryScreen() {
  const { db, deleteTx } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const filtered = (db.transactions || []).filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  const sections = groupByDate(filtered);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('ลบรายการ', 'ต้องการลบรายการนี้?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => deleteTx(id) },
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.monthRow}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <Text style={s.navTxt}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{MONTHS[month]} {year + 543}</Text>
        <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
          <Text style={s.navTxt}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryRow}>
        <View style={s.sumBox}>
          <Text style={s.sumLabel}>รายรับ</Text>
          <Text style={[s.sumAmt, { color: C.income }]}>+฿{fmt(income)}</Text>
        </View>
        <View style={s.sumBox}>
          <Text style={s.sumLabel}>รายจ่าย</Text>
          <Text style={[s.sumAmt, { color: C.expense }]}>-฿{fmt(expense)}</Text>
        </View>
        <View style={s.sumBox}>
          <Text style={s.sumLabel}>สุทธิ</Text>
          <Text style={[s.sumAmt, { color: income - expense >= 0 ? C.income : C.expense }]}>
            {income - expense >= 0 ? '+' : ''}฿{fmt(income - expense)}
          </Text>
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>ไม่มีรายการในเดือนนี้</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={t => t.id}
          renderSectionHeader={({ section }) => (
            <View style={s.dateHeader}>
              <Text style={s.dateHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={s.itemWrap}>
              <TransactionItem transaction={item} onLongPress={() => confirmDelete(item.id)} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navBtn: { padding: 8 },
  navTxt: { fontSize: 24, color: C.primaryL, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  summaryRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10,
  },
  sumBox: { flex: 1, alignItems: 'center' },
  sumLabel: { fontSize: 11, color: C.muted, marginBottom: 2 },
  sumAmt: { fontSize: 13, fontWeight: '700' },
  dateHeader: {
    backgroundColor: C.surface2, paddingHorizontal: 16, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dateHeaderText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  itemWrap: { paddingHorizontal: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center' },
});
