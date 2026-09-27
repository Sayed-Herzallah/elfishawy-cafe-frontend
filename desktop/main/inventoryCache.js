// desktop/main/inventoryCache.js
// ============================================================
// كاش صنف المخزن القادم من السيرفر داخل SQLite المحلية.
// ------------------------------------------------------------
// الهدف: صف واحد فقط لكل صنف — لا كارت مكرر ولا رصيد مزدوج.
// المشكلة التي يحلها:
//   صنف أُنشئ أوفلاين يكون محفوظاً بمعرّف مؤقت (off_inv_...) وحالما يصل
//   المعرّف النهائي من السيرفر كان بيتعمل له صف تاني (لأن الـ _id مختلف)
//   فيظهر الصنف مرتين في صفحة المخزن برصيدين مختلفين.
// الحل:
//   1) لا نلمس أي صف معلّق (PENDING_SYNC) — العمليات المحلية لم تُزامن بعد.
//   2) لو فيه صف محلي بنفس client_inventory_id نحذف المكرر وننقل الصف
//      للمعرّف النهائي بدل إنشاء صف جديد.
//   3) الاحتفاظ بـ client_inventory_id في الصف — أساس كل مطابقة/دمج لاحق.
// ============================================================

/**
 * حفظ/تحديث صنف سيرفر في المخزن المحلي مع منع تكرار الصفوف.
 * @returns {boolean} true لو تم التطبيق، false لو اتُخطّى لأن الصنف معلّق محلياً
 */
export function cacheServerInventoryItem(db, inv) {
  if (!db || !inv || !inv._id) return false;

  const clientInventoryId = inv.clientInventoryId || inv.client_inventory_id || '';

  // A sale may have been applied locally before its order reached MongoDB.
  // Do not overwrite that stock deduction with the older server snapshot.
  const linkedPendingOrder = db.exec(
    `SELECT 1 FROM orders o
     JOIN sync_queue q ON q.client_op_id = o.client_order_id
     WHERE o.sync_status = 'PENDING_SYNC'
       AND q.entity_type = 'order'
       AND q.status IN ('PENDING', 'FAILED')
       AND (o.items LIKE '%' || ? || '%' OR o.items LIKE '%' || ? || '%')
     LIMIT 1`,
    [String(inv._id), String(clientInventoryId)]
  );
  if (linkedPendingOrder.length && linkedPendingOrder[0].values.length) return false;

  // 1) الصنف عنده عملية محلية معلّقة → نحترم الرصيد المحلي ولا نكتب فوقه
  const pendingItem = db.exec(
    `SELECT 1 FROM inventory
     WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
       AND (_id = ? OR (client_inventory_id IS NOT NULL AND client_inventory_id != '' AND client_inventory_id = ?))
     LIMIT 1`,
    [inv._id, clientInventoryId]
  );
  if (pendingItem.length && pendingItem[0].values.length) return false;

  // 2) دمج الصف المؤقت مع الصف النهائي (نفس الصنف بمعرّف مختلف)
  if (clientInventoryId) {
    try {
      // لو المعرّف النهائي موجود بالفعل → نحذف الصف المؤقت المكرر
      db.run(
        `DELETE FROM inventory
         WHERE _id != ? AND client_inventory_id = ?
           AND EXISTS (SELECT 1 FROM inventory WHERE _id = ?)`,
        [inv._id, clientInventoryId, inv._id]
      );
      // وإلا ننقل الصف المؤقت للمعرّف النهائي بدل إنشاء صف تاني
      db.run(
        `UPDATE inventory SET _id = ?, sync_status = 'SYNCED'
         WHERE _id != ? AND client_inventory_id = ?`,
        [inv._id, inv._id, clientInventoryId]
      );
    } catch (mergeErr) {
      console.warn('[Inventory cache] duplicate merge warning:', mergeErr?.message);
    }
  }

  // 3) Upsert للصنف القادم من السيرفر (مع حفظ client_inventory_id)
  db.run(`
    INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status, client_inventory_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)
    ON CONFLICT(_id) DO UPDATE SET
      name = excluded.name,
      quantity = excluded.quantity,
      unit = excluded.unit,
      min_limit = excluded.min_limit,
      cost_price = excluded.cost_price,
      last_restock_total_cost = excluded.last_restock_total_cost,
      last_restocked = excluded.last_restocked,
      updated_at = excluded.updated_at,
      client_inventory_id = COALESCE(excluded.client_inventory_id, inventory.client_inventory_id)
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
    inv.updatedAt || new Date().toISOString(),
    clientInventoryId || null,
  ]);

  return true;
}
