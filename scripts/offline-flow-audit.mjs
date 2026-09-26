/**
 * Functional smoke tests for offline order, purchase, and inventory flows.
 * Run: node scripts/offline-flow-audit.mjs
 */
import initSqlJs from 'sql.js';
import {
  createOfflineExpense,
  createOfflineInventoryItem,
  listOfflineExpenses,
  restockOfflineInventory,
} from '../desktop/main/offlineInventoryOps.js';
import {
  cacheServerExpense,
  reconcileExpenseWithServer,
  reconcileInventoryWithServer,
  reconcileRestockExpenseWithServer,
  resolveServerInventoryId,
} from '../desktop/main/sync.js';

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

const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(`
  CREATE TABLE inventory (
    _id TEXT PRIMARY KEY, name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL,
    min_limit REAL DEFAULT 5, cost_price REAL DEFAULT 0, last_restock_total_cost REAL DEFAULT 0,
    last_restocked TEXT, sync_status TEXT DEFAULT 'SYNCED', client_inventory_id TEXT UNIQUE, updated_at TEXT
  );
  CREATE TABLE expenses (
    _id TEXT PRIMARY KEY, description TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL,
    inventory_item_linked TEXT, inventory_quantity_added REAL, unit_cost REAL, date TEXT, added_by TEXT,
    sync_status TEXT DEFAULT 'SYNCED', client_expense_id TEXT UNIQUE, purchase_number TEXT UNIQUE, created_at TEXT
  );
  CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT, client_op_id TEXT UNIQUE NOT NULL, entity_type TEXT NOT NULL,
    action TEXT NOT NULL, payload TEXT NOT NULL, status TEXT DEFAULT 'PENDING', attempts INTEGER DEFAULT 0,
    last_error TEXT, created_at TEXT, synced_at TEXT
  );
`);

const enqueue = (operation) => db.run(`
  INSERT INTO sync_queue (client_op_id, entity_type, action, payload, status, created_at)
  VALUES (?, ?, ?, ?, 'PENDING', ?)
`, [operation.clientOpId, operation.entityType, operation.action, JSON.stringify(operation.payload), operation.createdAt]);
const scalar = (sql, params = []) => Number(db.exec(sql, params)?.[0]?.values?.[0]?.[0] || 0);
const localInventoryId = 'off_inv_audit_item';
const serverInventoryId = 'abcdef0123456789abcdef01';
const serverRestockExpenseId = '1234567890abcdef12345678';
const serverPurchaseExpenseId = '234567890abcdef123456789';
const serverOpeningInventoryId = '34567890abcdef1234567890';
const serverOpeningExpenseId = '4567890abcdef12345678901';

assert(
  'server purchase cache is retained in SQLite for offline reads',
  cacheServerExpense(db, {
    _id: 'server_existing_purchase',
    clientExpenseId: 'server_existing_purchase',
    description: 'Previously cached purchase',
    amount: 25,
    category: 'inventory',
    purchaseNumber: 'P-20260925-0012',
    date: '2026-09-25T10:00:00.000Z',
  }) && listOfflineExpenses(db).some((expense) => expense._id === 'server_existing_purchase' && expense.purchaseNumber === 'P-20260925-0012')
);

const createdItem = createOfflineInventoryItem(db, {
  clientInventoryId: localInventoryId,
  name: 'Audit flour',
  quantity: 0,
  unit: 'KG',
  minLimit: 2,
}, enqueue);
assert(
  'offline inventory create stores a pending row and queue item',
  createdItem.success && createdItem.data.syncStatus === 'PENDING_SYNC' &&
  scalar(`SELECT COUNT(*) FROM inventory WHERE _id = ?`, [localInventoryId]) === 1 &&
  scalar(`SELECT COUNT(*) FROM sync_queue WHERE client_op_id = ?`, [localInventoryId]) === 1
);

const openingInventoryId = 'off_inv_audit_opening';
createOfflineInventoryItem(db, {
  clientInventoryId: openingInventoryId,
  name: 'Audit opening stock',
  quantity: 2,
  unit: 'KG',
  minLimit: 1,
  totalCost: 20,
}, enqueue);
assert(
  'offline opening balance creates one pending purchase row',
  scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ? AND sync_status = 'PENDING_SYNC'`, [`${openingInventoryId}:opening`]) === 1 &&
  scalar(`SELECT COUNT(*) FROM sync_queue WHERE client_op_id = ?`, [openingInventoryId]) === 1
);
reconcileInventoryWithServer(db, openingInventoryId, { _id: serverOpeningInventoryId });
reconcileExpenseWithServer(db, `${openingInventoryId}:opening`, {
  _id: serverOpeningExpenseId,
  purchaseNumber: 'P-20260926-0001',
});
assert(
  'opening balance carries the final server purchase number',
  scalar(`SELECT COUNT(*) FROM expenses WHERE _id = ? AND purchase_number = ? AND sync_status = 'SYNCED'`, [serverOpeningExpenseId, 'P-20260926-0001']) === 1
);

const purchasePayload = {
  clientExpenseId: 'off_exp_audit_purchase',
  description: 'Audit flour purchase',
  amount: 100,
  totalCost: 100,
  category: 'inventory',
  inventoryItemLinked: localInventoryId,
  inventoryQuantityAdded: 10,
  date: '2026-09-26T10:00:00.000Z',
};
const purchase = createOfflineExpense(db, purchasePayload, enqueue);
assert(
  'offline purchase adds ten units once and stays pending',
  purchase.success && scalar(`SELECT quantity FROM inventory WHERE _id = ?`, [localInventoryId]) === 10 &&
  purchase.data.syncStatus === 'PENDING_SYNC' &&
  scalar(`SELECT COUNT(*) FROM sync_queue WHERE client_op_id = ?`, [purchasePayload.clientExpenseId]) === 1
);
createOfflineExpense(db, purchasePayload, enqueue);
assert(
  'retry of same offline purchase does not add stock twice',
  scalar(`SELECT quantity FROM inventory WHERE _id = ?`, [localInventoryId]) === 10 &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ?`, [purchasePayload.clientExpenseId]) === 1
);
let purchaseQueueFailed = false;
try {
  createOfflineExpense(db, {
    ...purchasePayload,
    clientExpenseId: 'off_exp_audit_rollback',
    inventoryQuantityAdded: 5,
    amount: 50,
    totalCost: 50,
  }, () => { throw new Error('simulated queue write failure'); });
} catch {
  purchaseQueueFailed = true;
}
assert(
  'failed offline purchase queue write rolls back stock and ledger',
  purchaseQueueFailed && scalar(`SELECT quantity FROM inventory WHERE _id = ?`, [localInventoryId]) === 10 &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = 'off_exp_audit_rollback'`) === 0
);

const restockPayload = {
  id: localInventoryId,
  clientRestockId: 'off_rstk_audit_restock',
  quantity: 10,
  totalCost: 80,
};
const restock = restockOfflineInventory(db, restockPayload, enqueue);
assert(
  'offline restock creates a pending purchase and increases stock',
  restock.success && restock.data.syncStatus === 'PENDING_SYNC' &&
  scalar(`SELECT quantity FROM inventory WHERE _id = ?`, [localInventoryId]) === 20 &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ?`, [restockPayload.clientRestockId]) === 1
);
restockOfflineInventory(db, restockPayload, enqueue);
assert(
  'retry of same restock ID does not increase stock twice',
  scalar(`SELECT quantity FROM inventory WHERE _id = ?`, [localInventoryId]) === 20 &&
  scalar(`SELECT COUNT(*) FROM sync_queue WHERE client_op_id = ?`, [restockPayload.clientRestockId]) === 1
);
assert(
  'offline inventory create precedes its dependent restock in the queue',
  scalar(`SELECT id FROM sync_queue WHERE client_op_id = ?`, [localInventoryId]) <
  scalar(`SELECT id FROM sync_queue WHERE client_op_id = ?`, [restockPayload.clientRestockId])
);

assert(
  'inventory create reconciliation resolves the real Mongo ID',
  reconcileInventoryWithServer(db, localInventoryId, { _id: serverInventoryId }) &&
  resolveServerInventoryId(db, localInventoryId) === serverInventoryId &&
  scalar(`SELECT COUNT(*) FROM inventory`) === 2
);
assert(
  'restock reconciliation replaces provisional expense ID without duplication',
  reconcileRestockExpenseWithServer(db, restockPayload.clientRestockId, {
    _id: serverRestockExpenseId,
    purchaseNumber: 'P-20260926-0003',
  }) &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ?`, [restockPayload.clientRestockId]) === 1 &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE _id = ? AND purchase_number = ? AND sync_status = 'SYNCED'`, [serverRestockExpenseId, 'P-20260926-0003']) === 1
);
assert(
  'offline purchase cache contains old, pending, and reconciled entries',
  listOfflineExpenses(db).length === 4 &&
  listOfflineExpenses(db).some((expense) => expense._id === 'server_existing_purchase') &&
  listOfflineExpenses(db).some((expense) => expense.clientExpenseId === purchasePayload.clientExpenseId && expense.syncStatus === 'PENDING_SYNC')
);
assert(
  'server purchase cache never overwrites a pending local record',
  !cacheServerExpense(db, {
    _id: serverPurchaseExpenseId,
    clientExpenseId: purchasePayload.clientExpenseId,
    description: 'Server purchase copy',
    amount: 100,
    category: 'inventory',
  }) && scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ?`, [purchasePayload.clientExpenseId]) === 1
);
assert(
  'offline purchase reconciliation replaces its provisional ID once',
  reconcileExpenseWithServer(db, purchasePayload.clientExpenseId, {
    _id: serverPurchaseExpenseId,
    purchaseNumber: 'P-20260926-0002',
  }) &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ?`, [purchasePayload.clientExpenseId]) === 1 &&
  scalar(`SELECT COUNT(*) FROM expenses WHERE _id = ? AND purchase_number = ? AND sync_status = 'SYNCED'`, [serverPurchaseExpenseId, 'P-20260926-0002']) === 1
);
assert(
  'pulled copy after purchase sync does not create a second record',
  cacheServerExpense(db, {
    _id: serverPurchaseExpenseId,
    clientExpenseId: purchasePayload.clientExpenseId,
    description: purchasePayload.description,
    amount: purchasePayload.amount,
    category: 'inventory',
    purchaseNumber: 'P-20260926-0002',
  }) && scalar(`SELECT COUNT(*) FROM expenses WHERE client_expense_id = ?`, [purchasePayload.clientExpenseId]) === 1
);

const rollbackDb = new SQL.Database();
rollbackDb.run(`
  CREATE TABLE inventory (
    _id TEXT PRIMARY KEY, name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL,
    min_limit REAL DEFAULT 5, cost_price REAL DEFAULT 0, last_restock_total_cost REAL DEFAULT 0,
    last_restocked TEXT, sync_status TEXT DEFAULT 'SYNCED', client_inventory_id TEXT UNIQUE, updated_at TEXT
  );
  CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT, client_op_id TEXT UNIQUE NOT NULL, entity_type TEXT NOT NULL,
    action TEXT NOT NULL, payload TEXT NOT NULL, status TEXT DEFAULT 'PENDING', created_at TEXT
  );
`);
let createFailed = false;
try {
  createOfflineInventoryItem(rollbackDb, {
    clientInventoryId: 'off_inv_rollback', name: 'Rollback item', quantity: 1, unit: 'KG', minLimit: 1,
  }, () => { throw new Error('simulated queue write failure'); });
} catch {
  createFailed = true;
}
assert(
  'inventory row rolls back when queue insertion fails',
  createFailed && Number(rollbackDb.exec(`SELECT COUNT(*) FROM inventory`)[0].values[0][0]) === 0
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll offline flow smoke tests passed.');
