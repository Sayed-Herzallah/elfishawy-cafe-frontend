import { ApiClient } from './api/apiClient';
import { Order, InventoryItem, Expense } from '../types';

const RECONCILE_LIST_TIMEOUT_MS = 15000;

const clientOrderIdOf = (row: any): string =>
  String(row?.clientOrderId || row?.client_order_id || '').trim();

const clientInventoryIdOf = (row: any): string =>
  String(row?.clientInventoryId || row?.client_inventory_id || '').trim();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * هل انقطع الاتصال فعلاً، ولا الطلب لسه شغال على السيرفر والرد بس اتأخر؟
 * الـ timeout بيقطع عندنا بس مش عند السيرفر — فالسيرفر ممكن يكون لسه بينشئ
 * الفاتورة. في الحالة دي نعتبرها "مش مؤكدة" مش "فاشلة".
 */
export const isTimeoutLikeError = (err: any): boolean => {
  const name = String(err?.name || '');
  const code = String(err?.code || err?.errno || '');
  return (
    name === 'TimeoutError' ||
    code === '23' ||
    /timeout|aborted|ETIMEDOUT|ECONNRESET/i.test(String(err?.message || ''))
  );
};

/** استعلام السيرفر عن فاتورة واحدة بمعرّفها (أخف من جلب كل الفواتير) */
async function fetchServerOrderOnce(clientOrderId: string): Promise<Order | null> {
  try {
    const res = await ApiClient.request<Order[]>('/orders', {
      method: 'GET',
      signal: AbortSignal.timeout(RECONCILE_LIST_TIMEOUT_MS),
    });
    if (!res.success || !Array.isArray(res.data)) return null;
    return res.data.find((o) => clientOrderIdOf(o) === clientOrderId) || null;
  } catch {
    return null;
  }
}

/**
 * بعد timeout/خطأ شبكة: هل السيرفر أنشأ الفاتورة فعلاً؟
 * بنحاول استعلام واحد، ولو طلع timeout بنستنى ونجرب تاني (٣ محاولات إجمالاً)
 * عشان نتجنب إعلان الفشل على فاتورة السيرفر بيعملها في نفس اللحظة.
 */
export async function findServerOrderByClientId(clientOrderId: string): Promise<Order | null> {
  const cid = String(clientOrderId || '').trim();
  if (!cid) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await fetchServerOrderOnce(cid);
    if (found) return found;
    // ما لقيتهاش → استنى شوية وجرب تاني (الفرق ممكن يكون ثواني)
    await sleep(1500 * (attempt + 1));
  }
  return null;
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
