// desktop/main/ipc.js
import { ipcMain, BrowserWindow } from 'electron';
import { getDb, saveDatabase, getMasterKey } from './db.js';
import { processSyncQueue, configureSync, pullServerUpdates, reconcileOrderWithServer } from './sync.js';
import { frontendUpdater } from './frontendUpdater.js';
import { encryptSensitiveString, decryptSensitiveString, computeOpHash } from './security.js';
import crypto from 'crypto';

// ============================================================
// اليوم التجاري الموحّد بتوقيت القاهرة (Africa/Cairo)
// نفس تعريف اليوم المستخدم في السيرفر → الترقيم اليومي للفواتير
// يبدأ من 1 في نفس اللحظة على كل الأجهزة مهما كان توقيت الجهاز.
// ============================================================
const CAIRO_TIMEZONE = 'Africa/Cairo';

const getBusinessDayKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  try {
    // en-CA ينتج الصيغة ISO "YYYY-MM-DD" مباشرة
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CAIRO_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

/** إزاحة توقيت القاهرة عن UTC بالدقائق عند لحظة معينة (يدعم التوقيت الصيفي) */
const cairoOffsetMinutes = (date) => {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: CAIRO_TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = {};
    for (const p of dtf.formatToParts(date)) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    }
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return 120; // fallback: UTC+2
  }
};

/** بداية اليوم التجاري (بتوقيت القاهرة) كـ ISO UTC string */
const getBusinessDayStartIso = (dayKey) => {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const noonGuess = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  const offsetMin = cairoOffsetMinutes(noonGuess);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) - offsetMin * 60000).toISOString();
};

/**
 * الرقم المؤقت (Provisional) للفواتير المُنشأة أوفلاين.
 * ------------------------------------------------------------------
 * - عدّاد محلي لكل يوم تجاري يبدأ من 1 (1, 2, 3, ...) ولا يتأثر إطلاقاً
 *   بأرقام الفواتير النهائية القادمة من السيرفر (ومهما اختلفت أجهزة أخرى)
 *   → لا "زيادة غلط" في الأرقام عند انقطاع الإنترنت.
 * - هذا الرقم للعرض/الطباعة فقط (فاتورة مؤقتة)، ويستبدله السيرفر بالرقم
 *   النهائي التسلسلي بعد المزامنة.
 * - يبدأ العدّاد من أعلى رقم مؤقت مسجَّل فعلاً لنفس اليوم (حماية بعد أي ترقية/استرجاع).
 */
const allocateProvisionalNumber = (db, businessDayKey) => {
  const counterId = `provisional_${businessDayKey}`;
  try {
    let maxProvisional = 0;
    try {
      const maxRes = db.exec(
        `SELECT MAX(CAST(provisional_number AS INTEGER)) AS max_num
         FROM orders
         WHERE provisional_number NOT GLOB '*[^0-9]*'
           AND LENGTH(provisional_number) <= 6
           AND CAST(provisional_number AS INTEGER) > 0
           AND (day_key = ? OR (day_key IS NULL AND created_at >= ?))`,
        [businessDayKey, getBusinessDayStartIso(businessDayKey)]
      );
      maxProvisional =
        maxRes.length && maxRes[0].values.length
          ? Number(maxRes[0].values[0][0]) || 0
          : 0;
    } catch {
      maxProvisional = 0;
    }

    // بذرة العدّاد = أعلى رقم مؤقت موجود فعلاً (لا ينقص أبداً)
    db.run(
      `INSERT INTO local_counters (_id, seq) VALUES (?, ?)
       ON CONFLICT(_id) DO UPDATE SET seq = MAX(local_counters.seq, excluded.seq)`,
      [counterId, maxProvisional]
    );
    db.run(`UPDATE local_counters SET seq = seq + 1 WHERE _id = ?`, [counterId]);

    const res = db.exec(`SELECT seq FROM local_counters WHERE _id = ?`, [counterId]);
    const seq = res.length && res[0].values.length ? Number(res[0].values[0][0]) || 1 : 1;
    return String(seq > 0 ? seq : 1);
  } catch {
    // fallback نادر جداً: أعلى رقم مؤقت + 1
    return String((maxProvisional || 0) + 1);
  }
};

// Conversion system mirroring backend utils/recipe/unitConverter.js
const CONVERSION_TO_BASE = {
  KG: 1000,
  GRAM: 1,
  LITER: 1000,
  ML: 1,
  PIECE: 1,
  SPOON: 5,
};

const convertToBase = (quantity, unit) => {
  const factor = CONVERSION_TO_BASE[String(unit || '').toUpperCase()] || 1;
  return quantity * factor;
};

const baseToUnit = (baseQty, unit) => {
  const u = String(unit || '').toUpperCase();
  if (u === 'KG') return baseQty / 1000;
  if (u === 'GRAM') return baseQty;
  if (u === 'LITER') return baseQty / 1000;
  if (u === 'ML') return baseQty;
  if (u === 'PIECE') return baseQty;
  if (u === 'SPOON') return baseQty / 5;
  return baseQty;
};

const consumptionPerUnit = (inputQuantity, inputUnit, outputQuantity) => {
  const baseInputQty = convertToBase(inputQuantity, inputUnit);
  return baseInputQty / (outputQuantity || 1);
};

const lookupProduct = (db, productId) => {
  if (!productId) return null;
  try {
    const pRes = db.exec(`SELECT name, price FROM products WHERE _id = ?`, [String(productId)]);
    if (pRes.length && pRes[0].values.length) {
      return {
        _id: String(productId),
        name: pRes[0].values[0][0] || 'مشروب',
        price: Number(pRes[0].values[0][1]) || 0,
      };
    }
  } catch {}
  return null;
};

const slimOrderItems = (items, db) => {
  let parsed = items;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.map((it) => {
    const pid = typeof it?.product === 'object' && it.product
      ? (it.product._id || it.product.id)
      : it?.product;
    const fromObjName = typeof it?.product === 'object' ? it.product?.name : '';
    const cached = pid ? lookupProduct(db, pid) : null;
    const name = fromObjName || it?.productName || cached?.name || 'مشروب';
    const price =
      Number(it?.price) ||
      Number(typeof it?.product === 'object' ? it.product?.price : 0) ||
      Number(cached?.price) ||
      0;
    return {
      product: { _id: pid || '', name, price },
      quantity: Number(it?.quantity) || 0,
      price,
    };
  });
};

const mapOrderRow = (raw, db) => {
  const createdAt = raw.created_at || raw.createdAt || new Date().toISOString();
  return {
    _id: raw._id,
    orderNumber: raw.order_number || raw.orderNumber || '',
    provisionalNumber: raw.provisional_number || raw.provisionalNumber || '',
    dayKey: raw.day_key || raw.dayKey || null,
    items: slimOrderItems(raw.items, db),
    totalAmount: Number(raw.total_amount ?? raw.totalAmount) || 0,
    status: raw.status || 'completed',
    tableNumber: raw.table_number ?? raw.tableNumber ?? null,
    cashierId: raw.cashier_id || raw.cashierId || '',
    notes: raw.notes || '',
    syncStatus: raw.sync_status || raw.syncStatus || 'SYNCED',
    clientOrderId: raw.client_order_id || raw.clientOrderId,
    createdAt,
    updatedAt: raw.updated_at || raw.updatedAt || createdAt,
  };
};

const upsertSyncedOrder = (db, ord) => {
  if (!ord || !ord._id) return;
  const createdAt = ord.createdAt || ord.created_at || new Date().toISOString();
  const updatedAt = ord.updatedAt || ord.updated_at || createdAt;
  const rawNum = String(ord.orderNumber || ord.order_number || '').trim();
  const orderNumber = /^\d{1,6}$/.test(rawNum) ? rawNum : null;
  const tableNumber = ord.tableNumber ?? ord.table_number ?? null;
  const cashierId = typeof ord.cashierId === 'object' ? (ord.cashierId?._id || '') : (ord.cashierId || '');
  const clientOrderId = ord.clientOrderId || ord.client_order_id || null;
  const dayKey = ord.dayKey || ord.day_key || null;
  const itemsJson = JSON.stringify(ord.items || []);

  try {
    const existing = db.exec(`SELECT sync_status FROM orders WHERE _id = ?`, [ord._id]);
    if (existing.length && existing[0].values.length && existing[0].values[0][0] === 'PENDING_SYNC') {
      return;
    }
  } catch {}

  // 🛡️ فحص ومنع التكرار الصارم بواسطة client_order_id:
  // إذا كان هناك صف محلي مسجل بمعرف مؤقت لنفس الـ client_order_id، نحذفه لتجنب تكرار الصف
  if (clientOrderId) {
    try {
      db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOrderId, ord._id]);
    } catch {}
  }

  try {
    // فواتير السيرفر المزامَنة تحمل الرقم النهائي في order_number،
    // والرقم المؤقت المحلي (لو وُجد لنفس الصف) يُحفظ للتتبع فقط.
    db.run(`
    INSERT INTO orders (_id, order_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
    ON CONFLICT(_id) DO UPDATE SET
      order_number = COALESCE(excluded.order_number, orders.order_number),
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
  } catch (upsertErr) {
    db.run(`
      INSERT OR REPLACE INTO orders (_id, order_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
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
  }
};

function enqueueSecureOperation(db, { clientOpId, entityType, action, payload, createdAt }) {
  const masterKey = getMasterKey();
  const lastRes = db.exec(`SELECT sequence_id, op_hash FROM sync_queue ORDER BY id DESC LIMIT 1`);
  let nextSeq = 1;
  let prevHash = 'ROOT_GENESIS';

  if (lastRes.length && lastRes[0].values.length) {
    const lastRow = lastRes[0].values[0];
    nextSeq = (Number(lastRow[0]) || 0) + 1;
    prevHash = String(lastRow[1] || 'ROOT_GENESIS');
  }

  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const opHash = masterKey
    ? computeOpHash(masterKey, { sequenceId: nextSeq, clientOpId, entityType, action, payload: payloadStr, prevHash })
    : '';

  db.run(`
    INSERT INTO sync_queue (client_op_id, entity_type, action, payload, status, sequence_id, prev_hash, op_hash, created_at)
    VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
  `, [clientOpId, entityType, action, payloadStr, nextSeq, prevHash, opHash, createdAt]);
}

export function setupIpcHandlers(mainWindow) {
  // Check connectivity
  ipcMain.handle('app:check-online', async () => {
    try {
      const res = await fetch('https://elfishawy-cafe-server.vercel.app/', {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      return res ? true : false;
    } catch {
      return false;
    }
  });

  // Set Auth Token for Sync
  ipcMain.handle('auth:set-token', async (_event, token) => {
    configureSync({ token });
    return { success: true };
  });

  // Generic DB query
  ipcMain.handle('db:query', async (_event, { sql, params }) => {
    try {
      const db = getDb();
      const res = db.exec(sql, params || []);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((row) => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    } catch (err) {
      console.error('db:query error:', err);
      throw err;
    }
  });

  // Generic DB execute
  ipcMain.handle('db:execute', async (_event, { sql, params }) => {
    try {
      const db = getDb();
      db.run(sql, params || []);
      saveDatabase();
      return { success: true };
    } catch (err) {
      console.error('db:execute error:', err);
      throw err;
    }
  });

  // ===================== 1. OFFLINE ORDER (POS SALE) =====================
  ipcMain.handle('offline:create-order', async (_event, orderData) => {
    try {
      const db = getDb();
      const clientOrderId = orderData.clientOrderId || `off_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Idempotency: نفس clientOrderId = نفس السجل (لا رقم مؤقت جديد ولا خصم مخزون مرتين)
      try {
        const existingRes = db.exec(
          `SELECT * FROM orders WHERE client_order_id = ? OR _id = ? LIMIT 1`,
          [clientOrderId, clientOrderId]
        );
        if (existingRes.length && existingRes[0].values.length) {
          const raw = {};
          existingRes[0].columns.forEach((col, idx) => { raw[col] = existingRes[0].values[0][idx]; });
          return { success: true, data: mapOrderRow(raw, db) };
        }
      } catch {}

      // ─── رقم فاتورة مؤقت تسلسلي يومي (اليوم التجاري بتوقيت القاهرة) ──
      // عدّاد محلي مستقل يبدأ من 1 لكل يوم تجاري جديد — لا علاقة له إطلاقاً
      // بأرقام السيرفر النهائية → لا "زيادة غلط" عند انقطاع الإنترنت.
      // الرقم النهائي يُصدره السيرفر فقط بعد المزامنة.
      const businessDayKey = getBusinessDayKey(new Date());
      const tempOrderNumber = allocateProvisionalNumber(db, businessDayKey);

      const now = new Date().toISOString();

      // Calculate total
      let totalAmount = 0;
      const processedItems = [];

      for (const it of orderData.items) {
        const productId = typeof it.product === 'object' ? (it.product?._id || it.product?.id) : it.product;
        const cached = lookupProduct(db, productId);
        let price = Number(it.price) || Number(cached?.price) || 0;
        const name = (typeof it.product === 'object' && it.product?.name) || cached?.name || 'مشروب';
        totalAmount += price * it.quantity;
        processedItems.push({
          product: { _id: productId, name, price },
          quantity: it.quantity,
          price,
        });
      }

      // Save order to SQLite
      // order_number يظل فارغاً حتى يمنحه السيرفر الرقم النهائي بعد المزامنة.
      // الرقم المؤقت للعرض/الطباعة فقط في provisional_number.
      db.run(`
        INSERT INTO orders (_id, order_number, provisional_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?, ?)
      `, [
        clientOrderId,
        tempOrderNumber,
        businessDayKey,
        JSON.stringify(processedItems),
        totalAmount,
        'completed',
        orderData.tableNumber,
        orderData.cashierId || '',
        orderData.notes || '',
        clientOrderId,
        now,
        now
      ]);

      // Phase A: Deduct product stockQuantity
      for (const it of processedItems) {
        const productId = typeof it.product === 'object' ? it.product._id : it.product;
        db.run(
          `UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), in_stock = CASE WHEN stock_quantity - ? > 0 THEN 1 ELSE 0 END WHERE _id = ?`,
          [it.quantity, it.quantity, productId]
        );
      }

      // Phase B: Recipe-based Inventory Deductions (Same as Backend Phase 6)
      for (const it of processedItems) {
        const productId = typeof it.product === 'object' ? it.product._id : it.product;
        const rRes = db.exec(`SELECT ingredients FROM recipes WHERE product_id = ? AND is_active = 1`, [productId]);
        if (rRes.length && rRes[0].values.length) {
          try {
            const ingredients = JSON.parse(rRes[0].values[0][0]);
            for (const ing of ingredients) {
              const invItemId = typeof ing.inventoryItem === 'string' ? ing.inventoryItem : ing.inventoryItem?._id;
              if (!invItemId) continue;

              const invRes = db.exec(`SELECT quantity, unit FROM inventory WHERE _id = ?`, [invItemId]);
              if (invRes.length && invRes[0].values.length) {
                const currentQty = Number(invRes[0].values[0][0]) || 0;
                const unit = invRes[0].values[0][1];

                const cpu = consumptionPerUnit(Number(ing.inputQuantity) || 0, ing.inputUnit, Number(ing.outputQuantity) || 1);
                const totalConsumptionBase = cpu * it.quantity;

                const currentStockBase = convertToBase(currentQty, unit);
                const newStockBase = Math.max(0, currentStockBase - totalConsumptionBase);
                const newQuantityInUnit = baseToUnit(newStockBase, unit);

                db.run(`UPDATE inventory SET quantity = ? WHERE _id = ?`, [newQuantityInUnit, invItemId]);
              }
            }
          } catch (e) {
            console.warn('Recipe parse error in offline order:', e);
          }
        }
      }

      // Add to sync queue with cryptographic hash-chaining
      // F4: نرفق وقت الإنشاء الأصلي (now) بالـ payload حتى تحافظ المزامنة على
      // اليوم التجاري الصحيح للفاتورة في MongoDB (وليس وقت المزامنة)
      enqueueSecureOperation(db, {
        clientOpId: clientOrderId,
        entityType: 'order',
        action: 'CREATE',
        payload: {
          ...orderData,
          // لا نرسل أي رقم للسيرفر: الرقم النهائي يُصدره السيرفر فقط من العداد الذري.
          createdAt: now,
        },
        createdAt: now,
      });

      saveDatabase();

      // Trigger background sync attempt
      setTimeout(() => processSyncQueue(mainWindow), 100);

      return {
        success: true,
        data: {
          _id: clientOrderId,
          clientOrderId,
          orderNumber: '',
          provisionalNumber: tempOrderNumber,
          items: processedItems,
          totalAmount,
          status: 'completed',
          tableNumber: orderData.tableNumber,
          notes: orderData.notes,
          syncStatus: 'PENDING_SYNC',
          createdAt: now,
          updatedAt: now,
          isOffline: true,
        }
      };
    } catch (err) {
      console.error('offline:create-order error:', err);
      return { success: false, message: err.message };
    }
  });

  // POS أونلاين: مطابقة صف محلي PENDING مع رد السيرفر دون إعادة خصم مخزون
  ipcMain.handle('offline:reconcile-synced-order', async (_event, { clientOrderId, serverOrder }) => {
    try {
      const db = getDb();
      const ok = reconcileOrderWithServer(db, clientOrderId, serverOrder);
      if (ok) saveDatabase();
      return { success: ok };
    } catch (err) {
      console.error('offline:reconcile-synced-order error:', err);
      return { success: false, message: err.message };
    }
  });

  // Get local orders
  ipcMain.handle('offline:get-orders', async () => {
    try {
      const db = getDb();
      const res = db.exec(`SELECT * FROM orders ORDER BY created_at DESC`);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((row) => {
        const raw = {};
        columns.forEach((col, idx) => { raw[col] = row[idx]; });
        return mapOrderRow(raw, db);
      });
    } catch (err) {
      console.error('offline:get-orders error:', err);
      return [];
    }
  });

  // ===================== 2. OFFLINE EXPENSE / PURCHASE =====================
  ipcMain.handle('offline:create-expense', async (_event, expenseData) => {
    try {
      const db = getDb();
      const clientExpenseId = expenseData.clientExpenseId || `off_exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Idempotency: نفس clientExpenseId = نفس السجل (لا تكرار ولا زيادة مخزون مرتين)
      try {
        const existingRes = db.exec(
          `SELECT * FROM expenses WHERE client_expense_id = ? OR _id = ? LIMIT 1`,
          [clientExpenseId, clientExpenseId]
        );
        if (existingRes.length && existingRes[0].values.length) {
          const raw = {};
          existingRes[0].columns.forEach((col, idx) => { raw[col] = existingRes[0].values[0][idx]; });
          return {
            success: true,
            data: {
              _id: raw._id,
              description: raw.description || '',
              amount: Number(raw.amount) || 0,
              category: raw.category || 'other',
              inventoryItemLinked: raw.inventory_item_linked || undefined,
              inventoryQuantityAdded: Number(raw.inventory_quantity_added) || undefined,
              unitCost: Number(raw.unit_cost) || undefined,
              date: raw.date || raw.created_at || new Date().toISOString(),
              syncStatus: raw.sync_status || 'PENDING_SYNC',
              clientExpenseId: raw.client_expense_id || clientExpenseId,
              createdAt: raw.created_at || raw.date || new Date().toISOString(),
              isOffline: true,
            },
          };
        }
      } catch {}

      const now = expenseData.date || new Date().toISOString();

      const amount = Number(expenseData.amount) || 0;
      const totalCost = Number(expenseData.totalCost ?? amount) || 0;
      const qtyNum = Number(expenseData.inventoryQuantityAdded) || 0;
      const unitCost = qtyNum > 0 && totalCost > 0 ? Number((totalCost / qtyNum).toFixed(2)) : 0;

      // Save expense to SQLite
      db.run(`
        INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
      `, [
        clientExpenseId,
        expenseData.description,
        amount,
        expenseData.category || 'inventory',
        expenseData.inventoryItemLinked || null,
        qtyNum || null,
        unitCost || 0,
        now,
        expenseData.addedBy || '',
        clientExpenseId,
        now
      ]);

      // If category === 'inventory', immediately increase stock in local SQLite
      if (expenseData.category === 'inventory' && expenseData.inventoryItemLinked) {
        db.run(`
          UPDATE inventory 
          SET quantity = quantity + ?, 
              cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
              last_restock_total_cost = ?,
              last_restocked = ?,
              updated_at = ?
          WHERE _id = ?
        `, [qtyNum, unitCost, unitCost, totalCost, now, now, expenseData.inventoryItemLinked]);
      }

      // Add to sync queue with cryptographic hash-chaining
      enqueueSecureOperation(db, {
        clientOpId: clientExpenseId,
        entityType: 'expense',
        action: 'CREATE',
        payload: expenseData,
        createdAt: now,
      });

      saveDatabase();

      // Trigger background sync attempt
      setTimeout(() => processSyncQueue(mainWindow), 100);

      return {
        success: true,
        data: {
          _id: clientExpenseId,
          description: expenseData.description,
          amount,
          category: expenseData.category,
          inventoryItemLinked: expenseData.inventoryItemLinked,
          inventoryQuantityAdded: qtyNum,
          unitCost,
          date: now,
          createdAt: now,
          isOffline: true,
        }
      };
    } catch (err) {
      console.error('offline:create-expense error:', err);
      return { success: false, message: err.message };
    }
  });

  // Get local expenses
  ipcMain.handle('offline:get-expenses', async () => {
    try {
      const db = getDb();
      const res = db.exec(`SELECT * FROM expenses ORDER BY date DESC, created_at DESC`);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((row) => {
        const raw = {};
        columns.forEach((col, idx) => { raw[col] = row[idx]; });
        return {
          _id: raw._id,
          description: raw.description || '',
          amount: Number(raw.amount) || 0,
          category: raw.category || 'other',
          inventoryItemLinked: raw.inventory_item_linked || undefined,
          inventoryQuantityAdded: Number(raw.inventory_quantity_added) || undefined,
          unitCost: Number(raw.unit_cost) || undefined,
          date: raw.date || raw.created_at || new Date().toISOString(),
          addedBy: raw.added_by || '',
          syncStatus: raw.sync_status || 'SYNCED',
          clientExpenseId: raw.client_expense_id,
          createdAt: raw.created_at || raw.date || new Date().toISOString(),
        };
      });
    } catch (err) {
      console.error('offline:get-expenses error:', err);
      return [];
    }
  });

  // ===================== 3. OFFLINE INVENTORY RESTOCK =====================
  ipcMain.handle('offline:restock-inventory', async (_event, restockData) => {
    try {
      const db = getDb();
      const clientOpId = restockData.clientRestockId || `off_rstk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      const qtyNum = Number(restockData.quantity) || 0;
      const totalCost = Number(restockData.totalCost) || 0;
      const costPrice = Number(restockData.costPrice) || (qtyNum > 0 ? Number((totalCost / qtyNum).toFixed(2)) : 0);

      const targetId = String(restockData.id || restockData._id || restockData.inventoryId || '');
      if (!targetId) {
        return { success: false, message: 'Missing inventory item id' };
      }

      // ⚠️ سبب "المخزن مش بيضيف": لو الـ UPDATE ما لقاش صف بالـ _id ده،
      // SQLite بيعمل "صفر تغييرات" من غير أي خطأ → الكاشير شايف رسالة نجاح
      // بس الرصيد ما اتزادش. ده بيحصل لما الصنف يكون اتعمل بعد آخر مزامنة
      // فمش موجود في SQLite المحلي.
      const existingRes = db.exec(`SELECT _id FROM inventory WHERE _id = ? LIMIT 1`, [targetId]);
      if (!existingRes.length || !existingRes[0].values.length) {
        console.warn(`[restock] inventory item ${targetId} not found in local SQLite`);
        return {
          success: false,
          message: 'الصنف غير موجود في المخزن المحلي — حدّث البيانات مرة واحدة وهو متصل بالإنترنت',
        };
      }

      const updateRes = db.run(`
        UPDATE inventory 
        SET quantity = quantity + ?, 
            cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
            last_restock_total_cost = ?,
            last_restocked = ?,
            updated_at = ?
        WHERE _id = ?
      `, [qtyNum, costPrice, costPrice, totalCost, now, now, targetId]);

      // تحقق إضافي: SQLite ما بيرجعش عدد الصفوف المتأثرة بسهولة في كل الإصدارات،
      // فبنقرأ الرصيد بعد التحديث للتأكد إن الكمية اتزادت فعلاً.
      const afterRes = db.exec(`SELECT quantity FROM inventory WHERE _id = ? LIMIT 1`, [targetId]);
      const qtyAfter = Number(afterRes?.[0]?.values?.[0]?.[0]);
      if (!Number.isFinite(qtyAfter) || qtyAfter <= 0) {
        return { success: false, message: 'فشل تحديث رصيد الصنف في المخزن المحلي' };
      }

      // Add to sync queue with cryptographic hash-chaining
      // clientRestockId يضمن Idempotency على السيرفر — نفس التوريد لو اتبعت مرتين
      // (انقطاع نت أثناء الرد) لا يرفع الرصيد مرتين.
      enqueueSecureOperation(db, {
        clientOpId,
        entityType: 'inventory_restock',
        action: 'UPDATE',
        payload: { ...restockData, id: targetId, clientRestockId: clientOpId },
        createdAt: now,
      });

      saveDatabase();

      // Trigger background sync attempt
      setTimeout(() => processSyncQueue(mainWindow), 100);

      return { success: true, clientRestockId: clientOpId };
    } catch (err) {
      console.error('offline:restock-inventory error:', err);
      return { success: false, message: err.message };
    }
  });

  // ===================== 4. OFFLINE INVENTORY CREATE (صنف جديد أوفلاين) =====================
  ipcMain.handle('offline:create-inventory-item', async (_event, itemData) => {
    try {
      const db = getDb();
      const clientInventoryId = itemData.clientInventoryId || `off_inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      try {
        const existingRes = db.exec(
          `SELECT * FROM inventory WHERE _id = ? OR client_inventory_id = ? LIMIT 1`,
          [clientInventoryId, clientInventoryId]
        );
        if (existingRes.length && existingRes[0].values.length) {
          const row = existingRes[0].values[0];
          const cols = existingRes[0].columns;
          const raw = {};
          cols.forEach((col, idx) => { raw[col] = row[idx]; });
          return {
            success: true,
            data: {
              _id: raw._id,
              clientInventoryId: raw.client_inventory_id || raw._id,
              name: raw.name,
              quantity: Number(raw.quantity) || 0,
              unit: raw.unit || 'KG',
              minLimit: Number(raw.min_limit) || 5,
              costPrice: Number(raw.cost_price) || 0,
              lastRestockTotalCost: Number(raw.last_restock_total_cost) || 0,
              lastRestocked: raw.last_restocked,
              syncStatus: raw.sync_status || 'PENDING_SYNC',
              isOffline: true,
            },
          };
        }
      } catch {}
      const now = new Date().toISOString();

      const qtyNum = Number(itemData.quantity) || 0;
      const minLimit = itemData.minLimit !== undefined ? Number(itemData.minLimit) : 5;
      const costPrice = Number(itemData.costPrice) || 0;
      const totalCost = itemData.totalCost !== undefined ? Number(itemData.totalCost) : Number((costPrice * qtyNum).toFixed(2));

      db.run(`
        INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status, client_inventory_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?)
      `, [
        clientInventoryId,
        String(itemData.name || '').trim(),
        qtyNum,
        String(itemData.unit || 'KG'),
        minLimit,
        costPrice,
        totalCost,
        now,
        now,
        clientInventoryId,
      ]);

      // يُرفع للسيرفر تلقائياً عند عودة النت (POST /inventory) — والسيرفر يمنع التكرار
      // بنفس clientInventoryId حتى لو اتبعت العملية مرتين.
      enqueueSecureOperation(db, {
        clientOpId: clientInventoryId,
        entityType: 'inventory_create',
        action: 'CREATE',
        payload: {
          name: String(itemData.name || '').trim(),
          quantity: qtyNum,
          unit: String(itemData.unit || 'KG'),
          minLimit,
          costPrice,
          totalCost,
          clientInventoryId,
        },
        createdAt: now,
      });

      saveDatabase();

      setTimeout(() => processSyncQueue(mainWindow), 100);

      return {
        success: true,
        data: {
          _id: clientInventoryId,
          clientInventoryId,
          name: String(itemData.name || '').trim(),
          quantity: qtyNum,
          unit: String(itemData.unit || 'KG'),
          minLimit,
          costPrice,
          lastRestockTotalCost: totalCost,
          lastRestocked: now,
          syncStatus: 'PENDING_SYNC',
          isOffline: true,
        },
      };
    } catch (err) {
      console.error('offline:create-inventory-item error:', err);
      return { success: false, message: err.message };
    }
  });

  // Cache server entities (products, categories, inventory, recipes) into local SQLite
  ipcMain.handle('sync:cache-entities', async (_event, { entityType, records }) => {
    try {
      if (!Array.isArray(records)) return { success: false };
      const db = getDb();

      if (entityType === 'products') {
        for (const p of records) {
          db.run(`
            INSERT OR REPLACE INTO products (_id, name, price, description, image_url, category_id, in_stock, stock_quantity, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            p._id,
            p.name,
            p.price,
            p.description || '',
            p.image?.secure_url || '',
            typeof p.category === 'object' ? p.category?._id : p.category,
            p.inStock ? 1 : 0,
            p.stockQuantity || 0,
            p.updatedAt || new Date().toISOString()
          ]);
        }
      } else if (entityType === 'categories') {
        for (const c of records) {
          db.run(`
            INSERT OR REPLACE INTO categories (_id, name, description, updated_at)
            VALUES (?, ?, ?, ?)
          `, [c._id, c.name, c.description || '', c.updatedAt || new Date().toISOString()]);
        }
      } else if (entityType === 'inventory') {
        for (const inv of records) {
          if (!inv || !inv._id) continue;
          const localClientId = inv.clientInventoryId || inv.client_inventory_id || '';
          const pendingItem = db.exec(
            `SELECT 1 FROM inventory
             WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
               AND (_id = ? OR (client_inventory_id IS NOT NULL AND client_inventory_id != '' AND client_inventory_id = ?))
             LIMIT 1`,
            [inv._id, localClientId]
          );
          if (pendingItem.length && pendingItem[0].values.length) continue;

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
            inv._id,
            inv.name,
            inv.quantity,
            inv.unit,
            inv.minLimit,
            inv.costPrice || 0,
            inv.lastRestockTotalCost || 0,
            inv.lastRestocked || '',
            inv.updatedAt || new Date().toISOString()
          ]);
        }
      } else if (entityType === 'recipes') {
        for (const r of records) {
          const prodId = typeof r.product === 'object' ? r.product?._id : r.product;
          db.run(`
            INSERT OR REPLACE INTO recipes (_id, product_id, ingredients, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `, [
            r._id,
            prodId,
            JSON.stringify(r.ingredients || []),
            r.isActive ? 1 : 0,
            r.updatedAt || new Date().toISOString()
          ]);
        }
      } else if (entityType === 'orders') {
        for (const ord of records) {
          try {
            upsertSyncedOrder(db, ord);
          } catch (ordErr) {
            console.warn('Failed to cache order locally:', ord?._id, ordErr?.message);
          }
        }
      } else if (entityType === 'expenses') {
        for (const exp of records) {
          if (!exp || !exp._id) continue;
          db.run(`
            INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
            ON CONFLICT(_id) DO UPDATE SET
              description = excluded.description,
              amount = excluded.amount,
              category = excluded.category,
              inventory_item_linked = excluded.inventory_item_linked,
              inventory_quantity_added = excluded.inventory_quantity_added,
              unit_cost = excluded.unit_cost,
              date = excluded.date,
              added_by = excluded.added_by
          `, [
            exp._id,
            exp.description || '',
            Number(exp.amount) || 0,
            exp.category || 'other',
            typeof exp.inventoryItemLinked === 'object' ? exp.inventoryItemLinked?._id : (exp.inventoryItemLinked || null),
            Number(exp.inventoryQuantityAdded) || null,
            Number(exp.unitCost) || null,
            exp.date || exp.createdAt || new Date().toISOString(),
            typeof exp.addedBy === 'object' ? exp.addedBy?._id || '' : (exp.addedBy || ''),
            exp._id,
            exp.createdAt || exp.date || new Date().toISOString()
          ]);
        }
      }

      saveDatabase();
      return { success: true };
    } catch (err) {
      console.error('sync:cache-entities error:', err);
      return { success: false, error: err.message };
    }
  });

  // Sync controls
  ipcMain.handle('sync:trigger', async () => {
    const result = await processSyncQueue(mainWindow);
    // عودة الاتصال = رفع + سحب معاً بدون أي تدخل يدوي:
    // بعد رفع العمليات المحلية (فواتير/مصروفات/مخزون) نسحب أحدث بيانات السيرفر فوراً.
    try {
      await pullServerUpdates(mainWindow);
    } catch {
      /* فشل السحب لا يُفشل المزامنة */
    }
    return result;
  });

  ipcMain.handle('sync:get-queue', async () => {
    const db = getDb();
    const res = db.exec(`SELECT * FROM sync_queue ORDER BY id DESC`);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map((row) => {
      const obj = {};
      columns.forEach((col, idx) => { obj[col] = row[idx]; });
      return obj;
    });
  });

  // Offline Auth caching
  ipcMain.handle('auth:cache-user', async (_event, { user, password, token }) => {
    try {
      if (!user || !user.email) return { success: false };
      const db = getDb();
      const hash = password ? crypto.createHash('sha256').update(password).digest('hex') : '';
      const secureToken = token ? encryptSensitiveString(token) : '';
      db.run(`
        INSERT OR REPLACE INTO local_users (_id, user_name, email, role_type, password_hash, session_token, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [user._id, user.userName, user.email.toLowerCase(), user.roleType, hash, secureToken, new Date().toISOString()]);
      saveDatabase();
      if (token) configureSync({ token });
      return { success: true };
    } catch (err) {
      console.error('auth:cache-user error:', err);
      return { success: false, error: err.message };
    }
  });

  // Offline Auth verification
  ipcMain.handle('auth:verify-offline', async (_event, { email, password }) => {
    try {
      if (!email || !password) return { success: false, message: 'Missing credentials' };
      const db = getDb();
      const inputHash = crypto.createHash('sha256').update(password).digest('hex');
      const res = db.exec(`
        SELECT _id, user_name, email, role_type, password_hash, session_token
        FROM local_users
        WHERE LOWER(email) = ?
      `, [email.toLowerCase()]);

      if (!res.length || !res[0].values.length) {
        return { success: false, message: 'User not cached locally' };
      }

      const [id, userName, userEmail, roleType, storedHash, rawSessionToken] = res[0].values[0];
      if (storedHash && storedHash === inputHash) {
        const sessionToken = decryptSensitiveString(rawSessionToken);
        if (sessionToken) configureSync({ token: sessionToken });
        return {
          success: true,
          user: {
            _id: id,
            userName,
            email: userEmail,
            roleType,
            verify: true,
            createdAt: new Date().toISOString(),
          },
          token: sessionToken,
        };
      }
      return { success: false, message: 'Invalid password' };
    } catch (err) {
      console.error('auth:verify-offline error:', err);
      return { success: false, message: err.message };
    }
  });

  // Frontend Hot-Update IPC handlers
  ipcMain.handle('frontend:get-version', async () => {
    return frontendUpdater.getLocalMeta();
  });

  ipcMain.handle('frontend:check-update', async () => {
    return await frontendUpdater.checkForUpdates(mainWindow);
  });

  ipcMain.handle('frontend:apply-update', async () => {
    return frontendUpdater.applyUpdateNow(mainWindow);
  });

  // ============================================================
  // 🖨️ الطباعة الصامتة — بدون Print Dialog
  // ============================================================

  /** جلب قائمة الطابعات المتاحة على الجهاز */
  ipcMain.handle('print:get-printers', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      // نرجّع الاسم والحالة فقط — بدون بيانات تقنية زيادة
      return {
        ok: true,
        printers: printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: p.isDefault,
          status: p.status,
        })),
      };
    } catch (err) {
      console.error('[print:get-printers]', err);
      return { ok: false, printers: [], error: err.message };
    }
  });

  /** طباعة HTML صامتة على طابعة محددة — بدون فتح أي dialog */
  ipcMain.handle('print:silent', async (_event, { html, printerName }) => {
    return new Promise((resolve) => {
      let printWin = null;
      const cleanup = () => {
        try { if (printWin && !printWin.isDestroyed()) printWin.close(); } catch {}
        printWin = null;
      };

      try {
        printWin = new BrowserWindow({
          show: false,
          skipTaskbar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            javascript: true,
          },
        });

        // تحميل HTML الفاتورة مباشرةً كـ data URL
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        printWin.loadURL(dataUrl);

        printWin.webContents.once('did-finish-load', () => {
          // هامش بسيط لضمان تحميل الخطوط قبل الطباعة
          setTimeout(() => {
            try {
              printWin.webContents.print(
                {
                  silent: true,
                  printBackground: true,
                  printerName: printerName || undefined,
                  margins: { marginType: 'none' },
                  pageSize: 'A4', // سيُستبدل بـ @page في CSS الفاتورة
                },
                (success, reason) => {
                  cleanup();
                  resolve({ ok: success, reason: reason || null });
                }
              );
            } catch (printErr) {
              console.error('[print:silent] print() error:', printErr);
              cleanup();
              resolve({ ok: false, reason: printErr.message });
            }
          }, 600);
        });

        // timeout أمان: لو لم يكتمل التحميل بعد 15 ثانية
        setTimeout(() => {
          if (printWin) {
            console.warn('[print:silent] timeout — closing print window');
            cleanup();
            resolve({ ok: false, reason: 'timeout' });
          }
        }, 15000);

      } catch (err) {
        console.error('[print:silent] setup error:', err);
        cleanup();
        resolve({ ok: false, reason: err.message });
      }
    });
  });
}