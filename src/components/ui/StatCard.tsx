import React, { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  percentage?: number;
  isPositive?: boolean;
  icon?: ReactNode;
  variant?: 'blue' | 'pink' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  percentage,
  isPositive = true,
  icon,
  variant = 'blue',
  className = '',
}) => {
  const variantStyles = {
    blue: 'bg-[#e8f1fd] border-transparent text-[#1e3a8a]',
    pink: 'bg-[#feecee] border-transparent text-[#9f1239]',
    neutral: 'bg-white border-gray-100 text-gray-900',
  };

  // شريط علوي بنفس ألوان ComparisonStatCard — توحيد مظهر البطاقات عبر المنصة
  const stripStyles = {
    blue: 'bg-gradient-to-l from-blue-400 via-cyan-400 to-blue-500',
    pink: 'bg-gradient-to-l from-rose-400 via-pink-400 to-rose-500',
    neutral: 'bg-gradient-to-l from-gray-300 via-gray-200 to-gray-300',
  };

  const clampedPercentage = percentage === undefined || percentage === null || Number.isNaN(percentage)
    ? 0
    : Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div
      className={`relative overflow-hidden rounded-xl p-3.5 flex flex-col justify-between border transition-all duration-200 shadow-xs hover:shadow-md ${variantStyles[variant]} ${className}`}
    >
      {/* Top Gradient Accent Strip — نفس لمسة ComparisonStatCard للتوحيد عبر الصفحات */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${stripStyles[variant]}`} />

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold opacity-80">{title}</span>
        {icon && <span className="opacity-70 scale-90">{icon}</span>}
      </div>

      <div className="my-1.5">
        <div className="text-lg sm:text-xl font-bold font-mono tracking-tight">{value}</div>
        {subtitle && <div className="text-[10px] opacity-75 mt-0.5">{subtitle}</div>}
      </div>

      {percentage !== undefined && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between gap-2 text-[9px] font-bold mb-1">
            <span className="opacity-60">النسبة</span>
            <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
              {clampedPercentage}%
            </span>
          </div>
          <div className="h-1 w-full bg-black/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isPositive ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${clampedPercentage}%` }}
            />
          </div>
        </div>
      )}

      {change && (
        <div className="flex items-center gap-1 text-[10px] font-medium mt-1">
          <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
            {isPositive ? '↗' : '↘'} {change}
          </span>
          <span className="opacity-60">عن الفترة السابقة</span>
        </div>
      )}
    </div>
  );
};
