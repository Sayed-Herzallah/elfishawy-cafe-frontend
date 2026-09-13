import { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryService } from '../services/opsService';
import { InventoryItem } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { isStockLow, isStockOut } from '../utils/stockStatus';
import { playAlertSound } from '../utils/soundFeedback';

interface InventoryState {
  items: InventoryItem[];
  lowStockItems: InventoryItem[];
  outOfStockItems: InventoryItem[];
  isLoading: boolean;
}

export const useInventorySync = (pollInterval = 30000) => {
  const [state, setState] = useState<InventoryState>({
    items: [],
    lowStockItems: [],
    outOfStockItems: [],
    isLoading: true,
  });

  const { showToast } = useNotification();
  const notifiedLowStock = useRef<Set<string>>(new Set());
  const notifiedOutOfStock = useRef<Set<string>>(new Set());

  const fetchInventory = useCallback(async () => {
    try {
      const res = await inventoryService.listInventory();
      if (res.success && res.data) {
        const items = res.data;
        const lowStock = items.filter(item => isStockLow(item.quantity, item.minLimit));
        const outOfStock = items.filter(item => isStockOut(item.quantity));

        setState(prev => ({
          ...prev,
          items,
          lowStockItems: lowStock,
          outOfStockItems: outOfStock,
          isLoading: false,
        }));

        // Check for new low stock alerts
        lowStock.forEach(item => {
          if (!notifiedLowStock.current.has(item._id)) {
            notifiedLowStock.current.add(item._id);
            playAlertSound('low');
            showToast(`⚠️ مخزون منخفض: ${item.name} (${item.quantity} ${item.unit} متبقي)`, 'info');
          }
        });

        // Check for new out of stock alerts
        outOfStock.forEach(item => {
          if (!notifiedOutOfStock.current.has(item._id)) {
            notifiedOutOfStock.current.add(item._id);
            playAlertSound('out');
            showToast(`🚫 نفذ المخزون: ${item.name} - يحتاج توريد فوري`, 'error');
          }
        });

        // Reset notifications: لما صنف يتوّرد ويرجع رصيده فوق حد التنبيه — يُسمح بتنبيهه مرة تانية لو نفد تاني
        lowStock.forEach(item => {
          if (!isStockLow(item.quantity, item.minLimit)) notifiedLowStock.current.delete(item._id);
        });
        outOfStock.forEach(item => {
          if (!isStockOut(item.quantity)) notifiedOutOfStock.current.delete(item._id);
        });
        const currentIds = new Set(items.map(i => i._id));
        notifiedLowStock.current.forEach(id => {
          if (!currentIds.has(id)) notifiedLowStock.current.delete(id);
        });
        notifiedOutOfStock.current.forEach(id => {
          if (!currentIds.has(id)) notifiedOutOfStock.current.delete(id);
        });

      }
    } catch (err) {
      console.error('Inventory sync error:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [showToast]);

  useEffect(() => {
    // Initial fetch
    fetchInventory();

    // Set up polling
    const interval = setInterval(fetchInventory, pollInterval);

    return () => clearInterval(interval);
  }, [fetchInventory, pollInterval]);

  return {
    ...state,
    refetch: fetchInventory,
  };
};

export const useProductAvailability = () => {
  const { items } = useInventorySync(30000);
  
  const getAvailableQuantity = useCallback((productId: string, recipeIngredients: Array<{ inventoryItem: string; consumeQty: number; isPrimary?: boolean }>) => {
    if (!recipeIngredients || recipeIngredients.length === 0) return 0;
    
    // الخامات الأساسية فقط هي التي تحدد عدد الأكواب المتاحة
    // الخامات المساعدة (مثل السكر واللبن) تُخصم عند البيع ولا تقيّد رصيد الأكواب
    const primaryIngredients = recipeIngredients.filter((ing) => ing.isPrimary !== false);
    const targetIngredients = primaryIngredients.length > 0 ? primaryIngredients : recipeIngredients;
    
    let minAvailable = Infinity;
    
    for (const ingredient of targetIngredients) {
      const inventoryItem = items.find(i => i._id === ingredient.inventoryItem);
      if (!inventoryItem || inventoryItem.quantity <= 0) {
        return 0;
      }
      const consumeQty = Number(ingredient.consumeQty);
      if (consumeQty <= 0) continue;
      const available = Math.floor(inventoryItem.quantity / consumeQty);
      minAvailable = Math.min(minAvailable, available);
    }
    
    return minAvailable === Infinity ? 0 : minAvailable;
  }, [items]);

  const isLowStock = useCallback((productId: string, recipeIngredients: Array<{ inventoryItem: string; consumeQty: number }>) => {
    const available = getAvailableQuantity(productId, recipeIngredients);
    return available > 0 && available <= 10;
  }, [getAvailableQuantity]);

  const isOutOfStock = useCallback((productId: string, recipeIngredients: Array<{ inventoryItem: string; consumeQty: number }>) => {
    const available = getAvailableQuantity(productId, recipeIngredients);
    return available <= 0;
  }, [getAvailableQuantity]);

  return {
    getAvailableQuantity,
    isLowStock,
    isOutOfStock,
  };
};