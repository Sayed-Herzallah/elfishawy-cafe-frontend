// src/services/data/offlineStore.ts
import {
  ORDERS_SQL_CHUNK_SIZE,
  buildOrdersUpsertQuery,
  mergeCachedOrders,
  normalizeCachedOrderRows,
  readOrdersSnapshot,
} from '../../utils/ordersCache';

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
};

/** أعمدة جدول orders محلياً — تُقرأ من المخطط نفسه حتى نتوافق مع أي إصدار Desktop */
let ordersTableColumns: string[] | null = null;

const getOrdersTableColumns = async (): Promise<string[]> => {
  if (ordersTableColumns) return ordersTableColumns;
  if (!isElectron() || !window.electronAPI?.query) return [];
  try {
    const rows = await window.electronAPI.query('PRAGMA table_info(orders)');
    const columns = Array.isArray(rows)
      ? rows.map((row: any) => String(row?.name || '').trim()).filter(Boolean)
      : [];
    if (columns.length > 0) ordersTableColumns = columns;
    return columns;
  } catch {
    return [];
  }
};

/** مفاتيح الفواتير التي لم تُزامن بعد (PENDING_SYNC) — ممنوع الكتابة فوقها */
const getPendingOrderKeys = async (): Promise<{ ids: Set<string>; clientIds: Set<string> }> => {
  const ids = new Set<string>();
  const clientIds = new Set<string>();
  if (!isElectron() || !window.electronAPI?.query) return { ids, clientIds };
  try {
    const rows = await window.electronAPI.query(
      `SELECT IFNULL(_id, '') AS id, IFNULL(client_order_id, '') AS cid FROM orders WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'`
    );
    (Array.isArray(rows) ? rows : []).forEach((row: any) => {
      const id = String(row?.id || '').trim();
      const cid = String(row?.cid || '').trim();
      if (id) ids.add(id);
      if (cid) clientIds.add(cid);
    });
  } catch {
    /* لو الجدول/العمود غير موجود نكمل بدون حماية (الحماية الأساسية في SQL نفسها) */
  }
  return { ids, clientIds };
};

/**
 * كتابة فواتير السيرفر داخل SQLite المحلية باستخدام أوامر الـ DB العامة.
 * مهم: `syncEntityCache('orders')` غير مدعوم في إصدارات Desktop القديمة،
 * لذلك نكتب مباشرة عبر `db:execute` حتى تعمل «فواتير اليوم» أوفلاين بعد أي تحديث.
 */
const writeOrdersToSqlite = async (records: any[]): Promise<void> => {
  if (!isElectron() || !window.electronAPI?.execute) return;
  const columns = await getOrdersTableColumns();
  if (columns.length === 0) return;

  const pending = await getPendingOrderKeys();
  const rows = normalizeCachedOrderRows(records).filter((order) => {
    if (!order._id) return false;
    if (pending.ids.has(order._id)) return false;
    if (order.clientOrderId && pending.clientIds.has(order.clientOrderId)) return false;
    return true;
  });
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += ORDERS_SQL_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + ORDERS_SQL_CHUNK_SIZE);
    const { sql, params } = buildOrdersUpsertQuery(columns, chunk);
    if (!sql) return;
    await window.electronAPI.execute(sql, params);
  }
};

export const offlineStore = {
  isDesktop: isElectron,

  async isOnline(): Promise<boolean> {
    if (!navigator.onLine) return false;
    if (isElectron() && window.electronAPI?.checkOnline) {
      return await window.electronAPI.checkOnline();
    }
    return true;
  },

  async setAuthToken(token: string): Promise<void> {
    if (isElectron() && window.electronAPI?.setAuthToken) {
      try {
        await window.electronAPI.setAuthToken(token);
      } catch (e) {
        console.warn('Failed to set auth token in desktop main:', e);
      }
    }
  },

  async cacheEntities(entityType: 'products' | 'categories' | 'inventory' | 'recipes' | 'orders' | 'expenses', records: any[]): Promise<void> {
    if (isElectron() && window.electronAPI?.syncEntityCache) {
      try {
        await window.electronAPI.syncEntityCache(entityType, records);
      } catch (e) {
        console.warn(`Failed to cache ${entityType} locally:`, e);
      }
    }
  },

  /**
   * حفظ فواتير السيرفر محلياً.
   * نكتب في SQLite مباشرة عبر `db:execute` العامة (موجودة في كل إصدارات الديسكتوب)
   * بدل الاعتماد على `sync:cache-entities` التي لا تدعم orders في النسخ القديمة المثبّتة،
   * مع الاحتفاظ بالمسار القديم كاحتياط لو تعذّرت الكتابة العامة.
   */
  async cacheOrders(records: any[]): Promise<void> {
    if (!isElectron() || !Array.isArray(records) || records.length === 0) return;
    try {
      await writeOrdersToSqlite(records);
    } catch (e) {
      console.warn('Failed to write orders to local SQLite, falling back to syncEntityCache:', e);
      try {
        await window.electronAPI?.syncEntityCache?.('orders', records);
      } catch (fallbackError) {
        console.warn('Failed to cache orders via syncEntityCache:', fallbackError);
      }
    }
  },

  async getCachedProducts(): Promise<any[]> {
    if (!isElectron() || !window.electronAPI?.query) return [];
    try {
      const rows = await window.electronAPI.query(`SELECT * FROM products ORDER BY name ASC`);
      return rows.map((r: any) => ({
        _id: r._id,
        name: r.name,
        price: r.price,
        description: r.description,
        image: r.image_url ? { secure_url: r.image_url, public_id: '' } : undefined,
        category: r.category_id,
        inStock: Boolean(r.in_stock),
        stockQuantity: r.stock_quantity,
      }));
    } catch {
      return [];
    }
  },

  async getCachedCategories(): Promise<any[]> {
    if (!isElectron() || !window.electronAPI?.query) return [];
    try {
      return await window.electronAPI.query(`SELECT * FROM categories ORDER BY name ASC`);
    } catch {
      return [];
    }
  },

  async getCachedInventory(): Promise<any[]> {
    if (!isElectron() || !window.electronAPI?.query) return [];
    try {
      const rows = await window.electronAPI.query(`SELECT * FROM inventory ORDER BY name ASC`);
      return rows.map((r: any) => ({
        _id: r._id,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        minLimit: r.min_limit,
        costPrice: r.cost_price,
        lastRestockTotalCost: r.last_restock_total_cost,
        lastRestocked: r.last_restocked,
      }));
    } catch {
      return [];
    }
  },

  async getCachedRecipes(): Promise<any[]> {
    if (!isElectron() || !window.electronAPI?.query) return [];
    try {
      const rows = await window.electronAPI.query(`SELECT * FROM recipes WHERE is_active = 1`);
      return rows.map((r: any) => ({
        _id: r._id,
        product: r.product_id,
        ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients,
        isActive: Boolean(r.is_active),
      }));
    } catch {
      return [];
    }
  },

  // 1. OFFLINE ORDER
  async createOfflineOrder(payload: any): Promise<any> {
    if (isElectron() && window.electronAPI?.createOfflineOrder) {
      return await window.electronAPI.createOfflineOrder(payload);
    }
    throw new Error('Offline order creation is only available in Desktop mode');
  },

  /**
   * قراءة كل الفواتير المحفوظة محلياً **بدون أي حد أقصى**.
   * - أولاً عبر `offline:get-orders` (الإصدار الأحدث)
   * - وإن لم ترجع صفوفاً نقرأ جدول orders مباشرة بـ `db:query` العامة (تعمل مع أي إصدار)
   * ثم نوحّد الشكل إلى camelCase (النسخ القديمة ترجع snake_case) ونحذف التكرار.
   */
  async getOfflineOrders(): Promise<any[]> {
    if (!isElectron()) return [];

    let rows: any[] = [];
    if (window.electronAPI?.getOfflineOrders) {
      try {
        const result = await window.electronAPI.getOfflineOrders();
        if (Array.isArray(result)) rows = result;
      } catch (e) {
        console.warn('Failed to read offline orders via IPC:', e);
      }
    }

    if (rows.length === 0 && window.electronAPI?.query) {
      try {
        const result = await window.electronAPI.query(`SELECT * FROM orders ORDER BY created_at DESC`);
        if (Array.isArray(result)) rows = result;
      } catch (e) {
        console.warn('Failed to read local orders table:', e);
      }
    }

    return normalizeCachedOrderRows(rows);
  },

  /** كل الفواتير المتاحة أوفلاين = SQLite المحلية + لقطة المتصفح (بدون تكرار) */
  async getAllCachedOrders(): Promise<any[]> {
    const [dbOrders, snapshot] = [await this.getOfflineOrders(), readOrdersSnapshot()];
    return mergeCachedOrders(dbOrders, snapshot);
  },

  // 2. OFFLINE EXPENSE / PURCHASE
  async createOfflineExpense(payload: any): Promise<any> {
    if (isElectron() && window.electronAPI?.createOfflineExpense) {
      return await window.electronAPI.createOfflineExpense(payload);
    }
    throw new Error('Offline expense creation is only available in Desktop mode');
  },

  async getOfflineExpenses(): Promise<any[]> {
    if (isElectron() && window.electronAPI?.getOfflineExpenses) {
      return await window.electronAPI.getOfflineExpenses();
    }
    return [];
  },

  // 3. OFFLINE INVENTORY RESTOCK
  async restockOfflineInventory(payload: any): Promise<any> {
    if (isElectron() && window.electronAPI?.restockOfflineInventory) {
      return await window.electronAPI.restockOfflineInventory(payload);
    }
    throw new Error('Offline restock is only available in Desktop mode');
  },

  // 3.b OFFLINE INVENTORY CREATE (صنف مخزون جديد أُنشئ أوفلاين)
  async createOfflineInventoryItem(payload: any): Promise<any> {
    if (isElectron() && window.electronAPI?.createOfflineInventoryItem) {
      return await window.electronAPI.createOfflineInventoryItem(payload);
    }
    throw new Error('Offline inventory creation is only available in Desktop mode');
  },

  // SYNC
  async triggerSync(): Promise<any> {
    if (isElectron() && window.electronAPI?.triggerSync) {
      return await window.electronAPI.triggerSync();
    }
    return { success: true };
  },
};

// 🌐 عندما يعود الاتصال بالإنترنت في المتصفح / Renderer:
// نمرر التوكن للديسكتوب ونطلب معالجة طابور المزامنة فوراً دون انتظار الدورة المجدولة
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const token = localStorage.getItem('ef_access_token');
    if (token && window.electronAPI?.setAuthToken) {
      window.electronAPI.setAuthToken(token).then(() => {
        window.electronAPI?.triggerSync?.().catch(() => {});
      }).catch(() => {});
    } else if (window.electronAPI?.triggerSync) {
      window.electronAPI.triggerSync().catch(() => {});
    }
  });
}