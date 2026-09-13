import React, { useState } from 'react';
import { formatPrice, formatNumber, EMPTY_LABEL } from '../../utils/formatters';
import { TrendingUp, Calendar, Sparkles } from 'lucide-react';

const isEmptyValue = (val: number | undefined | null): boolean => {
  if (val === undefined || val === null) return true;
  const n = Number(val);
  return isNaN(n) || n === 0;
};

export interface ChartDataPoint {
  label: string;
  sales: number;
  orders: number;
  expenses: number;
  profit: number;
}

interface AttaGlowingChartProps {
  data: ChartDataPoint[];
  timeRange: 'today' | 'week' | 'month' | 'year';
  onTimeRangeChange: (range: 'today' | 'week' | 'month' | 'year') => void;
  totalSales: number;
  totalOrders: number;
  totalExpenses: number;
  netProfit: number;
  growthRate?: number;
  title?: string;
}

// Generate smooth cubic bezier SVG path from points
function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return path;
}

// ضغط تسميات الساعات: "06:00 م" → "06 م" عشان تتعرض كل ساعة بدون تزاحم
function compactAxisLabel(label: string): string {
  return String(label || '').replace(':00', '');
}

// تنسيق مختصر لقيم محور الفلوس (يسار الرسمة): 1500 → 1.5K
function formatAxisValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return `${Math.round(value)}`;
}

export const AttaGlowingChart: React.FC<AttaGlowingChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  totalSales,
  totalOrders,
  totalExpenses,
  netProfit,
  growthRate = 18.5,
  title = 'نشاط ومبيعات الكافيه',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<{
    sales: boolean;
    orders: boolean;
    expenses: boolean;
    profit: boolean;
  }>({
    sales: true,
    orders: true,
    expenses: true,
    profit: true,
  });

  // Calculate scales
  const maxSales = Math.max(...data.map((d) => d.sales), 100);
  const maxOrders = Math.max(...data.map((d) => d.orders), 10);
  const maxExpenses = Math.max(...data.map((d) => d.expenses), 50);
  const maxOverall = Math.max(maxSales, maxExpenses, 100);

  const chartWidth = 1000;
  const chartHeight = 350;
  const paddingX = 58;
  const paddingY = 42;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  // Compute point coordinates
  const stepX = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth;

  // اتجاه RTL: أول نقطة (أول ساعة/يوم) على اليمين وآخر نقطة على اليسار
  const xAt = (i: number): number => chartWidth - paddingX - i * stepX;

  // تباعد تسميات المحور السيني: التسميات مضغوطة ("06 م") فتعرض كل ساعة ليوم كامل
  const labelEvery = data.length > 32 ? 2 : 1;

  const salesPoints = data.map((d, i) => ({
    x: xAt(i),
    y: chartHeight - paddingY - (d.sales / maxOverall) * usableHeight,
  }));

  const ordersPoints = data.map((d, i) => ({
    x: xAt(i),
    y: chartHeight - paddingY - (d.orders / Math.max(maxOrders * 1.5, 1)) * usableHeight,
  }));

  const expensesPoints = data.map((d, i) => ({
    x: xAt(i),
    y: chartHeight - paddingY - (d.expenses / maxOverall) * usableHeight,
  }));

  const profitPoints = data.map((d, i) => ({
    x: xAt(i),
    y: chartHeight - paddingY - (Math.max(0, d.profit) / maxOverall) * usableHeight,
  }));

  // SVG paths
  const salesLinePath = generateSmoothPath(salesPoints);
  const ordersLinePath = generateSmoothPath(ordersPoints);
  const expensesLinePath = generateSmoothPath(expensesPoints);
  const profitLinePath = generateSmoothPath(profitPoints);

  const salesAreaPath =
    salesPoints.length > 0
      ? `${salesLinePath} L ${salesPoints[salesPoints.length - 1].x} ${chartHeight - paddingY} L ${salesPoints[0].x} ${chartHeight - paddingY} Z`
      : '';

  const ordersAreaPath =
    ordersPoints.length > 0
      ? `${ordersLinePath} L ${ordersPoints[ordersPoints.length - 1].x} ${chartHeight - paddingY} L ${ordersPoints[0].x} ${chartHeight - paddingY} Z`
      : '';

  const expensesAreaPath =
    expensesPoints.length > 0
      ? `${expensesLinePath} L ${expensesPoints[expensesPoints.length - 1].x} ${chartHeight - paddingY} L ${expensesPoints[0].x} ${chartHeight - paddingY} Z`
      : '';

  const profitAreaPath =
    profitPoints.length > 0
      ? `${profitLinePath} L ${profitPoints[profitPoints.length - 1].x} ${chartHeight - paddingY} L ${profitPoints[0].x} ${chartHeight - paddingY} Z`
      : '';

  // Time range labels
  const timeLabels = {
    today: 'اليوم (ساعات العمل)',
    week: 'آخر 7 أيام',
    month: 'هذا الشهر',
    year: 'آخر 12 شهراً',
  };

  return (
        <div className="bg-white border border-gray-200/80 rounded-3xl p-5 sm:p-6 shadow-sm text-right font-sans relative overflow-hidden">
      {/* (تمت إزالة التوهجات الخضراء/الملونة خلف الرسمة بناءً على طلب المستخدم — خلفية بيضاء نظيفة) */}

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/70 relative z-10">
        {/* Filter Tabs (Left in RTL) */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl border border-gray-300 self-start sm:self-auto">
          {(
            [
              { key: 'today', label: 'اليوم' },
              { key: 'week', label: 'آخر 7 أيام' },
              { key: 'month', label: 'هذا الشهر' },
              { key: 'year', label: 'آخر 12 شهراً' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTimeRangeChange(tab.key)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeRange === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Title & Growth Badge (Right in RTL) */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-mono">
                <TrendingUp className="w-4 h-4" />
                {growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`}
              </span>
              <h3 className="text-xl font-bold text-gray-900 font-arabic-heading flex items-center gap-1.5">
                {title}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              مخطط بياني تحليلي مباشر لتدفق الإيرادات، المصروفات وأعداد الطلبات ({timeLabels[timeRange]})
            </p>
          </div>
        </div>
      </div>

      {/* Sub-metrics Pills Row (Exactly like Atta reference) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 relative z-10">
        <div
          onClick={() => setActiveSeries((s) => ({ ...s, sales: !s.sales }))}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right ${
            activeSeries.sales
              ? 'bg-white border-blue-200 ring-1 ring-blue-200'
              : 'bg-gray-50 border-gray-200 opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/40" />
            <span className="text-sm text-gray-500 font-bold">المبيعات</span>
          </div>
          <span className="text-2xl font-bold text-blue-600 font-mono block">
            {isEmptyValue(totalSales) ? EMPTY_LABEL : formatPrice(totalSales)}
          </span>
        </div>

        <div
          onClick={() => setActiveSeries((s) => ({ ...s, orders: !s.orders }))}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right ${
            activeSeries.orders
              ? 'bg-white border-purple-200 ring-1 ring-purple-200'
              : 'bg-gray-50 border-gray-200 opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/40" />
            <span className="text-sm text-gray-500 font-bold">حجم الطلبات</span>
          </div>
          <span className="text-2xl font-bold text-purple-600 font-mono block">
            {formatNumber(totalOrders)} <span className="text-xs text-gray-500 font-normal">طلب</span>
          </span>
        </div>

        <div
          onClick={() => setActiveSeries((s) => ({ ...s, expenses: !s.expenses }))}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right ${
            activeSeries.expenses
              ? 'bg-white border-rose-200 ring-1 ring-rose-200'
              : 'bg-gray-50 border-gray-200 opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/40" />
            <span className="text-sm text-gray-500 font-bold">المصروفات</span>
          </div>
          <span className="text-2xl font-bold text-rose-500 font-mono block">
            {isEmptyValue(totalExpenses) ? EMPTY_LABEL : formatPrice(totalExpenses)}
          </span>
        </div>

        <div
          onClick={() => setActiveSeries((s) => ({ ...s, profit: !s.profit }))}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right ${
            activeSeries.profit
              ? netProfit < 0
                ? 'bg-white border-rose-200 ring-1 ring-rose-200'
                : 'bg-white border-emerald-200 ring-1 ring-emerald-200'
              : 'bg-gray-50 border-gray-200 opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`w-3.5 h-3.5 rounded-full shadow-sm ${netProfit < 0 ? 'bg-rose-500 shadow-rose-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`} />
            <span className="text-sm text-gray-500 font-bold">{netProfit < 0 ? 'صافي الخسارة' : 'صافي الأرباح'}</span>
          </div>
          <span className={`text-2xl font-bold font-mono block ${netProfit < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
            {isEmptyValue(netProfit) ? EMPTY_LABEL : formatPrice(netProfit)}
          </span>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative w-full overflow-x-auto pt-2 pb-1 select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-64 sm:h-80 lg:h-96 overflow-visible"
        >
          <defs>
            {/* Sales Blue Gradient */}
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>

            {/* Orders Purple Gradient */}
            <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>

            {/* Expenses Rose Gradient */}
            <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
              <stop offset="80%" stopColor="#f43f5e" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            {/* Profit Emerald Gradient */}
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#10b981" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Glow Filters */}
            <filter id="salesGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.7" />
            </filter>
            <filter id="ordersGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.7" />
            </filter>
            <filter id="expensesGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.7" />
            </filter>
            <filter id="profitGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Grid lines + قيم الفلوس على يسار الرسمة */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingY + ratio * usableHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#94a3b8"
                  className="font-mono"
                >
                  {formatAxisValue(maxOverall * (1 - ratio))}
                </text>
              </g>
            );
          })}

          {/* ✅ خط متوسط المبيعات — لمسة احترافية توضح الأداء العام */}
          {activeSeries.sales && data.length > 0 && (() => {
            const avgSales = data.reduce((sum, d) => sum + d.sales, 0) / data.length;
            const y = chartHeight - paddingY - (avgSales / maxOverall) * usableHeight;
            return (
              <g>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="8 5"
                  strokeOpacity="0.45"
                />
                <text
                  x={chartWidth - paddingX - 8}
                  y={y - 6}
                  textAnchor="end"
                  fontSize="10"
                  fill="#3b82f6"
                  className="font-mono"
                >
                  المتوسط {formatAxisValue(avgSales)}
                </text>
              </g>
            );
          })()}

          {/* Area Fills */}
          {activeSeries.sales && salesAreaPath && (
            <path d={salesAreaPath} fill="url(#salesGrad)" />
          )}
          {activeSeries.orders && ordersAreaPath && (
            <path d={ordersAreaPath} fill="url(#ordersGrad)" />
          )}
          {activeSeries.expenses && expensesAreaPath && (
            <path d={expensesAreaPath} fill="url(#expensesGrad)" />
          )}

          {/* (تمت إزالة التعبئة الخضراء خلف خط الربح بناءً على طلب المستخدم — يظهر الخط وحده نظيف) */}

          {/* Lines */}
          {activeSeries.expenses && expensesLinePath && (
            <path
              d={expensesLinePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
              filter="url(#expensesGlow)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {activeSeries.orders && ordersLinePath && (
            <path
              d={ordersLinePath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="3"
              filter="url(#ordersGlow)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {activeSeries.sales && salesLinePath && (
            <path
              d={salesLinePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3.5"
              filter="url(#salesGlow)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {activeSeries.profit && profitLinePath && (
            <path
              d={profitLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              filter="url(#profitGlow)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Hover Columns & Dots */}
          {data.map((point, i) => {
            const x = xAt(i);
            const isHovered = hoveredIdx === i;
            // نعرض التسمية فقط عند النقاط المتباعدة (أو المؤشر عليها أو آخر نقطة)
            const showLabel = i % labelEvery === 0 || isHovered || i === data.length - 1;

            return (
              <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
                {/* Transparent hit area */}
                <rect
                  x={x - stepX / 2}
                  y={0}
                  width={stepX}
                  height={chartHeight}
                  fill="transparent"
                />

                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingY}
                    x2={x}
                    y2={chartHeight - paddingY}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Dots */}
                {activeSeries.sales && (
                  <circle
                    cx={salesPoints[i]?.x}
                    cy={salesPoints[i]?.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2.5 : 1}
                    className="transition-all"
                  />
                )}
                {activeSeries.orders && (
                  <circle
                    cx={ordersPoints[i]?.x}
                    cy={ordersPoints[i]?.y}
                    r={isHovered ? 5.5 : 3}
                    fill="#8b5cf6"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2 : 1}
                    className="transition-all"
                  />
                )}

                {/* Bottom X-axis label — كل ساعة بتسمية مضغوطة واضحة */}
                {showLabel && (
                  <text
                    x={x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fill={isHovered ? '#0f172a' : '#64748b'}
                    fontSize="12"
                    fontWeight={isHovered ? 'bold' : '600'}
                    className="transition-colors font-mono"
                  >
                    {compactAxisLabel(point.label)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            className="absolute z-20 top-2 bg-white/95 border border-gray-200 backdrop-blur-md p-4 rounded-2xl shadow-xl text-right pointer-events-none transition-all"
            style={{
              left: `${Math.min(Math.max(10, (salesPoints[hoveredIdx]?.x / chartWidth) * 100 - 12), 72)}%`,
            }}
          >
            <span className="font-bold text-base text-gray-900 block pb-1.5 border-b border-gray-200 font-arabic-heading">
              {data[hoveredIdx].label}
            </span>
            {/* الكلام على اليمين والفلوس على اليسار */}
            <div className="space-y-1.5 mt-2 font-mono text-sm">
              <div className="flex justify-between items-center gap-4 text-blue-500">
                <span className="font-bold">المبيعات:</span>
                <span className="font-bold">{formatPrice(data[hoveredIdx].sales)}</span>
              </div>
              <div className="flex justify-between items-center gap-4 text-purple-500">
                <span className="font-bold">الطلبات:</span>
                <span className="font-bold">{formatNumber(data[hoveredIdx].orders)} طلب</span>
              </div>
              <div className="flex justify-between items-center gap-4 text-rose-500">
                <span className="font-bold">المصروفات:</span>
                <span className="font-bold">{formatPrice(data[hoveredIdx].expenses)}</span>
              </div>
              <div className="flex justify-between items-center gap-4 text-emerald-500 border-t border-gray-300/60 pt-1.5 font-bold">
                <span>صافي الربح:</span>
                <span>{formatPrice(data[hoveredIdx].profit)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer — أكبر وأوضح */}
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-4 mt-3 border-t border-gray-200/60 text-sm font-bold text-gray-600">
        <div className="flex items-center gap-2">
          <span className="w-4 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/40" />
          <span>المبيعات</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/40" />
          <span>الطلبات</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/40" />
          <span>المصروفات</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
          <span>صافي الأرباح</span>
        </div>
      </div>
    </div>
  );
};
