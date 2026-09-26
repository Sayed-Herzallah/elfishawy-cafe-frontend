import { ApiClient } from './api/apiClient';
import { Order, InventoryItem, Expense } from '../types';

const RECONCILE_LIST_TIMEOUT_MS = 15000;

const clientOrderIdOf = (row: any): string =>
  String(row?.clientOrderId || row?.client_order_id || '').trim();

const clientInventoryIdOf = (row: any): string =>
  String(row?.clientInventoryId || row?.client_inventory_id || '').trim();

/** بعد timeout/خطأ شبكة: هل السيرفر أنشأ الفاتورة فعلاً؟ */
export async function findServerOrderByClientId(clientOrderId: string): Promise<Order | null> {
  const cid = String(clientOrderId || '').trim();
  if (!cid) return null;
  try {
    const res = await ApiClient.request<Order[]>('/orders', {
      method: 'GET',
      signal: AbortSignal.timeout(RECONCILE_LIST_TIMEOUT_MS),
    });
    if (!res.success || !Array.isArray(res.data)) return null;
    return res.data.find((o) => clientOrderIdOf(o) === cid) || null;
  } catch {
    return null;
  }
}

export async function findServerInventoryByClientId(clientInventoryId: string): Promise<InventoryItem | null> {
  const cid = String(clientInventoryId || '').trim();
  if (!cid) return null;
  try {
    const res = await ApiClient.request<InventoryItem[]>('/inventory', {
      method: 'GET',
      signal: AbortSignal.timeout(RECONCILE_LIST_TIMEOUT_MS),
    });
    if (!res.success || !Array.isArray(res.data)) return null;
    return res.data.find((row) => clientInventoryIdOf(row) === cid) || null;
  } catch {
    return null;
  }
}

const clientExpenseIdOf = (row: any): string =>
  String(row?.clientExpenseId || row?.client_expense_id || '').trim();

/** بعد timeout/خطأ شبكة: هل السيرفر أنشأ المصروف فعلاً؟ */
export async function findServerExpenseByClientId(clientExpenseId: string): Promise<Expense | null> {
  const cid = String(clientExpenseId || '').trim();
  if (!cid) return null;
  try {
    const res = await ApiClient.request<Expense[]>('/expenses', {
      method: 'GET',
      signal: AbortSignal.timeout(RECONCILE_LIST_TIMEOUT_MS),
    });
    if (!res.success || !Array.isArray(res.data)) return null;
    return res.data.find((row) => clientExpenseIdOf(row) === cid) || null;
  } catch {
    return null;
  }
}
