// src/utils/localMerge.ts
// ============================================================
// 🧹 تنقية البيانات المحلية من التكرار (المشتريات + المخزن)
// ------------------------------------------------------------
// المشكلة: نفس العملية كانت ممكن تتخزن محلياً بصفّين — صف مؤقت بمعرّف محلي
// (off_...) وصف حقيقي بعد المزامنة (معرّف MongoDB) — فيظهر:
//   • عدد مشتريات مختلف عن المنصة (مثال: 11 على المنصة و13 على الديسكتوب).
//   • كارت صنف مكرر في المخزن برصيدين مختلفين.
// القاعدة: المفتاح دائماً هو "الهوية الثابتة للعملية" (clientExpenseId /
// clientInventoryId) وليس _id النهائي ولا ترتيب المصفوفة.
// ============================================================

/** هل المعرّف النهائي الصادر من MongoDB (ObjectId)? */
export const isServerObjectId = (id: unknown): boolean => /^[0-9a-fA-F]{24}$/.test(String(id || ''));

const isPendingSyncRow = (row: any): boolean =>
  String(row?.syncStatus || row?.sync_status || '').toUpperCase() === 'PENDING_SYNC';

/**
 * إزالة تكرار صفوف المخزن لنفس الصنف.
 * - الهوية النهائية (_id) تُؤخذ من صف السيرفر.
 * - الرصيد يُؤخذ من الصف المحلي المعلّق (عملية أوفلاين لم تُزامن) حتى لا تختفي
 *   الكمية المضافة أوفلاين بعد أي Refresh أو سحب بيانات.
 */
export const dedupeInventoryRows = <T extends Record<string, any>>(rows: T[]): T[] => {
  const byKey = new Map<string, T>();
  (rows || []).forEach((row, index) => {
    const key =
      String(row?.clientInventoryId || row?.client_inventory_id || row?._id || '').trim() ||
      `__local_${index}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      return;
    }
    const prevServer = isServerObjectId(prev?._id);
    const rowServer = isServerObjectId(row?._id);

    // صف السيرفر = الهوية النهائية (المعرّف اللي بيتعامل بيه مع السيرفر)
    const identityRow = rowServer && !prevServer ? row : prev;

    // الرصيد: الصف المعلّق (عملية محلية لم تُزامن) أدق، وإلا الصف الموجود
    const prevPending = isPendingSyncRow(prev);
    const rowPending = isPendingSyncRow(row);
    let stockRow: T = prev;
    if (rowPending && !prevPending) stockRow = row;
    else if (!rowPending && !prevPending) stockRow = identityRow;

    byKey.set(key, {
      ...stockRow,
      ...identityRow,
      _id: identityRow?._id || stockRow?._id,
      quantity: stockRow?.quantity,
    } as T);
  });
  return Array.from(byKey.values());
};

/**
 * إزالة تكرار قيود المشتريات/المصروفات لنفس العملية.
 * - نفس العملية بصفّين → نعرض صف السيرفر (SYNCED) فقط.
 * - عملية أوفلاين لسه ما وصلتش للسيرفر (PENDING_SYNC ومفيش لها صف مُزامن)
 *   تفضل ظاهرة كما هي → (11 من السيرفر + 1 معلّقة = 12)، وبعد المزامنة 12 بس.
 */
export const dedupeExpenseRows = <T extends Record<string, any>>(rows: T[]): T[] => {
  const byKey = new Map<string, T>();
  const identityToKey = new Map<string, string>();
  (rows || []).forEach((row, index) => {
    const clientId = String(row?.clientExpenseId || row?.client_expense_id || '').trim();
    const purchaseNumber = String(row?.purchaseNumber || row?.purchase_number || '').trim();
    const id = String(row?._id || '').trim();
    const identities = [
      clientId && `client:${clientId}`,
      purchaseNumber && `purchase:${purchaseNumber}`,
      id && `id:${id}`,
    ].filter(Boolean) as string[];
    const key = identities.map((identity) => identityToKey.get(identity)).find(Boolean) || `__expense_${index}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
    } else {
      const prevPending = isPendingSyncRow(prev);
      const rowPending = isPendingSyncRow(row);
      // الصف المُزامن هو المرجع لأي عملية وصلت السيرفر
      if (prevPending && !rowPending) {
        byKey.set(key, { ...prev, ...row });
      } else if (!(rowPending && !prevPending)) {
        // الاتنين بنفس الحالة: نفضّل صف السيرفر (المعرّف النهائي)
        byKey.set(key, isServerObjectId(row?._id) && !isServerObjectId(prev?._id) ? { ...prev, ...row } : { ...row, ...prev });
      }
    }
    for (const identity of identities) identityToKey.set(identity, key);
  });
  return Array.from(byKey.values());
};
