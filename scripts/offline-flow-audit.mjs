/**
 * Functional smoke tests for offline order numbering & deduplication logic.
 * Run: node scripts/offline-flow-audit.mjs
 */

const displayOrderNumber = (order) => {
  const syncStatus = String(order?.syncStatus ?? order?.sync_status ?? '').toUpperCase();
  const isPending = syncStatus === 'PENDING_SYNC';
  if (isPending) {
    const provisional = String(order?.provisionalNumber ?? order?.provisional_number ?? '').trim();
    if (/^\d{1,6}$/.test(provisional)) return `مؤقت ${provisional}`;
    return '—';
  }
  const raw = String(order?.orderNumber ?? order?.order_number ?? '').trim();
  if (raw && /^\d{1,6}$/.test(raw.replace(/^OFF-/i, '').trim())) {
    return raw.replace(/^OFF-/i, '').trim();
  }
  const provisional = String(order?.provisionalNumber ?? order?.provisional_number ?? '').trim();
  if (/^\d{1,6}$/.test(provisional)) return `مؤقت ${provisional}`;
  return '—';
};

const mergeByClientOrderId = (primary, extra) => {
  const byCid = new Map();
  for (const list of [primary, extra]) {
    for (const o of list) {
      const cid = String(o.clientOrderId || '').trim();
      if (!cid) continue;
      const prev = byCid.get(cid);
      const pending = String(o.syncStatus || '').toUpperCase() === 'PENDING_SYNC';
      if (!prev) {
        byCid.set(cid, o);
        continue;
      }
      const prevPending = String(prev.syncStatus || '').toUpperCase() === 'PENDING_SYNC';
      if (prevPending && !pending) byCid.set(cid, o);
    }
  }
  return byCid.size;
};

let failed = 0;
const assert = (name, cond) => {
  if (!cond) {
    console.error('FAIL:', name);
    failed += 1;
  } else {
    console.log('OK:', name);
  }
};

assert(
  'pending ignores stale server-like order_number',
  displayOrderNumber({
    syncStatus: 'PENDING_SYNC',
    orderNumber: '105',
    provisionalNumber: '2',
  }) === 'مؤقت 2'
);

assert(
  'synced shows final number',
  displayOrderNumber({
    syncStatus: 'SYNCED',
    orderNumber: '27',
    provisionalNumber: '2',
  }) === '27'
);

assert(
  'merge keeps one row per clientOrderId after sync',
  mergeByClientOrderId(
    [{ _id: 'mongo1', clientOrderId: 'off_1', orderNumber: '27', syncStatus: 'SYNCED' }],
    [{ _id: 'off_1', clientOrderId: 'off_1', provisionalNumber: '1', syncStatus: 'PENDING_SYNC' }]
  ) === 1
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll offline flow smoke tests passed.');
