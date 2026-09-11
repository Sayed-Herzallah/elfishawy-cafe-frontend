import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ComparisonResult } from '../../hooks/useStatisticsComparison';

interface ComparisonStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: 'rose' | 'amber' | 'blue' | 'purple' | 'emerald';
  comparison?: ComparisonResult;
  invertColors?: boolean;
  /** Optional static label shown instead of a comparison tag (e.g. quality indicators) */
  periodLabel?: string;
  className?: string;
}

const safeNum = (val: number | undefined | null): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const colorMap = {
  rose: {
    topStrip: 'from-rose-400 via-pink-400 to-rose-500',
    iconBg: 'bg-rose-100 border-rose-200 text-rose-500',
    glow: 'group-hover:border-rose-300/50',
    positiveBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    negativeBg: 'bg-rose-50 border-rose-200 text-rose-600',
  },
  amber: {
    topStrip: 'from-amber-400 via-yellow-400 to-amber-500',
    iconBg: 'bg-amber-100 border-amber-200 text-amber-500',
    glow: 'group-hover:border-amber-300/50',
    positiveBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    negativeBg: 'bg-rose-50 border-rose-200 text-rose-600',
  },
  blue: {
    topStrip: 'from-blue-400 via-cyan-400 to-blue-500',
    iconBg: 'bg-blue-100 border-blue-200 text-blue-500',
    glow: 'group-hover:border-blue-300/50',
    positiveBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    negativeBg: 'bg-rose-50 border-rose-200 text-rose-600',
  },
  purple: {
    topStrip: 'from-purple-400 via-indigo-400 to-purple-500',
    iconBg: 'bg-purple-100 border-purple-200 text-purple-500',
    glow: 'group-hover:border-purple-300/50',
    positiveBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    negativeBg: 'bg-rose-50 border-rose-200 text-rose-600',
  },
  emerald: {
    topStrip: 'from-emerald-400 via-teal-400 to-emerald-500',
    iconBg: 'bg-emerald-100 border-emerald-200 text-emerald-500',
    glow: 'group-hover:border-emerald-300/50',
    positiveBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    negativeBg: 'bg-rose-50 border-rose-200 text-rose-600',
  },
};

export const ComparisonStatCard: React.FC<ComparisonStatCardProps> = ({
  title,
  value,
  icon,
  accentColor,
  comparison,
  invertColors = false,
  periodLabel,
  className = '',
}) => {
  const scheme = colorMap[accentColor];
  const hasComparison = comparison !== undefined && comparison.changePercent !== 0 && !Number.isNaN(comparison.changePercent);
  const isPositive = comparison ? comparison.trend === 'up' : false;
  const isNegative = comparison ? comparison.trend === 'down' : false;
  const isNeutral = comparison ? comparison.trend === 'neutral' : true;
  const isGood = invertColors ? !isPositive : isPositive;

  const getTrendIcon = () => {
    if (isPositive) return <TrendingUp className="w-3 h-3" />;
    if (isNegative) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendText = () => {
    if (!comparison) return '';
    const sign = comparison.changePercent > 0 ? '+' : '';
    return `${sign}${comparison.changePercent}%`;
  };

  const getTrendBg = () => {
    // ✅ invertColors: زيادة المصروفات = سيئ (أحمر) مش أخضر، والسهم بيفضل صادق مع اتجاه التغير
    if (isNeutral) return 'bg-gray-100 border-gray-200 text-gray-500';
    return isGood ? scheme.positiveBg : scheme.negativeBg;
  };

  const getTooltip = () => {
    if (!comparison) return '';
    return `${comparison.currentPeriodLabel}: ${safeNum(comparison.current).toLocaleString('en-US')}\n${comparison.previousPeriodLabel}: ${safeNum(comparison.previous).toLocaleString('en-US')}\nالتغير: ${safeNum(comparison.changeAbsolute) >= 0 ? '+' : ''}${safeNum(comparison.changeAbsolute).toLocaleString('en-US')} (${comparison.trend === 'up' ? 'ارتفاع' : comparison.trend === 'down' ? 'انخفاض' : 'ثبات'} ${Math.abs(comparison.changePercent)}%)`;
  };

  return (
    <div
      className={`
        group relative bg-white border border-gray-200/80 rounded-3xl p-5 shadow-sm
        transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-right font-sans overflow-hidden ${scheme.glow} ${className}
      `}
      title={getTooltip()}
    >
      {/* Top Gradient Accent Strip */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${scheme.topStrip}`} />

      {/* Main Content Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Rounded Badge Icon */}
        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-inner ${scheme.iconBg}`}>
          {icon}
        </div>

        {/* Right Side: Value & Title */}
        <div className="text-right min-w-0 flex-1">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 tracking-tight block break-words leading-tight">
            {value}
          </span>
          <span className="text-xs font-bold text-gray-500 mt-1 block font-arabic-heading truncate">
            {title}
          </span>
        </div>
      </div>

      {/* Footer Info Row: Current vs Previous Period */}
      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
        {/* Previous Period Context */}
        {comparison && (
          <span className="text-gray-500 font-medium truncate flex items-center gap-1">
            {comparison.previousPeriodLabel}:{' '}
            <span className="font-mono font-bold text-gray-700">
              {safeNum(comparison.previous).toLocaleString('en-US')}
            </span>
          </span>
        )}

        {/* % Growth Tag */}
        {hasComparison ? (
          <span
            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full border ${getTrendBg()}`}
          >
            {getTrendIcon()}
            {getTrendText()}
          </span>
        ) : comparison ? (
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {comparison.trend === 'neutral' ? 'ثابت' : 'لا توجد بيانات سابقة'}
          </span>
        ) : periodLabel ? (
          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full">
            {periodLabel}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            لا توجد مقارنة
          </span>
        )}
      </div>
    </div>
  );
};

export const ComparisonStatCardGrid: React.FC<{
  cards: Array<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    accentColor: 'rose' | 'amber' | 'blue' | 'purple' | 'emerald';
    comparison?: ComparisonResult;
    invertColors?: boolean;
  }>;
  columns?: 1 | 2 | 3 | 4;
  gap?: number;
}> = ({ cards, columns = 4, gap = 4 }) => {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
  };

  return (
    <div className={`${colClasses[columns]} ${gapClasses[gap as keyof typeof gapClasses] || 'gap-4'}`}>
      {cards.map((card, idx) => (
        <ComparisonStatCard key={idx} {...card} />
      ))}
    </div>
  );
};