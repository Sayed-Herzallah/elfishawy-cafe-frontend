/**
 * 🧾 كاش الفواتير (Orders Cache)
 * ------------------------------------------------------------------
 * الهدف: توفير كل فواتير اليوم حتى وقت انقطاع الإنترنت في **كلتا الحالتين**
 * (تطبيق الديسكتوب + المتصفح) ومن أي إصدار من المين بروسيس.
 *
 * طبقتان:
 * 1) SQLite المحلية في الديسكتوب — عن طريق `db:execute` العامة الموجودة في كل
 *    إصدارات الـ Desktop (بديل مضمون لـ syncEntityCache الذي قد لا يدعم orders).
 * 2) لقطة localStorage — تعمل في المتصفح وكذلك كطبقة أمان إضافية في الديسكتوب.
 *
 * كل الدوال هنا آمنة: أي فشل في التخزين يتم تجاهله بصمت (تحسيني فقط).
 */
import { normalizeOrder } from './orderDisplay';

const ORDERS_CACHE_KEY = 'elfishawy_orders_cache_v1';
// F3: 2000 فاتورة كحد أقصى (بدل 400) — يغطي أيام كاملة من البيانات للعرض أوفلاين،
// مع بقاء الكاش محدوداً (وليس full-history unbounded). الأولوية دائماً للأحدث
// زمنياً (فواتير اليوم أولاً) لأن القائمة مرتبة تنازلياً قبل القص.
const MAX_CACHED_ORDERS = 2000;
/** الحد الأقصى لعدد الفواتير في جملة SQL واحدة (حماية لحجم الـ IPC) */
export const ORDERS_SQL_CHUNK_SIZE = 60;

/** الأعمدة القابلة للكتابة في جدول orders محلياً (نفس أسماء أعمدة SQLite) */
const WRITABLE_ORDER_COLUMNS = [
  '_id',
  'order_number',
  'items',
  'total_amount',
  'status',
  'table_number',
  'cashier_id',
  'notes',
  'sync_status',
  'client_order_id',
  'created_at',
  'updated_at',
] as const;

const timeOf = (order: any): number =>
  new Date(order?.createdAt || order?.created_at || 0).getTime() || 0;

/** تقليص أصناف الفاتورة لأصغر شكل مفيد (اسم + سعر + كمية) قبل الحفظ */
const slimItems = (items: unknown): any[] => {
  const list = Array.isArray(items) ? items : [];
  return list.map((it: any) => {
    const product = it?.product;
    const isObject = Boolean(product) && typeof product === 'object';
    const id = isObject ? product._id || product.id || '' : product || '';
    const name = (isObject && product?.name) || it?.productName || '';
    const price = Number(it?.price) || Number(isObject ? product?.price : 0) || 0;
    return {
      product: { _id: String(id || ''), name: String(name || ''), price },
      quantity: Number(it?.quantity) || 0,
      price,
    };
  });
};

/** توحيد شكل الفاتورة (camelCase/snake_case، وتحويل items إلى مصفوفة كاملة) */
export const slimOrderForCache = (order: any): any => {
  const normalized: any = normalizeOrder(order);
  const raw = (order || {}) as any;
  return {
    _id: normalized._id,
    orderNumber: normalized.orderNumber,
    items: slimItems(normalized.items),
    totalAmount: normalized.totalAmount,
    status: normalized.status,
    tableNumber: normalized.tableNumber,
    cashierId: normalized.cashierId,
    notes: normalized.notes,
    syncStatus: raw.syncStatus || raw.sync_status || 'SYNCED',
    clientOrderId: normalized.clientOrderId || null,
    createdAt: normalized.createdAt || new Date().toISOString(),
    updatedAt: normalized.updatedAt || normalized.createdAt || new Date().toISOString(),
  };
};

/**
 * مفتاح التفرد للفاتورة.
 * `clientOrderId` أولاً لأن الفاتورة المُنشأة أوفلاين يبقى معها نفس المُعرّف بعد المزامنة
 * (السيرفر قد يرجّعها بـ _id مختلف) — فندمج النسختين كفاتورة واحدة بدون تكرار.
 */
const uniqueKeyOf = (order: any): string =>
  String(order?.clientOrderId || order?.client_order_id || order?._id || order?.orderNumber || '');

/** هل الفاتورة لم تُزامن بعد؟ */
const isPendingSync = (order: any): boolean =>
  String(order?.syncStatus || order?.sync_status || '').toUpperCase() === 'PENDING_SYNC';

/**
 * توحيد/تنقية صفوف الفواتير القادمة من SQLite أو من السيرفر.
 * - يوحّد camelCase و snake_case (إصدارات الديسكتوب القديمة كانت ترجع snake_case)
 * - يحوّل items النصية إلى مصفوفة
 * - يحذف التكرار ويوجد أحدث فاتورة أولاً
 */
export const normalizeCachedOrderRows = (rows: any[]): any[] => {
  const byKey = new Map<string, any>();
  (rows || []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const order = slimOrderForCache(row);
    const key = uniqueKeyOf(order);
    if (!key) return;
    const previous = byKey.get(key);
    // صف «قيد المزامنة» لا يُلغي نسخة مُزامَنة لنفس الفاتورة (العكس مسموح: المُزامَنة تحل مكانه)
    if (previous && !isPendingSync(previous) && isPendingSync(order)) return;
    byKey.set(key, order);
  });
  return Array.from(byKey.values()).sort((a, b) => timeOf(b) - timeOf(a));
};

/** دمج قائمتين من الفواتير بدون تكرار (دمج كاش SQLite مع لقطة localStorage) */
export const mergeCachedOrders = (primary: any[] = [], extra: any[] = []): any[] => {
  const byKey = new Map<string, any>();
  // خريطة منفصلة: clientOrderId → مفتاح الصف في byKey
  const byCid = new Map<string, string>();

  const take = (list: any[]) => {
    (list || []).forEach((order) => {
      if (!order || typeof order !== 'object') return;
      const id  = String(order._id || order.clientOrderId || order.client_order_id || '');
      const cid = String(order.clientOrderId || order.client_order_id || '');

      // هل الفاتورة موجودة بنفس clientOrderId؟ → نحتفظ بالنسخة المُزامَنة
      if (cid && byCid.has(cid)) {
        const existingKey = byCid.get(cid)!;
        const existing = byKey.get(existingKey);
        if (existing) {
          // صف «قيد المزامنة» يُستبدل بالنسخة المُزامَنة عند وجودها
          if (isPendingSync(existing) && !isPendingSync(order)) byKey.set(existingKey, order);
        }
        return;
      }

      const key = uniqueKeyOf(order);
      if (!key) return;
      const previous = byKey.get(key);
      if (previous) {
        if (isPendingSync(previous) && !isPendingSync(order)) byKey.set(key, order);
        return;
      }
      byKey.set(key, order);
      if (cid) byCid.set(cid, key);
    });
  };
  take(primary);
  take(extra);
  return Array.from(byKey.values()).sort((a, b) => timeOf(b) - timeOf(a));
};


/** قراءة لقطة الفواتير المحفوظة في المتصفح */
export const readOrdersSnapshot = (): any[] => {
  try {
    const raw = localStorage.getItem(ORDERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const orders = Array.isArray(parsed) ? parsed : parsed?.orders;
    return Array.isArray(orders) ? orders : [];
  } catch {
    /* التخزين تحسيني — نتجاهل أي تلف */
    return [];
  }
};

/**
 * حفظ الفواتير في لقطة localStorage (تُدمج مع المحفوظ سابقاً بدون تكرار).
 * @param replace عند true يتم استبدال اللقطة بالكامل (جلب كامل غير مُفلتر)
 */
export const saveOrdersSnapshot = (orders: any[], options: { replace?: boolean } = {}): void => {
  if (!Array.isArray(orders) || orders.length === 0) return;
  try {
    const previous = options.replace ? [] : readOrdersSnapshot();
    const merged = mergeCachedOrders(orders.map(slimOrderForCache), previous).slice(0, MAX_CACHED_ORDERS);
    localStorage.setItem(
      ORDERS_CACHE_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), orders: merged })
    );
  } catch {
    /* التخزين تحسيني — نتجاهل أي فشل (مثل امتلاء المساحة) */
  }
};

/** قيمة عمود واحد من الفاتورة بصيغة SQLite */
const valueForColumn = (order: any, column: string): any => {
  switch (column) {
    case '_id':
      return order._id;
    case 'order_number':
      return order.orderNumber || order._id;
    case 'items':
      return JSON.stringify(order.items || []);
    case 'total_amount':
      return Number(order.totalAmount) || 0;
    case 'status':
      return order.status || 'completed';
    case 'table_number':
      return order.tableNumber ?? null;
    case 'cashier_id':
      return order.cashierId || '';
    case 'notes':
      return order.notes || '';
    case 'sync_status':
      return 'SYNCED';
    case 'client_order_id':
      // لا نكتب client_order_id قادماً من السيرفر حتى لا نتعارض مع صف "قيد المزامنة" المحلي
      return null;
    case 'created_at':
      return order.createdAt || new Date().toISOString();
    case 'updated_at':
      return order.updatedAt || order.createdAt || new Date().toISOString();
    default:
      return null;
  }
};

export interface OrdersUpsertQuery {
  sql: string;
  params: any[];
  columns: string[];
}

/**
 * بناء جملة Upsert متوافقة مع مخطط جدول orders المحلي (أي إصدار):
 * - تستخدم فقط الأعمدة الموجودة فعلاً في الجدول
 * - تحمي صفوف "PENDING_SYNC" (طلبات أوفلاين لم تُزامن بعد) من الكتابة فوقها
 * - تحافظ على created_at الأصلي حتى تفضل الفاتورة في «فواتير اليوم» الصحيحة
 */
export const buildOrdersUpsertQuery = (tableColumns: string[], rows: any[]): OrdersUpsertQuery => {
  const existing = new Set(tableColumns || []);
  const columns = WRITABLE_ORDER_COLUMNS.filter((column) => existing.has(column));
  if (!columns.includes('_id') || !Array.isArray(rows) || rows.length === 0) {
    return { sql: '', params: [], columns: [] };
  }

  const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');

  const assignments = columns
    .filter((column) => column !== '_id')
    .map((column) => {
      if (column === 'created_at') {
        return 'created_at = COALESCE(orders.created_at, excluded.created_at)';
      }
      if (column === 'client_order_id') {
        return 'client_order_id = COALESCE(excluded.client_order_id, orders.client_order_id)';
      }
      return `${column} = excluded.${column}`;
    });

  const guard = columns.includes('sync_status')
    ? ` WHERE IFNULL(orders.sync_status, 'SYNCED') != 'PENDING_SYNC'`
    : '';

  const sql = `INSERT INTO orders (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT(_id) DO UPDATE SET ${assignments.join(', ')}${guard}`;
  const params = rows.flatMap((row) => columns.map((column) => valueForColumn(row, column)));

  return { sql, params, columns };
};
