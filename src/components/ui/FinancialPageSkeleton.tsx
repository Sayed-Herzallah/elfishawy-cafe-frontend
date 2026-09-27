import React from 'react';

/** Animated placeholder for data-heavy dashboard and report pages. */
export const FinancialPageSkeleton: React.FC<{ title?: string }> = ({
  title = 'جاري تحميل البيانات...',
}) => (
  <div className="mx-auto w-full max-w-7xl space-y-5 p-2 text-right" dir="rtl" aria-live="polite" aria-busy="true">
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
      <div className="space-y-3">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-gray-200" />
        <p className="text-xs font-semibold text-gray-500">{title}</p>
      </div>
      <div className="h-10 w-28 animate-pulse rounded-xl bg-blue-100" />
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
          <div className="mb-5 h-3 w-2/3 rounded bg-gray-200" />
          <div className="mb-3 h-6 w-1/2 rounded bg-gray-300" />
          <div className="h-2 w-1/3 rounded bg-gray-100" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="h-80 animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
        <div className="mb-7 h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-56 rounded-xl bg-gray-50" />
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
        <div className="mb-7 h-4 w-1/3 rounded bg-gray-200" />
        <div className="space-y-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gray-200" />
              <div className="h-3 flex-1 rounded bg-gray-100" />
              <div className="h-3 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
