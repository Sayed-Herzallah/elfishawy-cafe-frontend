// desktop/preload/preload.cjs — CommonJS required for preload with "type":"module" in package.json
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Connectivity & Health
  checkOnline: () => ipcRenderer.invoke('app:check-online'),
  onNetworkStatusChanged: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('network:status-change', handler);
    return () => ipcRenderer.removeListener('network:status-change', handler);
  },

  // Database operations
  query: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
  execute: (sql, params) => ipcRenderer.invoke('db:execute', { sql, params }),

  // Local Offline Operations
  createOfflineOrder: (orderData) => ipcRenderer.invoke('offline:create-order', orderData),
  getOfflineOrders: () => ipcRenderer.invoke('offline:get-orders'),
  createOfflineExpense: (expenseData) => ipcRenderer.invoke('offline:create-expense', expenseData),
  getOfflineExpenses: () => ipcRenderer.invoke('offline:get-expenses'),
  restockOfflineInventory: (data) => ipcRenderer.invoke('offline:restock-inventory', data),

  // Sync actions
  getSyncQueue: () => ipcRenderer.invoke('sync:get-queue'),
  triggerSync: () => ipcRenderer.invoke('sync:trigger'),
  syncEntityCache: (entityType, records) => ipcRenderer.invoke('sync:cache-entities', { entityType, records }),
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },

  // Offline Auth caching
  setAuthToken: (token) => ipcRenderer.invoke('auth:set-token', token),
  cacheUserCredentials: (user, password, token) => ipcRenderer.invoke('auth:cache-user', { user, password, token }),
  verifyOfflineLogin: (email, password) => ipcRenderer.invoke('auth:verify-offline', { email, password }),

  // Frontend Hot-Update
  getFrontendVersion: () => ipcRenderer.invoke('frontend:get-version'),
  checkFrontendUpdate: () => ipcRenderer.invoke('frontend:check-update'),
  applyFrontendUpdate: () => ipcRenderer.invoke('frontend:apply-update'),
  onFrontendUpdateReady: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('frontend:update-ready', handler);
    return () => ipcRenderer.removeListener('frontend:update-ready', handler);
  },

  // 🖨️ الطباعة الصامتة — بدون Print Dialog
  getPrinters: () => ipcRenderer.invoke('print:get-printers'),
  silentPrint: (html, printerName) => ipcRenderer.invoke('print:silent', { html, printerName }),
});
