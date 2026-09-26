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
    ''
  );
  const provisionalNumber = String(
    raw?.provisionalNumber ||
    raw?.provisional_number ||
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
    provisionalNumber: provisionalNumber || undefined,
    dayKey: raw?.dayKey || raw?.day_key || undefined,
    syncStatus: raw?.syncStatus || raw?.sync_status || undefined,
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

/**
 * 🔢 ترقيم مؤقت موحّد للمتصفح والديسكتوب في نفس اليوم.
 * ------------------------------------------------------------------
 * السبب: الديسكتوب بيخزّن "رقم مؤقت" محلي في SQLite عند كل فاتورة أوفلاين
 * (allocateProvisionalNumber)، لكن المتصفح كان بيخزّن الفاتورة من غير أي رقم
 * مؤقت خالص → نفس الطلب بيظهر برقم مختلف على كل منصة ("مشتريات بيجيب رقم
 * مختلف منصة").
 * الحل: مصدر واحد للرقم المؤقت — أعلى رقم مؤقت موجود فعلاً في اليوم
 * + 1. بيحترم ترتيب الجهاز (1, 2, 3 ...) ومتوافق مع منطق الديسكتوب.
 */
const PROVISIONAL_KEY = 'elfishawy_provisional_counter';

const getCairoDayKey = (value = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value instanceof Date ? value : new Date(value));
  } catch {
    const dateObj = value instanceof Date ? value : new Date(value);
    return Number.isNaN(dateObj.getTime()) ? new Date().toISOString().slice(0, 10) : dateObj.toISOString().slice(0, 10);
  }
};

/** أعلى رقم مؤقت مُسجَّل في لقطة اليوم (حماية بعد أي ترقية/استرجاع localStorage) */
const scanMaxProvisional = (): number => {
  let max = 0;
  try {
    const raw = localStorage.getItem('elfishawy_orders_cache_v1');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const orders = Array.isArray(parsed) ? parsed : parsed?.orders;
    if (!Array.isArray(orders)) return 0;
    const today = getCairoDayKey();
    orders.forEach((o: any) => {
      const dayKey = String(o?.dayKey || o?.day_key || '');
      const createdDay = dayKey || getCairoDayKey(new Date(String(o?.createdAt || o?.created_at || Date.now())));
      if (createdDay !== today) return;
      const prov = String(o?.provisionalNumber ?? o?.provisional_number ?? '').trim();
      if (/^\d{1,6}$/.test(prov)) max = Math.max(max, Number(prov));
      const num = String(o?.orderNumber ?? o?.order_number ?? '').trim();
      if (/^\d{1,6}$/.test(num)) max = Math.max(max, Number(num));
    });
  } catch {
    /* تجاهل */
  }
  return max;
};

/**
 * يوزّع رقماً مؤقتاً تسلسلياً لليوم الحالي (1, 2, 3, ...).
 * يُستخدم من المتصفح فقط عند إنشاء فاتورة أوفلاين، ومتوافق مع منطق
 * الديسكتوب — فتبقى الأرقام متطابقة بين المنصات لنفس الترتيب.
 */
export const allocateProvisionalNumber = (): string => {
  try {
    const dayKey = getCairoDayKey();
    const stored = localStorage.getItem(PROVISIONAL_KEY);
    let seq = 0;
    let storedDay = '';
    if (stored) {
      const parsed = JSON.parse(stored);
      storedDay = String(parsed?.dayKey || '');
      seq = Number(parsed?.seq) || 0;
    }
    // يوم جديد → العداد يبدأ من 1، مع الاحترام لأعلى رقم مؤقت مسجَّل فعلاً
    if (storedDay !== dayKey) {
      seq = scanMaxProvisional();
    } else {
      seq = Math.max(seq, scanMaxProvisional());
    }
    seq += 1;
    localStorage.setItem(PROVISIONAL_KEY, JSON.stringify({ dayKey, seq }));
    return String(seq);
  } catch {
    return '1';
  }
};

export const mergeOrderLists = (primary: any[] = [], extra: any[] = []): any[] => {
  const byKey = new Map<string, any>();
  const cidToKey = new Map<string, string>();
  const idToKey = new Map<string, string>();

  const isPending = (o: any): boolean =>
    String(o?.syncStatus || o?.sync_status || '').toUpperCase() === 'PENDING_SYNC';

  const hasFinalNumber = (o: any): boolean => {
    const raw = String(o?.orderNumber ?? o?.order_number ?? '').trim();
    if (!raw || raw.startsWith('off_') || raw.startsWith('tmp_')) return false;
    return /^\d{1,6}$/.test(raw.replace(/^OFF-/i, '').trim());
  };

  const processOrder = (o: any) => {
    if (!o || typeof o !== 'object') return;
    const cid = String(o.clientOrderId || o.client_order_id || '').trim();
    const id = String(o._id || '').trim();

    // العثور على المفتاح الموجود سواء عبر clientOrderId أو عبر _id
    let existingKey: string | undefined = undefined;
    if (cid && cidToKey.has(cid)) {
      existingKey = cidToKey.get(cid);
    } else if (id && idToKey.has(id)) {
      existingKey = idToKey.get(id);
    }

    if (existingKey && byKey.has(existingKey)) {
      const existing = byKey.get(existingKey);

      // دمج دقيق: تفضيل البيانات المؤكدة من السيرفر مدموجة مع الرقم والخصائص المحلية
      let merged: any;
      if (isPending(existing) && !isPending(o)) {
        merged = { ...existing, ...o };
      } else if (!isPending(existing) && isPending(o)) {
        merged = { ...o, ...existing };
      } else {
        merged = { ...existing, ...o };
      }

      if (!hasFinalNumber(o) && hasFinalNumber(existing)) {
        merged.orderNumber = existing.orderNumber;
        merged.syncStatus = existing.syncStatus;
      }
      if (!merged.provisionalNumber && existing.provisionalNumber) {
        merged.provisionalNumber = existing.provisionalNumber;
      }

      byKey.set(existingKey, merged);
      if (cid) cidToKey.set(cid, existingKey);
      if (id) idToKey.set(id, existingKey);
      return;
    }

    // سجل جديد
    const newKey = cid || id;
    if (!newKey) return;

    byKey.set(newKey, { ...o });
    if (cid) cidToKey.set(cid, newKey);
    if (id) idToKey.set(id, newKey);
  };

  // معالجة كلتا القائمتين مع الضمان بعدم التكرار
  for (const item of primary) processOrder(item);
  for (const item of extra) processOrder(item);

  return Array.from(byKey.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt || b.created_at || 0).getTime();
    return tb - ta;
  });
};



/**
 * رقم الفاتورة المعروض للكاشير.
 * - الرقم النهائي الرسمي من السيرفر (مثال "1", "2", "20") — أولوية دائماً.
 * - فواتير أوفلاين معلقة (بدون رقم نهائي بعد) تعرض الرقم المؤقت بعلامة
 *   «مؤقت» حتى لا تُخلط مع الأرقام النهائية — ثم تتحول للرقم النهائي بعد المزامنة.
 * - لا يستخدم Mongo _id كرقم فاتورة إطلاقاً.
 * - لا يستخدم slice(-4) أو slice(-6).
 */
export const displayOrderNumber = (order: any): string => {
  const syncStatus = String(order?.syncStatus ?? order?.sync_status ?? '').toUpperCase();
  const isPending = syncStatus === 'PENDING_SYNC';

  // فاتورة لم تُزامن بعد: الرقم المؤقت فقط — لا نعرض order_number حتى لو بقي من بيانات قديمة
  if (isPending) {
    const provisional = String(
      order?.provisionalNumber ?? order?.provisional_number ?? ''
    ).trim();
    if (/^\d{1,6}$/.test(provisional)) {
      return `مؤقت ${provisional}`;
    }
    const tableNumber = order?.tableNumber ?? order?.table_number;
    if (tableNumber !== undefined && tableNumber !== null && String(tableNumber).trim() !== '') {
      return `ط${String(tableNumber).trim()}`;
    }
    return '—';
  }

  const raw = String(order?.orderNumber ?? order?.order_number ?? '').trim();
  if (raw) {
    const cleaned = raw.replace(/^OFF-/i, '').trim();
    // بيانات قديمة: clientOrderId مخزّن خطأً كـ order_number — نتجاهله
    if (cleaned.startsWith('off_')) {
      // no orderNumber available, fall through to provisional fallback
    } else if (cleaned && !cleaned.startsWith('tmp_')) {
      // إذا كان الرقم تسلسلياً نقياً نرجعه بالكامل دون اقتطاع
      return cleaned;
    } else if (cleaned.startsWith('tmp_')) {
      // إزالة بادئة tmp_ لو وُجدت من بيانات قديمة
      const numOnly = cleaned.replace(/\D/g, '');
      if (numOnly) return numOnly;
    }
  }

  // لا رقم نهائي بعد (فاتورة معلقة أوفلاين) → الرقم المؤقت بعلامة واضحة
  const provisional = String(
    order?.provisionalNumber ?? order?.provisional_number ?? ''
  ).trim();
  if (/^\d{1,6}$/.test(provisional)) {
    return `مؤقت ${provisional}`;
  }

  // إذا لم يتوفر orderNumber إطلاقاً، نستخدم رقم الطاولة كمرجع واضح بدل تشويه الأرقام بـ Mongo _id
  const tableNumber = order?.tableNumber ?? order?.table_number;
  if (tableNumber !== undefined && tableNumber !== null && String(tableNumber).trim() !== '') {
    return `ط${String(tableNumber).trim()}`;
  }

  return '—';
};
