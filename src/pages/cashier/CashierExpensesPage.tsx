import React, { useState, useEffect, useMemo, useRef } from 'react';
import { expenseService, inventoryService } from '../../services/opsService';
import { Expense, InventoryItem } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ExportModal } from '../../components/ui/ExportModal';
import { DateRangeFilter, toLocalDateString } from '../../components/ui/DateRangeFilter';
import { DashboardFilterBar } from '../../components/ui/DashboardFilterBar';
import { StatCard } from '../../components/ui/StatCard';
import { exportElementToPdf } from '../../utils/pdfExport';
import { formatPrice, formatNumber, formatDate, formatTime, formatStat } from '../../utils/formatters';
import { ensurePurchaseRestockAndSync } from '../../utils/stockSync';
import { playSuccessSound } from '../../utils/soundFeedback';
import {
  Plus,
  ShoppingBag,
  FileSpreadsheet,
  SearchX,
  CheckCircle2,
  Receipt,
  Boxes,
  Download,
  User,
  Hash,
} from 'lucide-react';

/** استخراج اسم المورد من وصف الفاتورة المخزّن بصيغة [مورد: ...] */
const parseSupplier = (desc: string): string => {
  const m = (desc || '').match(/\[مورد:\s*([^\]]+)\]/);
  return m ? m[1].trim() : '';
};

/** استخراج رقم الفاتورة الورقية من الوصف بصيغة (فاتورة #...) */
const parseInvoice = (desc: string): string => {
  const m = (desc || '').match(/\(فاتورة\s*#([^)]+)\)/);
  return m ? m[1].trim() : '';
};

/** الوصف النظيف بدون حقن المورد والفاتورة */
const cleanDescription = (desc: string): string =>
  (desc || '')
    .replace(/\[مورد:[^\]]+\]\s*/g, '')
    .replace(/\s*\(فاتورة\s*#[^)]+\)/g, '')
    .trim();

type SearchMode = 'all' | 'desc' | 'supplier' | 'invoice' | 'item';

export const CashierExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 🔎 نوع البحث — نفس فكرة سجل فواتير اليوم في الكاشير
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ description?: string; amount?: string; quantity?: string }>({});

  // 📅 نطاق التاريخ المخصص من منتقي التاريخ الاحترافي
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // 📤 التصدير
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    description: '',
    unitCost: '',
    quantity: '10',
    amount: '',
    isAutoCalc: true,
    inventoryItemLinked: '',
    supplierName: '',
    invoiceNumber: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const { showToast, showError } = useNotification();

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [expRes, invRes] = await Promise.all([
        expenseService.listExpenses(),
        inventoryService.listInventory(),
      ]);

      // 🔐 حماية إضافية في الواجهة: الكاشير يرى قيود المشتريات (المواد الخام) فقط —
      // أي تصنيف مصروفات آخر (إيجار، رواتب، مرافق...) لا يُعرض مهما كانت استجابة الـ API
      if (expRes.success && expRes.data) {
        setExpenses(expRes.data.filter((e) => e.category === 'inventory'));
      }
      if (invRes.success && invRes.data) {
        const invData = invRes.data;
        setInventoryItems(invData);
        if (invData.length > 0 && !formData.inventoryItemLinked) {
          setFormData((prev) => ({
            ...prev,
            inventoryItemLinked: invData[0]._id,
            unitCost: invData[0].costPrice ? String(invData[0].costPrice) : '',
          }));
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUnitCostOrQtyChange = (field: 'unitCost' | 'quantity', val: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: val };
      if (updated.isAutoCalc) {
        const uCost = parseFloat(updated.unitCost) || 0;
        const q = parseFloat(updated.quantity) || 0;
        if (uCost > 0 && q > 0) {
          updated.amount = (uCost * q).toFixed(0);
        }
      }
      return updated;
    });
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { description?: string; amount?: string; quantity?: string } = {};

    if (!formData.description.trim()) {
      errors.description = 'اسم المادة الخام / البيان مطلوب';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'المبلغ الإجمالي مطلوب ويجب أن يكون أكبر من صفر';
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      errors.quantity = 'الكمية المشتراة مطلوبة ويجب أن تكون أكبر من صفر';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setFormErrors({});

    try {
      setIsSubmitting(true);

      // 🔍 رصيد الخام قبل التسجيل — عشان نتحقق بعدها إن الرصيد زاد فعلاً
      const linkedItem = inventoryItems.find((i) => i._id === formData.inventoryItemLinked);
      const qtyBefore = linkedItem ? Number(linkedItem.quantity) : null;
      const purchaseQty = Number(formData.quantity);
      const purchaseUnitCost =
        purchaseQty > 0 ? Number((Number(formData.amount) / purchaseQty).toFixed(2)) : undefined;

      const descriptionPrefix = formData.supplierName
        ? `[مورد: ${formData.supplierName.trim()}] `
        : '';
      const invoiceSuffix = formData.invoiceNumber
        ? ` (فاتورة #${formData.invoiceNumber.trim()})`
        : '';

      const fullDescription = `${descriptionPrefix}${formData.description.trim()}${invoiceSuffix}`;

      const res = await expenseService.createExpense({
        description: fullDescription,
        amount: Number(formData.amount),
        category: 'inventory',
        inventoryItemLinked: formData.inventoryItemLinked || undefined,
        inventoryQuantityAdded: formData.quantity ? purchaseQty : undefined,
        // الإجمالي وسعر الوحدة بيتسجلوا على القيد — الباك إند بيرفع سعر تكلفة الصنف تلقائياً
        totalCost: Number(formData.amount),
        unitCost: purchaseUnitCost,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
      });

      if (res.success) {
        playSuccessSound();
        showToast('تم تسجيل فاتورة الشراء بنجاح');
        setIsAddModalOpen(false);
        setFormErrors({});
        setFormData({
          description: '',
          unitCost: '',
          quantity: '10',
          amount: '',
          isAutoCalc: true,
          inventoryItemLinked: inventoryItems[0]?._id || '',
          supplierName: '',
          invoiceNumber: '',
          date: new Date().toISOString().slice(0, 10),
        });
        loadData();

        // ✅ مضمون التوريد: نتأكد إن رصيد الخام زاد فعلاً (لو الـ Backend مازودش من
        // القيد بنعمل restock صريح) — وبعدها نزامن المنتجات المرتبطة فوراً
        // فالمنتجات النافدة بتفتح مباشرة في الكاشير والمنيو.
        if (formData.inventoryItemLinked) {
          const { updatedProducts } = await ensurePurchaseRestockAndSync({
            itemId: formData.inventoryItemLinked,
            qtyBefore,
            addQty: purchaseQty,
            unitCost: purchaseUnitCost,
          });
          if (updatedProducts > 0) {
            showToast(`🔄 تم تحديث ${updatedProducts} منتج مرتبط وأصبح متاحاً للبيع`, 'info');
          }
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── الفلترة المتقدمة والبحث السريع ─────────────────────────────────────────

  /** هل فيه نطاق تاريخ مخصص من منتقي التاريخ؟ (بيتقدم على الأزرار السريعة) */
  const hasCustomRange = Boolean(dateFrom || dateTo);

  /** عدد الفلاتر النشطة عشان يظهر كشارة على زرار المسح */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (searchQuery.trim()) count++;
    if (dateFilter !== 'all' && !hasCustomRange) count++;
    return count;
  }, [searchQuery, dateFilter, hasCustomRange, dateFrom, dateTo]);

  const getLinkedItemName = (exp: Expense): string =>
    exp.inventoryItemLinked && typeof exp.inventoryItemLinked === 'object'
      ? exp.inventoryItemLinked.name
      : '';

  const getLinkedItemUnit = (exp: Expense): string =>
    exp.inventoryItemLinked && typeof exp.inventoryItemLinked === 'object'
      ? exp.inventoryItemLinked.unit || 'وحدة'
      : 'وحدة';

  const eCreatedAt = (exp: Expense): string => exp.createdAt || exp.date || '';

  const addedByName = (exp: Expense): string => {
    if (!exp.addedBy) return '—';
    return typeof exp.addedBy === 'string' ? 'مستخدم' : exp.addedBy.userName || '—';
  };

  const CATEGORY_LABELS: Record<string, { label: string; classes: string }> = {
    inventory: { label: 'مشتريات مخزون', classes: 'bg-rose-50 text-rose-700 border-rose-200/60' },
    // 🔐 شاشة الكاشير للمشتريات فقط — لا توجد فئات مصروفات (إيجار/رواتب/مرافق) هنا
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e || typeof e !== 'object') return false;
      const desc = e.description || '';
      const q = searchQuery.trim().toLowerCase();
      const supplier = parseSupplier(desc).toLowerCase();
      const invoice = parseInvoice(desc).toLowerCase();
      const itemText = (getLinkedItemName(e) || cleanDescription(desc)).toLowerCase();

      let matchesSearch = true;
      if (q) {
        switch (searchMode) {
          case 'desc':
            matchesSearch = cleanDescription(desc).toLowerCase().includes(q);
            break;
          case 'supplier':
            matchesSearch = supplier.includes(q);
            break;
          case 'invoice':
            matchesSearch = invoice.includes(q.replace('#', '').trim());
            break;
          case 'item':
            matchesSearch = itemText.includes(q);
            break;
          default:
            matchesSearch =
              desc.toLowerCase().includes(q) ||
              itemText.includes(q) ||
              supplier.includes(q) ||
              invoice.includes(q.replace('#', '').trim());
        }
      }

      // التاريخ: النطاق المخصص من منتقي التاريخ له الأولوية
      let matchesDate = true;
      const expDate = new Date(e.date || e.createdAt || '');
      if (hasCustomRange) {
        if (dateFrom) {
          const from = new Date(`${dateFrom}T00:00:00`);
          matchesDate = matchesDate && expDate >= from;
        }
        if (dateTo) {
          const to = new Date(`${dateTo}T23:59:59.999`);
          matchesDate = matchesDate && expDate <= to;
        }
      } else if (dateFilter !== 'all') {
        const now = new Date();
        if (dateFilter === 'today') {
          matchesDate = expDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = expDate >= weekAgo;
        } else if (dateFilter === 'month') {
          matchesDate =
            expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'year') {
          matchesDate = expDate.getFullYear() === now.getFullYear();
        }
      }

      return matchesSearch && matchesDate;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, searchQuery, searchMode, dateFilter, dateFrom, dateTo, hasCustomRange]);

  // مؤشرات محسوبة على النتائج المفلترة (مش الكل)
  const totalFilteredAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFilteredQty = filteredExpenses.reduce(
    (sum, e) => sum + (Number(e.inventoryQuantityAdded) || 0),
    0
  );

  const resetAllFilters = () => {
    setSearchQuery('');
    setSearchMode('all');
    setDateFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const selectedLinkedItem = inventoryItems.find((i) => i._id === formData.inventoryItemLinked);

  const searchModes: { id: SearchMode; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'desc', label: 'البيان' },
    { id: 'supplier', label: 'المورد' },
    { id: 'invoice', label: 'رقم فاتورة' },
    { id: 'item', label: 'الصنف' },
  ];

  // ─── إعدادات الفلتر المتقدم ──────────────────────────────────────────────────
  // ─── تصدير PDF / CSV ────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    try {
      setIsExportingPdf(true);
      showToast('جاري تجهيز ملف الـ PDF... ⏳', 'info');
      await exportElementToPdf(contentRef.current, `تقرير_المشتريات_${new Date().toISOString().slice(0, 10)}`);
      showToast('تم تنزيل ملف الـ PDF بنجاح ✅', 'success');
    } catch (err) {
      showError(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csvRows: (string | number)[][] = [
        ['تقرير مشتريات البضاعة والتشغيل'],
        ['البيان', 'الفئة', 'الصنف المرتبط', 'الكمية الموردة', 'المبلغ الإجمالي', 'المورد', 'رقم الفاتورة', 'التاريخ'],
        ...filteredExpenses.map((e) => [
          cleanDescription(e.description),
          e.category,
          getLinkedItemName(e) || '—',
          e.inventoryQuantityAdded ?? '—',
          e.amount,
          parseSupplier(e.description) || '—',
          parseInvoice(e.description) || '—',
          formatDate(e.date),
        ]),
      ];

      const csvContent = '\uFEFF' + csvRows.map((row) => row.map((val) => `"${val}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `تقرير_المشتريات_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('تم تصدير ملف CSV بنجاح 📊', 'success');
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className="space-y-5 text-right font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/70">
        <div>
          <h1 className="text-lg font-bold font-arabic-heading text-gray-900">
            مشتريات المواد الخام
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            تسجيل فواتير شراء المواد الخام وزيادة رصيد المخزن تلقائياً — مع سجل مشتريات المدير والكاشير.
          </p>
        </div>

        <button
          onClick={() => {
            setFormErrors({});
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 bg-[#2e5b9f] hover:bg-[#244b85] text-white py-2.5 px-5 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span> تسجيل شراء بضاعة</span>
        </button>
      </div>

      {/* KPI Cards + Table — للتصدير PDF */}
      <div ref={contentRef} className="space-y-4">
      {/* KPI Cards — على النتائج المفلترة */}
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
        <StatCard
          title="إجمالي المشتريات"
          value={formatStat(totalFilteredAmount, 'جنيها')}
          icon={<ShoppingBag className="w-5 h-5 text-[#2e5b9f]" />}
          variant="blue"
        />
        <StatCard
          title="عدد فواتير الشراء"
          value={formatStat(filteredExpenses.length, 'فاتورة')}
          icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
          variant="neutral"
        />
        <StatCard
          title="إجمالي الكميات الموردة"
          value={formatStat(totalFilteredQty, 'وحدة')}
          icon={<Boxes className="w-5 h-5 text-amber-600" />}
          variant="neutral"
        />
        <StatCard
          title="متوسط قيمة الفاتورة"
          value={formatStat(filteredExpenses.length > 0 ? Math.round(totalFilteredAmount / filteredExpenses.length) : 0, 'جنيها')}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          variant="neutral"
        />
      </div>
      )}

      {/* Expenses Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-5 space-y-4">
        {/* ✨ شريط الفلترة الموحّد — بحث + نوع البحث + فترات سريعة + منتقي تاريخ احترافي */}
        <DashboardFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={
            searchMode === 'supplier' ? 'اكتب اسم المورد...'
            : searchMode === 'invoice' ? 'اكتب رقم الفاتورة...'
            : searchMode === 'item' ? 'اكتب اسم الصنف من المخزن...'
            : searchMode === 'desc' ? 'اكتب البيان / اسم الخامة...'
            : 'ابحث في كل حاجة — بيان، مورد، فاتورة، صنف'
          }
          groupLabel="الفترة:"
          periods={[
            { id: 'all', label: 'الكل' },
            { id: 'today', label: 'اليوم' },
            { id: 'week', label: 'آخر ٧ أيام' },
            { id: 'month', label: 'هذا الشهر' },
            { id: 'year', label: 'هذه السنة' },
          ]}
          activePeriod={hasCustomRange ? '' : dateFilter}
          onPeriodChange={(id) => {
            setDateFilter(id as typeof dateFilter);
            setDateFrom('');
            setDateTo('');
          }}
          resultCount={filteredExpenses.length}
          resultLabel="فاتورة مسجلة"
          activeCount={activeFiltersCount}
          onReset={resetAllFilters}
        >
          {/* نوع البحث: بيان / مورد / فاتورة / صنف */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-bold text-gray-400 ml-0.5 select-none whitespace-nowrap">
              البحث بـ:
            </span>
            {searchModes.map((m) => (
              <button
                key={m.id}
                onClick={() => setSearchMode(m.id)}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                  searchMode === m.id
                    ? 'bg-[#2e5b9f]/10 text-[#2e5b9f] border border-[#2e5b9f]/30'
                    : 'bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 📅 منتقي التاريخ الاحترافي — نطاق مخصص بمعاينة حية واختصارات */}
          <DateRangeFilter
            value={{
              from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
              to: dateTo ? new Date(`${dateTo}T00:00:00`) : null,
              preset: 'custom',
            }}
            onChange={(range) => {
              setDateFrom(range.from ? toLocalDateString(range.from) : '');
              setDateTo(range.to ? toLocalDateString(range.to) : '');
              if (range.from || range.to) setDateFilter('all');
            }}
            maxDate={new Date()}
            showPresets
            className="w-full sm:w-[270px]"
          />

          {/* 📤 تصدير PDF / CSV */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isExportingPdf}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-[#2e5b9f] hover:bg-blue-50/50 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'جاري التجهيز...' : 'تصدير السجل'}</span>
          </button>
        </DashboardFilterBar>

        {isLoading ? (
          <LoadingSkeleton type="table" count={5} />
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
            <SearchX className="w-6 h-6" />
          </div>
          <p className="text-gray-600 font-bold text-sm">لا توجد فواتير مشتريات مطابقة</p>
          <p className="text-xs text-gray-500 mt-2">جرّب تغيير كلمة البحث أو امسح الفلاتر لعرض كل الفواتير.</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards — تفاصيل كاملة: بيان، مورد، فاتورة، صنف، سعر وحدة */}
            <div className="space-y-3 md:hidden">
              {filteredExpenses.map((exp) => {
                const supplier = parseSupplier(exp.description);
                const invoice = parseInvoice(exp.description);
                const unitPrice = exp.inventoryQuantityAdded
                  ? Number(exp.amount) / Number(exp.inventoryQuantityAdded)
                  : 0;
                return (
                <div key={exp._id} className="group relative overflow-hidden p-4 bg-white rounded-2xl border border-rose-100/80 border-r-4 border-r-rose-400 shadow-[0_2px_10px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)] transition-all duration-200 text-right space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900 text-xs block truncate">
                        {cleanDescription(exp.description)}
                      </span>
                      {getLinkedItemName(exp) && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                          <Boxes className="w-3 h-3" />
                          {getLinkedItemName(exp)}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-blue-50 text-[#2e5b9f] text-[10px] font-bold rounded-lg shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>تمت الزيادة</span>
                    </span>
                  </div>

                  {(supplier || invoice) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {supplier && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-md">
                          <User className="w-3 h-3" />
                          مورد: {supplier}
                        </span>
                      )}
                      {invoice && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                          <Hash className="w-3 h-3" />
                          فاتورة #{invoice}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dashed border-gray-200 text-[11px] text-gray-500">
                    <div className="rounded-xl bg-rose-50/60 border border-rose-100/70 p-2">
                      <span className="block text-[10px] text-gray-400">المبلغ</span>
                      <span className="font-bold font-mono text-[#2e5b9f] text-xs">{formatPrice(exp.amount)}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
                      <span className="block text-[10px] text-gray-400">الكمية الموردة</span>
                      <span className="font-mono text-xs text-gray-800">
                        {exp.inventoryQuantityAdded
                          ? `+ ${formatNumber(exp.inventoryQuantityAdded)} ${getLinkedItemUnit(exp)}`
                          : '—'}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
                      <span className="block text-[10px] text-gray-400">سعر الوحدة</span>
                      <span className="font-mono text-xs text-gray-800">
                        {unitPrice > 0 ? formatPrice(unitPrice) : '—'}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
                      <span className="block text-[10px] text-gray-400">التاريخ</span>
                      <span className="font-mono text-gray-700">
                        {formatDate(exp.date)} • {formatTime(eCreatedAt(exp))}
                      </span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Desktop View: Table — أعمدة غنية: بيان، صنف، فئة، سعر وحدة، كمية، مورد، فاتورة، بواسطة */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                    <th className="pb-3 px-3">البيان والصنف</th>
                    <th className="pb-3 px-3">الفئة</th>
                    <th className="pb-3 px-3">سعر الوحدة</th>
                    <th className="pb-3 px-3">الكمية الموردة</th>
                    <th className="pb-3 px-3">المبلغ الإجمالي</th>
                    <th className="pb-3 px-3">المورد / الفاتورة</th>
                    <th className="pb-3 px-3">التاريخ</th>
                    <th className="pb-3 px-3">بواسطة</th>
                    <th className="pb-3 px-3 text-left">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {filteredExpenses.map((exp) => {
                    const supplier = parseSupplier(exp.description);
                    const invoice = parseInvoice(exp.description);
                    const unitPrice = exp.inventoryQuantityAdded
                      ? Number(exp.amount) / Number(exp.inventoryQuantityAdded)
                      : 0;
                    const catMeta = CATEGORY_LABELS[exp.category] || { label: 'مشتريات مخزون', classes: 'bg-rose-50 text-rose-700 border-rose-200/60' };
                    return (
                    <tr key={exp._id} className="hover:bg-[#faf8f5]/80 transition">
                      <td className="py-3.5 px-3 min-w-[160px]">
                        <span className="font-bold text-gray-900 block text-xs truncate max-w-[220px]">
                          {cleanDescription(exp.description)}
                        </span>
                        {getLinkedItemName(exp) && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                            <Boxes className="w-3 h-3" />
                            {getLinkedItemName(exp)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center py-1 px-2 border font-bold rounded-lg text-[11px] ${catMeta.classes}`}>
                          {catMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {unitPrice > 0 ? formatPrice(unitPrice) : '—'}
                      </td>

                      <td className="py-3.5 px-3">
                        {exp.inventoryQuantityAdded ? (
                          <span className="inline-flex items-center py-1 px-2.5 bg-emerald-50 text-emerald-800 font-bold rounded-lg text-xs whitespace-nowrap">
                            + {formatNumber(exp.inventoryQuantityAdded)} {getLinkedItemUnit(exp)}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-bold font-mono text-sm text-[#2e5b9f] whitespace-nowrap">
                        {formatPrice(exp.amount)}
                      </td>

                      <td className="py-3.5 px-3 min-w-[150px]">
                        {supplier || invoice ? (
                          <div className="flex flex-col gap-1 items-start">
                            {supplier && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-md">
                                <User className="w-3 h-3" />
                                {supplier}
                              </span>
                            )}
                            {invoice && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                                <Hash className="w-3 h-3" />
                                #{invoice}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(exp.date)}
                        <span className="block text-[10px] text-gray-400">{formatTime(eCreatedAt(exp))}</span>
                      </td>

                      <td className="py-3.5 px-3 text-xs text-gray-600 font-bold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          {addedByName(exp)}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-left">
                        <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-blue-50 text-[#2e5b9f] text-xs font-bold rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تمت الزيادة</span>
                        </span>
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
      </div>{/* نهاية محتوى تصدير الـ PDF */}

      {/* 📤 اختيار صيغة التصدير */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        title="تصدير سجل المشتريات"
        periodLabel="الفترة المفلترة"
      />

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="تسجيل شراء بضاعة وخامات"
        maxWidth="md"
      >
        <form noValidate onSubmit={handleCreateExpense} className="space-y-4 text-right font-sans">
          <Input
            label="اسم المادة الخام / البيان *"
            placeholder="مثال: حبوب بن برازيلي، حليب طبيعي..."
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
            }}
            error={formErrors.description}
            autoFocus
            required
          />

          {/* Link to Inventory Item */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">
              ربط الصنف بالمخزون (لزيادة الرصيد تلقائياً):
            </label>
            <Select
              value={formData.inventoryItemLinked}
              onChange={(e) => {
                const targetId = e.target.value;
                const found = inventoryItems.find((i) => i._id === targetId);
                setFormData((prev) => ({
                  ...prev,
                  inventoryItemLinked: targetId,
                  unitCost: found?.costPrice ? String(found.costPrice) : prev.unitCost,
                }));
              }}
              options={inventoryItems.map((item) => ({
                value: item._id,
                label: `${item.name} (رصيده الحالي: ${item.quantity} ${item.unit})`,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`الكمية المشتراة (${selectedLinkedItem?.unit || 'وحدة'}) *`}
              type="number"
              min="0.1"
              step="any"
              placeholder="10"
              value={formData.quantity}
              onChange={(e) => {
                handleUnitCostOrQtyChange('quantity', e.target.value);
                if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: undefined });
              }}
              error={formErrors.quantity}
              required
            />

            <Input
              label="سعر الوحدة (جنيها)"
              type="number"
              min="0.1"
              step="any"
              placeholder="سعر القطعة"
              value={formData.unitCost}
              onChange={(e) => handleUnitCostOrQtyChange('unitCost', e.target.value)}
            />
          </div>

          <Input
            label="المبلغ الإجمالي للفاتورة (جنيها) *"
            type="number"
            min="1"
            placeholder="المبلغ الإجمالي"
            value={formData.amount}
            onChange={(e) => {
              setFormData({ ...formData, amount: e.target.value, isAutoCalc: false });
              if (formErrors.amount) setFormErrors({ ...formErrors, amount: undefined });
            }}
            error={formErrors.amount}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="اسم المورد (اختياري)"
              placeholder="مثال: مطاحن النصر"
              value={formData.supplierName}
              onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
            />

            <Input
              label="رقم الفاتورة الورقية"
              placeholder="مثال: #892"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f] hover:bg-[#244b85] py-2 px-5 rounded-xl text-xs font-bold"
            >
              حفظ الفاتورة وتوريد الكمية
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
