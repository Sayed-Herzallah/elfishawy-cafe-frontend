import React, { useState, useEffect } from 'react';
import { inventoryService, expenseService } from '../../services/opsService';
import { InventoryItem, Expense } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ensurePurchaseRestockAndSync } from '../../utils/stockSync';
import { playSuccessSound } from '../../utils/soundFeedback';
import { addRestockJournalEntry, purchaseSummary } from '../../utils/restockJournal';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { StatCard } from '../../components/ui/StatCard';
import { useInventorySync } from '../../hooks/useInventorySync';
import { isStockLow, isStockOut } from '../../utils/stockStatus';
import { formatPrice, formatNumber, formatDate, formatStat } from '../../utils/formatters';
import {
  Plus,
  ArrowDownToLine,
  Search,
  SearchX,
  AlertTriangle,
  ShoppingBag,
  CheckCircle2,
  Bell,
  LayoutGrid,
  ListFilter,
  Boxes,
} from 'lucide-react';

export const CashierInventoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'out'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modals
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Add Item Form Data
  const [formData, setFormData] = useState({ name: '', quantity: '10', unit: 'KG', minLimit: '5', totalCost: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; quantity?: string; minLimit?: string; totalCost?: string }>({});

  // Purchase/Restock Form Data (Linked to real backend expenses)
  // سعر تكلفة الوحدة بيتحسب تلقائياً: الإجمالي ÷ الكمية — مش محتاج إدخال يدوي
  const [purchaseFormData, setPurchaseFormData] = useState({
    quantity: '10',
    totalAmount: '',
    supplierName: '',
    invoiceNumber: '',
  });

  // Form Error States
  const [purchaseErrors, setPurchaseErrors] = useState<{ quantity?: string; totalAmount?: string }>({});

  const { showToast, showError } = useNotification();
  // 🔐 إضافة صنف مخزون جديد صلاحية أدمن في الـ Backend (POST /inventory) —
  // لا نعرض الزر للكاشير حتى لا يرى إجراءً سيفشل دائماً بخطأ 403
  const { user, isAdmin } = useAuth();

  // Use inventory sync hook with real-time polling
  const { items, lowStockItems, outOfStockItems, isLoading, refetch } = useInventorySync(30000);

  // 🧾 قيود الشراء — لاستخراج آخر مورد لكل صنف (زي صفحة المشتريات) — أفضل جهد
  const [purchaseLogs, setPurchaseLogs] = useState<Expense[]>([]);
  useEffect(() => {
    expenseService.listExpenses()
      .then((res) => {
        if (res.success && res.data) {
          setPurchaseLogs(res.data.filter((e) => e.category === 'inventory'));
        }
      })
      .catch(() => { /* تجاهل — عرض المورد تحسيني */ });
  }, []);

  /** استخراج اسم المورد من وصف قيد الشراء بصيغة [مورد: ...] — زي صفحة المشتريات */
  const parseSupplier = (desc: string): string => {
    const m = (desc || '').match(/\[مورد:\s*([^\]]+)\]/);
    return m ? m[1].trim() : '';
  };

  const lastSupplierByItem = (() => {
    const map = new Map<string, string>();
    purchaseLogs
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime())
      .forEach((e) => {
        const linked = e.inventoryItemLinked;
        if (typeof linked === 'object' && linked !== null && !map.has(linked._id)) {
          const supplier = parseSupplier(e.description || '');
          if (supplier) map.set(linked._id, supplier);
        }
      });
    return map;
  })();

  // Computed values from hook data
  const lowStockCount = lowStockItems.length;
  const outOfStockCount = outOfStockItems.length;
  const healthyCount = items.filter(i => i.quantity > i.minLimit).length;
  // 💰 القيمة التقديرية للمخزون = Σ (الكمية × سعر تكلفة الوحدة)
  const inventoryValue = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0), 0);

  // Handle Add new Inventory Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; quantity?: string; minLimit?: string; totalCost?: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم الصنف مطلوب';
    }
    if (formData.quantity === '' || Number(formData.quantity) < 0) {
      errors.quantity = 'الرجاء إدخال كمية صحيحة';
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
      const res = await inventoryService.createItem({
        name: formData.name.trim(),
        quantity: qtyNum,
        unit: formData.unit,
        minLimit: Number(formData.minLimit) || 5,
        // ✅ الإجمالي بيتبعت للباك إند وهو بيحسب سعر تكلفة الوحدة (الإجمالي ÷ الكمية) ويسجل رصيد افتتاحي في المشتريات
        totalCost: formData.totalCost ? Number(formData.totalCost) : undefined,
      });

      if (res.success) {
        showToast('تمت إضافة صنف المخزون بنجاح');
        setIsAddModalOpen(false);
        setFormData({ name: '', quantity: '10', unit: 'KG', minLimit: '5', totalCost: '' });
        refetch();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Purchase & Restock via Backend Expense Service
  const handleOpenPurchaseModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setPurchaseErrors({});
    // الإجمالي المبدئي = سعر تكلفة الوحدة الحالي × 10 (الكمية الافتراضية)
    const initialQty = '10';
    const initialTotal = item.costPrice ? String(Number((item.costPrice * 10).toFixed(2))) : '';
    setPurchaseFormData({
      quantity: initialQty,
      totalAmount: initialTotal,
      supplierName: '',
      invoiceNumber: '',
    });
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const errors: { quantity?: string; totalAmount?: string } = {};
    const qty = Number(purchaseFormData.quantity);
    const total = Number(purchaseFormData.totalAmount);

    if (!purchaseFormData.quantity || isNaN(qty) || qty <= 0) {
      errors.quantity = 'الكمية المشتراة مطلوبة ويجب أن تكون أكبر من صفر';
    }
    if (!purchaseFormData.totalAmount || isNaN(total) || total <= 0) {
      errors.totalAmount = 'المبلغ الإجمالي مطلوب ويجب أن يكون أكبر من صفر';
    }

    if (Object.keys(errors).length > 0) {
      setPurchaseErrors(errors);
      showToast('الرجاء تصحيح بيانات الشراء المميزة بالأحمر', 'error');
      return;
    }

    setPurchaseErrors({});

    try {
      setIsSubmitting(true);
      // 🔍 رصيد الخام قبل التسجيل — عشان نتحقق بعدها إن الرصيد زاد فعلاً
      const qtyBefore = Number(selectedItem.quantity) || 0;
      // 🧹 اسم/بيان الشراء نظيف واحترافي (مش "تعبئة مخزون" ولا "شراء بضاعة") —
      // بيظهر في المشتريات كاسم المادة المختارة مع الكمية والمورد والفاتورة.
      const supplierTag = purchaseFormData.supplierName
        ? ` [مورد: ${purchaseFormData.supplierName.trim()}]`
        : '';
      const invoiceTag = purchaseFormData.invoiceNumber
        ? ` (فاتورة #${purchaseFormData.invoiceNumber.trim()})`
        : '';
      const desc = `${selectedItem.name} — شراء ${qty} ${selectedItem.unit}${supplierTag}${invoiceTag}`;

        const expRes = await expenseService.createExpense({
          description: desc,
          amount: total,
          category: 'inventory',
          inventoryItemLinked: selectedItem._id,
          inventoryQuantityAdded: qty,
          // الإجمالي وسعر الوحدة بيتسجلوا على القيد — الباك إند بيرفع سعر تكلفة الصنف تلقائياً
          totalCost: total,
          unitCost: qty > 0 ? Number((total / qty).toFixed(2)) : undefined,
          date: new Date().toISOString(),
        });

      if (expRes.success) {
        playSuccessSound();
        showToast(`تم توريد ${qty} ${selectedItem.unit} بنجاح وتسجيل المصروفات بقيمة ${total} جنيها`);
        setIsPurchaseModalOpen(false);

        // 📓 تسجيل التوريد في اليومية المحلية باسم الكاشير والسعر — احتياط لو قيد السيرفر ناقص
        addRestockJournalEntry({
          itemId: selectedItem._id,
          date: new Date().toISOString(),
          qty,
          totalCost: total,
          unitCost: qty > 0 ? Number((total / qty).toFixed(2)) : undefined,
          by: user?.userName || 'الكاشير',
          byRole: 'cashier',
          source: 'cashier-purchase',
        });

        // ✅ مضمون التوريد: نتأكد إن رصيد الخام زاد فعلاً (لو الـ Backend مازودش من
        // القيد بنعمل restock صريح) — وبعدها نزامن المنتجات المرتبطة فوراً
        const { updatedProducts } = await ensurePurchaseRestockAndSync({
          itemId: selectedItem._id,
          qtyBefore,
          addQty: qty,
          unitCost: qty > 0 ? Number((total / qty).toFixed(2)) : undefined,
        });
        if (updatedProducts > 0) {
          showToast(`🔄 تم تحديث ${updatedProducts} منتج مرتبط وأصبح متاحاً للبيع`, 'info');
        }

        refetch();
        // 🔄 تحديث سجل المشتريات المحلي فوراً — عشان التكلفة الإجمالية والمتوسط يتحدثوا في الجدول
        expenseService
          .listExpenses()
          .then((lres) => {
            if (lres.success && lres.data) {
              setPurchaseLogs(lres.data.filter((x) => x.category === 'inventory'));
            }
          })
          .catch(() => { /* تجاهل — العرض هيتحدث على التحديث التالي */ });
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 💰 التكلفة الصحيحة للصنف من فواتير الشراء الفعلية (مش من سعر آخر توريد بس):
   * الإجمالي المستثمر = Σ كل الفواتير المرتبطة بالصنف (مثال: ٢٠٠٠ + ٣٣٠٠ = ٥٣٠٠ ✅)
   * متوسط سعر الوحدة = الإجمالي ÷ إجمالي الكمية المشتراة */
  const costSummaryFor = (item: InventoryItem) => {
    const p = purchaseSummary(item._id, purchaseLogs);
    const total = p.total > 0 ? p.total : (item.costPrice || 0) * (item.quantity || 0);
    const unit = p.avgUnitCost > 0 ? p.avgUnitCost : item.costPrice || 0;
    return { total, unit, hasPurchases: p.total > 0, count: p.count };
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    if (filterMode === 'low') return matchesSearch && isStockLow(item.quantity, item.minLimit);
    if (filterMode === 'out') return matchesSearch && isStockOut(item.quantity);
    return matchesSearch;
  });

  return (
    <div className="space-y-5 text-right font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/70">
        <div>
          <h1 className="text-lg font-bold font-arabic-heading text-gray-900">
            مخزون المواد الخام والمشتريات
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            عرض الخامات المستودعية، تسجيل المشتريات المباشرة، وزيادة الأرصدة.
          </p>
        </div>

        {isAdmin && (
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
        )}
      </div>

      {/* Metric Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setFilterMode('all')} className="cursor-pointer">
          <StatCard
            title="إجمالي الأصناف"
            value={formatStat(items.length, 'صنف')}
            subtitle={`${formatStat(healthyCount, 'صنف')} بحالة ممتازة`}
            icon={<Plus className="w-5 h-5 text-gray-500" />}
            variant="neutral"
          />
        </div>
        <div onClick={() => setFilterMode('low')} className="cursor-pointer">
          <StatCard
            title="مخزون منخفض"
            value={formatStat(lowStockCount, 'صنف')}
            subtitle="أقل من حد الأمان"
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
            variant="neutral"
          />
        </div>
        <div onClick={() => setFilterMode('out')} className="cursor-pointer">
          <StatCard
            title="نفد من المخزون"
            value={formatStat(outOfStockCount, 'صنف')}
            subtitle="يحتاج لتوريد عاجل"
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
            variant="pink"
          />
        </div>
        <StatCard
          title="قيمة المخزون"
          value={formatStat(inventoryValue, 'جنيها')}
          icon={<CheckCircle2 className="w-5 h-5 text-[#2e5b9f]" />}
          variant="blue"
        />
      </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-gray-100">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث في الخامات والمواد — مثال: بن، سكر، أكواب"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#faf8f5] border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2e5b9f]"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-[#2e5b9f] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الكل ({items.length})
              </button>
              <button
                onClick={() => setFilterMode('low')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterMode === 'low'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                المنخفض ({lowStockCount})
              </button>
              <button
                onClick={() => setFilterMode('out')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterMode === 'out'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                النافد ({outOfStockCount})
              </button>
            </div>

            {/* View Mode Toggle (Cards vs Table) */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/80">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-[#2e5b9f] text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title="عرض الكروت"
                aria-label="عرض الكروت"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-[#2e5b9f] text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title="عرض الجدول"
                aria-label="عرض الجدول"
              >
                <ListFilter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton type="table" count={5} />
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
              {filterMode === 'low' || filterMode === 'out' ? <CheckCircle2 className="w-6 h-6" /> : <SearchX className="w-6 h-6" />}
            </div>
            {filterMode === 'low' ? (
              <>
                <p className="text-gray-600 font-bold text-sm">لا توجد خامات منخفضة حالياً</p>
                <p className="text-xs text-gray-500 mt-2">كل الأرصدة فوق حد الأمان — لا حاجة لتوريد عاجل.</p>
              </>
            ) : filterMode === 'out' ? (
              <>
                <p className="text-gray-600 font-bold text-sm">لا توجد خامات نافدة حالياً</p>
                <p className="text-xs text-gray-500 mt-2">كل الأصناف لديها رصيد متاح بالمخزن.</p>
              </>
            ) : searchQuery.trim() ? (
              <>
                <p className="text-gray-600 font-bold text-sm">لا توجد خامات تطابق كلمة البحث</p>
                <p className="text-xs text-gray-500 mt-2">جرّب كلمة أخرى أو امسح البحث لعرض كل الأصناف ({formatNumber(items.length)} صنف).</p>
              </>
            ) : (
              <>
                <p className="text-gray-600 font-bold text-sm">لا توجد خامات في المخزون بعد</p>
                <p className="text-xs text-gray-500 mt-2">ابدأ بإضافة صنف مخزون جديد ليظهر هنا.</p>
              </>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards View — احترافي، مناسب لكل المقاسات وينهي مشكلة السكرول العرضي */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const isOut = isStockOut(item.quantity);
              const isLow = isStockLow(item.quantity, item.minLimit);
              const costInfo = costSummaryFor(item);
              const supplier = lastSupplierByItem.get(item._id);

              return (
                <div
                  key={item._id}
                  className={`group relative overflow-hidden bg-white border border-gray-200/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)] transition-all duration-200 text-right ${
                    isOut ? 'border-r-4 border-r-rose-400' : isLow ? 'border-r-4 border-r-amber-400' : 'border-r-4 border-r-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                          isOut ? 'bg-rose-50 border-rose-200 text-rose-600' : isLow ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        }`}
                      >
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{item.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                          {item.lastRestocked ? `آخر توريد: ${formatDate(item.lastRestocked)}` : 'لم يتم التوريد بعد'}
                          {supplier ? ` • مورد: ${supplier}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={isOut ? 'out' : isLow ? 'low' : 'available'}
                      size="sm"
                    >
                      {isOut ? 'نافد' : isLow ? 'منخفض' : 'متوفر'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-3 mt-3 border-t border-dashed border-gray-200">
                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-gray-400 block mb-0.5">الرصيد المتاح</span>
                      <span className={`font-bold font-mono text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-800' : 'text-gray-900'}`}>
                        {formatStat(item.quantity, item.unit)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-gray-400 block mb-0.5">حد الأمان</span>
                      <span className="font-bold text-gray-700 font-mono text-sm">
                        {formatNumber(item.minLimit)} {item.unit}
                      </span>
                    </div>
                    <div className="p-2.5 bg-[#2e5b9f]/5 rounded-xl border border-[#2e5b9f]/15">
                      <span className="text-[10px] text-gray-500 font-bold block mb-0.5">متوسط سعر الوحدة</span>
                      <span className="font-bold font-mono text-xs text-[#2e5b9f]">
                        {costInfo.unit > 0 ? `${formatPrice(costInfo.unit)} / ${item.unit}` : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-[#2e5b9f]/5 rounded-xl border border-[#2e5b9f]/15">
                      <span className="text-[10px] text-gray-500 font-bold block mb-0.5">التكلفة الإجمالية</span>
                      <span className="font-bold font-mono text-xs text-[#2e5b9f]">
                        {costInfo.total > 0 ? formatPrice(costInfo.total) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-dashed border-gray-200 flex items-center justify-end">
                    <button
                      onClick={() => handleOpenPurchaseModal(item)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-50 hover:bg-[#2e5b9f] text-[#2e5b9f] hover:text-white text-xs font-bold transition-all shadow-2xs cursor-pointer border border-blue-200/80"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>تسجيل شراء وتوريد</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View for wider desktops if preferred */
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                  <th className="pb-3 px-3">اسم المادة الخام</th>
                  <th className="pb-3 px-3">الرصيد المتاح</th>
                  <th className="pb-3 px-3">متوسط سعر الوحدة</th>
                  <th className="pb-3 px-3">التكلفة الإجمالية</th>
                  <th className="pb-3 px-3">حد الأمان الأدنى</th>
                  <th className="pb-3 px-3">آخر توريد</th>
                  <th className="pb-3 px-3">الحالة التشغيلية</th>
                  <th className="pb-3 px-3 text-left">شراء وتوريد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {filteredItems.map((item) => {
                  const isOut = isStockOut(item.quantity);
                  const isLow = isStockLow(item.quantity, item.minLimit);
                  const costInfo = costSummaryFor(item);

                  return (
                    <tr key={item._id} className="hover:bg-[#faf8f5]/80 transition">
                      <td className="py-3 px-3 font-bold text-gray-900 text-xs">
                        {item.name}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`font-bold font-mono text-xs ${
                            isOut
                              ? 'text-rose-600'
                              : isLow
                              ? 'text-amber-800'
                              : 'text-gray-900'
                          }`}
                        >
                          {formatNumber(item.quantity)} {item.unit}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {costInfo.unit > 0 ? formatPrice(costInfo.unit) : '—'}
                        {costInfo.unit > 0 ? <span className="text-gray-400 text-[10px]"> / {item.unit}</span> : null}
                      </td>

                      <td className="py-3 px-3 font-mono text-xs text-[#2e5b9f] font-bold whitespace-nowrap">
                        {costInfo.total > 0 ? formatPrice(costInfo.total) : '—'}
                      </td>

                      <td className="py-3 px-3 font-mono text-sm font-bold text-gray-700 whitespace-nowrap">
                        {formatNumber(item.minLimit)} {item.unit}
                      </td>

                      <td className="py-3 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(item.lastRestocked) || '—'}
                      </td>

                      <td className="py-3 px-3">
                        {isOut ? (
                          <Badge variant="out" size="sm">
                            نافد من المخزن
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="low" size="sm">
                            منخفض (اطلب توريد)
                          </Badge>
                        ) : (
                          <Badge variant="available" size="sm">
                            متوفر ومستقر
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-3 text-left">
                        <button
                          onClick={() => handleOpenPurchaseModal(item)}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2e5b9f] text-xs font-bold transition shadow-2xs cursor-pointer border border-blue-100"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>شراء وتوريد</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add New Inventory Item — للأدمن فقط (صلاحية الـ Backend) */}
      <Modal
        isOpen={isAddModalOpen && isAdmin}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة صنف مخزون جديد"
        maxWidth="md"
      >
        <form noValidate onSubmit={handleCreateItem} className="space-y-4 text-right font-sans">
          <Input
            label="اسم المادة الخام / الصنف *"
            placeholder="مثال: بن برازيلي، حليب كامل الدسم"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
            }}
            error={formErrors.name}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الكمية الافتتاحية الحالية *"
              type="number"
              min="0"
              placeholder="10"
              value={formData.quantity}
              onChange={(e) => {
                setFormData({ ...formData, quantity: e.target.value });
                if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: undefined });
              }}
              error={formErrors.quantity}
              required
            />

            <Select
              label="وحدة القياس *"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'KG', label: 'كيلو جرام (KG)' },
                { value: 'GRAM', label: 'جرام (GRAM)' },
                { value: 'LITER', label: 'لتر (LITER)' },
                { value: 'ML', label: 'ملي لتر (ML)' },
                { value: 'PIECE', label: 'قطعة / عبوة (PIECE)' },
              ]}
            />
          </div>

          <Input
            label="حد الأمان الأدنى للتنبيه *"
            type="number"
            min="1"
            placeholder="5"
            value={formData.minLimit}
            onChange={(e) => {
              setFormData({ ...formData, minLimit: e.target.value });
              if (formErrors.minLimit) setFormErrors({ ...formErrors, minLimit: undefined });
            }}
            error={formErrors.minLimit}
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
            required
          />
          <p className="text-[10px] text-gray-400 -mt-2">
            سعر تكلفة الوحدة بيتحسب تلقائياً: الإجمالي ÷ الكمية
            {Number(formData.quantity) > 0 && Number(formData.totalCost) > 0 && (
              <span className="font-mono font-bold text-[#2e5b9f]">
                {' '}= {(Number(formData.totalCost) / Number(formData.quantity)).toFixed(2)} / {formData.unit}
              </span>
            )}
          </p>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f] hover:bg-[#244b85] py-2 px-5 rounded-xl text-xs font-bold"
            >
              إضافة الصنف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Purchase and Restock Item */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title={selectedItem ? `تسجيل شراء وتوريد لـ (${selectedItem.name})` : 'شراء وتوريد'}
        maxWidth="md"
      >
        <form noValidate onSubmit={handlePurchaseSubmit} className="space-y-4 text-right font-sans">
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-gray-700">
            الرصيد الحالي بالمخزن: <span className="font-bold font-mono text-[#2e5b9f]">{selectedItem?.quantity} {selectedItem?.unit}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`الكمية المشتراة (${selectedItem?.unit || 'وحدة'}) *`}
              type="number"
              min="0.1"
              step="any"
              placeholder="10"
              value={purchaseFormData.quantity}
              onChange={(e) => {
                setPurchaseFormData({ ...purchaseFormData, quantity: e.target.value });
                if (purchaseErrors.quantity) setPurchaseErrors({ ...purchaseErrors, quantity: undefined });
              }}
              error={purchaseErrors.quantity}
              required
            />

            <Input
              label="المبلغ الإجمالي لفاتورة الشراء (جنيها) *"
              type="number"
              min="1"
              step="any"
              placeholder="الإجمالي"
              value={purchaseFormData.totalAmount}
              onChange={(e) => {
                setPurchaseFormData({ ...purchaseFormData, totalAmount: e.target.value });
                if (purchaseErrors.totalAmount) setPurchaseErrors({ ...purchaseErrors, totalAmount: undefined });
              }}
              error={purchaseErrors.totalAmount}
              required
            />
          </div>

          <p className="text-[10px] text-gray-400 -mt-2">
            سعر تكلفة الوحدة بيتحسب تلقائياً: الإجمالي ÷ الكمية
            {Number(purchaseFormData.quantity) > 0 && Number(purchaseFormData.totalAmount) > 0 && (
              <span className="font-mono font-bold text-[#2e5b9f]">
                {' '}= {(Number(purchaseFormData.totalAmount) / Number(purchaseFormData.quantity)).toFixed(2)} / {selectedItem?.unit}
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="اسم المورد (اختياري)"
              placeholder="مثال: شركة النصر"
              value={purchaseFormData.supplierName}
              onChange={(e) => setPurchaseFormData({ ...purchaseFormData, supplierName: e.target.value })}
            />

            <Input
              label="رقم الفاتورة الورقية"
              placeholder="مثال: #108"
              value={purchaseFormData.invoiceNumber}
              onChange={(e) => setPurchaseFormData({ ...purchaseFormData, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={() => setIsPurchaseModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f] hover:bg-[#244b85] py-2 px-5 rounded-xl text-xs font-bold"
            >
              تسجيل الشراء وزيادة الرصيد
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
