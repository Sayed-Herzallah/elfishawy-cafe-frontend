import { useMemo } from 'react';
import { getBusinessDayKey, shiftDayKey } from '../utils/businessDay';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export interface ComparisonResult {
  current: number;
  previous: number;
  changePercent: number;
  changeAbsolute: number;
  trend: 'up' | 'down' | 'neutral';
  previousPeriodLabel: string;
  currentPeriodLabel: string;
}

export interface ComparisonConfig {
  timeRange: TimeRange;
  currentData: number[];
  previousData: number[];
  currentDates: Date[];
  previousDates: Date[];
  label?: string;
}

/**
 * تحويل مفتاح يوم تجاري (YYYY-MM-DD) إلى بداية ذلك اليوم بتوقيت القاهرة (Date UTC).
 * يضمن توافق حدود الفترات مع منطق orderBusinessDayKey المستخدم في سجلات الفواتير.
 */
function cairoBusinessDayStart(dayKey: string): Date {
  // نستخدم Intl لتحديد offset توقيت القاهرة في تلك اللحظة
  const [y, m, d] = dayKey.split('-').map(Number);
  // نقدّر الـ offset من وسط اليوم (لتفادي أي حدود توقيت صيفي)
  const noonUtcGuess = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(noonUtcGuess)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const offsetMin = Math.round((asUtc - noonUtcGuess.getTime()) / 60000);
  // بداية اليوم 00:00:00.000 بتوقيت القاهرة → UTC
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0) - offsetMin * 60000);
}

/**
 * نهاية اليوم التجاري (بداية اليوم التالي) بتوقيت القاهرة.
 * الفلتر يكون: start <= date < end  (حصري من الأعلى)
 */
function cairoBusinessDayEnd(dayKey: string): Date {
  const nextDayKey = shiftDayKey(dayKey, 1);
  return cairoBusinessDayStart(nextDayKey);
}

/**
 * F-UNIFIED: حدود الفترات الزمنية تعتمد على اليوم التجاري بتوقيت القاهرة
 * حتى تتطابق مع orderBusinessDayKey المستخدم في سجلات الفواتير (filteredOrders).
 */
function getPeriodBounds(timeRange: TimeRange, referenceDate: Date = new Date()): {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  previousLabel: string;
  currentLabel: string;
} {
  const now = new Date(referenceDate);
  const oneDayMs = 24 * 60 * 60 * 1000;

  // مفتاح اليوم الحالي بتوقيت القاهرة — نفس المرجع المستخدم في filteredOrders
  const todayKey = getBusinessDayKey(now);

  switch (timeRange) {
    case 'today': {
      // F-UNIFIED: بداية ونهاية اليوم التقويمي بتوقيت القاهرة
      // (بدل new Date(y, m, d) التي تستخدم توقيت الجهاز)
      const currentStart = cairoBusinessDayStart(todayKey);
      const currentEnd = cairoBusinessDayEnd(todayKey);
      const prevDayKey = shiftDayKey(todayKey, -1);
      return {
        currentStart,
        currentEnd,
        previousStart: cairoBusinessDayStart(prevDayKey),
        previousEnd: cairoBusinessDayEnd(prevDayKey),
        previousLabel: 'أمس',
        currentLabel: 'اليوم',
      };
    }
    case 'week': {
      const weekStart = new Date(now.getTime() - 6 * oneDayMs);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now.getTime() + oneDayMs);
      weekEnd.setHours(0, 0, 0, 0);
      return {
        currentStart: weekStart,
        currentEnd: weekEnd,
        previousStart: new Date(weekStart.getTime() - 7 * oneDayMs),
        previousEnd: weekStart,
        previousLabel: 'الأسبوع السابق',
        currentLabel: 'هذا الأسبوع',
      };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return {
        currentStart: monthStart,
        currentEnd: monthEnd,
        previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        previousEnd: monthStart,
        previousLabel: 'الشهر السابق',
        currentLabel: 'هذا الشهر',
      };
    }
    case 'year': {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
      return {
        currentStart: yearStart,
        currentEnd: yearEnd,
        previousStart: new Date(now.getFullYear() - 1, 0, 1),
        previousEnd: yearStart,
        previousLabel: 'العام السابق',
        currentLabel: 'هذا العام',
      };
    }
  }
}

function filterDataByPeriod<T extends { createdAt?: string; date?: string; totalAmount?: number; amount?: number }>(
  data: T[],
  start: Date,
  end: Date,
  valueExtractor: (item: T) => number
): number {
  return data
    .filter((item) => {
      const itemDate = new Date(item.date || item.createdAt || '');
      return itemDate >= start && itemDate < end;
    })
    .reduce((sum, item) => sum + valueExtractor(item), 0);
}

export function useStatisticsComparison<
  T extends { createdAt?: string; date?: string; totalAmount?: number; amount?: number }
>(
  timeRange: TimeRange,
  currentData: T[],
  valueExtractor: (item: T) => number,
  referenceDate?: Date
): ComparisonResult {
  const bounds = useMemo(() => getPeriodBounds(timeRange, referenceDate), [timeRange, referenceDate]);

  const current = useMemo(() =>
    filterDataByPeriod(currentData, bounds.currentStart, bounds.currentEnd, valueExtractor),
    [currentData, bounds.currentStart, bounds.currentEnd, valueExtractor]
  );

  const previous = useMemo(() =>
    filterDataByPeriod(currentData, bounds.previousStart, bounds.previousEnd, valueExtractor),
    [currentData, bounds.previousStart, bounds.previousEnd, valueExtractor]
  );

  const changeAbsolute = current - previous;
  // ✅ القسمة على القيمة المطلقة للفترة السابقة — عشان الخسارة السابقة (بالسالب) ما تقلبش إشارة النسبة
  const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((changeAbsolute / Math.abs(previous)) * 100);

  return {
    current,
    previous,
    changePercent,
    changeAbsolute,
    trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
    previousPeriodLabel: bounds.previousLabel,
    currentPeriodLabel: bounds.currentLabel,
  };
}

export function useMultiMetricComparison<T extends { createdAt: string }>(
  timeRange: TimeRange,
  data: T[],
  metrics: Array<{ key: string; extractor: (item: T) => number }>,
  referenceDate?: Date
): Record<string, ComparisonResult> {
  const results: Record<string, ComparisonResult> = {};

  metrics.forEach(({ key, extractor }) => {
    results[key] = useStatisticsComparison(timeRange, data, extractor, referenceDate);
  });

  return results;
}

export function formatComparisonDisplay(comparison: ComparisonResult, currency ='جنيها'): string {
  const { current, previous, changePercent, trend } = comparison;
  const formattedCurrent = typeof current === 'number' && currency === 'جنيها'
    ? `${current.toLocaleString('en-US')} ${currency}`
    : `${current.toLocaleString('en-US')}`;

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-gray-500';

  return `${formattedCurrent} <span class="${trendColor} font-bold">${trendIcon} ${changePercent >= 0 ? '+' : ''}${changePercent}%</span>`;
}

export function getComparisonTooltip(comparison: ComparisonResult, currency = 'جنيها'): string {
  const { current, previous, changePercent, changeAbsolute, previousPeriodLabel, currentPeriodLabel } = comparison;
  const formattedCurrent = typeof current === 'number' && currency === 'جنيها'
    ? `${current.toLocaleString('en-US')} ${currency}`
    : `${current.toLocaleString('en-US')}`;
  const formattedPrevious = typeof previous === 'number' && currency === 'جنيها'
    ? `${previous.toLocaleString('en-US')} ${currency}`
    : `${previous.toLocaleString('en-US')}`;

  const direction = changePercent > 0 ? 'ارتفاع' : changePercent < 0 ? 'انخفاض' : 'ثبات';
  const absChange = changeAbsolute >= 0 ? `+${changeAbsolute.toLocaleString('en-US')}` : changeAbsolute.toLocaleString('en-US');

  return `${currentPeriodLabel}: ${formattedCurrent}\n${previousPeriodLabel}: ${formattedPrevious}\nالتغير: ${absChange} (${direction} ${Math.abs(changePercent)}%)`;
}

export function useSalesComparison(
  timeRange: TimeRange,
  orders: Array<{ createdAt: string; status: string; totalAmount: number }>,
  referenceDate?: Date
): ComparisonResult {
  return useStatisticsComparison(
    timeRange,
    orders,
    (order) => order.status === 'completed' ? order.totalAmount : 0,
    referenceDate
  );
}

export function useOrdersCountComparison(
  timeRange: TimeRange,
  orders: Array<{ createdAt: string; status: string }>,
  referenceDate?: Date
): ComparisonResult {
  return useStatisticsComparison(
    timeRange,
    orders,
    () => 1,
    referenceDate
  );
}

export function useExpensesComparison(
  timeRange: TimeRange,
  expenses: Array<{ createdAt?: string; amount: number; date?: string }>,
  referenceDate?: Date
): ComparisonResult {
  return useStatisticsComparison(
    timeRange,
    expenses,
    (expense) => expense.amount,
    referenceDate
  );
}

export function useProfitComparison(
  timeRange: TimeRange,
  orders: Array<{ createdAt: string; status: string; totalAmount: number }>,
  expenses: Array<{ createdAt?: string; amount: number; date?: string }>,
  referenceDate?: Date
): ComparisonResult {
  const bounds = getPeriodBounds(timeRange, referenceDate);

  const currentSales = orders
    .filter((o) => {
      const d = new Date(o.createdAt);
      return d >= bounds.currentStart && d < bounds.currentEnd && o.status === 'completed';
    })
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const currentExpenses = expenses
    .filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d >= bounds.currentStart && d < bounds.currentEnd;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const previousSales = orders
    .filter((o) => {
      const d = new Date(o.createdAt);
      return d >= bounds.previousStart && d < bounds.previousEnd && o.status === 'completed';
    })
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const previousExpenses = expenses
    .filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d >= bounds.previousStart && d < bounds.previousEnd;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // ✅ صافي الربح الحقيقي — ممكن يكون بالسالب (خسارة) لو المصروفات أكبر من المبيعات
  const current = currentSales - currentExpenses;
  const previous = previousSales - previousExpenses;
  const changeAbsolute = current - previous;
  // ✅ القسمة على القيمة المطلقة — لو الفترة السابقة كانت خسارة النسبة تطلع باتجاهها الصحيح
  const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((changeAbsolute / Math.abs(previous)) * 100);

  return {
    current,
    previous,
    changePercent,
    changeAbsolute,
    trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
    previousPeriodLabel: bounds.previousLabel,
    currentPeriodLabel: bounds.currentLabel,
  };
}

/**
 * مقارنة على نطاق تاريخ صريح (من منتقي التاريخ المخصص):
 * الفترة الحالية = [from, to] — والفترة السابقة = نافذة بنفس الطول قبلها مباشرة.
 */
export function useExplicitRangeComparison<
  T extends { createdAt?: string; date?: string }
>(
  data: T[],
  valueExtractor: (item: T) => number,
  from: Date,
  to: Date
): ComparisonResult {
  const bounds = useMemo(() => {
    const now = new Date();
    const effectiveTo = to.getTime() > now.getTime() ? now : to;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const rangeMs = Math.max(effectiveTo.getTime() - from.getTime(), oneDayMs);
    const prevEnd = new Date(from.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - rangeMs);
    return { from, to: effectiveTo, prevStart, prevEnd };
  }, [from.getTime(), to.getTime()]);

  const sumBetween = (start: Date, end: Date) =>
    data
      .filter((item) => {
        const d = new Date(item.date || item.createdAt || '');
        return d >= start && d <= end;
      })
      .reduce((sum, item) => sum + valueExtractor(item), 0);

  const current = sumBetween(bounds.from, bounds.to);
  const previous = sumBetween(bounds.prevStart, bounds.prevEnd);

  const changeAbsolute = current - previous;
  const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((changeAbsolute / Math.abs(previous)) * 100);

  return {
    current,
    previous,
    changePercent,
    changeAbsolute,
    trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
    previousPeriodLabel: 'الفترة السابقة',
    currentPeriodLabel: 'الفترة المحددة',
  };
}