import React from 'react';
import { Search, X, FilterX } from 'lucide-react';

export interface QuickPeriodOption {
  id: string;
  label: string;
}

export interface DashboardFilterBarProps {
  /** قيمة البحث الحالية — لو اتحددت يظهر صندوق بحث فاخر */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** أزرار الفترات السريعة (الكل / اليوم / آخر ٧ أيام ...) */
  periods?: readonly QuickPeriodOption[];
  activePeriod?: string;
  onPeriodChange?: (id: string) => void;
  /** عنوان مجموعة الأزرار السريعة (الفترة / الحالة / المخزون...) */
  groupLabel?: string;
  /** عدد الفلاتر النشطة — يظهر عليه زر مسح الفلاتر */
  activeCount?: number;
  onReset?: () => void;
  resetLabel?: string;
  /** إظهار زر مسح الفلاتر دائماً حتى لو لا يوجد فلاتر نشطة */
  alwaysShowReset?: boolean;
  /** عدد النتائج بعد التصفية + وصفها */
  resultCount?: number;
  resultLabel?: string;
  /** أزرار إضافية (منتقي التاريخ، تصدير، فلترة متقدمة...) */
  children?: React.ReactNode;
  className?: string;
}

/**
 * شريط فلترة موحّد وفاخر لكل الداشبوردات:
 * صندوق بحث بأيقونة متدرجة + أزرار فترات سريعة متحركة + عداد نتائج حي
 * + مساحة مرنة لأي أدوات إضافية (منتقي التاريخ الاحترافي مثلاً).
 */
export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'ابحث...',
  periods,
  activePeriod,
  onPeriodChange,
  groupLabel = 'الفترة:',
  activeCount = 0,
  onReset,
  resetLabel = 'مسح الفلاتر',
  alwaysShowReset = false,
  resultCount,
  resultLabel = 'نتيجة',
  children,
  className = '',
}) => {
  const hasSearch = onSearchChange !== undefined;

  return (
    <div
      className={`
        bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-3 space-y-3
        ${className}
      `}
    >
      {/* ── الصف الأول: البحث + الأدوات الإضافية ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        {hasSearch && (
          <div className="relative flex-1 min-w-0 lg:max-w-lg group">
            {/* أيقونة البحث داخل مربع متدرج */}
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-gradient-to-br from-[#4a7cc9] via-[#2e5b9f] to-[#1d4277] text-white flex items-center justify-center shadow-md shadow-[#2e5b9f]/25 transition-transform duration-200 group-focus-within:rotate-6 group-focus-within:scale-105 pointer-events-none">
              <Search className="w-3.5 h-3.5" strokeWidth={2.4} />
            </span>
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#faf8f5] hover:bg-white focus:bg-white border border-gray-200 rounded-xl pr-12 pl-10 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#2e5b9f]/10 focus:border-[#2e5b9f]/70 transition-all duration-150"
            />
            {searchValue ? (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                title="مسح البحث"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        )}

        {children && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">{children}</div>
        )}
      </div>

      {/* ── الصف الثاني: الفترات السريعة + العداد + المسح ── */}
      {(periods?.length || activeCount > 0 || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-dashed border-gray-100">
          {periods && periods.length > 0 && (
            <>
              <span className="text-[11px] font-bold text-gray-400 ml-0.5 select-none">
                {groupLabel}
              </span>
              {periods.map((p) => {
                const isActive = activePeriod === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPeriodChange?.(p.id)}
                    className={`
                      py-1.5 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer
                      transition-all duration-200 active:scale-95
                      ${
                        isActive
                          ? 'bg-gradient-to-l from-[#4a7cc9] via-[#2e5b9f] to-[#1d4277] text-white shadow-md shadow-[#2e5b9f]/30 ring-2 ring-[#2e5b9f]/15'
                          : 'bg-gray-50 text-gray-600 border border-gray-200/70 hover:bg-[#2e5b9f]/[0.06] hover:text-[#2e5b9f] hover:border-[#2e5b9f]/30'
                      }
                    `}
                  >
                    {p.label}
                  </button>
                );
              })}
            </>
          )}

          <div className="flex-1 min-w-2" />

          {resultCount !== undefined && (
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-[11px] font-bold font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {resultCount} {resultLabel}
            </span>
          )}

          {(activeCount > 0 || alwaysShowReset) && onReset && (
            <button
              type="button"
              onClick={onReset}
              title={activeCount > 0 ? resetLabel : 'لا توجد فلاتر نشطة — كل النتائج معروضة'}
              className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                activeCount > 0
                  ? 'text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:shadow-md hover:shadow-rose-500/25'
                  : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <FilterX className="w-3.5 h-3.5" />
              {resetLabel}
              {activeCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9.5px] font-bold shadow-sm">
                  {activeCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
