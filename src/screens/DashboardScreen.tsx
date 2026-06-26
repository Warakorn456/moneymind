import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { C } from '../config/colors';
import { useApp } from '../contexts/AppContext';
import TransactionItem from '../components/TransactionItem';
import { useNavigation } from '@react-navigation/native';
import { getCatInfo } from '../config/categories';

const fmtB = (n: number) =>
  (n < 0 ? '-฿' : '฿') + Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n: number) =>
  (n < 0 ? '-฿' : '฿') + Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTH_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function DashboardScreen() {
  const { db, loading, username, syncError } = useApp();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = React.useState(false);

  const txs = db.transactions || [];
  const now = new Date();

  // This month stats
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTxs = txs.filter(t => t.date?.startsWith(thisMonth));
  const monthIncome  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Net worth (all-time)
  const totalIncome  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;
  const totalSavings = (db.savings || []).reduce((s, sv) => s + (sv.current || 0), 0);
  const totalDebt    = (db.debts || []).reduce((s, d) => s + (d.remaining || 0), 0);
  const investments  = (db.investments || []).reduce((s: number, i: any) => s + (i.value || 0), 0);
  const netWorth     = balance - totalDebt + investments;

  // Last 6 months bar chart data
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mTxs = txs.filter(t => t.date?.startsWith(key));
    return {
      label: MONTH_TH[d.getMonth()],
      inc: mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      exp: mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });
  const maxBar = Math.max(...last6.flatMap(m => [m.inc, m.exp]), 1);

  // Top expense categories this month
  const expByCat: Record<string, number> = {};
  monthTxs.filter(t => t.type === 'expense').forEach(t => {
    expByCat[t.category] = (expByCat[t.category] || 0) + t.amount;
  });
  const topCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // YTD
  const yearKey = `${now.getFullYear()}`;
  const ytdTxs  = txs.filter(t => t.date?.startsWith(yearKey));
  const ytdInc  = ytdTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const ytdExp  = ytdTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const ytdSave = ytdInc - ytdExp;
  const saveRate = ytdInc > 0 ? Math.round((ytdSave / ytdInc) * 100) : 0;
  const spendRatio = ytdInc > 0 ? Math.min(100, Math.round((ytdExp / ytdInc) * 100)) : 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={C.primary} />}
    >
      {/* Sync error */}
      {syncError ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>⚠️ {syncError}</Text>
        </View>
      ) : null}

      {/* ─── HERO CARD ─── */}
      <View style={s.hero}>
        <View style={s.heroGlow1} /><View style={s.heroGlow2} />

        {/* Title + actions */}
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel}>👑 ความมั่งคั่งสุทธิ (NET WORTH)</Text>
            <Text style={[s.heroAmount, { color: netWorth >= 0 ? C.text : C.red }]}>
              {fmtB(netWorth)}
            </Text>
            <Text style={s.heroSub}>{fmtShort(totalIncome)} – {fmtShort(totalExpense)}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={s.heroActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('Add')}>
            <Text style={s.actionBtnText}>+ รายรับ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)' }]} onPress={() => navigation.navigate('Add')}>
            <Text style={[s.actionBtnText, { color: C.red }]}>– รายจ่าย</Text>
          </TouchableOpacity>
        </View>

        {/* 4-stat grid */}
        <View style={s.statGrid}>
          <View style={[s.statBox, { borderTopColor: C.green }]}>
            <Text style={s.statBoxLabel}>↓ รายรับ</Text>
            <Text style={[s.statBoxVal, { color: C.green }]}>{fmtShort(monthIncome)}</Text>
            <Text style={s.statBoxSub}>เดือนนี้</Text>
          </View>
          <View style={[s.statBox, { borderTopColor: C.red }]}>
            <Text style={s.statBoxLabel}>↑ รายจ่าย</Text>
            <Text style={[s.statBoxVal, { color: C.red }]}>{fmtShort(monthExpense)}</Text>
            <Text style={s.statBoxSub}>เดือนนี้</Text>
          </View>
          <View style={[s.statBox, { borderTopColor: C.cyan }]}>
            <Text style={s.statBoxLabel}>≡ คงเหลือ</Text>
            <Text style={[s.statBoxVal, { color: monthIncome - monthExpense >= 0 ? C.cyan : C.red }]}>
              {fmtShort(monthIncome - monthExpense)}
            </Text>
            <Text style={s.statBoxSub}>รายรับ – รายจ่าย</Text>
          </View>
          <View style={[s.statBox, { borderTopColor: C.yellow }]}>
            <Text style={s.statBoxLabel}>📊 พอร์ตลงทุน</Text>
            <Text style={[s.statBoxVal, { color: C.yellow }]}>
              {investments > 0 ? fmtShort(investments) : '—'}
            </Text>
            <Text style={s.statBoxSub}>มูลค่าปัจจุบัน</Text>
          </View>
        </View>
      </View>

      {/* ─── BAR CHART: รายรับ vs รายจ่าย 6 เดือน ─── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>📊 รายรับ vs รายจ่าย 6 เดือน</Text>
        <View style={s.legend}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.green }]} /><Text style={s.legendLabel}>รายรับ</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.red }]} /><Text style={s.legendLabel}>รายจ่าย</Text></View>
        </View>
        <View style={s.barChart}>
          {last6.map((m, i) => {
            const incH = Math.max(2, (m.inc / maxBar) * 80);
            const expH = Math.max(2, (m.exp / maxBar) * 80);
            return (
              <View key={i} style={s.barGroup}>
                <View style={s.barPair}>
                  <View style={[s.bar, { height: incH, backgroundColor: C.green }]} />
                  <View style={[s.bar, { height: expH, backgroundColor: C.red }]} />
                </View>
                <Text style={s.barLabel}>{m.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ─── TOP EXPENSE CATEGORIES ─── */}
      {topCats.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>💸 รายจ่ายแยกหมวด เดือนนี้</Text>
          {topCats.map(([cat, amt]) => {
            const info = getCatInfo(cat, 'expense');
            const pct = monthExpense > 0 ? (amt / monthExpense) * 100 : 0;
            return (
              <View key={cat} style={s.catRow}>
                <Text style={s.catIcon}>{info.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={s.catMeta}>
                    <Text style={s.catName}>{info.label}</Text>
                    <Text style={s.catAmt}>{fmtShort(amt)}</Text>
                  </View>
                  <View style={s.pbarBg}>
                    <View style={[s.pbarFill, { width: `${pct}%` as any, backgroundColor: info.color }]} />
                  </View>
                </View>
                <Text style={s.catPct}>{pct.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── YTD SUMMARY ─── */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          <View>
            <Text style={s.cardTitle}>📅 สรุปปีนี้ (YTD)</Text>
            <Text style={s.cardSub}>1 ม.ค. – ปัจจุบัน</Text>
          </View>
          {saveRate !== 0 && (
            <View style={[s.badge, { backgroundColor: saveRate > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
              <Text style={[s.badgeText, { color: saveRate > 0 ? C.green : C.red }]}>ออม {saveRate}%</Text>
            </View>
          )}
        </View>
        <View style={s.ytdGrid}>
          <View style={s.ytdBox}>
            <Text style={s.ytdLabel}>↓ รายรับ YTD</Text>
            <Text style={[s.ytdVal, { color: C.green }]}>{fmtShort(ytdInc)}</Text>
          </View>
          <View style={s.ytdBox}>
            <Text style={s.ytdLabel}>↑ รายจ่าย YTD</Text>
            <Text style={[s.ytdVal, { color: C.red }]}>{fmtShort(ytdExp)}</Text>
          </View>
          <View style={s.ytdBox}>
            <Text style={s.ytdLabel}>🐷 ออม/คงเหลือ</Text>
            <Text style={[s.ytdVal, { color: ytdSave >= 0 ? C.cyan : C.red }]}>{fmtShort(ytdSave)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <View style={s.ratioRow}>
            <Text style={s.ratioLabel}>สัดส่วนรายจ่าย/รายรับ</Text>
            <Text style={[s.ratioVal, { color: spendRatio > 80 ? C.red : C.green }]}>{spendRatio}%</Text>
          </View>
          <View style={s.pbarBg}>
            <View style={[s.pbarFill, {
              width: `${spendRatio}%` as any,
              backgroundColor: spendRatio > 80 ? C.red : C.green,
            }]} />
          </View>
        </View>
      </View>

      {/* ─── SAVINGS SUMMARY ─── */}
      {(db.savings || []).length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>🐷 เงินออม</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Savings')}>
              <Text style={s.seeAll}>ดูทั้งหมด →</Text>
            </TouchableOpacity>
          </View>
          {(db.savings || []).slice(0, 3).map((sv: any) => {
            const pct = sv.target > 0 ? Math.min(100, (sv.current / sv.target) * 100) : 0;
            return (
              <View key={sv.id} style={s.savRow}>
                <View style={s.savMeta}>
                  <Text style={s.savName}>{sv.name}</Text>
                  <Text style={s.savAmt}>
                    <Text style={{ color: C.cyan }}>฿{(sv.current || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</Text>
                    <Text style={{ color: C.muted }}> / ฿{(sv.target || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</Text>
                  </Text>
                </View>
                <View style={s.pbarBg}>
                  <View style={[s.pbarFill, { width: `${pct}%` as any, backgroundColor: sv.color || C.cyan }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── RECENT TRANSACTIONS ─── */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          <Text style={s.cardTitle}>🕒 รายการล่าสุด</Text>
          {txs.length > 5 && (
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text style={s.seeAll}>ดูทั้งหมด →</Text>
            </TouchableOpacity>
          )}
        </View>
        {loading ? (
          <Text style={[s.emptyText, { padding: 16, textAlign: 'center' }]}>กำลังโหลด...</Text>
        ) : txs.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 36 }}>💰</Text>
            <Text style={s.emptyText}>ยังไม่มีรายการ{'\n'}กด "บันทึกรายการ" เพื่อเริ่มต้น</Text>
          </View>
        ) : (
          txs.slice(0, 5).map(tx => <TransactionItem key={tx.id} transaction={tx} />)
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  errorBanner: {
    margin: 12, marginBottom: 4, backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  errorText: { color: C.red, fontSize: 13 },

  // Hero
  hero: {
    margin: 16, marginBottom: 10, borderRadius: 20, padding: 20,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
    overflow: 'hidden',
    // Simulate gradient via overlay glows
  },
  heroGlow1: {
    position: 'absolute', top: -50, right: -50, width: 200, height: 200,
    borderRadius: 100, backgroundColor: 'rgba(124,58,237,0.18)',
  },
  heroGlow2: {
    position: 'absolute', bottom: -40, left: '25%', width: 140, height: 140,
    borderRadius: 70, backgroundColor: 'rgba(6,182,212,0.1)',
  },
  heroTop: { marginBottom: 12 },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  heroAmount: { fontSize: 34, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  heroSub: { fontSize: 12, color: C.muted, marginTop: 4 },

  heroActions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)',
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: C.primaryL },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    flex: 1, minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 2,
  },
  statBoxLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
  statBoxVal: { fontSize: 15, fontWeight: '700' },
  statBoxSub: { fontSize: 10, color: C.muted, marginTop: 2 },

  // Cards
  card: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  cardSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  seeAll: { fontSize: 12, color: C.primaryL },

  // Bar chart
  legend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: C.muted },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 },
  barGroup: { flex: 1, alignItems: 'center', gap: 4 },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 },
  bar: { flex: 1, borderRadius: 3, minHeight: 2 },
  barLabel: { fontSize: 9, color: C.muted, textAlign: 'center' },

  // Category
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  catMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: 13, color: C.text },
  catAmt: { fontSize: 13, fontWeight: '600', color: C.expense },
  catPct: { fontSize: 11, color: C.muted, width: 30, textAlign: 'right' },

  pbarBg: { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  pbarFill: { height: 5, borderRadius: 3 },

  // YTD
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ytdGrid: { flexDirection: 'row', gap: 0 },
  ytdBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  ytdLabel: { fontSize: 10, color: C.muted, marginBottom: 4 },
  ytdVal: { fontSize: 14, fontWeight: '700' },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  ratioLabel: { fontSize: 12, color: C.muted },
  ratioVal: { fontSize: 12, fontWeight: '600' },

  // Savings
  savRow: { marginBottom: 10 },
  savMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  savName: { fontSize: 13, color: C.text, fontWeight: '500' },
  savAmt: { fontSize: 12 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
