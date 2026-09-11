import Dexie, { Table } from 'dexie';
import { Category, Product, InventoryItem, Recipe, Order } from '../../types';

export interface PendingOperation {
  id?: number;
  operationId: string;
  deviceId: string;
  operationType: 'CREATE_ORDER' | 'RESTOCK_INVENTORY' | 'CREATE_EXPENSE';
  payload: any;
  createdAt: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

export interface CachedAuthUser {
  id: string; // 'active_user'
  user: any;
  passwordHash?: string;
  savedAt: string;
}

export class PosOfflineDatabase extends Dexie {
  cachedProducts!: Table<Product, string>;
  cachedCategories!: Table<Category, string>;
  cachedInventory!: Table<InventoryItem, string>;
  cachedRecipes!: Table<Recipe, string>;
  pendingOperations!: Table<PendingOperation, number>;
  offlineOrders!: Table<Order, string>;
  cachedAuth!: Table<CachedAuthUser, string>;

  constructor() {
    super('ElfishawyPosOfflineDB');
    this.version(1).stores({
      cachedProducts: '_id, name, category, inStock',
      cachedCategories: '_id, name',
      cachedInventory: '_id, name',
      cachedRecipes: '_id, product',
      pendingOperations: '++id, operationId, operationType, syncStatus, createdAt',
      offlineOrders: '_id, orderNumber, status, cashierId, createdAt',
      cachedAuth: 'id',
    });
  }
}

export const offlineDb = new PosOfflineDatabase();
