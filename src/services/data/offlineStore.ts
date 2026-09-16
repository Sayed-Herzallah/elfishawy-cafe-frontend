// src/services/data/offlineStore.ts
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
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

  async cacheEntities(entityType: 'products' | 'categories' | 'inventory' | 'recipes', records: any[]): Promise<void> {
    if (isElectron() && window.electronAPI?.syncEntityCache) {
      try {
        await window.electronAPI.syncEntityCache(entityType, records);
      } catch (e) {
        console.warn(`Failed to cache ${entityType} locally:`, e);
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

  async getOfflineOrders(): Promise<any[]> {
    if (isElectron() && window.electronAPI?.getOfflineOrders) {
      return await window.electronAPI.getOfflineOrders();
    }
    return [];
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
