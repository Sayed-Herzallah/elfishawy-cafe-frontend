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
  if (authToken) return authToken;
  try {
    const db = getDb();
    const res = db.exec(`SELECT session_token FROM local_users WHERE session_token IS NOT NULL AND session_token != '' ORDER BY cached_at DESC LIMIT 1`);
    if (res.length && res[0].values.length) {
      const stored = res[0].values[0][0];
      // Decrypt token if it was encrypted via safeStorage
      authToken = decryptSensitiveString(stored);
      return authToken;
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
          const orderResponse = await fetch(`${apiBaseUrl}/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              items: payload.items.map((it) => ({
                product: it.product,
                quantity: it.quantity,
              })),
              tableNumber: payload.tableNumber,
              notes: payload.notes || '',
              clientOrderId: clientOpId,
            }),
          });

          const data = await orderResponse.json();
          if (orderResponse.ok && data.success) {
            success = true;
            serverResult = data.data;

            // Reconcile SQLite order with real Mongo _id and sequence orderNumber
            if (serverResult && serverResult.orderNumber) {
              db.run(
                `UPDATE orders SET _id = ?, order_number = ?, sync_status = 'SYNCED', updated_at = ? WHERE client_order_id = ?`,
                [serverResult._id, serverResult.orderNumber, new Date().toISOString(), clientOpId]
              );
            }
          } else {
            throw new Error(data.message || `Server returned ${orderResponse.status} for order`);
          }
        } 
        // 2. EXPENSES SYNC
        else if (entityType === 'expense') {
          const expenseResponse = await fetch(`${apiBaseUrl}/expenses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              description: payload.description,
              amount: payload.amount,
              category: payload.category || 'inventory',
              inventoryItemLinked: payload.inventoryItemLinked,
              inventoryQuantityAdded: payload.inventoryQuantityAdded,
              totalCost: payload.totalCost,
              unitCost: payload.unitCost,
              date: payload.date || new Date().toISOString(),
              clientExpenseId: clientOpId,
            }),
          });

          const data = await expenseResponse.json();
          if (expenseResponse.ok && data.success) {
            success = true;
            serverResult = data.data;
            db.run(
              `UPDATE expenses SET _id = ?, sync_status = 'SYNCED' WHERE client_expense_id = ?`,
              [serverResult._id, clientOpId]
            );
          } else {
            throw new Error(data.message || `Server returned ${expenseResponse.status} for expense`);
          }
        }
        // 3. INVENTORY RESTOCK SYNC
        else if (entityType === 'inventory_restock') {
          const restockResponse = await fetch(`${apiBaseUrl}/inventory/${payload.id}/restock`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'authorization': token || '',
            },
            body: JSON.stringify({
              quantity: payload.quantity,
              totalCost: payload.totalCost,
              costPrice: payload.costPrice,
            }),
          });

          const data = await restockResponse.json();
          if (restockResponse.ok && data.success) {
            success = true;
          } else {
            throw new Error(data.message || `Server returned ${restockResponse.status} for restock`);
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
        db.run(
          `UPDATE sync_queue SET status = 'FAILED', attempts = ?, last_error = ? WHERE id = ?`,
          [attempts + 1, err.message, id]
        );
      }
    }

    saveDatabase();
    if (mainWindow) {
      mainWindow.webContents.send('sync:progress', { status: 'DONE', count: syncedCount });
    }
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error('Sync queue execution error:', error);
    return { success: false, error: error.message };
  } finally {
    isSyncing = false;
  }
}

export function startBackgroundSync(mainWindow, intervalMs = 15000) {
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);

  syncIntervalTimer = setInterval(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/`, { method: 'GET' }).catch(() => null);
      if (res && res.ok) {
        await processSyncQueue(mainWindow);
      }
    } catch {
      // Offline, continue waiting
    }
  }, intervalMs);
}
