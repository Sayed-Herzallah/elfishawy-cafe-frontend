import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AttaStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: 'rose' | 'amber' | 'blue' | 'purple' | 'emerald';
  changePct?: number;
  periodLabel?: string;
  previousValueText?: string;
  invertColors?: boolean;
}

const colorMap = {
  rose: {
    topStrip: 'from-rose-400 via-pink-400 to-rose-500',
    iconBg: 'bg-rose-100 border-rose-200 text-rose-500',
    glow: 'group-hover:border-rose-300/50',
  },
  amber: {
    topStrip: 'from-amber-400 via-yellow-400 to-amber-500',
    iconBg: 'bg-amber-100 border-amber-200 text-amber-500',
    glow: 'group-hover:border-amber-300/50',
  },
  blue: {
    topStrip: 'from-blue-400 via-cyan-400 to-blue-500',
    iconBg: 'bg-blue-100 border-blue-200 text-blue-500',
    glow: 'group-hover:border-blue-300/50',
  },
  purple: {
    topStrip: 'from-purple-400 via-indigo-400 to-purple-500',
    iconBg: 'bg-purple-100 border-purple-200 text-purple-500',
    glow: 'group-hover:border-purple-300/50',
  },
  emerald: {
    topStrip: 'from-emerald-400 via-teal-400 to-emerald-500',
    iconBg: 'bg-emerald-100 border-emerald-200 text-emerald-500',
    glow: 'group-hover:border-emerald-300/50',
  },
};

export const AttaStatCard: React.FC<AttaStatCardProps> = ({
  title,
  value,
  icon,
  accentColor,
  changePct,
  periodLabel = 'هذا اليوم',
  previousValueText,
  invertColors = false,
}) => {
  const scheme = colorMap[accentColor];
  const hasChange = changePct !== undefined && !Number.isNaN(changePct) && changePct !== 0;
  const isPositive = (changePct || 0) > 0;
  const isGood = invertColors ? !isPositive : isPositive;

    return (
    <div className={`group relative bg-white border border-gray-200/80 rounded-3xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-right font-sans overflow-hidden ${scheme.glow}`}>
      {/* Top Gradient Accent Strip */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${scheme.topStrip}`} />

      {/* Main Content Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Rounded Badge Icon */}
        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-inner ${scheme.iconBg}`}>
          {icon}
        </div>

        {/* Right Side: Value & Title */}
        <div className="text-right min-w-0">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 tracking-tight block truncate">
            {value}
          </span>
          <span className="text-xs font-bold text-gray-500 mt-1 block font-arabic-heading truncate">
            {title}
          </span>
        </div>
      </div>

      {/* Footer Info Row: Clear distinction between Current & Previous */}
      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
        {/* Previous Period Context Note */}
        <span className="text-gray-500 font-medium truncate">
          {previousValueText || periodLabel}
        </span>

        {/* % Growth Tag */}
        {hasChange ? (
          <span
            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full border ${
              isGood
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? `+${changePct}%` : `${changePct}%`}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {periodLabel}
          </span>
        )}
      </div>
    </div>
  );
};
