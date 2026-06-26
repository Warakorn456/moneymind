import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { C } from '../config/colors';
import { Transaction } from '../types';
import { getCatInfo } from '../config/categories';

interface Props {
  transaction: Transaction;
  onLongPress?: () => void;
}

export default function TransactionItem({ transaction: tx, onLongPress }: Props) {
  const isIncome = tx.type === 'income';
  const cat = getCatInfo(tx.category, tx.type);
  const dateStr = new Date(tx.date).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short',
  });

  return (
    <TouchableOpacity style={s.row} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={[s.iconBox, { backgroundColor: isIncome ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
        <Text style={s.icon}>{cat.icon}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.category}>{cat.label}</Text>
        {!!tx.description && <Text style={s.note} numberOfLines={1}>{tx.description}</Text>}
        <Text style={s.date}>{dateStr}</Text>
      </View>
      <Text style={[s.amount, { color: isIncome ? C.income : C.expense }]}>
        {isIncome ? '+' : '-'}฿{tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 18 },
  info: { flex: 1 },
  category: { fontSize: 14, fontWeight: '600', color: C.text },
  note: { fontSize: 12, color: C.muted, marginTop: 1 },
  date: { fontSize: 11, color: C.muted, marginTop: 1 },
  amount: { fontSize: 14, fontWeight: '700' },
});
