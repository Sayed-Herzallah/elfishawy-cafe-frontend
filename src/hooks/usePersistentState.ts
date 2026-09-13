import { useState, useEffect } from 'react';

/**
 * ✅ حالة محفوظة في localStorage — بتفضل موجودة بعد أي Refresh.
 * مفيدة للفلاتر (الفترة الزمنية، نطاق التاريخ، الفئات) عشان المستخدم
 * يلاقي نفس الاختيارات بعد تحديث الصفحة بدل ما ترجع للافتراضي.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* تجاهل — نرجع للقيمة الافتراضية */
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* تجاهل — التخزين تحسيني مش حرج */
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * ✅ كاش جلسة للداتا (sessionStorage) — بعد أي Refresh الصفحة تظهر فورًا
 * بآخر داتا معروفة بدل سكيليتون فاضي، وبعدين بتعمل تحديث صامت من السيرفر.
 */
export function readSessionCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* تجاهل — الكاش تحسيني مش حرج */
  }
}

/**
 * ✅ هل الكاش صالح للاستخدام كداتا استرجاع فورية؟
 * الكاش الفاضي/التالف (اتكتب وقت فشل التحميل) ميتحترمش — لازم الصفحة تبدأ في حالة تحميل
 * بدل ما تعرض أصفار و"لا يوجد" طول مدة جلب البيانات من الـ API.
 *
 * @param requiredKeys مفاتيح أساسية لازم تكون موجودة بقيمة حقيقية (مصفوفة أو كائن أو رقم) في الكاش
 */
export function isSessionCacheUsable<T extends Record<string, any>>(
  key: string,
  requiredKeys: Array<keyof T> = []
): boolean {
  const cached = readSessionCache<T>(key);
  if (!cached || typeof cached !== 'object') return false;
  return requiredKeys.every((k) => {
    const v = cached[k as string];
    return Array.isArray(v) || (v !== null && v !== undefined && typeof v === 'object') || typeof v === 'number';
  });
}
