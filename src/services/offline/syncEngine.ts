import { offlineDb, PendingOperation } from './offlineDb';
import { ApiClient } from '../api/apiClient';
import { Category, Product, InventoryItem, Recipe, Order } from '../../types';

export const getDeviceId = (): string => {
  let id = localStorage.getItem('ef_device_id');
  if (!id) {
    id = 'POS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('ef_device_id', id);
  }
  return id;
};

export class SyncEngine {
  private static isSyncing = false;
  private static listeners: Array<(status: { isOnline: boolean; pendingCount: number }) => void> = [];
  private static isOnlineState = navigator.onLine;

  public static init() {
    window.addEventListener('online', () => {
      SyncEngine.isOnlineState = true;
      SyncEngine.notify();
      SyncEngine.syncPendingOperations();
      SyncEngine.refreshCatalogSnapshot();
    });

    window.addEventListener('offline', () => {
      SyncEngine.isOnlineState = false;
      SyncEngine.notify();
    });

    // Heartbeat check every 30 seconds
    setInterval(async () => {
      const live = await SyncEngine.checkConnectivity();
      if (live !== SyncEngine.isOnlineState) {
        SyncEngine.isOnlineState = live;
        SyncEngine.notify();
        if (live) {
          SyncEngine.syncPendingOperations();
        }
      }
    }, 30000);

    // Initial snapshot fetch if online
    if (navigator.onLine) {
      SyncEngine.refreshCatalogSnapshot().catch(() => {});
      SyncEngine.syncPendingOperations().catch(() => {});
    }
  }

  public static subscribe(listener: (status: { isOnline: boolean; pendingCount: number }) => void) {
    SyncEngine.listeners.push(listener);
    SyncEngine.notify();
    return () => {
      SyncEngine.listeners = SyncEngine.listeners.filter((l) => l !== listener);
    };
  }

  private static async notify() {
    const pendingCount = await offlineDb.pendingOperations
      .where('syncStatus')
      .equals('PENDING')
      .count();
    SyncEngine.listeners.forEach((fn) => fn({ isOnline: SyncEngine.isOnlineState, pendingCount }));
  }

  public static isOnline(): boolean {
    return SyncEngine.isOnlineState;
  }

  public static async checkConnectivity(): Promise<boolean> {
    try {
      const res = await fetch(`${ApiClient.getAccessToken() ? '' : ''}/`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      return res.ok || res.status === 404 || res.status === 401;
    } catch {
      return false;
    }
  }

  // Pull central cloud catalog into offline IndexedDB cache
  public static async refreshCatalogSnapshot(): Promise<void> {
    try {
      const res = await ApiClient.request<{
        categories: Category[];
        products: Product[];
        inventory: InventoryItem[];
        recipes: Recipe[];
      }>('/sync/pull-catalog', { method: 'GET' });

      if (res?.success && res.data) {
        await offlineDb.transaction('rw', [
          offlineDb.cachedCategories,
          offlineDb.cachedProducts,
          offlineDb.cachedInventory,
          offlineDb.cachedRecipes,
        ], async () => {
          await offlineDb.cachedCategories.clear();
          await offlineDb.cachedCategories.bulkPut(res.data.categories);

          await offlineDb.cachedProducts.clear();
          await offlineDb.cachedProducts.bulkPut(res.data.products);

          await offlineDb.cachedInventory.clear();
          await offlineDb.cachedInventory.bulkPut(res.data.inventory);

          await offlineDb.cachedRecipes.clear();
          await offlineDb.cachedRecipes.bulkPut(res.data.recipes);
        });
      }
    } catch (e) {
      console.warn('Could not refresh catalog snapshot (likely offline):', e);
    }
  }

  // Enqueue an offline mutation
  public static async enqueueOperation(
    type: 'CREATE_ORDER' | 'RESTOCK_INVENTORY' | 'CREATE_EXPENSE',
    payload: any
  ): Promise<string> {
    const deviceId = getDeviceId();
    const operationId = `${deviceId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const op: PendingOperation = {
      operationId,
      deviceId,
      operationType: type,
      payload,
      createdAt: new Date().toISOString(),
      syncStatus: 'PENDING',
      retryCount: 0,
    };

    await offlineDb.pendingOperations.add(op);
    SyncEngine.notify();

    // Trigger sync immediately if online
    if (SyncEngine.isOnlineState) {
      SyncEngine.syncPendingOperations().catch(() => {});
    }

    return operationId;
  }

  // Process batch of pending operations
  public static async syncPendingOperations(): Promise<void> {
    if (SyncEngine.isSyncing) return;
    SyncEngine.isSyncing = true;

    try {
      const pending = await offlineDb.pendingOperations
        .where('syncStatus')
        .equals('PENDING')
        .sortBy('id');

      if (pending.length === 0) {
        SyncEngine.isSyncing = false;
        SyncEngine.notify();
        return;
      }

      const res = await ApiClient.request<{ results: any[] }>('/sync/push', {
        method: 'POST',
        headers: {
          'X-Device-ID': getDeviceId(),
        },
        body: JSON.stringify({ operations: pending }),
      });

      if (res?.success && res.data?.results) {
        for (const item of res.data.results) {
          const op = pending.find((p) => p.operationId === item.operationId);
          if (op && op.id) {
            if (item.status === 'SUCCESS') {
              await offlineDb.pendingOperations.update(op.id, {
                syncStatus: 'SYNCED',
              });

              // If order, update offline order record with official central orderNumber
              if (op.operationType === 'CREATE_ORDER' && item.resultData?.orderNumber) {
                const offOrder = await offlineDb.offlineOrders
                  .where('orderNumber')
                  .equals(op.payload.offlineOrderNumber)
                  .first();
                if (offOrder) {
                  await offlineDb.offlineOrders.update(offOrder._id, {
                    orderNumber: item.resultData.orderNumber,
                  });
                }
              }
            } else {
              await offlineDb.pendingOperations.update(op.id, {
                syncStatus: 'FAILED',
                retryCount: (op.retryCount || 0) + 1,
                lastError: item.error || 'Server rejected operation',
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Sync attempt failed, will retry later:', err);
    } finally {
      SyncEngine.isSyncing = false;
      SyncEngine.notify();
    }
  }

  // Create order with offline-first support
  public static async createOrderOfflineFirst(payload: {
    items: { product: string; quantity: number }[];
    tableNumber: number;
    notes?: string;
  }): Promise<{ order: Order; isOffline: boolean }> {
    // If online, try cloud directly first
    if (SyncEngine.isOnlineState) {
      try {
        const res = await ApiClient.request<Order>('/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.success && res.data) {
          return { order: res.data, isOffline: false };
        }
      } catch (err) {
        console.warn('Cloud order creation failed, falling back to offline queue:', err);
      }
    }

    // Offline order generation
    const deviceId = getDeviceId();
    const offlineSeq = Date.now().toString().slice(-4);
    const offlineOrderNumber = `OFF-${deviceId.slice(-4)}-${offlineSeq}`;

    // Resolve item prices and names from cached products
    let totalAmount = 0;
    const processedItems: any[] = [];

    for (const it of payload.items) {
      const product = await offlineDb.cachedProducts.get(it.product);
      const price = product?.price || 0;
      totalAmount += price * it.quantity;
      processedItems.push({
        product: product || { _id: it.product, name: 'صنف محلي', price },
        quantity: it.quantity,
        price,
      });

      // Deduct local product stock cache
      if (product) {
        const newQty = Math.max(0, (product.stockQuantity || 0) - it.quantity);
        await offlineDb.cachedProducts.update(product._id, {
          stockQuantity: newQty,
          inStock: newQty > 0,
        });
      }
    }

    const cachedUser = JSON.parse(localStorage.getItem('ef_active_user') || '{}');

    const offlineOrder: Order = {
      _id: 'off_' + Math.random().toString(36).substring(2, 9),
      orderNumber: offlineOrderNumber,
      items: processedItems,
      totalAmount,
      tableNumber: payload.tableNumber,
      cashierId: cachedUser,
      status: 'completed' as any,
      notes: payload.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    await offlineDb.offlineOrders.put(offlineOrder);

    // Enqueue for cloud sync
    await SyncEngine.enqueueOperation('CREATE_ORDER', {
      ...payload,
      offlineOrderNumber,
    });

    return { order: offlineOrder, isOffline: true };
  }
}
