/**
 * 📝 سجل العجز اللحظي للفواتير (Order Shortages Journal)
 * يتم دعم طريقتين متكاملتين لضمان عملها محلياً وعبر السيرفر والسحاب (Vercel):
 * 1) من الـ notes المخزنة في قاعدة البيانات مع الفاتورة: [عجز: سكر، لبن]
 * 2) من الـ localStorage كـ backup سريع محلياً
 */

const SHORTAGE_STORAGE_KEY = 'elfishawy_order_shortages_v1';
const MAX_RECORDS = 500;

type ShortageMap = Record<string, string[]>;

/** استخراج العجز المسجل داخل ملاحظات الفاتورة من السيرفر: [عجز: سكر طبيعي] */
export function extractShortagesFromNotes(notes?: string): string[] {
  if (!notes || typeof notes !== 'string') return [];
  const match = notes.match(/\[عجز:\s*([^\]]+)\]/);
  if (!match || !match[1]) return [];
  return match[1]
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** دمج وسوم العجز داخل الملاحظات لإرسالها للسيرفر */
export function appendShortagesToNotes(originalNotes: string | undefined, shortages: string[]): string {
  const cleanOriginal = (originalNotes || '').replace(/\[عجز:[^\]]+\]/g, '').trim();
  if (!shortages || shortages.length === 0) return cleanOriginal;
  const tag = `[عجز: ${shortages.join('، ')}]`;
  return cleanOriginal ? `${cleanOriginal} ${tag}` : tag;
}

/** تنظيف الملاحظات لعرضها للكاشير/الزبون بدون وسم النظام الداخلي */
export function getCleanNotes(notes?: string): string {
  if (!notes || typeof notes !== 'string') return '';
  return notes.replace(/\[عجز:[^\]]+\]/g, '').trim();
}

/** قراءة كل سجلات العجز المحفوظة محلياً */
export function getOrderShortagesMap(): ShortageMap {
  try {
    const raw = localStorage.getItem(SHORTAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** تسجيل عجز فاتورة معينة */
export function recordOrderShortages(
  orderId: string,
  orderNumber: string | undefined,
  shortages: string[]
): void {
  if (!orderId || !shortages || shortages.length === 0) return;
  try {
    const map = getOrderShortagesMap();
    map[orderId] = shortages;
    if (orderNumber) map[orderNumber] = shortages;

    const keys = Object.keys(map);
    if (keys.length > MAX_RECORDS * 2) {
      const toDelete = keys.slice(0, keys.length - MAX_RECORDS);
      toDelete.forEach((k) => delete map[k]);
    }

    localStorage.setItem(SHORTAGE_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * جلب الخامات التي كان بها عجز في طلب معين.
 * يفحص أولاً السيرفر (notes) ثم الـ localStorage كـ fallback!
 */
export function getOrderShortages(
  orderId: string,
  orderNumber?: string,
  notes?: string
): string[] | null {
  // 1) أولاً من السيرفر مباشرةً لو مسجل في الملاحظات (شغال على كل الأجهزة وسيرفر Vercel!)
  const serverShortages = extractShortagesFromNotes(notes);
  if (serverShortages.length > 0) {
    return serverShortages;
  }

  // 2) كـ fallback: من المتصفح المحلي
  const map = getOrderShortagesMap();
  if (orderId && map[orderId]) return map[orderId];
  if (orderNumber && map[orderNumber]) return map[orderNumber];
  return null;
}