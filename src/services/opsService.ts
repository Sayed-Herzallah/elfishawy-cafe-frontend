import { ApiClient } from './api/apiClient';
import { ApiResponse, Order, InventoryItem, Expense, KPIStats, ChartsData, OrderStatus } from '../types';
import { offlineStore } from './data/offlineStore';
import { mergeOrderLists } from '../utils/orderDisplay';
import { saveOrdersSnapshot, readOrdersSnapshot } from '../utils/ordersCache';
import { isStockLow } from '../utils/stockStatus';
import { getBusinessDayKey } from '../utils/businessDay';
import {
  findServerExpenseByClientId,
  findServerInventoryByClientId,
  findServerOrderByClientId,
  isTimeoutLikeError,
} from './orderReconcile';

const ORDERS_FETCH_TIMEOUT_MS = 8000;

const isPendingSync = (row: any): boolean => {
  const status = String(row?.syncStatus || row?.sync_status || '').toUpperCase();
  return status === 'PENDING_SYNC' || status === 'PENDING';
};

const isInvoiceNumber = (value: unknown): boolean => /^\d{1,6}$/.test(String(value ?? '').trim());
const localInventoryDraftKey = 'ef_inventory_pending_drafts';

const syncBrowserInventoryDrafts = async (): Promise<void> => {
  if (offlineStore.isDesktop() || typeof localStorage === 'undefined' || !(await offlineStore.isOnline())) return;
  let drafts: any[];
  try {
    const raw = localStorage.getItem(localInventoryDraftKey);
    drafts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(drafts) || drafts.length === 0) return;
  } catch {
    return;
  }

  const remaining: any[] = [];
  for (const draft of drafts) {
    try {
      const res = await ApiClient.request<InventoryItem>('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          quantity: draft.quantity,
          unit: draft.unit,
          minLimit: draft.minLimit,
          totalCost: draft.totalCost,
          clientInventoryId: draft.clientInventoryId,
        }),
      });
      if (!res.success || !res.data) throw new Error('Inventory draft sync was not confirmed');
      const rawCache = localStorage.getItem('ef_inventory_cache');
      const cache = rawCache ? JSON.parse(rawCache) : [];
      localStorage.setItem('ef_inventory_cache', JSON.stringify(mergeInventoryLists([res.data], Array.isArray(cache) ? cache : [])));
    } catch {
      remaining.push(draft);
    }
  }
  try {
    if (remaining.length) localStorage.setItem(localInventoryDraftKey, JSON.stringify(remaining));
    else localStorage.removeItem(localInventoryDraftKey);
  } catch { /* best effort */ }
};

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
    const key = keyOf(row);
    if (!key) continue;
    // إضافة العناصر المحلية الجديدة (PENDING_SYNC أو عناصر SQLite) إن لم تكن أضيفت
    if (!byKey.has(key)) {
      byKey.set(key, row as InventoryItem);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
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
    const key = keyOf(row);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, row as Expense);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
  );
};

/**
 * حفظ فاتورة كـ "قيد المزامنة" محلياً في المتصفح (لقطة localStorage).
 * تُستخدم بعد timeout: الطلب راح السيرفر بس الرد مبيوصلش، فبنخزّنه بنفس الـ
 * clientOrderId بدل ما نرمي الخطأ ونخلّي الكاشير يبيع تاني → فاتورتين لنفس الطلب.
 * الفاتورة تظهر للعرض كـ PENDING_SYNC (رقم مؤقت) لحد ما تتأكد من السيرفر.
 */
const saveOrderAsLocallyPending = async (
  serverBody: Record<string, unknown>,
  clientOrderId: string
): Promise<Order | null> => {
  try {
    const now = new Date().toISOString();
    const items = Array.isArray(serverBody.items) ? serverBody.items : [];
    const totalAmount = items.reduce((sum: number, it: any) => {
      return sum + (Number(it?.price) || 0) * (Number(it?.quantity) || 0);
    }, 0);

    const pending = {
      _id: clientOrderId,
      clientOrderId,
      orderNumber: '',
      items,
      totalAmount,
      status: 'completed',
      tableNumber: serverBody.tableNumber,
      notes: serverBody.notes || '',
      syncStatus: 'PENDING_SYNC',
      createdAt: now,
      updatedAt: now,
    } as unknown as Order;

    saveOrdersSnapshot([pending]);
    return pending;
  } catch {
    /* التخزين تحسيني — لو فشل نرجع null فيتصرف الـ caller زي ما كان */
    return null;
  }
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
    clientOrderId?: string;
    orderNumber?: number;
    /** POS Desktop: الصف + الرقم المؤقت + خصم المخزون تمّ محلياً مسبقاً */
    localPrepared?: boolean;
  }): Promise<ApiResponse<Order>> => {
    const clientOrderId =
      payload.clientOrderId ||
      `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const localPrepared = Boolean(payload.localPrepared);
    const { clientOrderId: _omit, localPrepared: _lp, ...serverBody } = payload as any;

    const finishLocalPending = async (message: string): Promise<ApiResponse<Order>> => {
      const local = await offlineStore.getLocalOrderByClientId(clientOrderId);
      if (local) {
        saveOrdersSnapshot([local]);
        return { success: true, message, data: local as Order };
      }
      const offlineRes = await offlineStore.createOfflineOrder({ ...serverBody, clientOrderId });
      if (offlineRes.success && offlineRes.data) {
        saveOrdersSnapshot([offlineRes.data]);
        return {
          success: true,
          message,
          data: offlineRes.data,
        };
      }
      throw new Error(offlineRes.message || 'Failed to save order locally');
    };

    const applyServerOrder = async (serverOrder: Order, message?: string): Promise<ApiResponse<Order>> => {
      if (offlineStore.isDesktop()) {
        await offlineStore.reconcileSyncedOrder(clientOrderId, serverOrder);
        await offlineStore.cacheOrders([serverOrder]);
      }
      saveOrdersSnapshot([serverOrder]);
      return {
        success: true,
        message: message || 'Order created',
        data: serverOrder,
      };
    };

    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();

      if (!localPrepared && !isOnline) {
        return finishLocalPending('تم حفظ الطلب محلياً بنجاح (وضع غير متصل)');
      }

      if (localPrepared && !isOnline) {
        return finishLocalPending('تم حفظ الطلب محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت');
      }

      const CREATE_ORDER_TIMEOUT_MS = 20000;
      try {
        const res = await ApiClient.request<Order>('/orders', {
          method: 'POST',
          body: JSON.stringify({ ...serverBody, clientOrderId }),
          signal: AbortSignal.timeout(CREATE_ORDER_TIMEOUT_MS),
        });
        if (res.success && res.data) {
          return applyServerOrder(res.data);
        }
        return res;
      } catch (networkErr: any) {
        const reconciled = await findServerOrderByClientId(clientOrderId);
        if (reconciled) {
          return applyServerOrder(
            reconciled,
            'تم تأكيد الطلب على السيرفر بعد التحقق (بدون تكرار محلي)'
          );
        }
        if (localPrepared) {
          return finishLocalPending(
            'تم حفظ الطلب محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت'
          );
        }
        return finishLocalPending(
          'تم حفظ الطلب محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت'
        );
      }
    }

    // ⏱️ مهلة الإرسال: 20 ثانية (كانت 8).
    // السبب: السيرفر بيحتاج وقت لخصم المخزون والوصفات قبل ما يرد. Timeout قصير
    // كان بيخلّي الواجهة ترمي خطأ والعميل ماعرفش إن الفاتورة اتعملت → الكاشير
    // بيعيد البيع → فاتورتين. دلوقتي: مهلة أطول + التحقق والمطابقة قبل الخطأ.
    const CREATE_ORDER_TIMEOUT_MS = 20000;
    try {
      const res = await ApiClient.request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({ ...serverBody, clientOrderId }),
        signal: AbortSignal.timeout(CREATE_ORDER_TIMEOUT_MS),
      });
      if (res.success && res.data) {
        if (isInvoiceNumber(res.data.orderNumber)) {
          saveOrdersSnapshot([res.data]);
          return res;
        }
        const reconciled = await findServerOrderByClientId(clientOrderId);
        if (reconciled && isInvoiceNumber(reconciled.orderNumber)) {
          saveOrdersSnapshot([reconciled]);
          return { ...res, data: reconciled };
        }
        throw new Error('لم يؤكد السيرفر رقم فاتورة صالحاً. تحقّق من سجل الطلبات قبل تكرار البيع.');
      }
      return res;
    } catch (networkErr: any) {
      const reconciled = await findServerOrderByClientId(clientOrderId);
      if (reconciled) {
        saveOrdersSnapshot([reconciled]);
        return {
          success: true,
          message: 'تم تأكيد الطلب على السيرفر بعد التحقق',
          data: reconciled,
        };
      }
      // ⚠️ لو الـ timeout حصل وما لقيتناشش: نعتبرها "غير مؤكدة" مش "فاشلة".
      // رمي الخطأ هنا كان بيخلّي الكاشير يبيع تاني → فاتورتين لنفس الطلب.
      // بنخزّنها كـ pending بنفس الـ clientOrderId فيبقى الترقيم والتزامن آمن،
      // والمزامنة الجاية هترجع الفاتورة نفسها (idempotent) مش نسخة تانية.
      if (isTimeoutLikeError(networkErr)) {
        const pending = await saveOrderAsLocallyPending(serverBody, clientOrderId);
        if (pending) {
          return {
            success: true,
            message: 'تم حفظ الفاتورة محلياً وسيتم تأكيدها على السيرفر عند ثبات الاتصال',
            data: pending,
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
    if (!qs) await syncBrowserInventoryDrafts();

    // 1) فحص وضع عدم الاتصال في الديسكتوب — عودة فورية من SQLite بدون انتظار timeout
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        let cached = await offlineStore.getCachedInventory();
        if (params?.search) {
          const q = params.search.toLowerCase();
          cached = cached.filter((i: any) => i.name?.toLowerCase().includes(q));
        }
        if (params?.lowStock) {
          cached = cached.filter((i: any) => isStockLow(i.quantity, i.minLimit));
        }
        return { success: true, message: 'Loaded from local offline database', data: cached };
      }
    }

    try {
      const res = await ApiClient.request<InventoryItem[]>(`/inventory${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (res.success && Array.isArray(res.data) && !qs) {
        if (!offlineStore.isDesktop()) {
          try {
            const raw = localStorage.getItem('ef_inventory_cache');
            const cached = raw ? JSON.parse(raw) : [];
            const pending = Array.isArray(cached)
              ? cached.filter((item: any) => String(item.syncStatus || '').toUpperCase() === 'PENDING_SYNC')
              : [];
            localStorage.setItem('ef_inventory_cache', JSON.stringify(mergeInventoryLists(res.data, pending)));
          } catch { /* تجاهل */ }
        }
        await offlineStore.cacheEntities('inventory', res.data);
        if (offlineStore.isDesktop()) {
          const localItems = await offlineStore.getCachedInventory();
          // دمج ذكي: الأصناف المحلية التي لديها PENDING_SYNC (توريد أوفلاين أو إضافة أوفلاين)
          // تحل محل أو تُضاف إلى بيانات السيرفر لحين اكتمال المزامنة
          const pendingMap = new Map<string, any>();
          for (const li of localItems) {
            if (String(li.syncStatus || li.sync_status || '').toUpperCase() === 'PENDING_SYNC') {
              const cid = String(li.clientInventoryId || li.client_inventory_id || '');
              const lid = String(li._id || '');
              if (lid) pendingMap.set(lid, li);
              if (cid) pendingMap.set(cid, li);
            }
          }
          const mergedData = res.data.map((si: any) => {
            const sid = String(si._id || '');
            const scid = String(si.clientInventoryId || '');
            const local = pendingMap.get(sid) || (scid ? pendingMap.get(scid) : undefined);
            if (local) {
              pendingMap.delete(sid);
              if (scid) pendingMap.delete(scid);
              return { ...si, ...local, quantity: local.quantity, costPrice: local.costPrice || si.costPrice };
            }
            return si;
          });
          for (const remainingLocal of pendingMap.values()) {
            mergedData.push(remainingLocal);
          }
          return {
            ...res,
            data: mergedData as InventoryItem[],
          };
        }
      }
      return res;
    } catch (err) {
      if (offlineStore.isDesktop()) {
        // أوفلاين ديسكتوب: نرجع كل ما في SQLite (SYNCED من السيرفر + PENDING_SYNC جديدة)
        const cached = await offlineStore.getCachedInventory();
        if (cached && cached.length > 0) {
          return { success: true, message: 'Loaded from local offline database', data: cached };
        }
      } else {
        // ✅ أوفلاين متصفح: نقرأ من localStorage كاش
        try {
          const raw = localStorage.getItem('ef_inventory_cache');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return { success: true, message: 'Loaded from browser local cache', data: parsed as InventoryItem[] };
            }
          }
        } catch { /* تجاهل */ }
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
    clientInventoryId?: string;
    localPrepared?: boolean;
  }): Promise<ApiResponse<InventoryItem>> => {
    const clientInventoryId =
      data.clientInventoryId ||
      `off_inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const localPrepared = Boolean(data.localPrepared);
    const { localPrepared: _lp, clientInventoryId: _cid, ...serverBody } = data;

    const finishLocalInventory = async (message: string): Promise<ApiResponse<InventoryItem>> => {
      const offlineRes = await offlineStore.createOfflineInventoryItem({
        ...serverBody,
        clientInventoryId,
      });
      if (offlineRes.success && offlineRes.data) {
        return {
          success: true,
          message,
          data: offlineRes.data as InventoryItem,
        };
      }
      throw new Error(offlineRes.message || 'Failed to create inventory item locally');
    };

    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!localPrepared && !isOnline) {
        return finishLocalInventory('تم إنشاء الصنف محلياً بنجاح (وضع غير متصل)');
      }
      if (localPrepared && !isOnline) {
        return finishLocalInventory('تم إنشاء الصنف محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت');
      }

      try {
        const res = await ApiClient.request<InventoryItem>('/inventory', {
          method: 'POST',
          body: JSON.stringify({ ...serverBody, clientInventoryId }),
        });
        if (res.success && res.data) {
          await offlineStore.cacheEntities('inventory', [res.data]);
        }
        return res;
      } catch (networkErr) {
        const reconciled = await findServerInventoryByClientId(clientInventoryId);
        if (reconciled) {
          offlineStore.cacheEntities('inventory', [reconciled]);
          return {
            success: true,
            message: 'تم تأكيد الصنف على السيرفر بعد التحقق',
            data: reconciled,
          };
        }
        if (localPrepared) {
          return finishLocalInventory(
            'تم إنشاء الصنف محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت'
          );
        }
        return finishLocalInventory(
          'تم إنشاء الصنف محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت'
        );
      }
    }

    // Browser offline mode: keep the new item visible and retryable in a local draft.
    if (!(await offlineStore.isOnline())) {
      const pending: InventoryItem = {
        _id: clientInventoryId,
        clientInventoryId,
        name: String(serverBody.name || '').trim(),
        quantity: Number(serverBody.quantity) || 0,
        unit: String(serverBody.unit || 'KG'),
        minLimit: Number(serverBody.minLimit) || 5,
        costPrice: Number(serverBody.quantity) > 0
          ? Number(((Number(serverBody.totalCost) || 0) / Number(serverBody.quantity)).toFixed(2))
          : Number((serverBody as any).costPrice) || 0,
        syncStatus: 'PENDING_SYNC',
        isOffline: true,
      } as InventoryItem;
      try {
        const raw = localStorage.getItem('ef_inventory_cache');
        const cached = raw ? JSON.parse(raw) : [];
        const merged = mergeInventoryLists(Array.isArray(cached) ? cached : [], [pending]);
        localStorage.setItem('ef_inventory_cache', JSON.stringify(merged));
        const rawDrafts = localStorage.getItem(localInventoryDraftKey);
        const drafts = rawDrafts ? JSON.parse(rawDrafts) : [];
        const safeDrafts = Array.isArray(drafts) ? drafts : [];
        if (!safeDrafts.some((draft: any) => draft.clientInventoryId === clientInventoryId)) {
          safeDrafts.push({ ...serverBody, clientInventoryId });
        }
        localStorage.setItem(localInventoryDraftKey, JSON.stringify(safeDrafts));
      } catch { /* storage is best-effort */ }
      return {
        success: true,
        message: 'تم حفظ الصنف في هذا المتصفح محلياً، وسيتطلب اتصالاً لإرساله إلى الخادم',
        data: pending,
      };
    }

    try {
      const res = await ApiClient.request<InventoryItem>('/inventory', {
        method: 'POST',
        body: JSON.stringify({ ...serverBody, clientInventoryId }),
      });
      if (res.success && res.data) {
        try {
          const raw = localStorage.getItem('ef_inventory_cache');
          const cached = raw ? JSON.parse(raw) : [];
          localStorage.setItem('ef_inventory_cache', JSON.stringify(mergeInventoryLists([res.data], Array.isArray(cached) ? cached : [])));
        } catch { /* cache is best-effort */ }
      }
      return res;
    } catch (networkErr) {
      const reconciled = await findServerInventoryByClientId(clientInventoryId);
      if (reconciled) {
        return {
          success: true,
          message: 'تم تأكيد الصنف على السيرفر بعد التحقق',
          data: reconciled,
        };
      }
      throw networkErr;
    }
  },

  restockItem: async (id: string, quantity: number, costPrice?: number, totalCost?: number, operationId?: string): Promise<ApiResponse<InventoryItem>> => {
    const clientRestockId = operationId || `off_rstk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const restockLocal = async (): Promise<InventoryItem | null> => {
      try {
        const res = await offlineStore.restockOfflineInventory({ id, quantity, costPrice, totalCost, clientRestockId });
        if (res?.success) {
          const items = await offlineStore.getCachedInventory();
          return items.find((i: any) => String(i._id) === String(id) || String(i.clientInventoryId) === String(id)) || null;
        }
        return null;
      } catch {
        return null;
      }
    };

    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!isOnline) {
        const updatedItem = await restockLocal();
        if (updatedItem) {
          return {
            success: true,
            message: 'تم توريد الكمية محلياً وسيتم المزامنة عند عودة الاتصال',
            data: updatedItem,
          };
        }
        return {
          success: false,
          message:
            'تعذّر إضافة الكمية للمخزن المحلي. تأكد أن الصنف متاح في المخزن المحلي ثم أعد المحاولة.',
        };
      }
    }

    try {
      const res = await ApiClient.request<InventoryItem>(`/inventory/${id}/restock`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity, costPrice, totalCost, clientRestockId }),
      });
      if (res.success && res.data && offlineStore.isDesktop()) {
        await offlineStore.cacheEntities('inventory', [res.data]);
      }
      return res;
    } catch (networkErr) {
      if (offlineStore.isDesktop()) {
        const updatedItem = await restockLocal();
        if (updatedItem) {
          return {
            success: true,
            message: 'تم توريد الكمية محلياً وسيتم المزامنة عند عودة الاتصال',
            data: updatedItem,
          };
        }
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

    // فحص وضع عدم الاتصال في الديسكتوب — عودة فورية من SQLite
    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      const localExpenses = await offlineStore.getOfflineExpenses();
      if (!isOnline) {
        const filtered = params?.category
          ? localExpenses.filter((e: any) => e.category === params.category)
          : localExpenses;
        const merged = params?.searchDate
          ? filtered.filter((e: any) => getBusinessDayKey(String(e.date || e.createdAt || '')) === getBusinessDayKey(params.searchDate!))
          : filtered;
        return { success: true, message: 'Loaded from local offline database', data: merged };
      }
    }

    if (!offlineStore.isDesktop()) await syncBrowserInventoryDrafts();

    try {
      const res = await ApiClient.request<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (res.success && Array.isArray(res.data)) {
        // ✅ كاش المتصفح: حفظ القائمة في localStorage لاستخدامها أوفلاين
        if (!qs && !offlineStore.isDesktop()) {
          try { localStorage.setItem('ef_expenses_cache', JSON.stringify(res.data)); } catch { /* تجاهل */ }
        }
        if (offlineStore.isDesktop()) {
          // ✅ await: يضمن حفظ كل فواتير السيرفر في SQLite قبل أي انقطاع للشبكة
          await offlineStore.cacheEntities('expenses', res.data);
          if (!qs) {
            const localExpenses = await offlineStore.getOfflineExpenses();
            // Only add pending operations that have not arrived from the server.
            // A local row already represented by either its server id or client id
            // must not inflate the purchases count after reconciliation.
            const serverIds = new Set<string>();
            for (const expense of res.data as any[]) {
              const serverId = String(expense?._id || '');
              const clientId = String(expense?.clientExpenseId || expense?.client_expense_id || '');
              if (serverId) serverIds.add(serverId);
              if (clientId) serverIds.add(clientId);
            }
            const pendingOnly = localExpenses.filter((expense: any) => {
              const status = String(expense?.syncStatus || expense?.sync_status || '').toUpperCase();
              const clientId = String(expense?.clientExpenseId || expense?.client_expense_id || '');
              const localId = String(expense?._id || '');
              return status === 'PENDING_SYNC' && !serverIds.has(clientId) && !serverIds.has(localId);
            });
            const merged = mergeExpenseLists(res.data, pendingOnly);
            return { ...res, data: merged };
          }
        }
      }
      return res;
    } catch (err) {
      if (offlineStore.isDesktop()) {
        const localExpenses = await offlineStore.getOfflineExpenses();
        let filtered = params?.category
          ? localExpenses.filter((e: any) => e.category === params.category)
          : localExpenses;
        if (params?.searchDate) {
          const targetDay = getBusinessDayKey(params.searchDate);
          filtered = filtered.filter((e: any) =>
            getBusinessDayKey(String(e.date || e.createdAt || '')) === targetDay
          );
        }
        return { success: true, message: 'Loaded from local offline database', data: filtered };
      }
      // ✅ المتصفح أوفلاين: كاش localStorage كطبقة أخيرة
      if (!offlineStore.isDesktop()) {
        try {
          const cached = localStorage.getItem('ef_expenses_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return { success: true, message: 'Loaded from browser local cache', data: parsed as Expense[] };
            }
          }
        } catch { /* تجاهل */ }
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
    clientExpenseId?: string;
    localPrepared?: boolean;
  }): Promise<ApiResponse<Expense>> => {
    const clientExpenseId =
      data.clientExpenseId ||
      `off_exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const localPrepared = Boolean(data.localPrepared);
    const { clientExpenseId: _cid, localPrepared: _lp, ...serverBody } = data;

    const finishLocalExpense = async (message: string): Promise<ApiResponse<Expense>> => {
      const existing = await offlineStore.getLocalExpenseByClientId(clientExpenseId);
      if (existing) {
        return { success: true, message, data: existing as Expense };
      }
      const offlineRes = await offlineStore.createOfflineExpense({ ...serverBody, clientExpenseId });
      if (offlineRes.success && offlineRes.data) {
        return {
          success: true,
          message,
          data: offlineRes.data,
        };
      }
      throw new Error(offlineRes.message || 'Failed to save expense locally');
    };

    const applyServerExpense = async (serverExpense: Expense, message?: string): Promise<ApiResponse<Expense>> => {
      if (offlineStore.isDesktop()) {
        await offlineStore.cacheEntities('expenses', [serverExpense]);
      }
      return {
        success: true,
        message: message || 'Expense created',
        data: serverExpense,
      };
    };

    if (offlineStore.isDesktop()) {
      const isOnline = await offlineStore.isOnline();
      if (!localPrepared && !isOnline) {
        return finishLocalExpense('تم تسجيل المصروف/التوريد محلياً بنجاح (وضع غير متصل)');
      }
      if (localPrepared && !isOnline) {
        return finishLocalExpense('تم تسجيل المصروف/التوريد محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت');
      }

      try {
        const res = await ApiClient.request<Expense>('/expenses', {
          method: 'POST',
          body: JSON.stringify({ ...serverBody, clientExpenseId }),
        });
        if (res.success && res.data) {
          return applyServerExpense({ ...res.data, clientExpenseId: (res.data as any).clientExpenseId || clientExpenseId });
        }
        return res;
      } catch (networkErr) {
        const reconciled = await findServerExpenseByClientId(clientExpenseId);
        if (reconciled) {
          return applyServerExpense(
            reconciled,
            'تم تأكيد المصروف على السيرفر بعد التحقق (بدون تكرار محلي)'
          );
        }
        if (localPrepared) {
          return finishLocalExpense(
            'تم تسجيل المصروف/التوريد محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت'
          );
        }
        return finishLocalExpense(
          'تم تسجيل المصروف/التوريد محلياً وسيتم مزامنته تلقائياً عند عودة الإنترنت'
        );
      }
    }

    try {
      const res = await ApiClient.request<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...serverBody, clientExpenseId }),
      });
      if (res.success && res.data) {
        return applyServerExpense({ ...res.data, clientExpenseId: (res.data as any).clientExpenseId || clientExpenseId });
      }
      return res;
    } catch (networkErr) {
      const reconciled = await findServerExpenseByClientId(clientExpenseId);
      if (reconciled) {
        return {
          success: true,
          message: 'تم تأكيد المصروف على السيرفر بعد التحقق',
          data: reconciled,
        };
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
