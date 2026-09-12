import React, { useState, useEffect } from 'react';
import { inventoryService, expenseService } from '../../services/opsService';
import { productService, recipeService } from '../../services/catalogService';
import { syncProductStockAfterRestock, syncAllProductsStock } from '../../utils/stockSync';
import { isStockLow, isStockOut } from '../../utils/stockStatus';
import { InventoryItem, Expense } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice, formatNumber, formatDate, formatDateTime } from '../../utils/formatters';
import { mergeRestockHistory, addRestockJournalEntry, purchaseSummary } from '../../utils/restockJournal';
import { playSuccessSound } from '../../utils/soundFeedback';

import { StatCard } from '../../components/ui/StatCard';
import { ComparisonStatCard } from '../../components/ui/ComparisonStatCard';
import { DateRangeFilter, DateRange, toLocalDateString } from '../../components/ui/DateRangeFilter';
import { DashboardFilterBar } from '../../components/ui/DashboardFilterBar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  Boxes,
  AlertTriangle,
  Plus,
  ArrowDownToLine,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  Eye,
  Edit2,
  X,
  MoreVertical,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export const AdminInventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'out'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [formErrors, setFormErrors] = useState<{ name?: string; quantity?: string; minLimit?: string; totalCost?: string }>({});
  const [restockErrors, setRestockErrors] = useState<{ quantity?: string; totalCost?: string }>({});
  const [restockTotalCost, setRestockTotalCost] = useState('');
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [isRestockSubmitted, setIsRestockSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    quantity: '10',
    unit: 'KG',
    minLimit: '5',
    totalCost: '',
  });

  // Edit item states
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: '',
    unit: 'KG',
    minLimit: '5',
    totalCost: '',
  });
  const [editFormErrors, setEditFormErrors] = useState<{ name?: string; quantity?: string; minLimit?: string; totalCost?: string }>({});
  const [isEditFormSubmitted, setIsEditFormSubmitted] = useState(false);

  // View Detail State
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  // 🧾 قيود الشراء والتوريد المرتبطة بالأصناف — لعرضها في تفاصيل الصنف مع "بواسطة مين"
  const [purchaseLogs, setPurchaseLogs] = useState<Expense[]>([]);

  /** اسم اللي قام بآخر توريد للصنف — من بيانات الصنف أولاً ثم من آخر توريد معروف (سيرفر أو اليومية المحلية) */
  const resolveRestockerName = (item: InventoryItem): string => {
    const rb = item.lastRestockedBy;
    const fromItem =
      rb && typeof rb === 'object' ? rb.userName : typeof rb === 'string' ? rb : '';
    if (fromItem) return fromItem;

    const latest = mergeRestockHistory(item._id, purchaseLogs)[0];
    if (!latest) return '';

    // لو آخر توريد للصنف أحدث من آخر توريد معروف — حصل من جهاز تاني ومن غير سجل ومش هنعرف مين
    const restockedTime = new Date(item.lastRestocked || '').getTime();
    if (!isNaN(restockedTime) && restockedTime - latest.dateMs > 60 * 1000) return '';

    return latest.by || '';
  };

  /** 💰 التكلفة الصحيحة للصنف من فواتير الشراء الفعلية:
   * الإجمالي المستثمر = Σ مبالغ فواتير الشراء المرتبطة بالصنف
   * (مثلاً شريت حبوب مرتين ٢٠٠٠ + ٣٣٠٠ = ٥٣٠٠ — بدل ما بيظهر ٤٠٠٠ من سعر آخر توريد).
   * متوسط سعر الوحدة = الإجمالي ÷ إجمالي الكمية المشتراة */
  const costSummaryFor = (item: InventoryItem) => {
    const p = purchaseSummary(item._id, purchaseLogs);
    const total = p.total > 0 ? p.total : (item.costPrice || 0) * (item.quantity || 0);
    const unit = p.avgUnitCost > 0 ? p.avgUnitCost : item.costPrice || 0;
    return { total, unit, hasPurchases: p.total > 0, count: p.count, qty: p.qty };
  };

  const { showToast, showError } = useNotification();
  const { user } = useAuth();

  const loadInventory = async () => {
    try {
      setIsLoading(true);
      const res = await inventoryService.listInventory();
      if (res.success && res.data) {
        setItems(res.data);
      }
      // سجل المشتريات المرتبط بالأصناف (أفضل جهد)
      try {
        const expRes = await expenseService.listExpenses();
        if (expRes.success && expRes.data) {
          setPurchaseLogs(expRes.data.filter((e) => e.category === 'inventory'));
        }
      } catch {
        /* تجاهل — السجل إضافة تحسينية */
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  // 🔄 مزامنة أرصدة المنتجات مع المخزن عند فتح الصفحة —
  // رصيد المنتج بيترجع يتحسب من وصفته (الخام المتاح) لو حصل تضارب،
  // زي منتج وصل صفر بينما الخام لسه فيه رصيد يكفي أكواب جديدة.
  useEffect(() => {
    let cancelled = false;
    syncAllProductsStock().then((updatedCount) => {
      if (!cancelled && updatedCount > 0) {
        showToast(`🔄 تمت مزامنة ${updatedCount} منتج مع أرصدة المخزن تلقائياً`, 'info');
      }
    }).catch(() => { /* المزامنة تحسينية — فشلها لا يؤثر على الصفحة */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterReset = () => {
    setSearchQuery('');
    setFilterMode('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormSubmitted(true);
    const errors: { name?: string; quantity?: string; minLimit?: string; totalCost?: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم الصنف مطلوب';
    }
    if (formData.quantity === '' || Number(formData.quantity) < 0) {
      errors.quantity = 'الرجاء إدخال كمية صحيحة (0 أو أكثر)';
    }
    if (formData.minLimit === '' || Number(formData.minLimit) < 1) {
      errors.minLimit = 'الرجاء تحديد حد أدنى صحيح (1 أو أكثر)';
    }
    // ✅ التكلفة الإجمالية إجبارية
    if (formData.totalCost === '' || Number(formData.totalCost) <= 0) {
      errors.totalCost = 'التكلفة الإجمالية مطلوبة ويجب أن تكون أكبر من صفر';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setFormErrors({});

    try {
      setIsSubmitting(true);
      const qtyNum = Number(formData.quantity) || 0;
      const totalNum = Number(formData.totalCost);
      const res = await inventoryService.createItem({
        name: formData.name.trim(),
        quantity: qtyNum,
        unit: formData.unit,
        minLimit: Number(formData.minLimit) || 5,
        // ✅ الإجمالي بيتبعت للباك إند وهو بيحسب سعر تكلفة الوحدة (الإجمالي ÷ الكمية) ويسجل رصيد افتتاحي في المشتريات
        totalCost: totalNum,
      });

      if (res.success) {
        showToast('تمت إضافة صنف المخزون بنجاح');
        setIsAddModalOpen(false);
        setIsFormSubmitted(false);
        setFormErrors({});
        setFormData({ name: '', quantity: '10', unit: 'KG', minLimit: '5', totalCost: '' });
        loadInventory();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRestockSubmitted(true);
    const errors: { quantity?: string; totalCost?: string } = {};

    if (!restockQty || Number(restockQty) <= 0) {
      errors.quantity = 'الرجاء إدخال كمية توريد صحيحة أكبر من صفر';
    }
    // ✅ التكلفة الإجمالية للكمية المضافة إجبارية
    if (!restockTotalCost || Number(restockTotalCost) <= 0) {
      errors.totalCost = 'التكلفة الإجمالية مطلوبة ويجب أن تكون أكبر من صفر';
    }

    if (Object.keys(errors).length > 0) {
      setRestockErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setRestockErrors({});

    try {
      setIsSubmitting(true);
      // ✅ التوريد بيسجل الكمية + سعر تكلفة وحدة **متوسط مرجّح**:
      // (الكمية القديمة × سعرها القديم + قيمة فاتورة التوريد الجديدة) ÷ إجمالي الكمية
      // عشان الإجمالي بالمخزون يفضل صح مهما اشتريت نفس الصنف كام مرة.
      const qtyNum = Number(restockQty);
      const oldQty = Number(selectedItem?.quantity) || 0;
      const oldCost = Number(selectedItem?.costPrice) || 0;
      const newTotal = Number(restockTotalCost);
      const unitCost = Number((newTotal / qtyNum).toFixed(2));
      const weightedCost =
        oldQty > 0 && oldCost > 0
          ? Number(((oldQty * oldCost + newTotal) / (oldQty + qtyNum)).toFixed(2))
          : unitCost;
      const res = await inventoryService.restockItem(selectedItem!._id, qtyNum, weightedCost);
      if (res.success) {
        // 📓 تسجيل التوريد في اليومية المحلية باسم المستخدم — السيرفر مبيسجلش توريد المدير باسمه
        addRestockJournalEntry({
          itemId: selectedItem!._id,
          date: new Date().toISOString(),
          qty: qtyNum,
          totalCost: Number(restockTotalCost),
          unitCost,
          by: user?.userName || 'المدير',
          byRole: 'admin',
          source: 'admin-restock',
        });
        showToast(`تم توريد ${restockQty} ${selectedItem!.unit} لـ ${selectedItem!.name} بتكلفة إجمالية ${Number(restockTotalCost).toLocaleString('en-US')} جنيها`);
        playSuccessSound();
        setIsRestockModalOpen(false);
        setIsRestockSubmitted(false);
        setRestockErrors({});
        setRestockQty('');
        setRestockTotalCost('');

        // ✅ مزامنة تلقائية للمنتجات المرتبطة
        const updatedCount = await syncProductStockAfterRestock(selectedItem!._id);
        if (updatedCount > 0) {
          showToast(`تم تحديث ${updatedCount} منتج مرتبط تلقائياً`, 'info');
        }

        // ✅ فتح تفاصيل الصنف تلقائياً بعد التوريد للتحقق من الرصيد الجديد
        const freshRes = await inventoryService.listInventory();
        if (freshRes.success && freshRes.data) {
          setItems(freshRes.data);
          const fresh = freshRes.data.find((i: InventoryItem) => i._id === selectedItem!._id);
          if (fresh) setViewingItem(fresh);
        } else {
          loadInventory();
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditFormSubmitted(true);
    const errors: { name?: string; quantity?: string; minLimit?: string; totalCost?: string } = {};

    if (!editFormData.name.trim()) {
      errors.name = 'اسم الصنف مطلوب';
    }
    if (editFormData.quantity === '' || Number(editFormData.quantity) < 0) {
      errors.quantity = 'الرجاء إدخال رصيد صحيح (صفر أو أكثر)';
    }
    if (editFormData.minLimit === '' || Number(editFormData.minLimit) < 1) {
      errors.minLimit = 'الرجاء تحديد حد أدنى صحيح (1 أو أكثر)';
    }
    // ✅ التكلفة الإجمالية اختيارية — لو اتكتبت لازم تكون أكبر من صفر والكمية الجديدة تكفي للحساب
    if (editFormData.totalCost !== '') {
      if (Number(editFormData.totalCost) <= 0) {
        errors.totalCost = 'التكلفة الإجمالية يجب أن تكون أكبر من صفر';
      } else if (Number(editFormData.quantity) <= 0) {
        errors.totalCost = 'الكمية صفر — لا يمكن حساب التكلفة. امسح التكلفة أو عدّل الكمية.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setEditFormErrors({});

    try {
      setIsSubmitting(true);
      // ✅ تعديل التكلفة الإجمالية من الفرونت — الـ API بيخزن تكلفة الوحدة (الإجمالي ÷ الكمية الجديدة)
      const totalNum = Number(editFormData.totalCost);
      const qtyNum = Number(editFormData.quantity) || 0;
      const updatedCostPrice =
        editFormData.totalCost !== '' && totalNum > 0 && qtyNum > 0
          ? Number((totalNum / qtyNum).toFixed(2))
          : undefined;

      const res = await inventoryService.updateItem(editingItem!._id, {
        name: editFormData.name.trim(),
        quantity: qtyNum,
        unit: editFormData.unit,
        minLimit: Number(editFormData.minLimit),
        ...(updatedCostPrice !== undefined ? { costPrice: updatedCostPrice } : {}),
      });

      if (res.success) {
        showToast(
          updatedCostPrice !== undefined
            ? `تم تحديث الصنف والتكلفة الإجمالية (${Number(editFormData.totalCost).toLocaleString('en-US')} جنيها) بنجاح`
            : 'تم تحديث صنف المخزون بنجاح'
        );
        setIsEditModalOpen(false);
        setIsEditFormSubmitted(false);
        setEditFormErrors({});
        setEditingItem(null);
        loadInventory();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await inventoryService.deleteItem(deleteTarget.id);
      if (res.success) {
        showToast('تم حذف الصنف من المخزن');
        loadInventory();
      }
    } catch (err) {
      showError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const lowStockCount = items.filter((i) => isStockLow(i.quantity, i.minLimit)).length;
  const outOfStockCount = items.filter((i) => isStockOut(i.quantity)).length;

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    if (!matchesSearch) return false;

    // ✅ نطاق التاريخ المخصص — على آخر توريد / تحديث للصنف
    if (dateFrom || dateTo) {
      const itemDate = new Date(item.lastRestocked || item.updatedAt || item.createdAt || '');
      if (!itemDate || isNaN(itemDate.getTime())) return false;
      if (dateFrom && itemDate < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && itemDate > new Date(`${dateTo}T23:59:59.999`)) return false;
    }

    if (filterMode === 'low') return isStockLow(item.quantity, item.minLimit);
    if (filterMode === 'out') return isStockOut(item.quantity);
    return true;
  });

  // 📊 كل الإحصائيات بتتحسب من النتائج المعروضة بعد الفلترة — مش من كل الأصناف
  const shownLowCount = filteredItems.filter((i) => isStockLow(i.quantity, i.minLimit)).length;
  const shownOutCount = filteredItems.filter((i) => isStockOut(i.quantity)).length;
  const shownValue = filteredItems.reduce((sum, i) => sum + (costSummaryFor(i).total || 0), 0);
  const shownAvailableCount = Math.max(0, filteredItems.length - shownLowCount - shownOutCount);
  const availablePct = filteredItems.length > 0 ? Math.round((shownAvailableCount / filteredItems.length) * 100) : 0;
  const lowPct = filteredItems.length > 0 ? Math.round((shownLowCount / filteredItems.length) * 100) : 0;
  const outPct = filteredItems.length > 0 ? Math.round((shownOutCount / filteredItems.length) * 100) : 0;

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Top Header - Swapped to put text on right, and actions on left */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
        <div>
          <h1 className="text-2xl font-bold font-arabic-heading text-gray-900">
            دفتر المخزون والمواد الخام
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            تتبع كميات البن، الحليب، العبوات ومستلزمات التشغيل اليومية.
          </p>
        </div>

        <div>
          <Button
            onClick={() => {
              setFormErrors({});
              setIsAddModalOpen(true);
            }}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 ml-1.5" />}
            className="bg-[#2e5b9f] hover:bg-[#244b85]"
          >
            إضافة صنف مخزون
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الأصناف المعروضة"
          value={`${formatNumber(filteredItems.length)} صنف`}
          percentage={availablePct}
          icon={<Boxes className="w-5 h-5 text-gray-500" />}
          variant="neutral"
        />
        <StatCard
          title="مخزون منخفض"
          value={`${formatNumber(shownLowCount)} صنف`}
          subtitle="أقل من حد الأمان"
          percentage={lowPct}
          isPositive={false}
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          variant="neutral"
        />
        <StatCard
          title="نفد من المخزون"
          value={`${formatNumber(shownOutCount)} صنف`}
          subtitle="يحتاج لتوريد عاجل"
          percentage={outPct}
          isPositive={false}
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          variant="pink"
        />
        <StatCard
          title="قيمة المخزون المعروض"
          value={formatPrice(shownValue)}
          icon={<CheckCircle2 className="w-5 h-5 text-[#2e5b9f]" />}
          variant="blue"
        />
      </div>

      {/* ✨ شريط الفلترة الموحّد — بحث + حالة + منتقي تاريخ احترافي */}
      <DashboardFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="ابحث في الأصناف والمواد — مثال: بن، سكر، أكواب"
        groupLabel="الحالة:"
        periods={[
          { id: 'all', label: `الكل (${formatNumber(items.length)})` },
          { id: 'low', label: `منخفض (${formatNumber(lowStockCount)})` },
          { id: 'out', label: `نافد (${formatNumber(outOfStockCount)})` },
        ]}
        activePeriod={filterMode}
        onPeriodChange={(id) => setFilterMode(id as typeof filterMode)}
        resultCount={filteredItems.length}
        resultLabel="صنف معروض"
        activeCount={
          (searchQuery ? 1 : 0) +
          (filterMode !== 'all' ? 1 : 0) +
          (dateFrom ? 1 : 0) +
          (dateTo ? 1 : 0)
        }
        onReset={handleFilterReset}
      >
        <DateRangeFilter
          value={{
            from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
            to: dateTo ? new Date(`${dateTo}T00:00:00`) : null,
            preset: 'custom',
          }}
          onChange={(range) => {
            setDateFrom(range.from ? toLocalDateString(range.from) : '');
            setDateTo(range.to ? toLocalDateString(range.to) : '');
          }}
          maxDate={new Date()}
          showPresets
          className="w-full sm:w-[260px]"
        />
      </DashboardFilterBar>

      {/* Main 2-Column Layout - RTL: Content on right (order-1), Sidebar on left (order-2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Content: Inventory Table (8 cols) - Right side visually */}
        <div className="lg:col-span-8 lg:order-1 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
            <span className="text-xs text-gray-400 font-mono">
              {filteredItems.length} صنف معروض
            </span>
            <h3 className="font-bold text-base text-gray-900">الأصناف الحالية</h3>
          </div>

          {isLoading ? (
            <LoadingSkeleton type="table" count={8} />
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-14 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400 mx-2">
              <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
                {filterMode === 'low' || filterMode === 'out' ? <CheckCircle2 className="w-6 h-6" /> : <Boxes className="w-6 h-6" />}
              </div>
              {filterMode === 'low' ? (
                <>
                  <p className="text-gray-600 font-bold text-sm">لا توجد أصناف منخفضة حالياً</p>
                  <p className="text-xs text-gray-500 mt-2">كل الأرصدة فوق حد الأمان — لا حاجة لتوريد عاجل.</p>
                </>
              ) : filterMode === 'out' ? (
                <>
                  <p className="text-gray-600 font-bold text-sm">لا توجد أصناف نافدة حالياً</p>
                  <p className="text-xs text-gray-500 mt-2">كل الأصناف لديها رصيد متاح بالمخزن.</p>
                </>
              ) : searchQuery.trim() || dateFrom || dateTo ? (
                <>
                  <p className="text-gray-600 font-bold text-sm">لا توجد أصناف مطابقة للفلاتر الحالية</p>
                  <p className="text-xs text-gray-500 mt-2">جرّب تعديل البحث أو امسح الفلاتر لعرض كل الأصناف.</p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 font-bold text-sm">لا توجد أصناف في المخزون بعد</p>
                  <p className="text-xs text-gray-500 mt-2">ابدأ بإضافة صنف مخزون جديد ليظهر هنا.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card Layout (< md) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                {filteredItems.map((item) => {
                  const isLow = isStockLow(item.quantity, item.minLimit);
                  const isOut = isStockOut(item.quantity);
                  const restockerName = resolveRestockerName(item) || null;
                  const costInfo = costSummaryFor(item);

return (
                     <div
                       key={item._id}
                       className="bg-white border border-gray-200/70 rounded-2xl p-4 space-y-3 text-right shadow-2xs hover:shadow-sm hover:border-[#2e5b9f]/30 transition"
                       onClick={() => setViewingItem(item)}
                     >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${isOut ? 'bg-rose-50 text-rose-600 border-rose-200/60' : isLow ? 'bg-amber-50 text-amber-600 border-amber-200/60' : 'bg-[#2e5b9f]/10 text-[#2e5b9f] border-[#2e5b9f]/15'}`}>
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-gray-900 text-sm block truncate">{item.name}</span>
                            {item.lastRestocked && (
                              <span className="text-[10px] text-gray-400 font-mono mt-0.5 block truncate">
                                آخر توريد: {formatDate(item.lastRestocked)}
                                {restockerName ? ` • ${restockerName}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={isOut ? 'out' : isLow ? 'low' : 'available'}
                          size="sm"
                        >
                          {isOut ? 'نافد' : isLow ? 'منخفض' : 'مستقر'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#faf8f5] rounded-xl px-2.5 py-2 text-center">
                          <span className="text-[9px] font-bold text-gray-400 block mb-0.5">الكمية الحالية</span>
                          <span className="font-black text-gray-900 font-mono text-xs">
                            {formatNumber(item.quantity)} {item.unit}
                          </span>
                        </div>
                        <div className="bg-[#faf8f5] rounded-xl px-2.5 py-2 text-center">
                          <span className="text-[9px] font-bold text-gray-400 block mb-0.5">حد الأمان</span>
                          <span className="font-black text-gray-700 font-mono text-xs">
                            {formatNumber(item.minLimit)} {item.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 rounded-xl px-3 py-2 gap-2">
                        <span className="text-[10px] font-bold text-[#2e5b9f]">التكلفة الإجمالية المستثمرة</span>
                        <span className={`font-black font-mono text-sm ${costInfo.total > 0 ? 'text-[#2e5b9f]' : 'text-gray-300'}`}>
                          {costInfo.total > 0 ? formatPrice(costInfo.total) : '—'}
                        </span>
                      </div>
                      {costInfo.hasPurchases && (
                        <p className="text-[9px] text-gray-400 text-left -mt-1.5 font-medium">
                          محسوبة من {formatNumber(costInfo.count)} فاتورة شراء • {formatNumber(costInfo.qty)} {item.unit}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100/50">
<button
                           onClick={(e) => {
                             e.stopPropagation();
                             setViewingItem(item);
                           }}
                           className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold transition text-[11px]"
                           title="عرض التفاصيل"
                         >
                          <Eye className="w-3.5 h-3.5" />
                          <span>تفاصيل</span>
                        </button>
<button
                           onClick={(e) => {
                             e.stopPropagation();
                              setEditingItem(item);
                              setEditFormData({
                                name: item.name,
                                quantity: String(item.quantity),
                                unit: item.unit,
                                minLimit: String(item.minLimit),
                                totalCost: item.costPrice ? String(Number((item.costPrice * item.quantity).toFixed(2))) : '',
                              });
                             setEditFormErrors({});
                             setIsEditFormSubmitted(false);
                             setIsEditModalOpen(true);
                           }}
                           className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold transition text-[11px]"
                           title="تعديل الصنف"
                         >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            setRestockQty('10');
                            setRestockTotalCost(item.costPrice ? String((item.costPrice * 10).toFixed(0)) : '');
                            setRestockErrors({});
                            setIsRestockModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-blue-50 text-[#2e5b9f] hover:bg-blue-100 font-bold transition text-[11px]"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          <span>توريد</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(item._id, item.name); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="حذف الصنف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table Layout (>= md) */}
              <div className="hidden md:block overflow-x-auto -mx-6 px-6 pb-2">
                <table className="w-full text-right border-collapse text-xs min-w-[760px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                      <th className="pb-3 px-3">اسم المادة / الصنف</th>
                      <th className="pb-3 px-3">الكمية الحالية</th>
                      <th className="pb-3 px-3">التكلفة الإجمالية</th>
                      <th className="pb-3 px-3">حد الأمان</th>
                      <th className="pb-3 px-3">آخر توريد</th>
                      <th className="pb-3 px-3">الحالة</th>
                      <th className="pb-3 px-3 text-left">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {filteredItems.map((item) => {
                      const isLow = item.quantity > 0 && item.quantity <= item.minLimit;
                      const isOut = item.quantity <= 0;
                      const restockerName = resolveRestockerName(item) || null;
                      const costInfo = costSummaryFor(item);

                      return (
                        <tr
                          key={item._id}
                          className="hover:bg-[#faf8f5]/60 transition cursor-pointer"
                          onClick={() => setViewingItem(item)}
                        >
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-gray-900 block">{item.name}</span>
                            {item.lastRestocked && (
                              <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                                {formatDate(item.lastRestocked)}
                                {restockerName ? ` • ${restockerName}` : ''}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                            {formatNumber(item.quantity)} {item.unit}
                          </td>

                          <td className="py-3.5 px-3 font-mono text-[#2e5b9f] font-bold text-sm whitespace-nowrap">
                            {costInfo.total > 0 ? formatPrice(costInfo.total) : '—'}
                          </td>

                          <td className="py-3.5 px-3 font-mono text-sm font-bold text-gray-700 whitespace-nowrap">
                            {formatNumber(item.minLimit)} {item.unit}
                          </td>

                          <td className="py-3.5 px-3 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                            {formatDate(item.lastRestocked) || '—'}
                          </td>

                          <td className="py-3.5 px-3">
                            <Badge
                              variant={isOut ? 'out' : isLow ? 'low' : 'available'}
                              size="sm"
                            >
                              {isOut ? 'نفد المخزون' : isLow ? 'مخزون منخفض' : 'متوفر ومستقر'}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-3 text-left">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setViewingItem(item); }}
                                className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold transition text-[11px]"
                                title="عرض التفاصيل"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>تفاصيل</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(item);
                                  setEditFormData({
                                    name: item.name,
                                    quantity: String(item.quantity),
                                    unit: item.unit,
                                    minLimit: String(item.minLimit),
                                    totalCost: item.costPrice ? String(Number((item.costPrice * item.quantity).toFixed(2))) : '',
                                  });
                                  setEditFormErrors({});
                                  setIsEditFormSubmitted(false);
                                  setIsEditModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold transition text-[11px]"
                                title="تعديل الصنف"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(item);
                                  setRestockQty('10');
                                  setRestockTotalCost(item.costPrice ? String((item.costPrice * 10).toFixed(0)) : '');
                                  setRestockErrors({});
                                  setIsRestockModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-blue-50 text-[#2e5b9f] hover:bg-blue-100 font-bold transition text-[11px]"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                <span>توريد</span>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(item._id, item.name); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Sidebar: Stock Movements Log (4 cols) - Left side visually */}
        <div className="lg:col-span-4 lg:order-2 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs text-gray-400">سجل العمليات</span>
            <h3 className="font-bold text-base text-gray-900">حركة المخزون</h3>
          </div>

          <div className="space-y-3 text-xs">
            {items.slice(0, 5).map((item) => {
              const isLow = item.quantity > 0 && item.quantity <= item.minLimit;
              const isOut = item.quantity <= 0;
              return (
                <div key={item._id} className="p-3 rounded-xl bg-[#faf8f5] border border-gray-100 space-y-1">
                  <div className="flex justify-between items-center text-gray-800 font-bold">
                    <span className={`font-mono ${isOut ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {item.quantity} {item.unit}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {isOut ? 'نفد من المخزون - يحتاج توريد عاجل' : isLow ? 'مخزون منخفض - قريب من حد الأمان' : 'متوفر ومستقر'}
                  </p>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">
                لا توجد حركة مخزون مسجلة بعد.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsFormSubmitted(false);
          setFormErrors({});
          setFormData({ name: '', quantity: '10', unit: 'KG', minLimit: '5', totalCost: '' });
        }}
        title="إضافة صنف مخزون جديد"
        maxWidth="md"
      >
        <form noValidate onSubmit={handleCreateItem} className="space-y-4 text-right">
          <Input
            label="اسم الصنف / المادة الخام *"
            placeholder="مثال: حبوب بن برازيلي، سكر بني، أكواب 12oz..."
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
            }}
            error={formErrors.name}
            isSubmitted={isFormSubmitted}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الكمية الابتدائية *"
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) => {
                setFormData({ ...formData, quantity: e.target.value });
                if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: undefined });
              }}
              error={formErrors.quantity}
              isSubmitted={isFormSubmitted}
              required
            />

            <Select
              label="وحدة القياس *"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'KG', label: 'كيلوجرام (KG)' },
                { value: 'GRAM', label: 'جرام (GRAM)' },
                { value: 'LITER', label: 'لتر (LITER)' },
                { value: 'ML', label: 'مليلتر (ML)' },
                { value: 'PIECE', label: 'قطعة (PIECE)' },
              ]}
            />
          </div>

          <Input
            label="حد الأمان الأدنى (Min Limit) *"
            type="number"
            min="1"
            value={formData.minLimit}
            onChange={(e) => {
              setFormData({ ...formData, minLimit: e.target.value });
              if (formErrors.minLimit) setFormErrors({ ...formErrors, minLimit: undefined });
            }}
            error={formErrors.minLimit}
            isSubmitted={isFormSubmitted}
            helperText="سيتم إظهار تنبيه فور وصول المخزون لهذه الكمية أو أقل."
            required
          />

          <Input
            label="التكلفة الإجمالية (جنيها) *"
            type="number"
            min="0"
            step="any"
            placeholder="مثال: 1500"
            value={formData.totalCost}
            onChange={(e) => {
              setFormData({ ...formData, totalCost: e.target.value });
              if (formErrors.totalCost) setFormErrors({ ...formErrors, totalCost: undefined });
            }}
            error={formErrors.totalCost}
            isSubmitted={isFormSubmitted}
            helperText="إجمالي ما دفعت للكمية كلها — سعر تكلفة الوحدة بيتحسب تلقائياً (الإجمالي ÷ الكمية)."
            required
          />

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsFormSubmitted(false);
                setFormErrors({});
                setFormData({ name: '', quantity: '10', unit: 'KG', minLimit: '5', totalCost: '' });
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f]"
            >
              إضافة الصنف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Restock Modal */}
      <Modal
        isOpen={isRestockModalOpen}
        onClose={() => {
          setIsRestockModalOpen(false);
          setIsRestockSubmitted(false);
          setRestockErrors({});
          setRestockQty('');
          setRestockTotalCost('');
        }}
        title={`توريد كمية إضافية: ${selectedItem?.name || ''}`}
        maxWidth="sm"
      >
        <form noValidate onSubmit={handleRestock} className="space-y-4 text-right">
          <p className="text-xs text-gray-500">
            الكمية الحالية:{' '}
            <span className="font-bold text-gray-900 font-mono">
              {selectedItem?.quantity} {selectedItem?.unit}
            </span>
          </p>

          <Input
            label={`الكمية المضافة (${selectedItem?.unit}) *`}
            type="number"
            min="1"
            placeholder="10"
            value={restockQty}
            onChange={(e) => {
              setRestockQty(e.target.value);
              if (restockErrors.quantity) setRestockErrors({ ...restockErrors, quantity: undefined });
            }}
            error={restockErrors.quantity}
            isSubmitted={isRestockSubmitted}
            autoFocus
            required
          />

          <Input
            label={`التكلفة الإجمالية للكمية المضافة (جنيها) *`}
            type="number"
            min="0"
            step="any"
            placeholder="مثال: 1500"
            value={restockTotalCost}
            onChange={(e) => {
              setRestockTotalCost(e.target.value);
              if (restockErrors.totalCost) setRestockErrors({ ...restockErrors, totalCost: undefined });
            }}
            error={restockErrors.totalCost}
            isSubmitted={isRestockSubmitted}
            required
          />
          <p className="text-[10px] text-gray-400 -mt-2">
            سعر تكلفة الوحدة بيتحسب تلقائياً: الإجمالي ÷ الكمية
            {Number(restockQty) > 0 && Number(restockTotalCost) > 0 && (
              <span className="font-mono font-bold text-[#2e5b9f]">
                {' '}= {(Number(restockTotalCost) / Number(restockQty)).toFixed(2)} / {selectedItem?.unit}
              </span>
            )}
          </p>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRestockModalOpen(false);
                setIsRestockSubmitted(false);
                setRestockErrors({});
                setRestockQty('');
                setRestockTotalCost('');
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f]"
            >
              تأكيد التوريد
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف الصنف "${deleteTarget?.name}" من المخزن؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />

      {/* View Item Detail Modal */}
      <Modal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        title={`تفاصيل الصنف: ${viewingItem?.name || ''}`}
        maxWidth="lg"
      >
        {viewingItem && (
          <div className="space-y-4 text-right min-w-0">
            <div className="flex items-center gap-4 p-4 bg-[#faf8f5] rounded-2xl border border-gray-100">
              <Boxes className="w-10 h-10 rounded-xl bg-[#2e5b9f] text-white flex items-center justify-center shrink-0" />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 break-words">{viewingItem.name}</h3>
                <p className="text-xs text-gray-500 mt-1">صنف مخزون</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">الكمية الحالية</span>
                <span className="text-lg font-bold font-mono text-[#2e5b9f]">{formatNumber(viewingItem.quantity)} {viewingItem.unit}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">حد الأمان (Min Limit)</span>
                <span className="text-lg font-bold font-mono text-gray-900">{formatNumber(viewingItem.minLimit)} {viewingItem.unit}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">الحالة</span>
                <Badge
                  variant={isStockOut(viewingItem.quantity) ? 'out' : isStockLow(viewingItem.quantity, viewingItem.minLimit) ? 'low' : 'available'}
                  size="sm"
                >
                  {isStockOut(viewingItem.quantity) ? 'نفد المخزون' : isStockLow(viewingItem.quantity, viewingItem.minLimit) ? 'مخزون منخفض' : 'متوفر ومستقر'}
                </Badge>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">تم التوريد بواسطة</span>
                <span className="text-sm font-bold text-gray-900 break-words">
                  {resolveRestockerName(viewingItem) || '—'}
                </span>
              </div>

              {/* 💰 بطاقة التكلفة الإجمالية — إجمالي كل فواتير الشراء الفعلية للصنف */}
              <div className="sm:col-span-2 p-4 bg-[#2e5b9f]/5 rounded-xl border border-[#2e5b9f]/20 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 font-bold block">التكلفة الإجمالية المستثمرة</span>
                  <span className="text-xl font-bold font-mono text-[#2e5b9f]">
                    {costSummaryFor(viewingItem).total > 0 ? formatPrice(costSummaryFor(viewingItem).total) : '—'}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">إجمالي ما تم دفعه فعلاً لشراء هذا الصنف</span>
                </div>
                <div className="text-left shrink-0">
                  <span className="text-[10px] text-gray-500 font-bold block">الكمية المشتراة / مرات الشراء</span>
                  <span className="text-sm font-bold font-mono text-gray-900 whitespace-nowrap">
                    {costSummaryFor(viewingItem).hasPurchases
                      ? `${formatNumber(costSummaryFor(viewingItem).qty)} ${viewingItem.unit}`
                      : '—'}
                  </span>
                  {costSummaryFor(viewingItem).hasPurchases && (
                    <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                      {formatNumber(costSummaryFor(viewingItem).count)} فاتورة شراء
                    </span>
                  )}
                </div>
              </div>
              {/* 📈 تاريخ الأسعار والتوريد — كل توريد بسعره وتاريخه ومين اللي ورّد (سعر قديم ← سعر جديد) */}
              {(() => {
                const history = mergeRestockHistory(viewingItem._id, purchaseLogs).slice(0, 8);
                if (history.length === 0) return null;
                return (
                  <div className="sm:col-span-2 space-y-2 min-w-0">
                    <span className="text-[10px] text-gray-400 font-bold block">
                      📈 سجل التوريدات والأسعار ({formatNumber(history.length)} عملية — الأحدث أولاً)
                    </span>
                  {history.map((entry, idx) => {
                    const older = history[idx + 1];
                    const priceChanged =
                      entry.unitCost !== undefined &&
                      older?.unitCost !== undefined &&
                      Math.abs(entry.unitCost - older.unitCost) > 0.009;
                    const priceWentDown = priceChanged && (entry.unitCost as number) < (older!.unitCost as number);
                    return (
                      <div key={entry.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        {/* الرأس: العملية + التاريخ */}
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#faf8f5] border-b border-gray-100">
                          <span className="text-xs font-bold text-gray-900">
                            ✅ توريد <span className="font-mono text-emerald-700">+{formatNumber(entry.qty)}</span> {viewingItem.unit}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500 whitespace-nowrap">
                            🕒 {formatDateTime(new Date(entry.dateMs))}
                          </span>
                        </div>

                        {/* خلايا واضحة بعناوين منفصلة — بدل السطور المدمجة الملبكة */}
                        <div className="grid grid-cols-3 gap-2 px-3 py-2.5">
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold block mb-0.5">سعر الوحدة</span>
                            <span className="text-xs font-bold font-mono text-[#2e5b9f]">
                              {entry.unitCost !== undefined ? formatPrice(entry.unitCost) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold block mb-0.5">إجمالي الفاتورة</span>
                            <span className="text-xs font-bold font-mono text-gray-900">
                              {entry.totalCost !== undefined ? formatPrice(entry.totalCost) : '—'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] text-gray-400 font-bold block mb-0.5">بواسطة</span>
                            <span className="flex items-center gap-1 min-w-0">
                              <span className="text-[11px] font-bold text-gray-800 truncate">{entry.by}</span>
                              {entry.byRole && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-px rounded-full text-[9px] font-bold border shrink-0 ${
                                    entry.byRole === 'admin'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {entry.byRole === 'admin' ? 'مدير' : 'كاشير'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* شارات توضيحية: تغيّر السعر + المورد */}
                        {(priceChanged || entry.supplier) && (
                          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
                            {priceChanged && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  priceWentDown
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {priceWentDown ? '📉' : '📈'} السعر {priceWentDown ? 'أقل' : 'أعلى'} من السابق: {formatPrice(older!.unitCost!)} ← {formatPrice(entry.unitCost!)}
                              </span>
                            )}
                            {entry.supplier && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                                🏷️ مورد: {entry.supplier}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                );
              })()}

              {/* Timestamps */}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-xl">
                  <span className="text-base">📅</span>
                  <span className="text-[10px] text-blue-500 font-bold">أُنشئ في</span>
                  <span className="font-mono font-bold">{formatDate(viewingItem.createdAt)}</span>
                </span>
                {viewingItem.updatedAt && viewingItem.updatedAt !== viewingItem.createdAt && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-xl">
                    <span className="text-base">✏️</span>
                    <span className="text-[10px] text-amber-600 font-bold">آخر تعديل</span>
                    <span className="font-mono font-bold">{formatDate(viewingItem.updatedAt)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setViewingItem(null)}>
                إغلاق
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-[#2e5b9f]"
                onClick={() => {
                  setSelectedItem(viewingItem);
                  setRestockQty('10');
                  setRestockTotalCost(viewingItem.costPrice ? String((viewingItem.costPrice * 10).toFixed(0)) : '');
                  setRestockErrors({});
                  setIsRestockModalOpen(true);
                  setViewingItem(null);
                }}
              >
                <ArrowDownToLine className="w-3.5 h-3.5 ml-1" />
                <span>توريد كمية</span>
              </Button>
            </div>
            </div>
        )}
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setIsEditFormSubmitted(false);
          setEditFormErrors({});
          setEditingItem(null);
        }}
        title={`تعديل صنف مخزون: ${editingItem?.name || ''}`}
        maxWidth="md"
      >
        <form noValidate onSubmit={handleUpdateItem} className="space-y-4 text-right">
          <Input
            label="اسم الصنف / المادة الخام *"
            placeholder="مثال: حبوب بن برازيلي، سكر بني..."
            value={editFormData.name}
            onChange={(e) => {
              setEditFormData({ ...editFormData, name: e.target.value });
              if (editFormErrors.name) setEditFormErrors({ ...editFormErrors, name: undefined });
            }}
            error={editFormErrors.name}
            isSubmitted={isEditFormSubmitted}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الرصيد الحالي *"
              type="number"
              min="0"
              step="any"
              value={editFormData.quantity}
              onChange={(e) => {
                setEditFormData({ ...editFormData, quantity: e.target.value });
                if (editFormErrors.quantity) setEditFormErrors({ ...editFormErrors, quantity: undefined });
              }}
              error={editFormErrors.quantity}
              isSubmitted={isEditFormSubmitted}
              helperText="تصحيح يدوي للرصيد — استخدمه لو الرقم المسجل غلط."
              required
            />

            <Select
              label="وحدة القياس *"
              value={editFormData.unit}
              onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
              options={[
                { value: 'KG', label: 'كيلوجرام (KG)' },
                { value: 'GRAM', label: 'جرام (GRAM)' },
                { value: 'LITER', label: 'لتر (LITER)' },
                { value: 'ML', label: 'مليلتر (ML)' },
                { value: 'PIECE', label: 'قطعة (PIECE)' },
              ]}
            />
          </div>

          <Input
            label="حد الأمان الأدنى (Min Limit) *"
            type="number"
            min="1"
            value={editFormData.minLimit}
            onChange={(e) => {
              setEditFormData({ ...editFormData, minLimit: e.target.value });
              if (editFormErrors.minLimit) setEditFormErrors({ ...editFormErrors, minLimit: undefined });
            }}
            error={editFormErrors.minLimit}
            isSubmitted={isEditFormSubmitted}
            helperText="سيتم إظهار تنبيه فور وصول المخزون لهذه الكمية أو أقل."
            required
          />

          <Input
            label="التكلفة الإجمالية (جنيها)"
            type="number"
            min="0"
            step="any"
            placeholder="مثال: 1500"
            value={editFormData.totalCost}
            onChange={(e) => {
              setEditFormData({ ...editFormData, totalCost: e.target.value });
              if (editFormErrors.totalCost) setEditFormErrors({ ...editFormErrors, totalCost: undefined });
            }}
            error={editFormErrors.totalCost}
            isSubmitted={isEditFormSubmitted}
          />
          <p className="text-[10px] text-gray-400 -mt-2">
            عدّل الإجمالي لو الكمية نفسها بسعر جديد — سعر تكلفة الوحدة بيتحدث تلقائياً: الإجمالي ÷ الكمية
            {Number(editFormData.totalCost) > 0 && Number(editFormData.quantity) > 0 && (
              <span className="font-mono font-bold text-[#2e5b9f]">
                {' '}= {(Number(editFormData.totalCost) / Number(editFormData.quantity)).toFixed(2)} / {editFormData.unit}
              </span>
            )}
          </p>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setIsEditFormSubmitted(false);
                setEditFormErrors({});
                setEditingItem(null);
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f]"
            >
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};