import React, { useState, useEffect, useMemo } from 'react';
import { expenseService, inventoryService } from '../../services/opsService';
import { Expense, InventoryItem, ExpenseCategory } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { syncAllProductsStock, ensurePurchaseRestockAndSync } from '../../utils/stockSync';
import { playSuccessSound } from '../../utils/soundFeedback';
import { StatCard } from '../../components/ui/StatCard';
import { ComparisonStatCard } from '../../components/ui/ComparisonStatCard';
import { DateRangeFilter, DateRange, toLocalDateString } from '../../components/ui/DateRangeFilter';
import { DashboardFilterBar } from '../../components/ui/DashboardFilterBar';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import { ProfessionalCard, ExpenseCard } from '../../components/ui/ProfessionalCard';
import { formatPrice, formatNumber, formatDate, formatDateTime } from '../../utils/formatters';
import {
  ReceiptText,
  DollarSign,
  Plus,
  Trash2,
  PieChart,
  Calendar,
  Filter,
  ChevronLeft,
  MoreVertical,
  Eye,
  Edit2,
  FileText,
  User,
  X,
  Boxes,
  CheckCircle2,
} from 'lucide-react';

/** استخراج اسم المورد من وصف القيد بصيغة [مورد: ...] */
const parseSupplierTag = (desc: string): string => {
  const m = (desc || '').match(/\[مورد:\s*([^\]]+)\]/);
  return m ? m[1].trim() : '';
};

/** استخراج رقم الفاتورة الورقية من الوصف بصيغة (فاتورة #...) */
const parseInvoiceTag = (desc: string): string => {
  const m = (desc || '').match(/\(فاتورة\s*#([^)]+)\)/);
  return m ? m[1].trim() : '';
};

/** الوصف النظيف بدون أوسمة المورد والفاتورة */
const cleanDescriptionText = (desc: string): string =>
  (desc || '')
    .replace(/\[مورد:[^\]]+\]\s*/g, '')
    .replace(/\s*\(فاتورة\s*#[^)]+\)/g, '')
    .trim();

/** 🏷️ اسم شراء نظيف واحترافي بدل أوصاف الباك إند المعقدة زي
 * "تعبة مخزون: حبوب 2 - اشتراء بضاعة" — الاسم بيطلع: اسم الصنف من المخزن + الكمية،
 * والمورد ورقم الفاتورة بيتعرضوا كوسوم منفصلة تحت الاسم. */
const purchaseTitleFor = (exp: Expense): string => {
  const linked = exp.inventoryItemLinked;
  if (linked && typeof linked === 'object' && linked.name) {
    const qty = exp.inventoryQuantityAdded || 0;
    return qty > 0 ? `${linked.name} — شراء ${formatNumber(qty)} ${linked.unit || ''}`.trim() : linked.name;
  }
  const clean = cleanDescriptionText(exp.description)
    .replace(/^(تعبة|تعبية)\s*(مخزون|المخزون):\s*/i, '')
    .replace(/\s*[-–]\s*(اشتراء|شراء)\s*بضاعة\s*$/i, '')
    .replace(/\s*[-–]\s*شراء\s+.+$/i, '');
  return clean || exp.description;
};

export const AdminExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [formErrors, setFormErrors] = useState<{ description?: string; amount?: string; inventoryQuantityAdded?: string }>({});

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'inventory' as ExpenseCategory,
    inventoryItemLinked: '',
    inventoryQuantityAdded: '',
    date: new Date().toISOString().slice(0, 10),
  });

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null);
  
  // View detail modal state
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  
  // Edit expense states
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    amount: '',
    category: 'inventory' as ExpenseCategory,
    inventoryItemLinked: '',
    inventoryQuantityAdded: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [editFormErrors, setEditFormErrors] = useState<{ description?: string; amount?: string; inventoryQuantityAdded?: string }>({});
  const [isEditFormSubmitted, setIsEditFormSubmitted] = useState<boolean>(false);

  // 🛒 فصل المشتريات عن المصروفات التشغيلية — تبويبين مستقلين بإحصائيات مختلفة
  const [viewMode, setViewMode] = useState<'operational' | 'purchases'>('operational');

  // Pagination
  const [itemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { showToast, showError } = useNotification();

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [expRes, invRes] = await Promise.all([
        expenseService.listExpenses(),
        inventoryService.listInventory(),
      ]);

      if (expRes.success && expRes.data) setExpenses(expRes.data);
      if (invRes.success && invRes.data) {
        setInventoryItems(invRes.data);
        if (invRes.data.length > 0) {
          setFormData((prev) => ({ ...prev, inventoryItemLinked: invRes.data[0]._id }));
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
    // 🔄 مزامنة أرصدة المنتجات مع المخزن عند فتح صفحة المشتريات
    syncAllProductsStock().catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, dateFilter, searchQuery, dateFrom, dateTo]);

  const handleFilterReset = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDateFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { description?: string; amount?: string; inventoryQuantityAdded?: string } = {};

    if (!formData.description.trim()) {
      errors.description = 'بيان المصروف مطلوب';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'الرجاء إدخال مبلغ صحيح أكبر من صفر';
    }
    if (formData.category === 'inventory' && (!formData.inventoryQuantityAdded || Number(formData.inventoryQuantityAdded) <= 0)) {
      errors.inventoryQuantityAdded = 'الرجاء إدخال كمية التوريد';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المطلوبة المميزة باللون الأحمر', 'error');
      return;
    }

    setFormErrors({});

    try {
      setIsSubmitting(true);

      // 🔍 رصيد الخام قبل التسجيل — عشان نتحقق بعدها إن الرصيد زاد فعلاً
      const linkedItem = inventoryItems.find((i) => i._id === formData.inventoryItemLinked);
      const qtyBefore = linkedItem ? Number(linkedItem.quantity) : null;
      const purchaseQty = Number(formData.inventoryQuantityAdded) || 0;
      const purchaseUnitCost =
        purchaseQty > 0 ? Number((Number(formData.amount) / purchaseQty).toFixed(2)) : undefined;

      const res = await expenseService.createExpense({
        description: formData.description.trim(),
        amount: Number(formData.amount),
        category: formData.category,
        inventoryItemLinked:
          formData.category === 'inventory' ? formData.inventoryItemLinked : undefined,
        inventoryQuantityAdded:
          formData.category === 'inventory' && formData.inventoryQuantityAdded
            ? Number(formData.inventoryQuantityAdded)
            : undefined,
        // إجمالي الفاتورة = المبلغ — الباك إند بيرفع سعر تكلفة الصنف منه
        totalCost: Number(formData.amount),
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
      });

      if (res.success) {
        showToast('تم تسجيل المصروف بنجاح وتحديث السجلات');

        // ✅ ربط المشتريات بالمنتجات — مضمون على كل الحالات:
        // نتأكد إن رصيد الخام زاد فعلاً (لو الـ Backend مازودش من القيد بنعمل restock
        // صريح) — وبعدها نعيد حساب أرصدة المنتجات المرتبطة بالوصفة، فالمنتجات اللي
        // كانت نافدة بتفتح تلقائياً وتظهر متاحة في الكاشير والمنيو فوراً.
        if (formData.category === 'inventory' && formData.inventoryItemLinked) {
          playSuccessSound();
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

        setIsAddModalOpen(false);
        setFormErrors({});
        setFormData({
          description: '',
          amount: '',
          category: 'inventory',
          inventoryItemLinked: inventoryItems[0]?._id || '',
          inventoryQuantityAdded: '',
          date: new Date().toISOString().slice(0, 10),
        });
        loadData();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditFormSubmitted(true);
    const errors: { description?: string; amount?: string; inventoryQuantityAdded?: string } = {};

    if (!editFormData.description.trim()) {
      errors.description = 'بيان المصروف مطلوب';
    }
    if (!editFormData.amount || Number(editFormData.amount) <= 0) {
      errors.amount = 'الرجاء إدخال مبلغ صحيح أكبر من صفر';
    }
    if (
      editFormData.category === 'inventory' &&
      (!editFormData.inventoryQuantityAdded || Number(editFormData.inventoryQuantityAdded) <= 0)
    ) {
      errors.inventoryQuantityAdded = 'الرجاء إدخال كمية التوريد';
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المطلوبة المميزة باللون الأحمر', 'error');
      return;
    }

    setEditFormErrors({});

    try {
      setIsSubmitting(true);
      const res = await expenseService.updateExpense(editingExpense!._id, {
        description: editFormData.description.trim(),
        amount: Number(editFormData.amount),
        category: editFormData.category,
        inventoryItemLinked:
          editFormData.category === 'inventory' ? editFormData.inventoryItemLinked : undefined,
        inventoryQuantityAdded:
          editFormData.category === 'inventory' && editFormData.inventoryQuantityAdded
            ? Number(editFormData.inventoryQuantityAdded)
            : undefined,
        // إجمالي الفاتورة = المبلغ — عشان سعر الوحدة يتحدث على القيد والصنف
        totalCost: Number(editFormData.amount),
        date: editFormData.date ? new Date(editFormData.date).toISOString() : undefined,
      });

      if (res.success) {
        showToast('تم تحديث المصروف بنجاح');

        // ✅ تعديل قيد شراء مرتبط بمخزون = تغيّر رصيد الخام — نعيد مزامنة أرصدة المنتجات
        const touchesInventory =
          editingExpense?.category === 'inventory' || editFormData.category === 'inventory';
        if (touchesInventory) {
          const updatedCount = await syncAllProductsStock().catch(() => 0);
          if (updatedCount > 0) {
            showToast(`🔄 تمت إعادة مزامنة ${updatedCount} منتج مع أرصدة المخزن`, 'info');
          }
        }

        setIsEditModalOpen(false);
        setIsEditFormSubmitted(false);
        setEditFormErrors({});
        setEditingExpense(null);
        loadData();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = (id: string) => {
    setDeleteTarget({ id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const wasInventoryLinked = expenses.find((e) => e._id === deleteTarget.id)?.category === 'inventory';
    try {
      const res = await expenseService.deleteExpense(deleteTarget.id);
      if (res.success) {
        showToast('تم حذف قيد المصروف بنجاح');

        // ✅ حذف قيد شراء مرتبط بمخزون = الباك إند بيرجّع الكمية للصنف — نعيد مزامنة المنتجات
        if (wasInventoryLinked) {
          const updatedCount = await syncAllProductsStock().catch(() => 0);
          if (updatedCount > 0) {
            showToast(`🔄 تمت إعادة مزامنة ${updatedCount} منتج مع أرصدة المخزن`, 'info');
          }
        }

        loadData();
      }
    } catch (err) {
      showError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  // 🛒 فصل القيود: مشتريات المخزون (توريدات) vs مصروفات تشغيلية
  const purchaseEntries = useMemo(() => expenses.filter((e) => e.category === 'inventory'), [expenses]);
  const operationalEntries = useMemo(() => expenses.filter((e) => e.category !== 'inventory'), [expenses]);
  const activeEntries = viewMode === 'purchases' ? purchaseEntries : operationalEntries;

  // إجمالي عام لكل المدفوعات — مرجع ثابت للعنوان الفرعي فقط، الإحصائيات بتتحسب من المفلتر
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryLabels: Record<ExpenseCategory, string> = {
    inventory: 'المواد الخام والمخزون',
    salaries: 'الرواتب والأجور',
    utilities: 'المرافق والخدمات',
    rent: 'الإيجار والمقر',
    other: 'مصاريف أخرى ',
  };

  const categoryColors: Record<ExpenseCategory, string> = {
    inventory: 'bg-[#2e5b9f]',
    salaries: 'bg-[#eab308]',
    utilities: 'bg-[#06b6d4]',
    rent: 'bg-[#a855f7]',
    other: 'bg-[#f97316]',
  };

  // هل فيه نطاق تاريخ مخصص من منتقي التاريخ؟ (بيتقدم على الفترات السريعة)
  const hasCustomRange = Boolean(dateFrom || dateTo);

  const filteredExpenses = activeEntries.filter((e) => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;

    let matchesDate = true;
    const expDate = new Date(e.date || e.createdAt);

    // ✅ النطاق المخصص (منتقي التاريخ الاحترافي) — له الأولوية دائماً
    if (dateFrom) {
      matchesDate = matchesDate && expDate >= new Date(`${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      matchesDate = matchesDate && expDate <= new Date(`${dateTo}T23:59:59.999`);
    }

    // الفترات السريعة
    if (matchesDate && dateFilter !== 'all') {
      const now = new Date();
      if (dateFilter === 'today') {
        matchesDate = expDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = expDate >= weekAgo;
      } else if (dateFilter === 'month') {
        matchesDate =
          expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      }
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesCategory && matchesDate;

    const matchesSearch =
      e.description.toLowerCase().includes(q) ||
      (categoryLabels[e.category] || '').toLowerCase().includes(q) ||
      String(e.amount).includes(q);

    return matchesCategory && matchesDate && matchesSearch;
  });

  // 📊 كل الإحصائيات بتتحسب من النتائج المفلترة المعروضة فعلاً — مش من كل السجلات
  const shownTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const todayKey = new Date().toDateString();
  const shownTodayTotal = expenses
    .filter((e) => new Date(e.date || e.createdAt).toDateString() === todayKey)
    .reduce((s, e) => s + e.amount, 0);
  const shownUnits = filteredExpenses.reduce((s, e) => s + (e.inventoryQuantityAdded || 0), 0);

  // 🛒 "بتشتري إيه بالظبط؟" — تجميع المشتريات المعروضة حسب صنف المخزن المرتبط
  const shownPurchaseBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; qty: number; count: number }>();
    filteredExpenses.forEach((e) => {
      const linked = e.inventoryItemLinked;
      const isObj = typeof linked === 'object' && linked !== null;
      const key = isObj ? (linked as InventoryItem)._id : 'unlinked';
      const name = isObj ? (linked as InventoryItem).name : 'توريدات غير مرتبطة بصنف';
      const cur = map.get(key) || { name, amount: 0, qty: 0, count: 0 };
      cur.amount += e.amount;
      cur.qty += e.inventoryQuantityAdded || 0;
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // 💰 سعر وحدة كل مشتريات + السعر اللي قبله (القديم) — عشان إظهار تغيّر السعر بتاريخ كل توريد
  const purchasePriceInfo = useMemo(() => {
    const unitPrice = new Map<string, number>();
    const prevPrice = new Map<string, number>();
    const purchases = expenses
      .filter(
        (e) =>
          e.category === 'inventory' &&
          e.inventoryItemLinked &&
          typeof e.inventoryItemLinked === 'object' &&
          (e.inventoryQuantityAdded || 0) > 0
      )
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());
    // المشي من الأقدم للأحدث: السعر السابق = آخر سعر مسجّل لنفس الصنف قبله
    const lastPriceByItem = new Map<string, number>();
    for (let i = purchases.length - 1; i >= 0; i--) {
      const e = purchases[i];
      const key = (e.inventoryItemLinked as InventoryItem)._id;
      const price =
        e.unitCost && e.unitCost > 0
          ? e.unitCost
          : Number(((e.amount || 0) / (e.inventoryQuantityAdded || 1)).toFixed(2));
      const older = lastPriceByItem.get(key);
      if (older !== undefined) prevPrice.set(e._id, older);
      unitPrice.set(e._id, price);
      lastPriceByItem.set(key, price);
    }
    return { unitPrice, prevPrice };
  }, [expenses]);

  // توزيع الفئات المعروضة نسبياً على إجمالي المعروض
  const shownCategoryTotals = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const shownCategoryBreakdown = Object.entries(shownCategoryTotals)
    .map(([cat, amount]) => ({
      category: cat as ExpenseCategory,
      amount,
      percentage: shownTotal > 0 ? Math.round((amount / shownTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = shownCategoryBreakdown[0];

  // Pagination Logic
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExpenses = useMemo(
    () => filteredExpenses.slice(startIndex, startIndex + itemsPerPage),
    [filteredExpenses, startIndex, itemsPerPage]
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
        <div>
          <h1 className="text-2xl font-bold font-arabic-heading text-gray-900">
            {viewMode === 'purchases' ? '🛒 سجل المشتريات والتوريدات' : 'سجل المصروفات والتشغيل'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {viewMode === 'purchases'
              ? 'كل اللي بتشتريه للمخزن — خامات وعبوات ومستلزمات — بكمياتها وتكاليفها الفعلية.'
              : 'الرواتب، الإيجارات، المرافق والمصاريف التشغيلية — منفصلة تماماً عن مشتريات المخزن.'}
          </p>
        </div>

        <Button
          onClick={() => {
            setFormErrors({});
            // فتح النافذة بفئة مناسبة للتبويب الحالي
            setFormData((prev) => ({
              ...prev,
              category: viewMode === 'purchases' ? 'inventory' : 'other',
              inventoryItemLinked: viewMode === 'purchases' ? (inventoryItems[0]?._id || prev.inventoryItemLinked) : prev.inventoryItemLinked,
            }));
            setIsAddModalOpen(true);
            showToast(viewMode === 'purchases' ? 'تم فتح نافذة تسجيل توريد جديد' : 'تم فتح نافذة تسجيل مصروف جديد', 'info');
          }}
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 ml-1.5" />}
          className="bg-[#2e5b9f]"
        >
          {viewMode === 'purchases' ? 'تسجيل توريد / شراء جديد' : 'تسجيل مصروف جديد'}
        </Button>
      </div>

      {/* Tabs: فصل كامل بين المصروفات التشغيلية والمشتريات */}
      <div className="bg-[#f0ebe1] p-1 rounded-2xl border border-gray-200/70 flex items-center gap-1 text-xs w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setViewMode('operational')}
          className={`inline-flex items-center gap-1.5 py-2 px-4 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
            viewMode === 'operational'
              ? 'bg-white text-[#2e5b9f] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ReceiptText className="w-3.5 h-3.5" />
          المصروفات التشغيلية
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${viewMode === 'operational' ? 'bg-blue-50 text-[#2e5b9f]' : 'bg-black/5 text-gray-500'}`}>
            {formatNumber(operationalEntries.length)}
          </span>
        </button>
        <button
          onClick={() => setViewMode('purchases')}
          className={`inline-flex items-center gap-1.5 py-2 px-4 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
            viewMode === 'purchases'
              ? 'bg-white text-[#2e5b9f] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🛒 المشتريات والتوريدات
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${viewMode === 'purchases' ? 'bg-blue-50 text-[#2e5b9f]' : 'bg-black/5 text-gray-500'}`}>
            {formatNumber(purchaseEntries.length)}
          </span>
        </button>
      </div>

      {/* Stats Cards — مختلفة لكل تبويب */}
      {viewMode === 'purchases' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي المشتريات"
            value={formatPrice(shownTotal)}
            subtitle={`من إجمالي ${formatPrice(totalExpenses)} مدفوعات`}
            icon={<Boxes className="w-5 h-5 text-[#2e5b9f]" />}
            variant="blue"
          />
          <StatCard
            title="مشتريات اليوم"
            value={formatPrice(shownTodayTotal)}
            subtitle="توريدات مسجلة النهاردة"
            icon={<Calendar className="w-5 h-5 text-gray-500" />}
            variant="neutral"
          />
          <StatCard
            title="أكثر صنف بتشتريه"
            value={shownPurchaseBreakdown[0]?.name || '—'}
            subtitle={shownPurchaseBreakdown[0] ? `${formatPrice(shownPurchaseBreakdown[0].amount)} • ${formatNumber(shownPurchaseBreakdown[0].count)} توريدة` : undefined}
            icon={<PieChart className="w-5 h-5 text-emerald-600" />}
            variant="neutral"
          />
          <StatCard
            title="إجمالي الكميات المشتراة"
            value={`${formatNumber(shownUnits)} وحدة`}
            subtitle={`${formatNumber(purchaseEntries.length)} قيد توريد`}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            variant="neutral"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="المصروفات التشغيلية"
            value={formatPrice(shownTotal)}
            subtitle="بدون مشتريات المخزن"
            icon={<ReceiptText className="w-5 h-5 text-[#9f1239]" />}
            variant="pink"
          />
          <StatCard
            title="مصروفات اليوم"
            value={formatPrice(shownTodayTotal)}
            icon={<DollarSign className="w-5 h-5 text-gray-500" />}
            variant="neutral"
          />
          <StatCard
            title="أكبر فئة تشغيلية"
            value={topCategory && topCategory.category !== 'inventory' ? `${categoryLabels[topCategory.category]} (${formatNumber(topCategory.percentage)}%)` : '—'}
            icon={<PieChart className="w-5 h-5 text-[#2e5b9f]" />}
            variant="blue"
          />
          <StatCard
            title="عدد القيود المسجلة"
            value={`${formatNumber(filteredExpenses.length)} قيد`}
            icon={<Calendar className="w-5 h-5 text-gray-500" />}
            variant="neutral"
          />
        </div>
      )}

      {/* Main 2-Column Grid - RTL: Content on right (order-1), Sidebar on left (order-2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Content: Expenses Table (8 cols) - Right side visually */}
        <div className="lg:col-span-8 lg:order-1 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs space-y-4">
          {/* ✨ شريط الفلترة الموحّد — بحث فاخر + فترات سريعة + منتقي تاريخ احترافي */}
          <DashboardFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="ابحث في المصروفات — مثال: بن، صيانة، كهرباء"
            periods={[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'آخر ٧ أيام' },
              { id: 'month', label: 'هذا الشهر' },
            ]}
            activePeriod={hasCustomRange ? '' : dateFilter}
            onPeriodChange={(id) => {
              setDateFilter(id as typeof dateFilter);
              setDateFrom('');
              setDateTo('');
            }}
            resultCount={filteredExpenses.length}
            resultLabel="عملية مسجلة"
            activeCount={
              (categoryFilter !== 'all' && viewMode === 'operational' ? 1 : 0) +
              (searchQuery ? 1 : 0) +
              (dateFilter !== 'all' ? 1 : 0) +
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
                // اختيار نطاق مخصص يلغي الفترة السريعة لتفادي التعارض
                setDateFilter('all');
                setDateFrom(range.from ? toLocalDateString(range.from) : '');
                setDateTo(range.to ? toLocalDateString(range.to) : '');
              }}
              maxDate={new Date()}
              showPresets
              className="w-full sm:w-[260px]"
            />
          </DashboardFilterBar>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-gray-500 ml-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#2e5b9f]" /> الفئة:
              </span>
              <button
                onClick={() => setCategoryFilter('all')}
                className={`py-1 px-2.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setCategoryFilter('inventory')}
                className={`py-1 px-2.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  categoryFilter === 'inventory'
                    ? 'bg-[#2e5b9f] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                المخزون
              </button>
              <button
                onClick={() => setCategoryFilter('salaries')}
                className={`py-1 px-2.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  categoryFilter === 'salaries'
                    ? 'bg-[#2e5b9f] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                الرواتب
              </button>
              <button
                onClick={() => setCategoryFilter('utilities')}
                className={`py-1 px-2.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  categoryFilter === 'utilities'
                    ? 'bg-[#2e5b9f] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                المرافق
              </button>
              <button
                onClick={() => setCategoryFilter('rent')}
                className={`py-1 px-2.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  categoryFilter === 'rent'
                    ? 'bg-[#2e5b9f] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                الإيجار
              </button>
              <button
                onClick={() => setCategoryFilter('other')}
                className={`py-1 px-2.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  categoryFilter === 'other'
                    ? 'bg-[#2e5b9f] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                أخرى
              </button>
            </div>
          </div>

          {isLoading ? (
            <LoadingSkeleton type="tile" count={itemsPerPage} />
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-14 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400 mx-2">
              <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
                <ReceiptText className="w-6 h-6" />
              </div>
              <p className="text-gray-600 font-bold text-sm">لا توجد مصروفات مطابقة</p>
              <p className="text-xs text-gray-500 mt-2">جرّب كلمة بحث أخرى أو امسح الفلاتر لعرض كل المصروفات.</p>
            </div>
          ) : (
            <div className="space-y-3">
               {paginatedExpenses.map((exp) => {
                const authorName =
                  typeof exp.addedBy === 'object' ? exp.addedBy.userName : exp.addedBy || 'المدير';
                const supplier = parseSupplierTag(exp.description || '');
                const invoiceNo = parseInvoiceTag(exp.description || '');

                return (
                  <ExpenseCard
                    key={exp._id}
                    id={exp._id}
                    status="completed"
                    title={viewMode === 'purchases' ? purchaseTitleFor(exp) : exp.description}
                    subtitle={formatDate(exp.date || exp.createdAt)}
                    onClick={() => setViewingExpense(exp)}
                    amounts={{
                      primary: exp.amount,
                    }}
                    metadata={[
                      ...(viewMode === 'purchases' && supplier
                        ? [{ label: 'المورد', value: supplier }]
                        : viewMode === 'purchases'
                          ? []
                          : [{ label: 'الفئة', value: categoryLabels[exp.category] || exp.category }]),
                      { label: 'بواسطة', value: authorName },
                    ]}


                    tags={
                      viewMode === 'purchases'
                        ? [
                            ...(exp.inventoryQuantityAdded ? [`تم توريد +${formatNumber(exp.inventoryQuantityAdded)} وحدة`] : []),
                            ...(purchasePriceInfo.unitPrice.get(exp._id)
                              ? [`سعر الوحدة: ${formatPrice(purchasePriceInfo.unitPrice.get(exp._id) || 0)}`]
                              : []),
                            ...((purchasePriceInfo.prevPrice.get(exp._id) !== undefined &&
                              Math.abs((purchasePriceInfo.prevPrice.get(exp._id) || 0) - (purchasePriceInfo.unitPrice.get(exp._id) || 0)) > 0.009
                              ? [`📈 سعر جديد بدلاً من ${formatPrice(purchasePriceInfo.prevPrice.get(exp._id) || 0)}`]
                              : []) as string[]),
                            ...(invoiceNo ? [`🧾 فاتورة #${invoiceNo}`] : []),
                          ]
                        : []
                    }
                                        actions={[
                      {
                        icon: <Edit2 className="w-3.5 h-3.5" />,
                        label: 'تعديل',
                        onClick: (e) => {
                          e.stopPropagation();
                          setEditingExpense(exp);
                          setEditFormData({
                            description: exp.description,
                            amount: String(exp.amount),
                            category: exp.category as ExpenseCategory,
                            inventoryItemLinked:
                              exp.inventoryItemLinked
                                ? typeof exp.inventoryItemLinked === 'object'
                                  ? exp.inventoryItemLinked._id
                                  : exp.inventoryItemLinked
                                : inventoryItems[0]?._id || '',
                            inventoryQuantityAdded: exp.inventoryQuantityAdded
                              ? String(exp.inventoryQuantityAdded)
                              : '',
                            date: exp.date
                              ? new Date(exp.date).toISOString().slice(0, 10)
                              : new Date().toISOString().slice(0, 10),
                          });
                          setEditFormErrors({});
                          setIsEditFormSubmitted(false);
                          setIsEditModalOpen(true);
                        },
                        variant: 'default',
                      },
                      {
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        label: 'حذف',
                        onClick: (e) => { e.stopPropagation(); handleDeleteExpense(exp._id); },
                        variant: 'danger',
                      },
                    ]}
                  />
                );
              })}
            </div>
          )} 
        </div>

        {/* Sidebar: Quick Summary + Category Breakdown Bars (4 cols) - Left side visually */}
        <div className="lg:col-span-4 lg:order-2 lg:sticky lg:top-6 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4 self-start">
          {/* Quick Summary */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs text-gray-400">نظرة سريعة</span>
            <h3 className="font-bold text-base text-gray-900">ملخص الفترة</h3>
          </div>

          {(() => {
            const shownCount = filteredExpenses.length;
            const shownTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);
            const avgExpense = shownCount > 0 ? shownTotal / shownCount : 0;
            const biggestExpense = filteredExpenses.reduce((m, e) => (e.amount > m ? e.amount : m), 0);
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf8f5] border border-gray-100 text-xs">
                  <span className="font-bold font-mono text-[#9f1239]">{formatPrice(shownTotal)}</span>
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                    إجمالي المعروض
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf8f5] border border-gray-100 text-xs">
                  <span className="font-bold font-mono text-gray-900">{formatPrice(avgExpense)}</span>
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    <ReceiptText className="w-3.5 h-3.5 text-gray-400" />
                    متوسط القيد
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf8f5] border border-gray-100 text-xs">
                  <span className="font-bold font-mono text-gray-900">{formatPrice(biggestExpense)}</span>
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-gray-400" />
                    أكبر قيد
                  </span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-2 text-[11px] text-gray-500">
                  <span className="font-bold font-mono">{formatNumber(shownCount)} قيد</span>
                  <span>عدد القيود المعروضة بعد التصفية</span>
                </div>
              </div>
            );
          })()}

          {/* Category Breakdown / Purchases Breakdown */}
          {viewMode === 'purchases' ? (
            <>
              <div className="flex items-center justify-between pb-3 pt-1 border-b border-gray-100">
                <span className="text-xs text-gray-400">بتشتري إيه بالظبط؟</span>
                <h3 className="font-bold text-base text-gray-900">توزيع المشتريات على الأصناف</h3>
              </div>

              {shownPurchaseBreakdown.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  لا توجد مشتريات مسجلة لعرض التحليل.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {shownPurchaseBreakdown.slice(0, 8).map((pb, idx) => {
                    const pct = shownTotal > 0 ? Math.round((pb.amount / shownTotal) * 100) : 0;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-gray-700 mb-1 font-medium">
                          <span className="font-mono">{formatPrice(pb.amount)} ({formatNumber(pct)}%)</span>
                          <span className="truncate max-w-[55%]">{pb.name}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-l from-blue-400 to-[#2e5b9f] h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5 text-[10px] text-gray-400 font-mono">
                          <span>{formatNumber(pb.count)} عملية شراء</span>
                          {pb.qty > 0 && <span>+{formatNumber(pb.qty)} وحدة للمخزن</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between pb-3 pt-1 border-b border-gray-100">
                <span className="text-xs text-gray-400">تحليل نسبي</span>
                <h3 className="font-bold text-base text-gray-900">توزيع المصروفات</h3>
              </div>

              {shownCategoryBreakdown.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  لا توجد بيانات مصروفات لعرض التحليل.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {shownCategoryBreakdown.map(({ category, amount, percentage }) => (
                    <div key={category}>
                      <div className="flex justify-between text-gray-700 mb-1 font-medium">
                        <span className="font-mono">{formatPrice(amount)} ({formatNumber(percentage)}%)</span>
                        <span>{categoryLabels[category]}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`${categoryColors[category]} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

            {/* Pagination (Professional Google-style) — باجناش واحد صحيح: إصلاح أسماء الدعائم (كان page/totalPages → NaN) والإزالة النص المتكرر تحت الأسهم */}
      {!isLoading && filteredExpenses.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredExpenses.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          maxPages={7}
        />
      )}

       {/* Add Expense Modal — في تبويب المشتريات الفئة بتكون "مخزون" تلقائياً بدون قائمة منسدلة */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={viewMode === 'purchases' ? 'تسجيل توريد / شراء جديد للمخزن' : 'تسجيل مصروف تشغيلي جديد'}
        maxWidth="md"
      >
        <form noValidate onSubmit={handleCreateExpense} className="space-y-4 text-right">
          <Input
            label={viewMode === 'purchases' ? 'اسم المادة الخام / البيان *' : 'بيان المصروف *'}
            placeholder={
              viewMode === 'purchases'
                ? 'مثال: حبوب بن ، أكياس تغليف...'
                : 'مثال: فاتورة ، صيانة ماكينة، كهرباء...'
            }
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
            }}
            error={formErrors.description}
            required
            autoFocus
          />

          <div className={`grid gap-3 ${viewMode === 'purchases' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Input
              label="المبلغ (جنيها) *"
              type="number"
              min="1"
              placeholder="1500"
              value={formData.amount}
              onChange={(e) => {
                setFormData({ ...formData, amount: e.target.value });
                if (formErrors.amount) setFormErrors({ ...formErrors, amount: undefined });
              }}
              error={formErrors.amount}
              required
            />

            {/* 🚫 مفيش خيار شراء/مخزون هنا — المصروفات التشغيلية للحاجات الخارجة بس،
                والمشتريات ليها تبويبها الخاص (المشتريات والتوريدات) */}
            {viewMode !== 'purchases' && (
              <Select
                label="فئة المصروف *"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                }
                options={[
                  { value: 'salaries', label: 'رواتب وأجور' },
                  { value: 'utilities', label: 'مرافق وكهرباء ومياه' },
                  { value: 'rent', label: 'إيجار المقر' },
                  { value: 'other', label: 'مصاريف أخرى' },
                ]}
              />
            )}
          </div>

          {/* Dynamic Auto-Restock Link Fields (Backend Business Rule) */}
          {formData.category === 'inventory' && (
            <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 space-y-3">
              <p className="text-[11px] font-bold text-[#2e5b9f]">
                ربط التوريد التلقائي بصنف المخزن (ميزة النظام):
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="اختر صنف المخزن"
                  value={formData.inventoryItemLinked}
                  onChange={(e) =>
                    setFormData({ ...formData, inventoryItemLinked: e.target.value })
                  }
                  options={inventoryItems.map((i) => ({
                    value: i._id,
                    label: `${i.name} (${i.unit})`,
                  }))}
                />
                <Input
                  label="الكمية المضافة *"
                  type="number"
                  min="1"
                  placeholder="20"
                  value={formData.inventoryQuantityAdded}
                  onChange={(e) => {
                    setFormData({ ...formData, inventoryQuantityAdded: e.target.value });
                    if (formErrors.inventoryQuantityAdded) setFormErrors({ ...formErrors, inventoryQuantityAdded: undefined });
                  }}
                  error={formErrors.inventoryQuantityAdded}
                  helperText="ستتم زيادة رصيد المخزن فورياً."
                  required
                />
              </div>
              {/* 💰 سعر تكلفة الوحدة بيتحسب تلقائياً ويظهر فوراً قبل الحفظ */}
              {Number(formData.inventoryQuantityAdded) > 0 && Number(formData.amount) > 0 && (
                <p className="text-[11px] font-bold bg-white border border-blue-100 rounded-lg px-2.5 py-1.5">
                  سعر تكلفة الوحدة:{' '}
                  <span className="font-mono text-[#2e5b9f]">
                    {(Number(formData.amount) / Number(formData.inventoryQuantityAdded)).toFixed(2)} جنيها
                  </span>
                  <span className="text-gray-400 font-normal"> — هيُسجل على القيد ويتحدث في تفاصيل الصنف بالمخزن</span>
                </p>
              )}
            </div>
          )}

          <Input
            label="تاريخ المصروف"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
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
              className="bg-[#2e5b9f]"
            >
              {viewMode === 'purchases' ? 'حفظ التوريد' : 'حفظ المصروف'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف المصروف"
        message="سيتم حذف قيد المصروف نهائياً من السجل، وإذا كان مرتبطاً بمخزون ستتم إرجاع الكمية تلقائياً إلى رصيده. هل تريد المتابعة؟"
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />

      {/* View Detail Modal */}
      <Modal
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
        title="تفاصيل قيد المصروف"
        maxWidth="md"
      >
        {viewingExpense && (
          <div className="space-y-4 text-right">
            <div className="flex items-center gap-4 p-4 bg-[#faf8f5] rounded-2xl border border-gray-100">
              <ReceiptText className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0" />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 break-words">
                  {viewingExpense.category === 'inventory'
                    ? purchaseTitleFor(viewingExpense)
                    : viewingExpense.description}
                </h3>
                {(viewingExpense.category === 'inventory' &&
                  (parseSupplierTag(viewingExpense.description || '') || parseInvoiceTag(viewingExpense.description || ''))) && (
                  <p className="text-[11px] text-gray-500 mt-1 break-words">
                    {parseSupplierTag(viewingExpense.description || '') && (
                      <span>🏷️ مورد: {parseSupplierTag(viewingExpense.description || '')}</span>
                    )}
                    {parseSupplierTag(viewingExpense.description || '') && parseInvoiceTag(viewingExpense.description || '') && (
                      <span> • </span>
                    )}
                    {parseInvoiceTag(viewingExpense.description || '') && (
                      <span>🧾 فاتورة #{parseInvoiceTag(viewingExpense.description || '')}</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">القيمة الإجمالية</span>
                <span className="text-lg font-bold font-mono text-rose-600">
                  {formatPrice(viewingExpense.amount)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">فئة المصروف</span>
                <span className="text-sm font-bold text-gray-900">
                  {categoryLabels[viewingExpense.category] || viewingExpense.category}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">تاريخ الفاتورة / القيد</span>
                <span className="text-sm font-bold font-mono text-gray-900">
                  {formatDate(viewingExpense.date || viewingExpense.createdAt)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">تم التسجيل بواسطة</span>
                <span className="text-sm font-bold text-gray-900">
                  {typeof viewingExpense.addedBy === 'object'
                    ? viewingExpense.addedBy.userName
                    : viewingExpense.addedBy || 'المدير'}
                </span>
              </div>

              {viewingExpense.inventoryItemLinked && (
                <div className="p-3 bg-white rounded-xl border border-gray-200 col-span-1 sm:col-span-2 space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold block">تفاصيل التوريد المرتبط</span>
                  <div className="text-xs text-gray-700 bg-emerald-50/70 border border-emerald-100 rounded-lg p-2 flex items-center justify-between">
                    <span>
                      ✅ تم توريد{' '}
                      <span className="font-bold text-emerald-700 font-mono">
                        +{formatNumber(viewingExpense.inventoryQuantityAdded || 0)}
                      </span>{' '}
                      وحدة للمخزن بواسطة{' '}
                      <span className="font-bold text-gray-900">
                        {typeof viewingExpense.addedBy === 'object'
                          ? viewingExpense.addedBy.userName
                          : viewingExpense.addedBy || 'المدير'}
                      </span>
                    </span>
                    <span className="font-bold text-gray-900">
                      الصنف:{' '}
                      {typeof viewingExpense.inventoryItemLinked === 'object' && viewingExpense.inventoryItemLinked !== null
                        ? (viewingExpense.inventoryItemLinked as any).name || String((viewingExpense.inventoryItemLinked as any)._id).slice(-8)
                        : String(viewingExpense.inventoryItemLinked).slice(-8)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700 bg-blue-50/70 border border-blue-100 rounded-lg p-2 flex items-center justify-between">
                    <span>
                      سعر الوحدة في التوريد:{' '}
                      <span className="font-bold font-mono text-[#2e5b9f]">
                        {formatPrice(purchasePriceInfo.unitPrice.get(viewingExpense._id) || 0)}
                      </span>
                      {purchasePriceInfo.prevPrice.get(viewingExpense._id) !== undefined &&
                        Math.abs((purchasePriceInfo.prevPrice.get(viewingExpense._id) || 0) - (purchasePriceInfo.unitPrice.get(viewingExpense._id) || 0)) > 0.009 && (
                          <span className="font-bold text-amber-700">
                            {' '}(سعر جديد بدلاً من {formatPrice(purchasePriceInfo.prevPrice.get(viewingExpense._id) || 0)})
                          </span>
                        )}
                    </span>
                    <span className="font-mono text-gray-500 whitespace-nowrap">
                      {formatDateTime(viewingExpense.date || viewingExpense.createdAt)}
                    </span>
                  </div>
                </div>
              )}

                            {/* 📅 التاريخ موحّد في حقل "تاريخ الفاتورة / القيد" أعلاه لتفادي التكرار البصري */}
                                      </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setViewingExpense(null)}>
                إغلاق
              </Button>
              <Button
                type="button"
                variant="danger"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={() => {
                  handleDeleteExpense(viewingExpense._id);
                  setViewingExpense(null);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                <span>حذف القيد</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Expense Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setIsEditFormSubmitted(false);
          setEditFormErrors({});
          setEditingExpense(null);
        }}
        title="تعديل قيد مصروف"
        maxWidth="lg"
      >
        <form noValidate onSubmit={handleUpdateExpense} className="space-y-4 text-right">
          <Input
            label="بيان المصروف *"
            placeholder="مثال: شراء حبوب بن، إيجار شهري..."
            value={editFormData.description}
            onChange={(e) => {
              setEditFormData({ ...editFormData, description: e.target.value });
              if (editFormErrors.description) setEditFormErrors({ ...editFormErrors, description: undefined });
            }}
            error={editFormErrors.description}
            isSubmitted={isEditFormSubmitted}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="المبلغ (جنيها) *"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="مثال: 500"
              value={editFormData.amount}
              onChange={(e) => {
                setEditFormData({ ...editFormData, amount: e.target.value });
                if (editFormErrors.amount) setEditFormErrors({ ...editFormErrors, amount: undefined });
              }}
              error={editFormErrors.amount}
              isSubmitted={isEditFormSubmitted}
              required
            />

            <Input
              label="تاريخ المصروف"
              type="date"
              value={editFormData.date}
              onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
            />
          </div>

          {/* فئة المصروف — مخفية لقيود المخزون، ومن غير خيار الشراء:
              المشتريات بتتعدل من تبويبها الخاص بس */}
          {editFormData.category !== 'inventory' && (
            <Select
              label="فئة المصروف *"
              value={editFormData.category}
              onChange={(e) =>
                setEditFormData({ ...editFormData, category: e.target.value as ExpenseCategory })
              }
              options={[
                { value: 'salaries', label: '👥 رواتب' },
                { value: 'rent', label: '🏠 إيجار' },
                { value: 'utilities', label: '⚡ مرافق (كهرباء / مياه / غاز)' },
                { value: 'other', label: '📋 أخرى' },
              ]}
            />
          )}

          {editFormData.category === 'inventory' && (
            <div className="space-y-3 p-4 bg-[#f0f5ff] rounded-xl border border-[#2e5b9f]/20">
              <p className="text-xs font-bold text-[#2e5b9f]">
                📦 ربط بمخزون — سيتم تعديل كمية المخزن تلقائياً
              </p>
              <Select
                label="اختر الصنف من المخزن"
                value={editFormData.inventoryItemLinked}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, inventoryItemLinked: e.target.value })
                }
                options={inventoryItems.map((inv) => ({
                  value: inv._id,
                  label: `${inv.name} (${formatNumber(inv.quantity)} ${inv.unit})`,
                }))}
              />
              <Input
                label="الكمية المضافة للمخزن *"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="مثال: 10"
                value={editFormData.inventoryQuantityAdded}
                onChange={(e) => {
                  setEditFormData({ ...editFormData, inventoryQuantityAdded: e.target.value });
                  if (editFormErrors.inventoryQuantityAdded)
                    setEditFormErrors({ ...editFormErrors, inventoryQuantityAdded: undefined });
                }}
                error={editFormErrors.inventoryQuantityAdded}
                isSubmitted={isEditFormSubmitted}
                required
              />
            </div>
          )}

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsEditFormSubmitted(false);
                  setEditFormErrors({});
                  setEditingExpense(null);
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