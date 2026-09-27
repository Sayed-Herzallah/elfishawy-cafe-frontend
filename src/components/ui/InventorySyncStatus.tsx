import React from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';

interface InventorySyncStatusProps {
  syncStatus?: string | null;
  sync_status?: string | null;
  className?: string;
}

/** Shows the local restock immediately and keeps its sync state visible until server confirmation. */
export const InventorySyncStatus: React.FC<InventorySyncStatusProps> = ({
  syncStatus,
  sync_status,
  className = '',
}) => {
  const status = String(syncStatus || sync_status || '').toUpperCase();
  if (status !== 'PENDING_SYNC' && status !== 'PENDING') return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} dir="rtl">
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> تمت الزيادة
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
        <Clock3 className="h-3 w-3" /> قيد المزامنة
      </span>
    </div>
  );
};
