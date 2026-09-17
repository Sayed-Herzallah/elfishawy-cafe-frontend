// src/services/data/offlineStore.ts
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
};

// ── كاش فواتير عام (localStorage) — يعمل في المتصفح والديسكتوب ──
// الهدف: لما النت ينقطع، سجل الفواتير يعرض نفس الفواتير اللي اتحمّلت آخر مرة أونلاين.
const ORDERS_CACHE_KEY = 'ef_cached_orders_v1';
const MAX_CACHED_ORDERS = 400;

function readWebOrdersCache(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ORDERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWebOrdersCache(orders: any[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify((orders || []).slice(0, MAX_CACHED_ORDERS)));
  } catch {
    /* مساحة التخزين ممتلئة أو وضع خاص — الكاش تحسيني مش حرج */
  }
}

export const offlineStore = {
  isDesktop: isElectron,

  /** هل الكاش المحلي فيه نفس بيانات اليوم؟ (تشخيص لمشكلة 3 فواتير أوفلاين) */
  async getOrdersCacheStatus(): Promise<{ count: number; newest: string | null; oldest: string | null }> {
    try {
      const cached = readWebOrdersCache();
      const times = cached
        .map((o: any) => new Date(o?.createdAt || o?.created_at || 0).getTime() || 0)
        .filter((t: number) => t > 0)
        .sort((a: number, b: number) => a - b);
      return {
        count: cached.length,
        newest: times.length ? new Date(times[times.length - 1]).toISOString() : null,
        oldest: times.length ? new Date(times[0]).toISOString() : null,
      };
    } catch {
      return { count: 0, newest: null, oldest: null };
    }
  },

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

  async cacheOrders(records: any[]): Promise<void> {
    // 1) كاش فوري في المتصفح (localStorage) — يضمن ظهور كل الفواتير أوفلاين
    //    حتى خارج الديسكتوب (Chrome/الموبايل)، بنفس بيانات السيرفر الكاملة
    //    (رقم الفاتورة، الطاولة، الوقت، أسماء المشروبات).
    writeWebOrdersCache(records || []);
    // 2) كاش SQLite في الديسكتوب — مهم لأسعار وأسماء الأصناف عند البيع أوفلاين
    return this.cacheEntities('orders', records);
  },

  /** إضافة فاتورة واحدة لأول الكاش المحلي (بعد إنشاء طلب أونلاين بنجاح) */
  async prependOrderToCache(order: any): Promise<void> {
    if (!order) return;
    try {
      const cached = readWebOrdersCache();
      const key = (o: any) => String(o?.clientOrderId || o?.client_order_id || o?._id || '');
      const nk = key(order);
      const filtered = nk ? cached.filter((o) => key(o) !== nk) : cached;
      writeWebOrdersCache([order, ...filtered]);
    } catch {
      /* تجاهل — الكاش تحسيني مش حرج */
    }
  },

  /** قراءة كاش المتصفح مباشرة (تستخدم كـ fallback عند انقطاع النت) */
  async getWebCachedOrders(): Promise<any[]> {
    return readWebOrdersCache();
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

  async getOfflineOrders(): Promise<any[]> {
    const webCached = readWebOrdersCache();
    if (isElectron() && window.electronAPI?.getOfflineOrders) {
      try {
        const sqliteOrders = (await window.electronAPI.getOfflineOrders()) || [];
        // دمج المصدرين: صفوف SQLite هي الأحدث (حالات المزامنة والطلبات الأوفلاين)،
        // وكاش المتصفح يكمّل باقي الفواتير — بدون أي تكرار.
        const seen = new Set<string>();
        const merged: any[] = [];
        const push = (o: any) => {
          if (!o) return;
          const k = String(o.clientOrderId || o.client_order_id || o._id || '');
          if (k && seen.has(k)) return;
          if (k) seen.add(k);
          merged.push(o);
        };
        sqliteOrders.forEach(push);
        webCached.forEach(push);
        merged.sort((a, b) => {
          const ta = new Date(a.createdAt || a.created_at || 0).getTime() || 0;
          const tb = new Date(b.createdAt || b.created_at || 0).getTime() || 0;
          return tb - ta;
        });
        return merged;
      } catch {
        return webCached;
      }
    }
    // وضع المتصفح: كل الفواتير المحفوظة من آخر تحميل أونلاين
    return webCached;
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

  // SYNC
  async triggerSync(): Promise<any> {
    if (isElectron() && window.electronAPI?.triggerSync) {
      return await window.electronAPI.triggerSync();
    }
    return { success: true };
  },
};
