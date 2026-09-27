/**
 * اختبارات تنقية/دمج البيانات المحلية — منع تكرار المشتريات والمخزن.
 * التشغيل: npx tsx scripts/offline-merge-audit.ts
 */
import { dedupeExpenseRows, dedupeInventoryRows } from '../src/utils/localMerge';

let failed = 0;
const assert = (name: string, cond: boolean) => {
  if (!cond) {
    console.error('FAIL:', name);
    failed += 1;
  } else {
    console.log('OK:', name);
  }
};

const SERVER_INV_ID = 'aaaabbbbccccddddeeeeffff';
const SERVER_EXP_ID = '111122223333444455556666';

// 1) صنف واحد مخزّن بصفّين (معرّف مؤقت أوفلاين + معرّف السيرفر النهائي) → كارت واحد
const mergedInventory = dedupeInventoryRows([
  {
    _id: 'off_inv_x',
    clientInventoryId: 'off_inv_x',
    name: 'بن',
    quantity: 12,
    unit: 'KG',
    syncStatus: 'PENDING_SYNC',
  },
  {
    _id: SERVER_INV_ID,
    clientInventoryId: 'off_inv_x',
    name: 'بن',
    quantity: 12,
    unit: 'KG',
    syncStatus: 'SYNCED',
  },
]);
assert('inventory duplicates collapse into a single card', mergedInventory.length === 1);
assert('inventory card keeps the final server id', mergedInventory[0]._id === SERVER_INV_ID);
assert('inventory card keeps the local pending quantity', Number(mergedInventory[0].quantity) === 12);

// 2) رصيد محلي معلّق (توريد أوفلاين) لازم يظهر بدل رصيد السيرفر القديم
const pendingStock = dedupeInventoryRows([
  { _id: SERVER_INV_ID, clientInventoryId: 'off_inv_y', name: 'سكر', quantity: 0, syncStatus: 'SYNCED' },
  { _id: 'off_inv_y', clientInventoryId: 'off_inv_y', name: 'سكر', quantity: 20, syncStatus: 'PENDING_SYNC' },
]);
assert(
  'pending local stock (0 → 20) wins over the stale server row',
  pendingStock.length === 1 && Number(pendingStock[0].quantity) === 20
);

// 3) 11 قيد من السيرفر + 1 توريد أوفلاين معلّق = 12 (وليس 13 بسبب تكرار محلي)
const serverPurchases = Array.from({ length: 11 }, (_, i) => ({
  _id: `srv_${i}`,
  clientExpenseId: `srv_client_${i}`,
  amount: 10,
  category: 'inventory',
  syncStatus: 'SYNCED',
}));
const mergedExpenses = dedupeExpenseRows([
  ...serverPurchases,
  {
    _id: 'off_exp_pending',
    clientExpenseId: 'off_exp_pending',
    amount: 50,
    category: 'inventory',
    syncStatus: 'PENDING_SYNC',
  },
]);
assert('server 11 + one pending purchase = 12 records', mergedExpenses.length === 12);

// 4) نفس العملية مخزّنة مرتين محلياً (مؤقت + سيرفر) → قيد واحد فقط
const sameOperation = dedupeExpenseRows([
  { _id: 'off_rstk_1', clientExpenseId: 'off_rstk_1', amount: 240, category: 'inventory', syncStatus: 'PENDING_SYNC' },
  { _id: SERVER_EXP_ID, clientExpenseId: 'off_rstk_1', amount: 240, category: 'inventory', syncStatus: 'SYNCED' },
]);
assert(
  'the same purchase stored twice counts once',
  sameOperation.length === 1 && sameOperation[0]._id === SERVER_EXP_ID
);

// 5) بعد المزامنة: نفس الـ 12 قيد بمعرّفات نهائية (بدون تحولها لـ 13)
const afterSync = dedupeExpenseRows([
  ...serverPurchases,
  {
    _id: 'off_exp_pending',
    clientExpenseId: 'off_exp_pending',
    amount: 50,
    category: 'inventory',
    syncStatus: 'PENDING_SYNC',
  },
  {
    _id: SERVER_EXP_ID,
    clientExpenseId: 'off_exp_pending',
    amount: 50,
    category: 'inventory',
    syncStatus: 'SYNCED',
  },
]);
assert('after sync the same 12 purchases remain (no duplicate)', afterSync.length === 12);

// 6) عمليتان أوفلاين مختلفتان (لم تتزامنا) تفضلان ظاهرتين
const twoPending = dedupeExpenseRows([
  { _id: 'off_exp_a', clientExpenseId: 'off_exp_a', amount: 10, category: 'inventory', syncStatus: 'PENDING_SYNC' },
  { _id: 'off_exp_b', clientExpenseId: 'off_exp_b', amount: 20, category: 'inventory', syncStatus: 'PENDING_SYNC' },
]);
assert('two different pending purchases stay visible', twoPending.length === 2);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll local merge smoke tests passed.');
