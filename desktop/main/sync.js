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
  } catch {}
  return '';
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
              orderNumber: payload.orderNumber && /^\d{1,5}$/.test(String(payload.orderNumber)) ? Number(payload.orderNumber) : undefined,
              clientCreatedAt: payload.createdAt,
            }),
          });

          const data = await orderResponse.json().catch(() => ({}));
          if (orderResponse.ok && data.success) {
            success = true;
            serverResult = data.data;

            // Reconcile SQLite order with real Mongo _id and sequence orderNumber safely
            if (serverResult && serverResult.orderNumber) {
              const nowIso = new Date().toISOString();
              const existingCheck = db.exec(`SELECT _id FROM orders WHERE _id = ?`, [serverResult._id]);
              if (existingCheck.length && existingCheck[0].values.length) {
                db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOpId, serverResult._id]);
                db.run(
                  `UPDATE orders SET order_number = ?, sync_status = 'SYNCED', client_order_id = ?, updated_at = ? WHERE _id = ?`,
                  [serverResult.orderNumber, clientOpId, nowIso, serverResult._id]
                );
              } else {
                db.run(
                  `UPDATE orders SET _id = ?, order_number = ?, sync_status = 'SYNCED', updated_at = ? WHERE client_order_id = ?`,
                  [serverResult._id, serverResult.orderNumber, nowIso, clientOpId]
                );
              }
            }
          } else {
            const err = new Error(data.message || `Server returned ${orderResponse.status} for order`);
            err.statusCode = orderResponse.status;
            throw err;
          }
        } 
        // 2. EXPENSES SYNC
        else if (entityType === 'expense') {
          const linkedId = typeof payload.inventoryItemLinked === 'object'
            ? (payload.inventoryItemLinked?._id || payload.inventoryItemLinked?.id)
            : payload.inventoryItemLinked;

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
            db.run(
              `UPDATE expenses SET _id = ?, sync_status = 'SYNCED' WHERE client_expense_id = ?`,
              [serverResult._id, clientOpId]
            );
          } else {
            const err = new Error(data.message || `Server returned ${expenseResponse.status} for expense`);
            err.statusCode = expenseResponse.status;
            throw err;
          }
        }
        // 3. INVENTORY RESTOCK SYNC
        else if (entityType === 'inventory_restock') {
          const restockItemId = payload.id || payload._id || payload.inventoryId;
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
            }),
          });

          const data = await restockResponse.json().catch(() => ({}));
          if (restockResponse.ok && data.success) {
            success = true;
          } else {
            const err = new Error(data.message || `Server returned ${restockResponse.status} for restock`);
            err.statusCode = restockResponse.status;
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
            const orderNumber = /^\d{1,5}$/.test(rawNum) ? rawNum : null;
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
          db.run(`
            INSERT OR REPLACE INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    if (hasNewOrders || hasNewInventory) {
      saveDatabase();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync:data-updated', {
          orders: hasNewOrders,
          inventory: hasNewInventory,
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
