export const INC_CATS = [
  { id: 'salary', label: 'เงินเดือน', icon: '💼', color: '#10b981' },
  { id: 'freelance', label: 'ฟรีแลนซ์', icon: '💻', color: '#06b6d4' },
  { id: 'invest_return', label: 'ผลตอบแทนลงทุน', icon: '📈', color: '#a78bfa' },
  { id: 'bonus', label: 'โบนัส/รางวัล', icon: '🎁', color: '#f59e0b' },
  { id: 'rental', label: 'ค่าเช่า', icon: '🏢', color: '#84cc16' },
  { id: 'other_inc', label: 'รายรับอื่นๆ', icon: '💰', color: '#94a3b8' },
];

export const EXP_CATS = [
  { id: 'food', label: 'อาหาร', icon: '🍜', color: '#ef4444' },
  { id: 'transport', label: 'เดินทาง', icon: '🚗', color: '#f97316' },
  { id: 'fuel', label: 'เติมน้ำมัน', icon: '⛽', color: '#fb923c' },
  { id: 'housing', label: 'ที่พัก/เช่า', icon: '🏠', color: '#84cc16' },
  { id: 'utility', label: 'สาธารณูปโภค', icon: '⚡', color: '#eab308' },
  { id: 'health', label: 'สุขภาพ', icon: '💊', color: '#ec4899' },
  { id: 'entertainment', label: 'บันเทิง', icon: '🎮', color: '#8b5cf6' },
  { id: 'shopping', label: 'ช้อปปิ้ง', icon: '🛍️', color: '#06b6d4' },
  { id: 'education', label: 'การศึกษา', icon: '📚', color: '#3b82f6' },
  { id: 'insurance', label: 'ประกัน', icon: '🛡️', color: '#14b8a6' },
  { id: 'debt_pay', label: 'ชำระหนี้', icon: '💳', color: '#f43f5e' },
  { id: 'tax_exp', label: 'ภาษี', icon: '🧾', color: '#f59e0b' },
  { id: 'invest_exp', label: 'ลงทุน', icon: '📊', color: '#7c3aed' },
  { id: 'save_tx', label: 'เงินออม', icon: '🐷', color: '#06b6d4' },
  { id: 'wedding', label: 'แต่งงาน', icon: '💍', color: '#ec4899' },
  { id: 'family', label: 'ให้ครอบครัว', icon: '❤️', color: '#10b981' },
  { id: 'transfer', label: 'โอนเงิน', icon: '🔄', color: '#64748b' },
  { id: 'cash', label: 'ถอนเงินสด', icon: '💵', color: '#78716c' },
  { id: 'travel', label: 'ท่องเที่ยว', icon: '✈️', color: '#0ea5e9' },
  { id: 'other_exp', label: 'รายจ่ายอื่นๆ', icon: '📝', color: '#94a3b8' },
];

export function getCatInfo(id: string, type: 'income' | 'expense') {
  const list = type === 'income' ? INC_CATS : EXP_CATS;
  return list.find(c => c.id === id) || { id, label: id, icon: '📝', color: '#94a3b8' };
}
