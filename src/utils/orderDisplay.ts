import { Order, OrderItem, Product } from '../types';

type ProductLookup = Map<string, { name: string; price?: number }>;

const parseItems = (items: unknown): any[] => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string' && items.trim()) {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const productIdOf = (item: any): string => {
  if (!item) return '';
  if (typeof item.product === 'string') return item.product;
  return String(item.product?._id || item.productId || '');
};

export const resolveOrderItemName = (
  item: any,
  products?: ProductLookup | Array<{ _id: string; name: string }>
): string => {
  if (!item) return 'مشروب';
  if (item.product && typeof item.product === 'object' && item.product.name) {
    return String(item.product.name);
  }
  if (item.productName) return String(item.productName);
  const id = productIdOf(item);
  if (!id || !products) return 'مشروب';
  if (products instanceof Map) return products.get(id)?.name || 'مشروب';
  const found = products.find((p) => p._id === id);
  return found?.name || 'مشروب';
};

export const buildProductLookup = (
  products: Array<{ _id: string; name: string; price?: number }>
): ProductLookup => {
  const map: ProductLookup = new Map();
  products.forEach((p) => {
    if (p?._id) map.set(p._id, { name: p.name, price: p.price });
  });
  return map;
};

const hydrateItems = (items: any[], lookup?: ProductLookup): OrderItem[] =>
  items.map((it) => {
    const id = productIdOf(it);
    const lookupHit = id && lookup ? lookup.get(id) : undefined;
    const name =
      (typeof it.product === 'object' && it.product?.name) ||
      it.productName ||
      lookupHit?.name ||
      'مشروب';
    const price =
      Number(it.price) ||
      Number(typeof it.product === 'object' ? it.product?.price : 0) ||
      Number(lookupHit?.price) ||
      0;
    return {
      product: id ? { _id: id, name, price } as Product : it.product,
      quantity: Number(it.quantity) || 0,
      price,
    };
  });

/** يوحّد شكل الفاتورة من السيرفر أو SQLite (camelCase / snake_case) */
export const normalizeOrder = (raw: any, lookup?: ProductLookup): Order => {
  const createdAt =
    raw?.createdAt ||
    raw?.created_at ||
    raw?.updatedAt ||
    raw?.updated_at ||
    '';
  const orderNumber = String(
    raw?.orderNumber ||
      raw?.order_number ||
      raw?.clientOrderId ||
      raw?.client_order_id ||
      ''
  );
  const tableRaw = raw?.tableNumber ?? raw?.table_number;
  const tableNumber =
    tableRaw === null || tableRaw === undefined || tableRaw === ''
      ? undefined
      : Number(tableRaw);

  return {
    ...raw,
    _id: String(raw?._id || raw?.clientOrderId || raw?.client_order_id || ''),
    orderNumber,
    items: hydrateItems(parseItems(raw?.items), lookup),
    totalAmount: Number(raw?.totalAmount ?? raw?.total_amount) || 0,
    status: raw?.status || 'completed',
    tableNumber: Number.isFinite(tableNumber) ? tableNumber : undefined,
    notes: raw?.notes || '',
    cashierId: raw?.cashierId || raw?.cashier_id || '',
    createdAt,
    updatedAt: raw?.updatedAt || raw?.updated_at || createdAt,
    clientOrderId: raw?.clientOrderId || raw?.client_order_id,
  } as Order;
};

export const mergeOrderLists = (primary: any[] = [], extra: any[] = []): any[] => {
  const byKey = new Map<string, any>();
  // خريطة: clientOrderId -> مفتاح السجل في byKey
  const byCid = new Map<string, string>();
  // خريطة: _id -> مفتاح السجل في byKey
  const byId = new Map<string, string>();

  const isPending = (o: any): boolean =>
    String(o?.syncStatus || o?.sync_status || '').toUpperCase() === 'PENDING_SYNC';

  const take = (list: any[]) => {
    for (const o of list) {
      if (!o || typeof o !== 'object') continue;
      const cid = String(o.clientOrderId || o.client_order_id || '').trim();
      const id  = String(o._id || '').trim();

      // ── 1. الهوية الأساسية الأولى: clientOrderId / client_order_id ──────────
      if (cid) {
        if (byCid.has(cid)) {
          const existingKey = byCid.get(cid)!;
          const existing = byKey.get(existingKey);
          if (existing) {
            // تفضيل نسخة السيرفر المعتمدة (التي ليست PENDING_SYNC أو التي تملك _id سيرفر ورقم رسمي)
            if (isPending(existing) && !isPending(o)) {
              byKey.set(existingKey, { ...existing, ...o });
            } else if (!isPending(existing) && isPending(o)) {
              // احتفظ بنسخة السيرفر الحالية
            } else {
              // دمج الحقول مع الحفاظ على نسخة أحدث
              byKey.set(existingKey, { ...existing, ...o });
            }
          }
          if (id) byId.set(id, existingKey);
          continue;
        }
      }

      // ── 2. Fallback: الاعتماد على _id فقط عند عدم وجود clientOrderId ──────────
      if (id && byId.has(id)) {
        const existingKey = byId.get(id)!;
        const existing = byKey.get(existingKey);
        if (existing) {
          if (isPending(existing) && !isPending(o)) {
            byKey.set(existingKey, { ...existing, ...o });
          }
        }
        if (cid) byCid.set(cid, existingKey);
        continue;
      }

      // ── 3. إضافة سجل جديد ──────────────────────────────────────────────────
      const key = cid || id;
      if (!key) continue;

      byKey.set(key, o);
      if (cid) byCid.set(cid, key);
      if (id) byId.set(id, key);
    }
  };

  take(primary);
  take(extra);

  return Array.from(byKey.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt || b.created_at || 0).getTime();
    return tb - ta;
  });
};



/**
 * رقم الفاتورة المعروض للكاشير.
 * - رقم الفاتورة الرسمي القادم من السيرفر أو المحلي التسلسلي (مثال "1", "2", "20").
 * - لا يستخدم Mongo _id كرقم فاتورة إطلاقاً.
 * - لا يستخدم slice(-4) أو slice(-6).
 */
export const displayOrderNumber = (order: any): string => {
  const raw = String(order?.orderNumber ?? order?.order_number ?? '').trim();
  if (raw) {
    const cleaned = raw.replace(/^OFF-/i, '').trim();
    // إذا كان الرقم تسلسلياً نقياً نرجعه بالكامل دون اقتطاع
    if (cleaned && !cleaned.startsWith('tmp_')) {
      return cleaned;
    }
    if (cleaned.startsWith('tmp_')) {
      // إزالة بادئة tmp_ لو وُجدت من بيانات قديمة
      const numOnly = cleaned.replace(/\D/g, '');
      if (numOnly) return numOnly;
    }
    if (cleaned) return cleaned;
  }

  // إذا لم يتوفر orderNumber إطلاقاً، نستخدم رقم الطاولة كمرجع واضح بدل تشويه الأرقام بـ Mongo _id
  const tableNumber = order?.tableNumber ?? order?.table_number;
  if (tableNumber !== undefined && tableNumber !== null && String(tableNumber).trim() !== '') {
    return `ط${String(tableNumber).trim()}`;
  }

  return '—';
};
