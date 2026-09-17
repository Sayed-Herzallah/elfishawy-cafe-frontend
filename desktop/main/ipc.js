// desktop/main/ipc.js
import { ipcMain } from 'electron';
import { getDb, saveDatabase, getMasterKey } from './db.js';
import { processSyncQueue, configureSync } from './sync.js';
import { frontendUpdater } from './frontendUpdater.js';
import { encryptSensitiveString, decryptSensitiveString, computeOpHash } from './security.js';
import crypto from 'crypto';

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
      const clientOrderId = `off_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const tempOrderNumber = `OFF-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      // Calculate total
      let totalAmount = 0;
      const processedItems = [];

      for (const it of orderData.items) {
        let price = Number(it.price) || 0;
        if (!price) {
          const pRes = db.exec(`SELECT price, name FROM products WHERE _id = ?`, [it.product]);
          if (pRes.length && pRes[0].values.length) {
            price = Number(pRes[0].values[0][0]) || 0;
          }
        }
        totalAmount += price * it.quantity;
        processedItems.push({
          product: it.product,
          quantity: it.quantity,
          price,
        });
      }

      // Save order to SQLite
      db.run(`
        INSERT INTO orders (_id, order_number, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?, ?)
      `, [
        clientOrderId,
        tempOrderNumber,
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
        db.run(
          `UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), in_stock = CASE WHEN stock_quantity - ? > 0 THEN 1 ELSE 0 END WHERE _id = ?`,
          [it.quantity, it.quantity, it.product]
        );
      }

      // Phase B: Recipe-based Inventory Deductions (Same as Backend Phase 6)
      for (const it of processedItems) {
        const rRes = db.exec(`SELECT ingredients FROM recipes WHERE product_id = ? AND is_active = 1`, [it.product]);
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
      enqueueSecureOperation(db, {
        clientOpId: clientOrderId,
        entityType: 'order',
        action: 'CREATE',
        payload: orderData,
        createdAt: now,
      });

      saveDatabase();

      // Trigger background sync attempt
      setTimeout(() => processSyncQueue(mainWindow), 100);

      return {
        success: true,
        data: {
          _id: clientOrderId,
          orderNumber: tempOrderNumber,
          items: processedItems,
          totalAmount,
          status: 'completed',
          tableNumber: orderData.tableNumber,
          notes: orderData.notes,
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
        let items = [];
        if (typeof raw.items === 'string') {
          try { items = JSON.parse(raw.items); } catch {}
        } else if (Array.isArray(raw.items)) {
          items = raw.items;
        }
        return {
          _id: raw._id,
          orderNumber: raw.order_number || raw.client_order_id || raw._id,
          items,
          totalAmount: Number(raw.total_amount) || 0,
          status: raw.status || 'completed',
          tableNumber: raw.table_number,
          cashierId: raw.cashier_id || '',
          notes: raw.notes || '',
          syncStatus: raw.sync_status || 'SYNCED',
          clientOrderId: raw.client_order_id,
          createdAt: raw.created_at || new Date().toISOString(),
          updatedAt: raw.updated_at || raw.created_at || new Date().toISOString(),
        };
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
      const clientExpenseId = `off_exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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
      const clientOpId = `off_rstk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      const qtyNum = Number(restockData.quantity) || 0;
      const totalCost = Number(restockData.totalCost) || 0;
      const costPrice = Number(restockData.costPrice) || (qtyNum > 0 ? Number((totalCost / qtyNum).toFixed(2)) : 0);

      db.run(`
        UPDATE inventory 
        SET quantity = quantity + ?, 
            cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
            last_restock_total_cost = ?,
            last_restocked = ?,
            updated_at = ?
        WHERE _id = ?
      `, [qtyNum, costPrice, costPrice, totalCost, now, now, restockData.id]);

      // Add to sync queue with cryptographic hash-chaining
      enqueueSecureOperation(db, {
        clientOpId,
        entityType: 'inventory_restock',
        action: 'UPDATE',
        payload: restockData,
        createdAt: now,
      });

      saveDatabase();

      // Trigger background sync attempt
      setTimeout(() => processSyncQueue(mainWindow), 100);

      return { success: true };
    } catch (err) {
      console.error('offline:restock-inventory error:', err);
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
          db.run(`
            INSERT OR REPLACE INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          if (!ord || !ord._id) continue;
          db.run(`
            INSERT INTO orders (_id, order_number, items, total_amount, status, table_number, cashier_id, notes, sync_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)
            ON CONFLICT(_id) DO UPDATE SET
              order_number = excluded.order_number,
              items = excluded.items,
              total_amount = excluded.total_amount,
              status = excluded.status,
              table_number = excluded.table_number,
              notes = excluded.notes,
              updated_at = excluded.updated_at
          `, [
            ord._id,
            ord.orderNumber || ord._id,
            JSON.stringify(ord.items || []),
            Number(ord.totalAmount) || 0,
            ord.status || 'completed',
            ord.tableNumber || null,
            typeof ord.cashierId === 'object' ? ord.cashierId?._id || '' : (ord.cashierId || ''),
            ord.notes || '',
            ord.createdAt || new Date().toISOString(),
            ord.updatedAt || ord.createdAt || new Date().toISOString()
          ]);
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
    return await processSyncQueue(mainWindow);
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
}
