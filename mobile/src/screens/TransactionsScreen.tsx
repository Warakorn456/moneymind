import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import TransactionItem from '../components/TransactionItem';

const FILTERS = ['ทั้งหมด', 'รายรับ', 'รายจ่าย'];

export default function TransactionsScreen() {
  const { db, deleteTx } = useApp();
  const [filter, setFilter] = useState('ทั้งหมด');
  const [search, setSearch] = useState('');

  const txs = (db.transactions || [])
    .filter(t => filter === 'ทั้งหมด' ? true : filter === 'รายรับ' ? t.type === 'income' : t.type === 'expense')
    .filter(t => search === '' ? true : (t.category + (t.description || '')).toLowerCase().includes(search.toLowerCase()));

  const income = (db.transactions || []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = (db.transactions || []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  const confirmDelete = (id: string) => {
    Alert.alert('ลบรายการ', 'ต้องการลบรายการนี้ใช่ไหม?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => deleteTx(id) },
    ]);
  };

  return (
    <View style={s.container}>
      {/* Summary */}
      <View style={s.summary}>
        <View style={s.sumItem}>
          <Text style={s.sumLabel}>รายรับ</Text>
          <Text style={[s.sumAmt, { color: C.income }]}>+฿{fmt(income)}</Text>
        </View>
        <View style={s.sumDivider} />
        <View style={s.sumItem}>
          <Text style={s.sumLabel}>รายจ่าย</Text>
          <Text style={[s.sumAmt, { color: C.expense }]}>-฿{fmt(expense)}</Text>
        </View>
        <View style={s.sumDivider} />
        <View style={s.sumItem}>
          <Text style={s.sumLabel}>คงเหลือ</Text>
          <Text style={[s.sumAmt, { color: income - expense >= 0 ? C.text : C.red }]}>
            ฿{fmt(income - expense)}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="ค้นหา..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={txs}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TransactionItem transaction={item} onLongPress={() => confirmDelete(item.id)} />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>ไม่พบรายการ</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  summary: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingVertical: 12,
  },
  sumItem: { flex: 1, alignItems: 'center' },
  sumLabel: { fontSize: 11, color: C.muted, marginBottom: 2 },
  sumAmt: { fontSize: 14, fontWeight: '700' },
  sumDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  searchWrap: { padding: 12, paddingBottom: 8 },
  search: {
    backgroundColor: C.surface, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    padding: 10, fontSize: 14, color: C.text,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  filterActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: C.primary },
  filterText: { fontSize: 13, color: C.muted },
  filterTextActive: { color: C.primaryL, fontWeight: '600' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: C.muted, fontSize: 14 },
});
