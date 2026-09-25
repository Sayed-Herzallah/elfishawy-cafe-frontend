import { ApiClient } from './api/apiClient';
import { ApiResponse, Order, InventoryItem, Expense, KPIStats, ChartsData, OrderStatus } from '../types';
import { offlineStore } from './data/offlineStore';
import { mergeOrderLists } from '../utils/orderDisplay';
import { saveOrdersSnapshot, readOrdersSnapshot } from '../utils/ordersCache';

const ORDERS_FETCH_TIMEOUT_MS = 8000;

const isPendingSync = (row: any): boolean =>
  String(row?.syncStatus || row?.sync_status || '').toUpperCase() === 'PENDING_SYNC';

/** دمج قائمة السيرفر مع صفوف محلية معلقة فقط (تجنّب تكرار الفواتير المُزامَنة) */
const mergeServerWithLocalPending = <T extends { _id?: string; clientOrderId?: string; client_order_id?: string }>(
  serverRows: T[],
  localRows: T[]
): T[] => {
  const pending = (localRows || []).filter(isPendingSync);
  if (pending.length === 0) return serverRows;
  return mergeOrderLists(serverRows, pending) as T[];
};

const mergeInventoryLists = (serverRows: InventoryItem[] = [], localRows: any[] = []): InventoryItem[] => {
  const byKey = new Map<string, InventoryItem>();
  const keyOf = (item: any) =>
    String(item?.clientInventoryId || item?.client_inventory_id || item?._id || '');

  for (const row of serverRows) {
    const key = keyOf(row);
    if (key) byKey.set(key, row);
  }
  for (const row of localRows) {
    if (!isPendingSync(row)) continue;
    const key = keyOf(row);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, row as InventoryItem);
  }
  return Array.from(byKey.values());
};

const mergeExpenseLists = (serverRows: Expense[] = [], localRows: any[] = []): Expense[] => {
  const byKey = new Map<string, Expense>();
  const keyOf = (row: any) =>
    String(row?.clientExpenseId || row?.client_expense_id || row?._id || '');

  for (const row of serverRows) {
    const key = keyOf(row);
    if (key) byKey.set(key, row);
  }
  for (const row of localRows) {
    if (!isPendingSync(row)) continue;
    const key = keyOf(row);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, row as Expense);
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
  );
};

export const orderService = {
  getOrders: async (params?: { status?: string; searchDate?: string; cashierId?: string }): Promise<ApiResponse<Order[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.searchDate) query.append('searchDate', params.searchDate);
    if (params?.cashierId) query.append('cashierId', params.cashierId);
    const qs = query.toString();
    // الجلب بدون فلاتر = القائمة الكاملة من السيرفر (كل استدعاءات التطبيق كذلك)،
    // وهي اللقطة الصالحة لعرض «كل الفواتير» عند انقطاع الإنترنت.
    const isFullList = !qs;

    try {
      const res = await ApiClient.request<Order[]>(`/orders${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        signal: AbortSignal.timeout(ORDERS_FETCH_TIMEOUT_MS),
      });
      if (res.success && Array.isArray(res.data)) {
        if (isFullList) {
          // لقطة محلية في الديسكتوب والمتصفح: تضمن وجود كل الفواتير حتى لو فشلت كتابة SQLite
          saveOrdersSnapshot(res.data, { replace: true });
        }
        if (offlineStore.isDesktop()) {
          await offlineStore.cacheOrders(res.data);
          const localOrders = await offlineStore.getOfflineOrders();
          return {
            ...res,
            data: mergeServerWithLocalPending(res.data, localOrders || []),
          };
        }
        return res;
      }
      return res;
    } catch (err) {
      // عند انقطاع النت: كل الفواتير المحفوظة محلياً (SQLite + لقطة المتصفح) بدون حد
      const localOrders = await offlineStore.getAllCachedOrders();
      if (localOrders.length > 0) {
        return {
          success: true,
          message: offlineStore.isDesktop()
            ? 'Loaded from local offline database'
            : 'Loaded from local cache',
          data: localOrders as Order[],
        };
      }
      if (offlineStore.isDesktop()) {
        // لا يوجد كاش بعد (تشغيل أول بدون إنترنت) — نرجع قائمة فارغة بدل رفض غير معالج
        return {
          success: true,
          message: 'No cached orders available',
          data: [],
        };
      }
      // المتصفح: نحاول localStorage snapshot كطبقة أخيرة قبل الـ throw
      const snapshot = readOrdersSnapshot();
      if (snapshot.length > 0) {
        return {
          success: true,
          message: 'Loaded from browser local cache',
          data: snapshot as Order[],
        };
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
    clientOrderId?: string;  // ← يُمرَّر من handleCheckoutAndPrint للتطابق لاحقاً
    orderNumber?: number;
  }): Promise<ApiResponse<Order>> => {
    // If on Desktop, check if online before calling server
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        const offlineRes = await offlineStore.createOfflineOrder(payload);
        if (offlineRes.success && offlineRes.data) {
          saveOrdersSnapshot([offlineRes.data]);
          return {
            success: true,
            message: 'تم حفظ الطلب محلياً بنجاح (وضع غير متصل)',
            data: offlineRes.data,
          };
        }
      }
    }

    /** نستخدم الـ clientOrderId الممرَّر — أو نولّد جديد لو لم يُمرَّر */
    const clientOrderId =
      payload.clientOrderId ||
      `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { clientOrderId: _omit, ...serverBody } = payload as any;

    /** timeout 8 ثواني — كافٍ لـ Vercel cold start بدون تعطيل الـ UI (الـ UI أصبح optimistic) */
    const CREATE_ORDER_TIMEOUT_MS = 8000;

    try {
      const res = await ApiClient.request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({ ...serverBody, clientOrderId }),
        signal: AbortSignal.timeout(CREATE_ORDER_TIMEOUT_MS),
      });
      if (res.success && res.data) {
        saveOrdersSnapshot([res.data]);
        if (offlineStore.isDesktop()) {
          await offlineStore.cacheOrders([res.data]);
        }
      }
      return res;
    } catch (networkErr: any) {
      // Desktop: حفظ أوفلاين كامل عند أي خطأ شبكة
      if (offlineStore.isDesktop()) {
        const offlineRes = await offlineStore.createOfflineOrder({ ...serverBody, clientOrderId } as any);
        if (offlineRes.success && offlineRes.data) {
          saveOrdersSnapshot([offlineRes.data]);
          return {
            success: true,
            message: 'تم حفظ الطلب محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت',
            data: offlineRes.data,
          };
        }
      }
      // متصفح: رمي الخطأ — الـ caller (handleCheckoutAndPrint) قد حفظ الفاتورة optimistically
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
        if (offlineStore.isDesktop()) {
          const localItems = await offlineStore.getCachedInventory();
          return {
            ...res,
            data: mergeInventoryLists(res.data, localItems),
          };
        }
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

  createItem: async (data: {
    name: string;
    quantity?: number;
    unit: string;
    minLimit: number;
    costPrice?: number;
    totalCost?: number;
  }): Promise<ApiResponse<InventoryItem>> => {
    // أوفلاين: ننشئ الصنف محلياً فوراً ويُزامَن تلقائياً عند عودة الاتصال —
    // والسيرفر يمنع التكرار بنفس clientInventoryId لو أُعيد الإرسال.
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        const offlineRes = await offlineStore.createOfflineInventoryItem(data);
        if (offlineRes.success && offlineRes.data) {
          return {
            success: true,
            message: 'تم إنشاء الصنف محلياً بنجاح (وضع غير متصل)',
            data: offlineRes.data as InventoryItem,
          };
        }
      }
    }

    try {
      return await ApiClient.request<InventoryItem>('/inventory', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (networkErr) {
      // فشل الشبكة أثناء الإرسال: ننشئ الصنف محلياً بدل فقدان البيانات
      if (offlineStore.isDesktop()) {
        const offlineRes = await offlineStore.createOfflineInventoryItem(data);
        if (offlineRes.success && offlineRes.data) {
          return {
            success: true,
            message: 'تم إنشاء الصنف محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت',
            data: offlineRes.data as InventoryItem,
          };
        }
      }
      throw networkErr;
    }
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
      const res = await ApiClient.request<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (res.success && Array.isArray(res.data) && offlineStore.isDesktop()) {
        offlineStore.cacheEntities('expenses', res.data);
        if (!qs) {
          const localExpenses = await offlineStore.getOfflineExpenses();
          return {
            ...res,
            data: mergeExpenseLists(res.data, localExpenses),
          };
        }
      }
      return res;
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
  // F2: الفترة الزمنية اختيارية (from/to = أيام تجارية بتوقيت القاهرة على السيرفر) —
  // بدون params يبقى السلوك القديم الكامل (backward-compatible)
  getStats: (params?: { from?: string; to?: string }): Promise<ApiResponse<KPIStats>> => {
    const query = new URLSearchParams();
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return ApiClient.request<KPIStats>(`/analytics/stats${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getCharts: (params?: { from?: string; to?: string }): Promise<ApiResponse<ChartsData>> => {
    const query = new URLSearchParams();
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return ApiClient.request<ChartsData>(`/analytics/charts${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },
};