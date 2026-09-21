// src/utils/businessDay.ts
// ============================================================
// اليوم التجاري الموحّد بتوقيت القاهرة (Africa/Cairo)
// نفس تعريف اليوم المستخدم في السيرفر والديسكتوب → الترقيم اليومي
// للفواتير يبدأ من 1 في نفس اللحظة على كل المنصات.
// ============================================================

export const CAIRO_TIMEZONE = "Africa/Cairo";

/** مفتاح اليوم التجاري "YYYY-MM-DD" بتوقيت القاهرة */
export const getBusinessDayKey = (date: Date | string = new Date()): string => {
  const d = date instanceof Date ? date : new Date(date);
  try {
    // en-CA ينتج الصيغة ISO "YYYY-MM-DD" مباشرة
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: CAIRO_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    // fallback نادر: لو Intl بلا دعم مناطق زمنية
    return d.toISOString().slice(0, 10);
  }
};

/** مفتاح اليوم التجاري لتاريخ إنشاء الفاتورة (أو النهاردة لو مفيش تاريخ) */
export const orderBusinessDayKey = (createdAt?: string | number | Date | null): string => {
  if (!createdAt) return getBusinessDayKey(new Date());
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return getBusinessDayKey(new Date());
  return getBusinessDayKey(d);
};

/**
 * إزاحة مفتاح يوم تجاري بعدد أيام (سالب = الماضي).
 * الفرق بين يومين تقويميين — آمن مع حدود الشهور والسنوات.
 */
export const shiftDayKey = (dayKey: string, deltaDays: number): string => {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + deltaDays));
  return dt.toISOString().slice(0, 10);
};
