import React from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { Expense, InventoryItem } from '../../types';

interface InventorySyncStatusProps {
  status?: string | null;
  className?: string;
}

export function getInventoryRestockSyncStatus(item: InventoryItem, logs: Expense[]): string | undefined {
  const itemStatus = String(item.syncStatus || item.sync_status || '').toUpperCase();
  if (itemStatus === 'PENDING_SYNC' || itemStatus === 'PENDING') return itemStatus;

  const latestRestock = (logs || [])
    .filter((expense) => {
      const linked = expense.inventoryItemLinked;
      return expense.category === 'inventory' && typeof linked === 'object' && linked?._id === item._id;
    })
    .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime())[0];

  const expenseStatus = String(latestRestock?.syncStatus || '').toUpperCase();
  return expenseStatus === 'SYNCED' ? 'SYNCED' : expenseStatus === 'PENDING_SYNC' || expenseStatus === 'PENDING' ? expenseStatus : undefined;
}

/** Shows the local restock immediately and keeps its sync state visible until server confirmation. */
export const InventorySyncStatus: React.FC<InventorySyncStatusProps> = ({
  status,
  className = '',
}) => {
  const normalizedStatus = String(status || '').toUpperCase();
  if (normalizedStatus !== 'PENDING_SYNC' && normalizedStatus !== 'PENDING' && normalizedStatus !== 'SYNCED') return null;

  const isSynced = normalizedStatus === 'SYNCED';

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} dir="rtl">
      {isSynced ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> تمت المزامنة
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
          <Clock3 className="h-3 w-3" /> قيد المزامنة
        </span>
      )}
    </div>
  );
};
