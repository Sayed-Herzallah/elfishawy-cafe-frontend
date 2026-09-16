import { ApiClient } from './api/apiClient';
import { ApiResponse, Order, InventoryItem, Expense, KPIStats, ChartsData, OrderStatus } from '../types';
import { offlineStore } from './data/offlineStore';

export const orderService = {
  getOrders: async (params?: { status?: string; searchDate?: string; cashierId?: string }): Promise<ApiResponse<Order[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.searchDate) query.append('searchDate', params.searchDate);
    if (params?.cashierId) query.append('cashierId', params.cashierId);
    const qs = query.toString();

    try {
      return await ApiClient.request<Order[]>(`/orders${qs ? `?${qs}` : ''}`, { method: 'GET' });
    } catch (err) {
      if (offlineStore.isDesktop()) {
        const localOrders = await offlineStore.getOfflineOrders();
        if (localOrders && localOrders.length > 0) {
          return { success: true, message: 'Loaded from local offline database', data: localOrders };
        }
      }
      throw err;
    }
  },

  getOrder: (id: string): Promise<ApiResponse<Order>> => {
    return ApiClient.request<Order>(`/orders/${id}`, { method: 'GET' });
  },

  createOrder: async (payload: {
    items: { product: string; quantity: number; price?: number }[];
    tableNumber: number;
    notes?: string;
  }): Promise<ApiResponse<Order>> => {
    // If on Desktop, check if online before calling server
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        const offlineRes = await offlineStore.createOfflineOrder(payload);
        if (offlineRes.success && offlineRes.data) {
          return {
            success: true,
            message: 'تم حفظ الطلب محلياً بنجاح (وضع غير متصل)',
            data: offlineRes.data,
          };
        }
      }
    }

    try {
      return await ApiClient.request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      // If request failed due to network error and in Desktop, save offline immediately
      if (offlineStore.isDesktop()) {
        const offlineRes = await offlineStore.createOfflineOrder(payload);
        if (offlineRes.success && offlineRes.data) {
          return {
            success: true,
            message: 'تم حفظ الطلب محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت',
            data: offlineRes.data,
          };
        }
      }
      throw networkErr;
    }
  },

  updateOrderStatus: (id: string, status: OrderStatus): Promise<ApiResponse<Order>> => {
    return ApiClient.request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  updateOrder: (id: string, payload: {
    items?: { product: string; quantity: number }[];
    tableNumber?: number;
    notes?: string;
  }): Promise<ApiResponse<Order>> => {
    return ApiClient.request<Order>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

export const inventoryService = {
  listInventory: async (params?: { search?: string; lowStock?: boolean }): Promise<ApiResponse<InventoryItem[]>> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.lowStock !== undefined) query.append('lowStock', String(params.lowStock));
    const qs = query.toString();

    try {
      const res = await ApiClient.request<InventoryItem[]>(`/inventory${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (res.success && Array.isArray(res.data) && !qs) {
        offlineStore.cacheEntities('inventory', res.data);
      }
      return res;
    } catch (err) {
      if (offlineStore.isDesktop()) {
        const cached = await offlineStore.getCachedInventory();
        if (cached && cached.length > 0) {
          return { success: true, message: 'Loaded from local offline database', data: cached };
        }
      }
      throw err;
    }
  },

  createItem: (data: {
    name: string;
    quantity?: number;
    unit: string;
    minLimit: number;
    costPrice?: number;
    totalCost?: number;
  }): Promise<ApiResponse<InventoryItem>> => {
    return ApiClient.request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  restockItem: async (id: string, quantity: number, costPrice?: number, totalCost?: number): Promise<ApiResponse<InventoryItem>> => {
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        await offlineStore.restockOfflineInventory({ id, quantity, costPrice, totalCost });
        return {
          success: true,
          message: 'تم توريد الكمية محلياً وسيتم المزامنة عند عودة الاتصال',
        };
      }
    }

    try {
      return await ApiClient.request<InventoryItem>(`/inventory/${id}/restock`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity, costPrice, totalCost }),
      });
    } catch (networkErr) {
      if (offlineStore.isDesktop()) {
        await offlineStore.restockOfflineInventory({ id, quantity, costPrice, totalCost });
        return {
          success: true,
          message: 'تم توريد الكمية محلياً وسيتم المزامنة عند عودة الاتصال',
        };
      }
      throw networkErr;
    }
  },

  deleteItem: (id: string): Promise<ApiResponse<void>> => {
    return ApiClient.request<void>(`/inventory/${id}`, { method: 'DELETE' });
  },

  updateItem: (id: string, data: {
    name?: string;
    quantity?: number;
    unit?: string;
    minLimit?: number;
    costPrice?: number;
  }): Promise<ApiResponse<InventoryItem>> => {
    return ApiClient.request<InventoryItem>(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

export const expenseService = {
  listExpenses: async (params?: { category?: string; searchDate?: string }): Promise<ApiResponse<Expense[]>> => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.searchDate) query.append('searchDate', params.searchDate);
    const qs = query.toString();

    try {
      return await ApiClient.request<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`, { method: 'GET' });
    } catch (err) {
      if (offlineStore.isDesktop()) {
        const localExpenses = await offlineStore.getOfflineExpenses();
        if (localExpenses && localExpenses.length > 0) {
          return { success: true, message: 'Loaded from local offline database', data: localExpenses };
        }
      }
      throw err;
    }
  },

  createExpense: async (data: {
    description: string;
    amount: number;
    category: 'rent' | 'salaries' | 'utilities' | 'inventory' | 'other';
    inventoryItemLinked?: string;
    inventoryQuantityAdded?: number;
    totalCost?: number;
    unitCost?: number;
    date?: string;
  }): Promise<ApiResponse<Expense>> => {
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        const offlineRes = await offlineStore.createOfflineExpense(data);
        if (offlineRes.success && offlineRes.data) {
          return {
            success: true,
            message: 'تم تسجيل المصروف/التوريد محلياً بنجاح (وضع غير متصل)',
            data: offlineRes.data,
          };
        }
      }
    }

    try {
      return await ApiClient.request<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (networkErr) {
      if (offlineStore.isDesktop()) {
        const offlineRes = await offlineStore.createOfflineExpense(data);
        if (offlineRes.success && offlineRes.data) {
          return {
            success: true,
            message: 'تم تسجيل المصروف/التوريد محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت',
            data: offlineRes.data,
          };
        }
      }
      throw networkErr;
    }
  },

  deleteExpense: (id: string): Promise<ApiResponse<void>> => {
    return ApiClient.request<void>(`/expenses/${id}`, { method: 'DELETE' });
  },

  updateExpense: (id: string, data: {
    description?: string;
    amount?: number;
    category?: 'rent' | 'salaries' | 'utilities' | 'inventory' | 'other';
    inventoryItemLinked?: string;
    inventoryQuantityAdded?: number;
    totalCost?: number;
    date?: string;
  }): Promise<ApiResponse<Expense>> => {
    return ApiClient.request<Expense>(`/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

export const analyticsService = {
  getStats: (): Promise<ApiResponse<KPIStats>> => {
    return ApiClient.request<KPIStats>('/analytics/stats', { method: 'GET' });
  },

  getCharts: (): Promise<ApiResponse<ChartsData>> => {
    return ApiClient.request<ChartsData>('/analytics/charts', { method: 'GET' });
  },
};
