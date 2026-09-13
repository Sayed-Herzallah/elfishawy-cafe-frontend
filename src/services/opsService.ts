import { ApiClient } from './api/apiClient';
import { ApiResponse, Order, InventoryItem, Expense, KPIStats, ChartsData, OrderStatus } from '../types';

export const orderService = {
  getOrders: (params?: { status?: string; searchDate?: string; cashierId?: string }): Promise<ApiResponse<Order[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.searchDate) query.append('searchDate', params.searchDate);
    if (params?.cashierId) query.append('cashierId', params.cashierId);
    const qs = query.toString();
    return ApiClient.request<Order[]>(`/orders${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getOrder: (id: string): Promise<ApiResponse<Order>> => {
    return ApiClient.request<Order>(`/orders/${id}`, { method: 'GET' });
  },

  createOrder: (payload: {
    items: { product: string; quantity: number }[];
    tableNumber: number;
    notes?: string;
  }): Promise<ApiResponse<Order>> => {
    return ApiClient.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
  listInventory: (params?: { search?: string; lowStock?: boolean }): Promise<ApiResponse<InventoryItem[]>> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.lowStock !== undefined) query.append('lowStock', String(params.lowStock));
    const qs = query.toString();
    return ApiClient.request<InventoryItem[]>(`/inventory${qs ? `?${qs}` : ''}`, { method: 'GET' });
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

  restockItem: (id: string, quantity: number, costPrice?: number): Promise<ApiResponse<InventoryItem>> => {
    return ApiClient.request<InventoryItem>(`/inventory/${id}/restock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity, costPrice }),
    });
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
  listExpenses: (params?: { category?: string; searchDate?: string }): Promise<ApiResponse<Expense[]>> => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.searchDate) query.append('searchDate', params.searchDate);
    const qs = query.toString();
    return ApiClient.request<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  createExpense: (data: {
    description: string;
    amount: number;
    category: 'rent' | 'salaries' | 'utilities' | 'inventory' | 'other';
    inventoryItemLinked?: string;
    inventoryQuantityAdded?: number;
    totalCost?: number;
    unitCost?: number;
    date?: string;
  }): Promise<ApiResponse<Expense>> => {
    return ApiClient.request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
