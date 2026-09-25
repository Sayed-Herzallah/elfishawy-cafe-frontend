// src/types/electron.d.ts
export interface ElectronAPI {
  isElectron: boolean;
  checkOnline: () => Promise<boolean>;
  onNetworkStatusChanged: (callback: (status: boolean) => void) => () => void;
  query: (sql: string, params?: any[]) => Promise<any[]>;
  execute: (sql: string, params?: any[]) => Promise<{ success: boolean }>;
  createOfflineOrder: (orderData: any) => Promise<{ success: boolean; data?: any; message?: string }>;
  getOfflineOrders: () => Promise<any[]>;
  createOfflineExpense: (expenseData: any) => Promise<{ success: boolean; data?: any; message?: string }>;
  getOfflineExpenses: () => Promise<any[]>;
  restockOfflineInventory: (data: any) => Promise<{ success: boolean; message?: string }>;
  createOfflineInventoryItem: (itemData: any) => Promise<{ success: boolean; data?: any; message?: string }>;
  getSyncQueue: () => Promise<any[]>;
  triggerSync: () => Promise<{ success: boolean; count?: number; error?: string }>;
  syncEntityCache: (entityType: 'products' | 'categories' | 'inventory' | 'recipes' | 'orders' | 'expenses', records: any[]) => Promise<{ success: boolean }>;
  onSyncProgress: (callback: (data: any) => void) => () => void;
  onDataUpdated?: (callback: (data: { orders?: boolean; inventory?: boolean; expenses?: boolean; entity?: string }) => void) => () => void;
  setAuthToken: (token: string) => Promise<{ success: boolean }>;
  cacheUserCredentials: (user: any, password?: string, token?: string) => Promise<{ success: boolean }>;
  verifyOfflineLogin: (email: string, password?: string) => Promise<{ success: boolean; user?: any; token?: string; message?: string }>;
  getFrontendVersion: () => Promise<{ version: string; buildDate?: string; activatedAt?: string }>;
  checkFrontendUpdate: () => Promise<{ hasUpdate: boolean; version?: string; ready?: boolean }>;
  applyFrontendUpdate: () => Promise<boolean>;
  onFrontendUpdateReady: (callback: (data: { version: string; message: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
