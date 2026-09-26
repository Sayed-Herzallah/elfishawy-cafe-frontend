// desktop/main/sync.js
import { getDb, saveDatabase, getMasterKey } from './db.js';
import { decryptSensitiveString, computeOpHash } from './security.js';

let isSyncing = false;
let syncIntervalTimer = null;
let apiBaseUrl = 'https://elfishawy-cafe-server.vercel.app';
let authToken = '';

export function configureSync({ serverUrl, token }) {
  if (serverUrl) apiBaseUrl = serverUrl.replace(/\/$/, '');
  if (token) authToken = token;
}

export function getAuthToken() {
  if (authToken && authToken !== 'offline_default_cashier_token' && authToken.split('.').length === 3) {
    return authToken;
  }
  try {
    const db = getDb();
    const res = db.exec(`SELECT session_token FROM local_users WHERE session_token IS NOT NULL AND session_token != '' ORDER BY cached_at DESC`);
    if (res.length && res[0].values.length) {
      for (const row of res[0].values) {
        const stored = row[0];
        const decrypted = decryptSensitiveString(stored);
        if (decrypted && decrypted !== 'offline_default_cashier_token' && decrypted.split('.').length === 3) {
          authToken = decrypted;
          return authToken;
        }
      }
    }
  } catch { }
  return '';
}

const isMongoObjectId = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

/**
 * ترجمة معرّف صنف مخزون محلي (أُنشئ أوفلاين) إلى المعرّف الحقيقي القادم من السيرفر.
 * يرجع '' لو الصنف لسه لم يُزامن — وقتها نأجّل العملية المرتبطة به للدورة القادمة
 * بدل ما نبعتها بمعرّف محلي يرفضه السيرفر (400).
 */
export function resolveServerInventoryId(db, localId) {
  if (!localId) return '';
  if (isMongoObjectId(localId)) return localId;
  try {
    const res = db.exec(
      `SELECT _id FROM inventory WHERE _id = ? OR client_inventory_id = ? LIMIT 1`,
      [String(localId), String(localId)]
    );
    const resolved = res.length && res[0].values.length ? String(res[0].values[0][0] || '') : '';
    return isMongoObjectId(resolved) ? resolved : '';
  } catch {
    return '';
  }
}

export function reconcileInventoryWithServer(db, localId, serverItem) {
  const serverId = String(serverItem?._id || '');
  const clientId = String(localId || serverItem?.clientInventoryId || '');
  if (!clientId || !isMongoObjectId(serverId)) return false;

  const serverRow = db.exec(`SELECT 1 FROM inventory WHERE _id = ? LIMIT 1`, [serverId]);
  if (serverRow.length && serverRow[0].values.length) {
    db.run(
      `DELETE FROM inventory WHERE (_id = ? OR client_inventory_id = ?) AND _id != ?`,
      [clientId, clientId, serverId]
    );
    db.run(
      `UPDATE inventory SET client_inventory_id = ?, sync_status = 'SYNCED', updated_at = ? WHERE _id = ?`,
      [clientId, new Date().toISOString(), serverId]
    );
  } else {
    db.run(
      `UPDATE inventory SET _id = ?, sync_status = 'SYNCED', client_inventory_id = ?, updated_at = ? WHERE _id = ? OR client_inventory_id = ?`,
      [serverId, clientId, new Date().toISOString(), clientId, clientId]
    );
  }
  return true;
}

export function reconcileRestockExpenseWithServer(db, clientRestockId, serverExpenseId) {
  return reconcileExpenseWithServer(db, clientRestockId, serverExpenseId);
}

export function reconcileExpenseWithServer(db, clientExpenseId, serverExpense) {
  const clientId = String(clientExpenseId || '');
  const result = serverExpense && typeof serverExpense === 'object' ? serverExpense : { _id: serverExpense };
  const serverId = String(result._id || '');
  const purchaseNumber = result.purchaseNumber || null;
  if (!clientId || !isMongoObjectId(serverId)) return false;

  const serverRow = db.exec(`SELECT 1 FROM expenses WHERE _id = ? LIMIT 1`, [serverId]);
  if (serverRow.length && serverRow[0].values.length) {
    db.run(`DELETE FROM expenses WHERE client_expense_id = ? AND _id != ?`, [clientId, serverId]);
  }
  db.run(
    `UPDATE expenses SET _id = ?, sync_status = 'SYNCED', client_expense_id = ?, purchase_number = COALESCE(?, purchase_number) WHERE client_expense_id = ? OR _id = ? OR _id = ?`,
    [serverId, clientId, purchaseNumber, clientId, clientId, serverId]
  );
  return true;
}

export function cacheServerExpense(db, exp) {
  if (!exp?._id) return false;
  const clientExpenseId = exp.clientExpenseId || exp.client_expense_id || '';
  const pendingCheck = db.exec(
    `SELECT 1 FROM expenses
     WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
       AND (client_expense_id = ? OR client_expense_id = ?)
     LIMIT 1`,
    [exp._id, clientExpenseId]
  );
  if (pendingCheck.length && pendingCheck[0].values.length) return false;

  const linked = typeof exp.inventoryItemLinked === 'object'
    ? (exp.inventoryItemLinked?._id || exp.inventoryItemLinked?.id || null)
    : (exp.inventoryItemLinked || null);
  const addedBy = typeof exp.addedBy === 'object' ? (exp.addedBy?._id || '') : (exp.addedBy || '');
  const createdAt = exp.createdAt || exp.date || new Date().toISOString();
  db.run(`
    INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, purchase_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
    ON CONFLICT DO UPDATE SET
      description = excluded.description,
      amount = excluded.amount,
      category = excluded.category,
      inventory_item_linked = excluded.inventory_item_linked,
      inventory_quantity_added = excluded.inventory_quantity_added,
      unit_cost = excluded.unit_cost,
      date = excluded.date,
      added_by = excluded.added_by,
      purchase_number = excluded.purchase_number,
      sync_status = 'SYNCED'
    WHERE IFNULL(expenses.sync_status, 'SYNCED') != 'PENDING_SYNC'
  `, [
    exp._id,
    exp.description || '',
    Number(exp.amount) || 0,
    exp.category || 'other',
    linked,
    Number(exp.inventoryQuantityAdded) || null,
    Number(exp.unitCost) || null,
    exp.date || createdAt,
    addedBy,
    clientExpenseId || null,
    exp.purchaseNumber || exp.purchase_number || null,
    createdAt,
  ]);
  return true;
}

/** تأجيل عملية طابور المزامنة لانتظار تبعية (مثل صنف مخزون لم يُرفع بعد) — بدون FAILED دائم */
function deferSyncQueueItem(db, queueId, attempts, message) {
  db.run(
    `UPDATE sync_queue SET status = 'PENDING', attempts = ?, last_error = ? WHERE id = ?`,
    [Number(attempts) + 1, message, queueId]
  );
}

/**
 * مطابقة صف الطلب المحلي (PENDING) مع نتيجة السيرفر — بدون خصم مخزون إضافي.
 * تُستخدم من طابور المزامنة ومن مسار الـ POS المباشر أونلاين.
 */
export function reconcileOrderWithServer(db, clientOrderId, serverResult) {
  if (!clientOrderId || !serverResult?.orderNumber) return false;
  const nowIso = new Date().toISOString();
  const orderNumber = String(serverResult.orderNumber);
  const serverId = serverResult._id;

  try {
    const existingCheck = db.exec(`SELECT _id FROM orders WHERE _id = ?`, [serverId]);
    if (existingCheck.length && existingCheck[0].values.length) {
      db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOrderId, serverId]);
      db.run(
        `UPDATE orders SET order_number = ?, sync_status = 'SYNCED', client_order_id = ?, updated_at = ? WHERE _id = ?`,
        [orderNumber, clientOrderId, nowIso, serverId]
      );
    } else {
      db.run(
        `UPDATE orders SET _id = ?, order_number = ?, sync_status = 'SYNCED', updated_at = ? WHERE client_order_id = ?`,
        [serverId, orderNumber, nowIso, clientOrderId]
      );
    }
    db.run(
      `UPDATE sync_queue SET status = 'COMPLETED', synced_at = ? WHERE client_op_id = ? AND entity_type = 'order' AND status IN ('PENDING', 'FAILED')`,
      [nowIso, clientOrderId]
    );
    return true;
  } catch (err) {
    console.error('reconcileOrderWithServer error:', err.message);
    return false;
  }
}

export async function processSyncQueue(mainWindow) {
  if (isSyncing) return { success: false, message: 'Sync already in progress' };
  isSyncing = true;

  try {
    const db = getDb();
    const res = db.exec(`
      SELECT id, client_op_id, entity_type, action, payload, attempts, sequence_id, prev_hash, op_hash
      FROM sync_queue
      WHERE status IN ('PENDING', 'FAILED')
      ORDER BY id ASC
    `);

    if (!res.length || !res[0].values.length) {
      isSyncing = false;
      return { success: true, count: 0 };
    }

    const token = getAuthToken();
    const rows = res[0].values;
    let syncedCount = 0;

    for (const row of rows) {
      const [id, clientOpId, entityType, action, payloadStr, attempts, sequenceId, prevHash, opHash] = row;
      let payload;
      try {
        payload = JSON.parse(payloadStr);
      } catch (err) {
        db.run(`UPDATE sync_queue SET status = 'FAILED', last_error = 'Invalid JSON payload' WHERE id = ?`, [id]);
        continue;
      }

      // Cryptographic Tamper Detection Check
      const masterKey = getMasterKey();
      if (masterKey && opHash) {
        const expectedHash = computeOpHash(masterKey, {
          sequenceId: Number(sequenceId) || 0,
          clientOpId,
          entityType,
          action,
          payload: payloadStr,
          prevHash: prevHash || 'ROOT_GENESIS',
        });

        if (expectedHash !== opHash) {
          console.error(`[Security Alert] Tamper detected on queue item #${id} (${clientOpId})! Hash mismatch.`);
          db.run(`UPDATE sync_queue SET status = 'BLOCKED_TAMPERED', last_error = 'Security Alert: Operation integrity hash mismatch' WHERE id = ?`, [id]);
          continue;
        }

        // Verify chain link with the preceding row in the database
        const prevRowRes = db.exec(`SELECT op_hash, sequence_id FROM sync_queue WHERE id < ? ORDER BY id DESC LIMIT 1`, [id]);
        if (prevRowRes.length && prevRowRes[0].values.length) {
          const [actualPrevHash, actualPrevSeq] = prevRowRes[0].values[0];
          const expectedPrevSeq = (Number(sequenceId) || 0) - 1;

          if (actualPrevHash && prevHash && actualPrevHash !== prevHash) {
            console.error(`[Security Alert] Chain break detected on queue item #${id}! Preceding hash mismatch (possible deletion).`);
            db.run(`UPDATE sync_queue SET status = 'BLOCKED_TAMPERED', last_error = 'Security Alert: Preceding chain hash mismatch (deleted item detected)' WHERE id = ?`, [id]);
            continue;
          }

          if (actualPrevSeq !== undefined && Number(sequenceId) > 1 && actualPrevSeq !== expectedPrevSeq) {
            console.error(`[Security Alert] Sequence gap detected! Expected #${expectedPrevSeq}, got #${actualPrevSeq}.`);
            db.run(`UPDATE sync_queue SET status = 'BLOCKED_TAMPERED', last_error = 'Security Alert: Sequence gap detected (missing item)' WHERE id = ?`, [id]);
            continue;
          }
        }
      }

      try {
        if (mainWindow) {
          mainWindow.webContents.send('sync:progress', {
            clientOpId,
            entityType,
            status: 'SYNCING',
          });
        }

        let success = false;
        let serverResult = null;

        // 1. ORDERS SYNC
        if (entityType === 'order') {
          const rawItems = Array.isArray(payload.items) ? payload.items : [];
          const orderResponse = await fetch(`${apiBaseUrl}/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              items: rawItems.map((it) => ({
                product: typeof it.product === 'object' ? (it.product?._id || it.product?.id || '') : String(it.product || ''),
                quantity: Number(it.quantity) || 1,
                price: Number(it.price) || 0,
              })),
              tableNumber: payload.tableNumber,
              notes: payload.notes || '',
              clientOrderId: clientOpId,
              // لا نرسل أي رقم للسيرفر: الرقم النهائي يُصدره السيرفر فقط من العداد اليومي الذري
              // (الرقم المؤقت المحلي للعرض/الطباعة فقط ولا يصلح رقماً نهائياً).
              clientCreatedAt: payload.createdAt,
            }),
          });

          const data = await orderResponse.json().catch(() => ({}));
          if (orderResponse.ok && data.success) {
            success = true;
            serverResult = data.data;

            reconcileOrderWithServer(db, clientOpId, serverResult);
          } else {
            const err = new Error(data.message || `Server returned ${orderResponse.status} for order`);
            err.statusCode = orderResponse.status;
            throw err;
          }
        }
        // 2. EXPENSES SYNC
        else if (entityType === 'expense') {
          let linkedId = typeof payload.inventoryItemLinked === 'object'
            ? (payload.inventoryItemLinked?._id || payload.inventoryItemLinked?.id)
            : payload.inventoryItemLinked;

          // الصنف المرتبط ممكن يكون أُنشئ أوفلاين بمعرّف محلي — نترجمه للمعرّف الحقيقي،
          // ولو لسه لم يُزامن نأجّل قيد الشراء بدل ما السيرفر يرفضه (400).
          if (linkedId && !isMongoObjectId(linkedId)) {
            const serverItemId = resolveServerInventoryId(db, linkedId);
            if (serverItemId) {
              linkedId = serverItemId;
            } else {
              deferSyncQueueItem(db, id, attempts, 'Waiting for linked inventory item to sync');
              continue;
            }
          }

          const expenseResponse = await fetch(`${apiBaseUrl}/expenses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              description: payload.description,
              amount: Number(payload.amount) || 0,
              category: payload.category || 'inventory',
              inventoryItemLinked: linkedId || undefined,
              inventoryQuantityAdded: payload.inventoryQuantityAdded ? Number(payload.inventoryQuantityAdded) : undefined,
              totalCost: payload.totalCost !== undefined ? Number(payload.totalCost) : Number(payload.amount),
              unitCost: payload.unitCost !== undefined ? Number(payload.unitCost) : undefined,
              date: payload.date || new Date().toISOString(),
              clientExpenseId: clientOpId,
            }),
          });

          const data = await expenseResponse.json().catch(() => ({}));
          if (expenseResponse.ok && data.success) {
            success = true;
            serverResult = data.data;
            if (!reconcileExpenseWithServer(db, clientOpId, serverResult)) {
              throw new Error('Server returned an invalid expense ID for reconciliation');
            }
          } else {
            const err = new Error(data.message || `Server returned ${expenseResponse.status} for expense`);
            err.statusCode = expenseResponse.status;
            throw err;
          }
        }
        // 3. INVENTORY RESTOCK SYNC
        else if (entityType === 'inventory_restock') {
          const rawRestockItemId = payload.id || payload._id || payload.inventoryId;
          // نفس المنطق: صنف أُنشئ أوفلاين → نستنى مزامنته ثم نستخدم المعرّف الحقيقي
          const restockItemId = resolveServerInventoryId(db, rawRestockItemId);
          if (!restockItemId) {
            deferSyncQueueItem(db, id, attempts, 'Waiting for inventory item to sync');
            continue;
          }
          const restockResponse = await fetch(`${apiBaseUrl}/inventory/${restockItemId}/restock`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              quantity: Number(payload.quantity) || 0,
              totalCost: payload.totalCost !== undefined ? Number(payload.totalCost) : undefined,
              costPrice: payload.costPrice !== undefined ? Number(payload.costPrice) : undefined,
              // معرّف العملية الأوفلاين — يمنع رفع الرصيد مرتين عند إعادة الإرسال
              clientRestockId: payload.clientRestockId || clientOpId,
            }),
          });

          const data = await restockResponse.json().catch(() => ({}));
          if (restockResponse.ok && data.success) {
            if (!reconcileRestockExpenseWithServer(db, clientOpId, {
              _id: data.expenseId,
              purchaseNumber: data.purchaseNumber,
            })) {
              throw new Error('Server did not return the restock purchase ID for reconciliation');
            }
            success = true;
          } else {
            const err = new Error(data.message || `Server returned ${restockResponse.status} for restock`);
            err.statusCode = restockResponse.status;
            throw err;
          }
        }
        // 4. INVENTORY CREATE SYNC (صنف مخزون جديد أُنشئ أوفلاين)
        else if (entityType === 'inventory_create') {
          const createResponse = await fetch(`${apiBaseUrl}/inventory`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              name: payload.name,
              quantity: Number(payload.quantity) || 0,
              unit: payload.unit || 'KG',
              minLimit: payload.minLimit !== undefined ? Number(payload.minLimit) : 5,
              costPrice: payload.costPrice !== undefined ? Number(payload.costPrice) : undefined,
              totalCost: payload.totalCost !== undefined ? Number(payload.totalCost) : undefined,
              clientInventoryId: payload.clientInventoryId || clientOpId,
            }),
          });

          const data = await createResponse.json().catch(() => ({}));
          if (createResponse.ok && data.success && data.data) {
            success = true;
            serverResult = data.data;
            // مطابقة الصف المحلي المؤقت مع _id الحقيقي من السيرفر — نتجنب صنفين مكررين
            const localId = payload.clientInventoryId || clientOpId;
            if (!reconcileInventoryWithServer(db, localId, serverResult)) {
              throw new Error('Server returned an invalid inventory ID for reconciliation');
            }
            if (data.openingExpense) {
              const openingExpenseId = data.openingExpense.clientExpenseId || `${localId}:opening`;
              if (!reconcileExpenseWithServer(db, openingExpenseId, data.openingExpense)) {
                throw new Error('Server returned an invalid opening purchase ID for reconciliation');
              }
            }
          } else {
            const err = new Error(data.message || `Server returned ${createResponse.status} for inventory create`);
            err.statusCode = createResponse.status;
            throw err;
          }
        }

        if (success) {
          db.run(
            `UPDATE sync_queue SET status = 'COMPLETED', synced_at = ? WHERE id = ?`,
            [new Date().toISOString(), id]
          );
          syncedCount++;
        }
      } catch (err) {
        console.error(`Error syncing operation ${clientOpId}:`, err.message);
        const isAuthError = err.statusCode === 401 || err.message?.includes('401') || err.message?.includes('Unauthorized');
        const isNetworkError = err.name === 'TypeError' || err.message?.includes('fetch failed') || err.message?.includes('NetworkError') || err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED');

        // أخطاء الشبكة والتوثيق تظل PENDING ولا يتم تعليمها كـ FAILED
        const newStatus = (isAuthError || isNetworkError) ? 'PENDING' : 'FAILED';
        db.run(
          `UPDATE sync_queue SET status = ?, attempts = ?, last_error = ? WHERE id = ?`,
          [newStatus, isAuthError ? attempts : attempts + 1, err.message, id]
        );

        // إذا كان خطأ توثيق 401، نوقف محاولة مزامنة باقي الصفوف حالياً حتى يتوفر توكن صالح
        if (isAuthError) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sync:auth-required');
          }
          break;
        }
      }
    }

    saveDatabase();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:progress', { status: 'DONE', count: syncedCount });
      if (syncedCount > 0) {
        mainWindow.webContents.send('sync:data-updated', { entity: 'orders' });
      }
    }
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error('Sync queue execution error:', error);
    return { success: false, error: error.message };
  } finally {
    isSyncing = false;
  }
}

/**
 * 🔄 سحب التحديثات الجديدة من السيرفر (Web/Server -> Desktop SQLite)
 * يتم جلب أحدث الفواتير والمخزن وتحديث SQLite محلياً، ثم إخطار نافذة الـ POS
 * لتحديث الشاشة فوراً دون الحاجة إلى F5 أو إعادة تشغيل التطبيق.
 */
let isPulling = false;
export async function pullServerUpdates(mainWindow) {
  if (isPulling) return;
  isPulling = true;
  try {
    const token = getAuthToken();
    if (!token) return;
    const db = getDb();

    // 1. سحب الفواتير من السيرفر
    const ordersRes = await fetch(`${apiBaseUrl}/orders`, {
      method: 'GET',
      headers: {
        'authorization': token,
      },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    let hasNewOrders = false;
    if (ordersRes && ordersRes.ok) {
      const ordersData = await ordersRes.json();
      if (ordersData.success && Array.isArray(ordersData.data)) {
        for (const ord of ordersData.data) {
          if (!ord || !ord._id) continue;
          try {
            // التحقق مما إذا كانت الفاتورة معلقة محلياً
            const existing = db.exec(`SELECT sync_status FROM orders WHERE _id = ?`, [ord._id]);
            if (existing.length && existing[0].values.length && existing[0].values[0][0] === 'PENDING_SYNC') {
              continue;
            }

            const clientOrderId = ord.clientOrderId || ord.client_order_id || null;
            if (clientOrderId) {
              db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOrderId, ord._id]);
            }

            const itemsJson = JSON.stringify(ord.items || []);
            const createdAt = ord.createdAt || ord.created_at || new Date().toISOString();
            const updatedAt = ord.updatedAt || ord.updated_at || createdAt;
            const rawNum = String(ord.orderNumber || ord.order_number || '').trim();
            const orderNumber = /^\d{1,6}$/.test(rawNum) ? rawNum : null;
            const tableNumber = ord.tableNumber ?? ord.table_number ?? null;
            const cashierId = typeof ord.cashierId === 'object' ? (ord.cashierId?._id || '') : (ord.cashierId || '');
            const dayKey = ord.dayKey || null;

            db.run(`
              INSERT INTO orders (_id, order_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
              ON CONFLICT(_id) DO UPDATE SET
                order_number = excluded.order_number,
                day_key = COALESCE(excluded.day_key, orders.day_key),
                items = excluded.items,
                total_amount = excluded.total_amount,
                status = excluded.status,
                table_number = excluded.table_number,
                cashier_id = excluded.cashier_id,
                notes = excluded.notes,
                client_order_id = COALESCE(excluded.client_order_id, orders.client_order_id),
                created_at = COALESCE(orders.created_at, excluded.created_at),
                updated_at = excluded.updated_at
              WHERE IFNULL(orders.sync_status, 'SYNCED') != 'PENDING_SYNC'
            `, [
              ord._id,
              orderNumber,
              dayKey,
              itemsJson,
              Number(ord.totalAmount ?? ord.total_amount) || 0,
              ord.status || 'completed',
              tableNumber,
              cashierId,
              ord.notes || '',
              clientOrderId,
              createdAt,
              updatedAt,
            ]);
            hasNewOrders = true;
          } catch (ordErr) {
            // تجاهل أي خطأ فردي في صف معين
          }
        }
      }
    }

    // 2. سحب المخزون المحدث من السيرفر (لتحديث أرصدة الخامات بدقة في SQLite)
    const invRes = await fetch(`${apiBaseUrl}/inventory`, {
      method: 'GET',
      headers: {
        'authorization': token,
      },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    let hasNewInventory = false;
    if (invRes && invRes.ok) {
      const invData = await invRes.json();
      if (invData.success && Array.isArray(invData.data)) {
        for (const item of invData.data) {
          if (!item || !item._id) continue;
          // لا نضيف صنفاً محلياً لسه لم يُزامن (منع صنفين مكررين لنفس الخامة)
          const localClientId = item.clientInventoryId || item.client_inventory_id || '';
          const pendingItem = db.exec(
            `SELECT 1 FROM inventory
             WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
               AND (_id = ?
                    OR (client_inventory_id IS NOT NULL AND client_inventory_id != '' AND client_inventory_id = ?))
             LIMIT 1`,
            [item._id, localClientId]
          );
          if (pendingItem.length && pendingItem[0].values.length) continue;

          // upsert آمن: لا نكتب فوق صنف محلي لم يُزامن بعد (توريد أو إنشاء أوفلاين)
          // ولا نمسح client_inventory_id / sync_status الخاصين به.
          db.run(`
            INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
            ON CONFLICT(_id) DO UPDATE SET
              name = excluded.name,
              quantity = excluded.quantity,
              unit = excluded.unit,
              min_limit = excluded.min_limit,
              cost_price = excluded.cost_price,
              last_restock_total_cost = excluded.last_restock_total_cost,
              last_restocked = excluded.last_restocked,
              updated_at = excluded.updated_at
            WHERE IFNULL(inventory.sync_status, 'SYNCED') != 'PENDING_SYNC'
          `, [
            item._id,
            item.name,
            Number(item.quantity) || 0,
            item.unit || 'KG',
            Number(item.minLimit) || 5,
            Number(item.costPrice) || 0,
            Number(item.lastRestockTotalCost) || 0,
            item.lastRestocked || '',
            item.updatedAt || new Date().toISOString(),
          ]);
          hasNewInventory = true;
        }
      }
    }

    // 3. سحب المصروفات / المشتريات من السيرفر (لتظهر في سجل المشتريات حتى أوفلاين)
    const expRes = await fetch(`${apiBaseUrl}/expenses`, {
      method: 'GET',
      headers: {
        'authorization': token,
      },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    let hasNewExpenses = false;
    if (expRes && expRes.ok) {
      const expData = await expRes.json();
      if (expData.success && Array.isArray(expData.data)) {
        for (const exp of expData.data) {
          if (!exp || !exp._id) continue;
          try {
            if (cacheServerExpense(db, exp)) hasNewExpenses = true;
          } catch (expErr) {
            // تجاهل أي خطأ فردي في صف واحد (UNIQUE constraint مثلاً) ونكمل الباقي
          }
        }
      }
    }

    if (hasNewOrders || hasNewInventory || hasNewExpenses) {
      saveDatabase();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync:data-updated', {
          orders: hasNewOrders,
          inventory: hasNewInventory,
          expenses: hasNewExpenses,
        });
      }
    }
  } catch (pullErr) {
    console.warn('[Sync] Pull updates warning:', pullErr.message);
  } finally {
    isPulling = false;
  }
}

export function startBackgroundSync(mainWindow, intervalMs = 15000) {
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);

  syncIntervalTimer = setInterval(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/`, { method: 'GET' }).catch(() => null);
      if (res && res.ok) {
        // 1. رفع العمليات المعلقة المحلية
        await processSyncQueue(mainWindow);
        // 2. سحب أي فواتير أو تغييرات جديدة من المنصة
        await pullServerUpdates(mainWindow);
      }
    } catch {
      // Offline, continue waiting
    }
  }, intervalMs);
}
