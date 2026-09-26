const rows = (db, sql, params = []) => {
    const result = db.exec(sql, params);
    if (!result.length) return [];
    return result[0].values.map((values) => {
        const row = {};
        result[0].columns.forEach((column, index) => { row[column] = values[index]; });
        return row;
    });
};

const transaction = (db, operation) => {
    db.run('BEGIN IMMEDIATE');
    try {
        const result = operation();
        db.run('COMMIT');
        return result;
    } catch (err) {
        try { db.run('ROLLBACK'); } catch { }
        throw err;
    }
};

const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

const inventoryPayload = (item) => ({
    name: item.name,
    quantity: Number(item.quantity) || 0,
    unit: item.unit || 'KG',
    minLimit: item.min_limit !== undefined ? Number(item.min_limit) : 5,
    costPrice: Number(item.cost_price) || 0,
    totalCost: Number(item.last_restock_total_cost) || 0,
    clientInventoryId: item.client_inventory_id || item._id,
});

const expensePayload = (expense) => ({
    _id: expense._id,
    description: expense.description || '',
    amount: Number(expense.amount) || 0,
    category: expense.category || 'inventory',
    inventoryItemLinked: expense.inventory_item_linked || undefined,
    inventoryQuantityAdded: Number(expense.inventory_quantity_added) || undefined,
    unitCost: Number(expense.unit_cost) || undefined,
    purchaseNumber: expense.purchase_number || undefined,
    addedBy: expense.added_by || '',
    date: expense.date || expense.created_at || new Date().toISOString(),
    syncStatus: expense.sync_status || 'PENDING_SYNC',
    clientExpenseId: expense.client_expense_id || expense._id,
    createdAt: expense.created_at || expense.date || new Date().toISOString(),
    isOffline: expense.sync_status !== 'SYNCED',
});

const ensureQueueEntry = (db, clientOpId, enqueue, operation) => {
    const existing = rows(db, 'SELECT id FROM sync_queue WHERE client_op_id = ? LIMIT 1', [clientOpId]);
    if (existing.length) return false;
    enqueue(operation);
    return true;
};

export function createOfflineInventoryItem(db, itemData, enqueue) {
    const clientInventoryId = itemData.clientInventoryId || newId('off_inv');
    const existing = rows(
        db,
        'SELECT * FROM inventory WHERE _id = ? OR client_inventory_id = ? LIMIT 1',
        [clientInventoryId, clientInventoryId]
    )[0];

    if (existing) {
        const pending = (existing.sync_status || 'SYNCED') === 'PENDING_SYNC';
        const queued = pending && transaction(db, () => ensureQueueEntry(db, clientInventoryId, enqueue, {
            clientOpId: clientInventoryId,
            entityType: 'inventory_create',
            action: 'CREATE',
            payload: inventoryPayload(existing),
            createdAt: existing.updated_at || new Date().toISOString(),
        }));
        return {
            success: true,
            queued,
            data: {
                _id: existing._id,
                clientInventoryId: existing.client_inventory_id || existing._id,
                name: existing.name,
                quantity: Number(existing.quantity) || 0,
                unit: existing.unit || 'KG',
                minLimit: Number(existing.min_limit) || 5,
                costPrice: Number(existing.cost_price) || 0,
                lastRestockTotalCost: Number(existing.last_restock_total_cost) || 0,
                lastRestocked: existing.last_restocked,
                syncStatus: existing.sync_status || 'SYNCED',
                isOffline: pending,
            },
        };
    }

    const now = itemData.date || new Date().toISOString();
    const quantity = Number(itemData.quantity) || 0;
    const minLimit = itemData.minLimit !== undefined ? Number(itemData.minLimit) : 5;
    const totalCost = itemData.totalCost !== undefined
        ? Number(itemData.totalCost) || 0
        : Number(((Number(itemData.costPrice) || 0) * quantity).toFixed(2));
    const costPrice = quantity > 0 && totalCost > 0
        ? Number((totalCost / quantity).toFixed(2))
        : Number(itemData.costPrice) || 0;
    const name = String(itemData.name || '').trim();
    const unit = String(itemData.unit || 'KG');

    transaction(db, () => {
        db.run(`
      INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status, client_inventory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?)
    `, [clientInventoryId, name, quantity, unit, minLimit, costPrice, totalCost, now, now, clientInventoryId]);

        enqueue({
            clientOpId: clientInventoryId,
            entityType: 'inventory_create',
            action: 'CREATE',
            payload: { name, quantity, unit, minLimit, costPrice, totalCost, clientInventoryId },
            createdAt: now,
        });

        if (quantity > 0) {
            const openingExpenseId = `${clientInventoryId}:opening`;
            const openingUnitCost = totalCost > 0 ? Number((totalCost / quantity).toFixed(2)) : 0;
            db.run(`
                INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
                VALUES (?, ?, ?, 'inventory', ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
            `, [openingExpenseId, `رصيد افتتاحي: ${name} - كمية: ${quantity} ${unit}`, totalCost, clientInventoryId, quantity, openingUnitCost, now, itemData.addedBy || '', openingExpenseId, now]);
        }
    });

    return {
        success: true,
        queued: true,
        data: {
            _id: clientInventoryId,
            clientInventoryId,
            name,
            quantity,
            unit,
            minLimit,
            costPrice,
            lastRestockTotalCost: totalCost,
            lastRestocked: now,
            syncStatus: 'PENDING_SYNC',
            isOffline: true,
        },
    };
}

export function createOfflineExpense(db, expenseData, enqueue) {
    const clientExpenseId = expenseData.clientExpenseId || newId('off_exp');
    const existing = rows(db, 'SELECT * FROM expenses WHERE client_expense_id = ? OR _id = ? LIMIT 1', [clientExpenseId, clientExpenseId])[0];
    if (existing) {
        const pending = (existing.sync_status || 'SYNCED') === 'PENDING_SYNC';
        const queued = pending && transaction(db, () => ensureQueueEntry(db, clientExpenseId, enqueue, {
            clientOpId: clientExpenseId,
            entityType: 'expense',
            action: 'CREATE',
            payload: expenseData,
            createdAt: existing.created_at || existing.date || new Date().toISOString(),
        }));
        return { success: true, queued, data: expensePayload(existing) };
    }

    const now = expenseData.date || new Date().toISOString();
    const amount = Number(expenseData.amount) || 0;
    const totalCost = Number(expenseData.totalCost ?? amount) || 0;
    const quantity = Number(expenseData.inventoryQuantityAdded) || 0;
    const unitCost = quantity > 0 && totalCost > 0 ? Number((totalCost / quantity).toFixed(2)) : 0;
    const category = expenseData.category || 'inventory';

    transaction(db, () => {
        db.run(`
      INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
    `, [clientExpenseId, expenseData.description, amount, category, expenseData.inventoryItemLinked || null, quantity || null, unitCost, now, expenseData.addedBy || '', clientExpenseId, now]);

        if (category === 'inventory' && expenseData.inventoryItemLinked) {
            db.run(`
        UPDATE inventory
        SET quantity = quantity + ?,
            cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
            last_restock_total_cost = ?,
            last_restocked = ?,
            updated_at = ?
        WHERE _id = ?
      `, [quantity, unitCost, unitCost, totalCost, now, now, expenseData.inventoryItemLinked]);
        }

        enqueue({
            clientOpId: clientExpenseId,
            entityType: 'expense',
            action: 'CREATE',
            payload: { ...expenseData, clientExpenseId },
            createdAt: now,
        });
    });

    return {
        success: true,
        queued: true,
        data: {
            _id: clientExpenseId,
            description: expenseData.description,
            amount,
            category,
            inventoryItemLinked: expenseData.inventoryItemLinked,
            inventoryQuantityAdded: quantity,
            unitCost,
            date: now,
            createdAt: now,
            syncStatus: 'PENDING_SYNC',
            clientExpenseId,
            isOffline: true,
        },
    };
}

export function listOfflineExpenses(db) {
    // JOIN مع المخزون لإرجاع اسم ووحدة الصنف المرتبط بكل فاتورة شراء —
    // بدون الـ JOIN كان الصنف المرتبط يرجع كـ string ID فقط مما يجعل العرض
    // يظهر "—" في الكمية واسم الصنف حتى وإن كانت البيانات موجودة محلياً.
    try {
        const result = db.exec(`
            SELECT e.*,
                   i.name   AS inv_name,
                   i.unit   AS inv_unit,
                   i._id    AS inv_resolved_id
            FROM expenses e
            LEFT JOIN inventory i ON i._id = e.inventory_item_linked
            ORDER BY e.date DESC, e.created_at DESC
        `);
        if (!result.length) return [];
        return result[0].values.map((values) => {
            const raw = {};
            result[0].columns.forEach((col, idx) => { raw[col] = values[idx]; });
            const exp = expensePayload(raw);
            // لو الصنف موجود في المخزون المحلي نرجعه كـ object كامل (زي استجابة السيرفر)
            if (raw.inv_resolved_id && raw.inv_name) {
                exp.inventoryItemLinked = {
                    _id: raw.inv_resolved_id,
                    name: raw.inv_name,
                    unit: raw.inv_unit || 'وحدة',
                };
            }
            return exp;
        });
    } catch {
        // fallback: استعلام بسيط بدون JOIN لو الـ JOIN فشل لأي سبب
        return rows(db, 'SELECT * FROM expenses ORDER BY date DESC, created_at DESC').map(expensePayload);
    }
}

export function restockOfflineInventory(db, restockData, enqueue) {
    const clientRestockId = restockData.clientRestockId || newId('off_rstk');
    const targetId = String(restockData.id || restockData._id || restockData.inventoryId || '');
    if (!targetId) return { success: false, message: 'Missing inventory item id' };

    const priorExpense = rows(db, 'SELECT * FROM expenses WHERE client_expense_id = ? LIMIT 1', [clientRestockId])[0];
    if (priorExpense) {
        const pending = (priorExpense.sync_status || 'SYNCED') === 'PENDING_SYNC';
        const queued = pending && transaction(db, () => ensureQueueEntry(db, clientRestockId, enqueue, {
            clientOpId: clientRestockId,
            entityType: 'inventory_restock',
            action: 'UPDATE',
            payload: { ...restockData, id: targetId, clientRestockId },
            createdAt: priorExpense.created_at || priorExpense.date || new Date().toISOString(),
        }));
        return { success: true, duplicate: true, queued, data: expensePayload(priorExpense), clientRestockId };
    }

    const priorQueue = rows(db, 'SELECT status FROM sync_queue WHERE client_op_id = ? LIMIT 1', [clientRestockId])[0];
    if (priorQueue) {
        let repairedLedger = false;
        if (['PENDING', 'FAILED'].includes(priorQueue.status)) {
            const item = rows(db, 'SELECT * FROM inventory WHERE _id = ? LIMIT 1', [targetId])[0];
            if (item) {
                const quantity = Number(restockData.quantity) || 0;
                const totalCost = Number(restockData.totalCost ?? ((Number(restockData.costPrice) || 0) * quantity)) || 0;
                const now = restockData.date || new Date().toISOString();
                const unitCost = quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : 0;
                transaction(db, () => db.run(`
          INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
          VALUES (?, ?, ?, 'inventory', ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
        `, [clientRestockId, restockData.description || `توريد مخزون: ${item.name} - كمية: ${quantity} ${item.unit}`, totalCost, targetId, quantity, unitCost, now, restockData.addedBy || '', clientRestockId, now]));
                repairedLedger = true;
            }
        }
        return { success: true, duplicate: true, queued: repairedLedger, clientRestockId };
    }

    const item = rows(db, 'SELECT * FROM inventory WHERE _id = ? LIMIT 1', [targetId])[0];
    if (!item) return { success: false, message: 'الصنف غير موجود في المخزن المحلي — حدّث البيانات مرة واحدة وهو متصل بالإنترنت' };

    const quantity = Number(restockData.quantity) || 0;
    const totalCost = Number(restockData.totalCost ?? ((Number(restockData.costPrice) || 0) * quantity)) || 0;
    const unitCost = quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : Number(restockData.costPrice) || 0;
    const now = restockData.date || new Date().toISOString();
    const description = restockData.description || `توريد مخزون: ${item.name} - كمية: ${quantity} ${item.unit}`;

    transaction(db, () => {
        db.run(`
      UPDATE inventory
      SET quantity = quantity + ?,
          cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
          last_restock_total_cost = ?,
          last_restocked = ?,
          updated_at = ?
      WHERE _id = ?
    `, [quantity, unitCost, unitCost, totalCost, now, now, targetId]);

        db.run(`
      INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
      VALUES (?, ?, ?, 'inventory', ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
    `, [clientRestockId, description, totalCost, targetId, quantity, unitCost, now, restockData.addedBy || '', clientRestockId, now]);

        enqueue({
            clientOpId: clientRestockId,
            entityType: 'inventory_restock',
            action: 'UPDATE',
            payload: { ...restockData, id: targetId, totalCost, clientRestockId },
            createdAt: now,
        });
    });

    return {
        success: true,
        queued: true,
        clientRestockId,
        data: {
            _id: clientRestockId,
            description,
            amount: totalCost,
            category: 'inventory',
            inventoryItemLinked: targetId,
            inventoryQuantityAdded: quantity,
            unitCost,
            date: now,
            createdAt: now,
            syncStatus: 'PENDING_SYNC',
            clientExpenseId: clientRestockId,
            isOffline: true,
        },
    };
}