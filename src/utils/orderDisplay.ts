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
  const byId = new Map<string, any>();
  // خريطة منفصلة: clientOrderId → مفتاح الصف في byId
  // تمنع ظهور نفس الفاتورة مرتين (مرة بـ clientOrderId ومرة بـ _id السيرفر)
  const byCid = new Map<string, string>();

  const isPending = (o: any): boolean =>
    String(o?.syncStatus || o?.sync_status || '').toUpperCase() === 'PENDING_SYNC';

  const take = (list: any[]) => {
    for (const o of list) {
      if (!o) continue;
      const id  = String(o._id || '');
      const cid = String(o.clientOrderId || o.client_order_id || '');

      // ── هل الفاتورة موجودة بنفس clientOrderId؟ ──────────────────────────
      // (مثلاً: فاتورة أوفلاين جاءت مرة بـ clientOrderId ومرة بـ _id السيرفر)
      if (cid && byCid.has(cid)) {
        const existingKey = byCid.get(cid)!;
        const existing = byId.get(existingKey);
        // نحتفظ بالنسخة المُزامَنة (غير PENDING) وإن وُجدت
        if (existing && isPending(existing) && !isPending(o)) {
          byId.set(existingKey, o);
        }
        continue;
      }

      // ── هل الفاتورة موجودة بنفس _id؟ ────────────────────────────────────
      if (id && byId.has(id)) continue;

      const key = id || cid;
      if (!key) continue;
      byId.set(key, o);
      if (cid) byCid.set(cid, key);
    }
  };

  take(primary);
  take(extra);

  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt || b.created_at || 0).getTime();
    return tb - ta;
  });
};



/**
 * رقم الفاتورة المعروض للكاشير.
 * - فاتورة السيرفر: orderNumber (مثال "20")
 * - فاتورة أوفلاين مؤقتة: OFF-1234 → تظهر 1234
 * - لو الرقم مفقود تماماً (بيانات قديمة/محلية): نرجع لآخر جزء من _id أو clientOrderId
 *   بدل ما نعرض "----" في شريط آخر الطلبات.
 */
export const displayOrderNumber = (order: any): string => {
  const raw = String(order?.orderNumber ?? order?.order_number ?? '').trim();
  if (raw) {
    const cleaned = raw.replace(/^OFF-/i, '').trim();
    if (cleaned) return cleaned.slice(-6);
  }

  const clientId = String(order?.clientOrderId ?? order?.client_order_id ?? '').trim();
  const id = String(order?._id ?? '').trim();
  const fallbackSource = id || clientId;
  if (fallbackSource) {
    const stripped = fallbackSource.replace(/^off[_]/i, '').replace(/^OFF-/i, '');
    const digits = stripped.replace(/\D/g, '');
    if (digits) return digits.slice(-6);
    return stripped.slice(-6) || fallbackSource.slice(-4);
  }

  const tableNumber = order?.tableNumber ?? order?.table_number;
  if (tableNumber !== undefined && tableNumber !== null && String(tableNumber).trim() !== '') {
    return `ط${String(tableNumber).trim()}`;
  }

  return '----';
};
