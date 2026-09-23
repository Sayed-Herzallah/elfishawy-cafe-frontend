/**
 * src/utils/printerConfig.ts
 * إدارة إعدادات طابعات الكاشير المخصصة لهذا الجهاز
 * 
 * - تدعم طابعة واحدة أو أكثر من طابعة كاشير
 * - بدون أسماء ثابتة (dynamic printer discovery من نظام Windows)
 * - تخزين موثوق في localStorage + التوافق مع المفتاح السابق elfishawy_selected_printer
 */

export const CASHIER_PRINTERS_STORAGE_KEY = 'elfishawy_configured_cashier_printers';
export const LEGACY_SELECTED_PRINTER_KEY = 'elfishawy_selected_printer';

export interface CashierPrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  status?: number;
}

/**
 * جلب أسماء طابعات الكاشير المخصصة لهذا الجهاز.
 * إذا لم يتم تعيين قائمة مسبقاً، يحاول استخدام الطابعة الافتراضية القديمة إن وجدت.
 */
export function getConfiguredCashierPrinters(): string[] {
  try {
    const raw = localStorage.getItem(CASHIER_PRINTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
      }
    }
    // Fallback: لو فيه قيمة قديمة مخزنة كطابعة وحيدة
    const legacy = localStorage.getItem(LEGACY_SELECTED_PRINTER_KEY);
    if (legacy && legacy.trim()) {
      return [legacy.trim()];
    }
  } catch (err) {
    console.warn('[printerConfig] Failed to read configured cashier printers:', err);
  }
  return [];
}

/**
 * حفظ قائمة طابعات الكاشير المخصصة لهذا الجهاز.
 */
export function setConfiguredCashierPrinters(printers: string[]): void {
  try {
    const cleanList = Array.from(new Set(printers.map((p) => p.trim()).filter((p) => p.length > 0)));
    localStorage.setItem(CASHIER_PRINTERS_STORAGE_KEY, JSON.stringify(cleanList));
    // الحفاظ على التوافق مع المفتاح القديم (أول طابعة)
    if (cleanList.length > 0) {
      localStorage.setItem(LEGACY_SELECTED_PRINTER_KEY, cleanList[0]);
    } else {
      localStorage.removeItem(LEGACY_SELECTED_PRINTER_KEY);
    }
  } catch (err) {
    console.error('[printerConfig] Failed to save configured cashier printers:', err);
  }
}
