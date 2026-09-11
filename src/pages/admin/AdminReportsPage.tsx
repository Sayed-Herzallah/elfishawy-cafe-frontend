import React, { useState, useEffect, useMemo, useRef } from 'react';
import { analyticsService, orderService, expenseService, inventoryService } from '../../services/opsService';
import { recipeService } from '../../services/catalogService';
import { KPIStats, ChartsData, Order, Expense, InventoryItem, ExpenseCategory } from '../../types';
import { AttaStatCard } from '../../components/ui/AttaStatCard';
import { ComparisonStatCard } from '../../components/ui/ComparisonStatCard';
import { DateRangeFilter, DateRange } from '../../components/ui/DateRangeFilter';
import { FilterConfig } from '../../components/ui/FilterDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ExportModal } from '../../components/ui/ExportModal';
import { usePersistentState, readSessionCache, writeSessionCache } from '../../hooks/usePersistentState';
import { exportElementToPdf } from '../../utils/pdfExport';
import { useNotification } from '../../contexts/NotificationContext';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Download, Award, AlertCircle, Calendar, PieChart, Medal, Info, X, ReceiptText } from 'lucide-react';
import { formatPrice, formatNumber, formatDate } from '../../utils/formatters';
import {
  useSalesComparison,
  useExpensesComparison,
  useProfitComparison,
  useExplicitRangeComparison,
  type ComparisonResult,
  type TimeRange
} from '../../hooks/useStatisticsComparison';

/** Estimated per-product financials computed on the client */
interface ProductStat {
  name: string;
  qty: number;
  revenue: number;
  /** Estimated net profit (revenue − recipe cost) when recipe data exists; otherwise null */
  profit: number | null;
}

const rankValue = (p: ProductStat) => (p.profit !== null ? p.profit : p.revenue);

const EXPENSE_CATEGORY_META: Record<ExpenseCategory, { label: string; color: string }> = {
  rent: { label: 'الإيجار', color: 'bg-purple-500' },
  salaries: { label: 'الرواتب', color: 'bg-blue-500' },
  utilities: { label: 'المرافق', color: 'bg-cyan-500' },
  inventory: { label: 'مشتريات المخزون', color: 'bg-rose-500' },
  other: { label: 'أخرى', color: 'bg-gray-400' },
};

/** 🗂️ فئات فلترة التقارير المالية — أزرار سريعة بدل القائمة المنسدلة */
const CATEGORY_FILTERS: Array<{ value: 'all' | ExpenseCategory; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'inventory', label: '🛒 المشتريات' },
  { value: 'salaries', label: '👥 الرواتب' },
  { value: 'utilities', label: '⚡ المرافق' },
  { value: 'rent', label: '🏠 الإيجار' },
  { value: 'other', label: '📋 أخرى' },
];

export const AdminReportsPage: React.FC = () => {
  const { showToast, showError } = useNotification();
  const REPORTS_CACHE_KEY = 'reports_cache_v1';
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // ✅ الفلاتر محفوظة — بعد أي Refresh بترجع نفس نطاق التاريخ والفئة المختارين
  const [dateRange, setDateRange] = usePersistentState<DateRange>('reports_dateRange', { from: null, to: null, preset: 'custom' });
  const [categoryFilter, setCategoryFilter] = usePersistentState<string>('reports_categoryFilter', 'all');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  /** productId → estimated cost per unit, derived from active recipes + inventory cost prices */
  const [unitCostMap, setUnitCostMap] = useState<Map<string, number>>(new Map());
  // ✅ كاش الجلسة — الصفحة تظهر فورًا بآخر داتا بعد Refresh بدل شاشة تحميل فاضية
  const [isLoading, setIsLoading] = useState<boolean>(!readSessionCache<any>(REPORTS_CACHE_KEY));
  const contentRef = useRef<HTMLDivElement>(null);

  // ✅ فلترة التاريخ — بتشتغل على الطلبات والمصروفات بأي نطاق يختاره المستخدم
  // (متنقلة فوق early-return بتاع الـ loading عشان تتفلتر قبل عرض أي حاجة)
  const filteredOrders = orders.filter((o) => {
    if (!o || typeof o !== 'object') return false;
    const orderDate = new Date(o.createdAt);

    if (dateRange.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (orderDate < from) return false;
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (orderDate > to) return false;
    }
    return true;
  });

  // Filter expenses by date + category
  const filteredExpenses = expenses.filter((e) => {
    if (!e || typeof e !== 'object') return false;
    const expDate = new Date(e.date || e.createdAt || '');

    if (dateRange.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (expDate < from) return false;
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (expDate > to) return false;
    }

    const matchesCategory =
      !categoryFilter || categoryFilter === 'all'
        ? true
        : e.category === categoryFilter;

    return matchesCategory;
  });

  // المصروفات المفلترة بالتاريخ فقط (من غير الفئة) — عشان عدّادات أزرار الفئة تفضل ثابتة
  const dateFilteredExpenses = expenses.filter((e) => {
    if (!e || typeof e !== 'object') return false;
    const expDate = new Date(e.date || e.createdAt || '');

    if (dateRange.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (expDate < from) return false;
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (expDate > to) return false;
    }
    return true;
  });

  // ✅ المقارنات مبنية على النطاق المحدد فعلاً:
  // لو فيه تاريخ محدد (اختصار أو مخصص) → مقارنة بنافذة بنفس الطول قبله مباشرة
  // عشان كروت المؤشرات تطابق الفترة المفلترة بالظبط (كان ده سبب إن الفلترة "مش شغالة").
  // ولو مفيش تاريخ محدد → مقارنات الشهر الحالي كافتراضي.
  const hasExplicitRange = Boolean(dateRange.from && dateRange.to);

  // ✅ تطبيع حدود النطاق: البداية أول اليوم والنهاية آخر اليوم — عشان اختيار يوم من التقويم
  // ميبقاش نصفه مخفي (النهاية كانت ممكن تيجي منتصف الليل وتستبعد حركات اليوم نفسه)
  const explicitFrom = dateRange.from
    ? new Date(new Date(dateRange.from).setHours(0, 0, 0, 0))
    : new Date(0);
  const explicitTo = dateRange.to
    ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999))
    : new Date(86400000);

  const completedOrders = useMemo(
    () => orders.filter((o) => o && o.status === 'completed'),
    [orders]
  );

  const explicitSalesComparison = useExplicitRangeComparison(
    completedOrders,
    (o) => Number(o.totalAmount) || 0,
    explicitFrom,
    explicitTo
  );
  const explicitExpensesComparison = useExplicitRangeComparison(
    expenses,
    (e) => Number(e.amount) || 0,
    explicitFrom,
    explicitTo
  );

  /** دمج مبيعات ومصروفات نطاق صريح في مقارنة صافي ربح واحدة */
  const combineProfitComparison = (
    sales: ComparisonResult,
    exp: ComparisonResult
  ): ComparisonResult => {
    const current = sales.current - exp.current;
    const previous = sales.previous - exp.previous;
    const changeAbsolute = current - previous;
    const changePercent =
      previous === 0 ? (current > 0 ? 100 : 0) : Math.round((changeAbsolute / Math.abs(previous)) * 100);
    return {
      current,
      previous,
      changePercent,
      changeAbsolute,
      trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
      previousPeriodLabel: sales.previousPeriodLabel,
      currentPeriodLabel: sales.currentPeriodLabel,
    };
  };

  // Comparison hooks — تحويل النطاق المختار إلى فترة قابلة للمقارنة (احتياطي لما مفيش تاريخ محدد)
  const comparisonTimeRange: TimeRange = 'month';

  const presetSalesComparison = useSalesComparison(comparisonTimeRange, orders);
  const presetExpensesComparison = useExpensesComparison(comparisonTimeRange, expenses);
  const presetProfitComparison = useProfitComparison(comparisonTimeRange, orders, expenses);

  const salesComparison = hasExplicitRange ? explicitSalesComparison : presetSalesComparison;
  const expensesComparison = hasExplicitRange ? explicitExpensesComparison : presetExpensesComparison;
  const profitComparison = hasExplicitRange
    ? combineProfitComparison(explicitSalesComparison, explicitExpensesComparison)
    : presetProfitComparison;

  useEffect(() => {
    const loadReports = async () => {
      try {
        setIsLoading(true);
        const [statsRes, chartsRes, ordersRes, expRes, recipesRes, invRes] = await Promise.all([
          analyticsService.getStats(),
          analyticsService.getCharts(),
          orderService.getOrders(),
          expenseService.listExpenses(),
          recipeService.listRecipes().catch(() => null),
          inventoryService.listInventory().catch(() => null),
        ]);
        if (statsRes?.success && statsRes.data) setStats(statsRes.data);
        if (chartsRes?.success && chartsRes.data) setCharts(chartsRes.data);
        if (ordersRes?.success && ordersRes.data) setOrders(ordersRes.data);
        if (expRes?.success && expRes.data) setExpenses(expRes.data);

        // Build estimated unit-cost map (best-effort — silently skipped if data unavailable)
        try {
          const invList = invRes?.success && Array.isArray(invRes.data) ? invRes.data : [];
          const invById = new Map<string, InventoryItem>(invList.map((i) => [i._id, i]));
          const recipes = recipesRes?.success && Array.isArray(recipesRes.data) ? recipesRes.data : [];
          const costMap = new Map<string, number>();
          recipes.forEach((r) => {
            if (!r.isActive) return;
            const pid = typeof r.product === 'string' ? r.product : r.product._id;
            const unitCost = r.ingredients.reduce((sum, ing) => {
              const inv = typeof ing.inventoryItem === 'object' ? ing.inventoryItem : invById.get(ing.inventoryItem);
              if (!inv || !inv.costPrice) return sum;
              return sum + (ing.consumptionPerUnitInBase || 0) * inv.costPrice;
            }, 0);
            if (unitCost > 0) costMap.set(pid, unitCost);
          });
          setUnitCostMap(costMap);
        } catch (costErr) {
          console.warn('Cost estimation skipped:', costErr);
        }

        // ✅ حفظ آخر داتا ناجحة — بعد أي Refresh الصفحة تظهر فورًا بيها
        writeSessionCache(REPORTS_CACHE_KEY, {
          savedAt: Date.now(),
          stats: statsRes?.success ? statsRes.data : null,
          charts: chartsRes?.success ? chartsRes.data : null,
          orders: ordersRes?.success ? ordersRes.data : null,
          expenses: expRes?.success ? expRes.data : null,
        });
      } catch (err) {
        console.error('Error loading reports', err);
      } finally {
        setIsLoading(false);
      }
    };

    // ✅ استرجاع فوري من كاش الجلسة — التقارير تظهر بآخر داتا بدون شاشة تحميل فاضية
    try {
      const cached = readSessionCache<any>(REPORTS_CACHE_KEY);
      if (cached) {
        if (cached.stats) setStats(cached.stats);
        if (cached.charts) setCharts(cached.charts);
        if (Array.isArray(cached.orders)) setOrders(cached.orders);
        if (Array.isArray(cached.expenses)) setExpenses(cached.expenses);
      }
    } catch {
      /* تجاهل — الكاش تحسيني */
    }

    loadReports();
  }, []);

  if (isLoading) {
    return <LoadingSpinner text="جاري تجهيز التقارير المالية..." />;
  }

  // ملاحظة: فلترة التاريخ والفئة (filteredOrders / filteredExpenses) متعرّفة فوق
  // قبل early-return بتاع الـ loading — عشان المقارنات والفلاتر تشتغل على كل render.


  // عدد الفلاتر النشطة (شارة على زرار الفلتر)
  const activeFiltersCount =
    (dateRange.from ? 1 : 0) +
    (dateRange.to ? 1 : 0) +
    (categoryFilter && categoryFilter !== 'all' ? 1 : 0);

  const filterConfig: FilterConfig = {
    title: 'فلترة متقدمة للتقرير المالي',
    fields: [
      { name: 'date', label: 'فترة مخصصة (من - إلى)', type: 'date', isDateRange: true },
    ],
    activeFiltersCount,
  };

  // Handle filter apply
  const handleFilterApply = (values: Record<string, any>) => {
    if (values.date_from !== undefined) setDateRange(prev => ({ ...prev, from: values.date_from ? new Date(values.date_from) : null }));
    if (values.date_to !== undefined) setDateRange(prev => ({ ...prev, to: values.date_to ? new Date(values.date_to) : null }));
    if (values.category !== undefined) setCategoryFilter(values.category);
  };

  const handleFilterReset = () => {
    setDateRange({ from: null, to: null, preset: 'custom' });
    setCategoryFilter('all');
  };

  // Dynamic KPIs from filtered data
  const totalRevenue = filteredOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const totalExpensesFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  // 🛒 فصل المشتريات عن المصروفات التشغيلية في عرض التقرير
  const purchasesFiltered = filteredExpenses
    .filter((e) => e.category === 'inventory')
    .reduce((s, e) => s + e.amount, 0);
  const operatingFiltered = totalExpensesFiltered - purchasesFiltered;
  // ✅ صافي الربح الحقيقي = المبيعات − (المشتريات + المصروفات التشغيلية) — والسالب يعني خسارة
  const netProfit = totalRevenue - totalExpensesFiltered;
  const isLoss = profitComparison.current < 0;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // Real percentage indicators for the KPI cards
  const combinedTotal = totalRevenue + totalExpensesFiltered;
  const revenueShare = combinedTotal > 0 ? Math.round((totalRevenue / combinedTotal) * 100) : 0;
  const expensesShare = combinedTotal > 0 ? Math.round((totalExpensesFiltered / combinedTotal) * 100) : 0;

  // Per-product stats from filtered orders (+ estimated profit when recipe cost data exists)
  // ملاحظة: نتخطى العناصر التي لا تحتوي منتجاً حقيقياً (item.product = null/محذوف) تماماً
  // حتى لا تظهر "منتج محذوف" في قائمة الأعلى ربحية
  const productStats = new Map<string, ProductStat>();
  filteredOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (!item) return;
      const prod = item && typeof item.product === 'object' && item.product ? item.product : null;
      if (!prod) return; // منتج محذوف من قاعدة البيانات → لا نحسبه في الإحصائيات
      const pId = prod._id;
      const pName = prod.name || 'منتج';
      const existing = productStats.get(pName) || { name: pName, qty: 0, revenue: 0, profit: null };
      existing.qty += item.quantity;
      existing.revenue += item.price * item.quantity;
      const unitCost = pId ? unitCostMap.get(pId) : undefined;
      if (unitCost !== undefined) {
        existing.profit = (existing.profit ?? 0) + (item.price - unitCost) * item.quantity;
      }
      productStats.set(pName, existing);
    });
  });
  const hasCostData = Array.from(productStats.values()).some((p) => p.profit !== null);

  const sortedByProfit = Array.from(productStats.values()).sort((a, b) => rankValue(b) - rankValue(a));

  // Top performers — best 5 by estimated profit (falls back to revenue when no recipes)
  const topProducts = sortedByProfit.slice(0, 5);
  const topProductNames = new Set(topProducts.map((p) => p.name));

  // Bottom performers — NEVER overlap with the top list (same product can't appear in both)
  const bottomProducts = sortedByProfit
    .filter((p) => !topProductNames.has(p.name))
    .sort((a, b) => rankValue(a) - rankValue(b))
    .slice(0, 5);

  const maxTopValue = Math.max(...topProducts.map((p) => Math.abs(rankValue(p))), 1);
  const maxBottomValue = Math.max(...bottomProducts.map((p) => Math.abs(rankValue(p))), 1);

  // Expense totals per category (respects the selected period filter)
  const expenseCategoryRows = Object.entries(
    filteredExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {})
  )
    .map(([cat, amount]) => ({ cat: cat as ExpenseCategory, amount }))
    .sort((a, b) => b.amount - a.amount);

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    try {
      setIsExportingPdf(true);
      showToast('جاري تجهيز ملف الـ PDF... ⏳', 'info');
      await exportElementToPdf(contentRef.current, `تقرير_مالي_الفيشاوي_${dateRange.preset}`);
      showToast('تم تنزيل ملف PDF بنجاح ✅', 'success');
    } catch (err) {
      showError(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const periodLabel = dateRange.from && dateRange.to 
        ? `${dateRange.from.toLocaleDateString('ar-EG')} - ${dateRange.to.toLocaleDateString('ar-EG')}`
        : dateRange.preset !== 'custom' ? dateRange.preset : 'الكل';
      
      const csvRows = [
        ["التقرير المالي - مقهى الفيشاوي", `الفترة: ${periodLabel}`],
        ["المؤشر", "القيمة الحالية", "قيمة الفترة السابقة", "نسبة التغير %"],
        ["إجمالي الإيرادات", `${salesComparison.current.toLocaleString('ar-EG')}جنيها`, `${salesComparison.previous.toLocaleString('ar-EG')} جنيها`, `${salesComparison.changePercent >= 0 ? '+' : ''}${salesComparison.changePercent}%`],
        ["إجمالي المصروفات", `${expensesComparison.current.toLocaleString('ar-EG')} جنيها`, `${expensesComparison.previous.toLocaleString('ar-EG')} جنيها`, `${expensesComparison.changePercent >= 0 ? '+' : ''}${expensesComparison.changePercent}%`],
        ["صافي الأرباح", `${profitComparison.current.toLocaleString('ar-EG')} جنيها`, `${profitComparison.previous.toLocaleString('ar-EG')} جنيها`, `${profitComparison.changePercent >= 0 ? '+' : ''}${profitComparison.changePercent}%`],
        ["هامش الربحية", `${profitMargin}%`, "", ""],
        ["", ""],
        ...topProducts.map((p, i) => [`أعلى ربحاً #${i + 1}`, `${p.name} — ${formatPrice(rankValue(p))} (${formatNumber(p.qty)} وحدة)`] as [string, string]),
        ...bottomProducts.map((p, i) => [`الأقل ربحاً #${i + 1}`, `${p.name} — ${formatPrice(rankValue(p))} (${formatNumber(p.qty)} وحدة)`] as [string, string]),
      ];
      const csvContent = "\uFEFF" + csvRows.map(row => row.map(val => `"${val}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `تقرير_مالي_${periodLabel.replace(/[\/\s]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div ref={contentRef} className="space-y-6 text-right font-sans print-report bg-white p-6 rounded-3xl border border-gray-200/80 shadow-2xs text-gray-900">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200/60">
        <div>
          <h1 className="text-2xl font-bold font-arabic-heading text-gray-900 flex items-center gap-2">
            التقارير المالية والتحليلية
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            مؤشرات الربحية، كفاءة التشغيل، ومقارنات أداء المبيعات مقابل المصروفات.
          </p>
        </div>
        <button
          onClick={() => setIsExportModalOpen(true)}
          disabled={isExportingPdf}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 px-4 rounded-2xl text-xs font-bold transition shadow-lg cursor-pointer no-print border border-blue-500/30"
        >
<Download className="w-4 h-4" />
          <span>تصدير التقرير (PDF / إكسل)</span>
        </button>
      </div>
       
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col gap-3 text-right text-gray-900">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              maxDate={new Date()}
              showPresets={true}
              className="min-w-[220px]"
            />
            {activeFiltersCount > 0 && (
              <button
                onClick={handleFilterReset}
                className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer whitespace-nowrap"
                title="مسح الفلاتر"
              >
                <X className="w-3.5 h-3.5" />
                مسح
              </button>
            )}
          </div>

          <span className="text-xs font-mono font-bold text-gray-500 whitespace-nowrap">
            {formatNumber(filteredOrders.length)} طلب • {formatNumber(filteredExpenses.length)} مصروف
          </span>
        </div>

        {/* 🗂️ فلترة الفئة — أزرار سريعة بدل القائمة المنسدلة: بتفلتر المصروفات والتقارير المرتبطة بيها */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-gray-100 text-xs">
          <span className="text-[11px] font-bold text-gray-500 ml-1">الفئة:</span>
          {CATEGORY_FILTERS.map(({ value, label }) => {
            const isActive = categoryFilter === value;
            const count =
              value === 'all'
                ? dateFilteredExpenses.length
                : dateFilteredExpenses.filter((e) => e.category === value).length;
            return (
              <button
                key={value}
                onClick={() => setCategoryFilter(value)}
                className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-bold transition cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#2e5b9f] text-white border-[#2e5b9f] shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-[#faf8f5] hover:border-gray-300'
                }`}
              >
                {label}
                <span
                  className={`font-mono text-[10px] px-1.5 py-px rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-500'
                  }`}
                >
                  {formatNumber(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComparisonStatCard
          title="إجمالي الإيرادات"
          value={formatPrice(salesComparison.current)}
          accentColor="blue"
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
          comparison={salesComparison}
        />
        <ComparisonStatCard
          title="إجمالي المصروفات"
          value={formatPrice(expensesComparison.current)}
          accentColor="rose"
          icon={<DollarSign className="w-5 h-5 text-rose-500" />}
          invertColors
          comparison={expensesComparison}
        />
        <ComparisonStatCard
          title={isLoss ? 'صافي الخسارة' : 'صافي الربح'}
          value={isLoss ? formatPrice(Math.abs(profitComparison.current)) : formatPrice(profitComparison.current)}
          accentColor={isLoss ? 'rose' : 'emerald'}
          icon={isLoss ? <TrendingDown className="w-5 h-5 text-rose-500" /> : <Award className="w-5 h-5 text-emerald-500" />}
          comparison={profitComparison}
        />
        <ComparisonStatCard
          title="هامش الربح التشغيلي"
          value={`%${formatNumber(profitMargin)}`}
          accentColor="purple"
          icon={<BarChart3 className="w-5 h-5 text-purple-500" />}
          periodLabel={isLoss ? 'خسارة — راجع المصروفات' : profitMargin > 50 ? 'معدل ممتاز' : profitMargin > 30 ? 'معدل جيد' : 'يحتاج تحسين'}
        />
      </div>

      {/* 🛒 تفصيل المصروفات: تشغيلية vs مشتريات مخزون */}
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-rose-50 border border-rose-100 text-[11px] font-bold text-[#9f1239]">
          💸 مصروفات تشغيلية: <span className="font-mono">{formatPrice(operatingFiltered)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-bold text-[#2e5b9f]">
          🛒 مشتريات مخزون: <span className="font-mono">{formatPrice(purchasesFiltered)}</span>
        </span>
        <span className="text-[10px] text-gray-400">— صافي الربح = المبيعات − (المشتريات + المصروفات التشغيلية) • لو النتيجة بالسالب تظهر كخسارة</span>
      </div>

      {/* Profitability Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Top Profitable Products */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-1 rounded-lg">
              الأعلى ربحية
            </span>
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                <Medal className="w-4 h-4 text-emerald-600" />
              </span>
              <span>المنتجات الأكثر ربحاً</span>
            </h3>
          </div>

          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            {hasCostData
              ? 'الترتيب حسب صافي الربح التقديري (السعر − تكلفة الوصفة)'
              : 'الترتيب حسب الإيراد — أضف وصفات تكلفة للمنتجات لحساب الربح الفعلي'}
          </p>

          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              لا توجد بيانات مبيعات في هذه الفترة.
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`w-7 h-7 shrink-0 rounded-xl border flex items-center justify-center text-[11px] font-black font-mono ${
                    idx === 0
                      ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : idx === 1
                        ? 'bg-slate-50 border-slate-300 text-slate-500'
                        : idx === 2
                          ? 'bg-orange-50 border-orange-200 text-orange-500'
                          : 'bg-emerald-50/60 border-emerald-200/60 text-emerald-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900 truncate">{p.name}</span>
                      <span className="text-xs font-black font-mono text-emerald-600 shrink-0">
                        {formatPrice(rankValue(p))}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(8, Math.round((Math.abs(rankValue(p)) / maxTopValue) * 100))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 font-mono">
                      <span>{p.profit !== null ? 'ربح تقديري' : 'إيراد'}</span>
                      <span>{formatNumber(p.qty)} وحدة • {formatPrice(p.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Least Profitable Products — guaranteed no overlap with the top list */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-1 rounded-lg">
              تحتاج مراجعة
            </span>
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-rose-500" />
              </span>
              <span>المنتجات الأقل ربحاً</span>
            </h3>
          </div>

          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            لا يتكرر أي منتج هنا مع قائمة الأعلى ربحية — منتجات مختلفة تماماً.
          </p>

          {bottomProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              {productStats.size === 0
                ? 'لا توجد بيانات مبيعات في هذه الفترة.'
                : 'عدد المنتجات المباعة قليل — لا توجد منتجات خارج قائمة الأعلى.'}
            </div>
          ) : (
            <div className="space-y-3">
              {bottomProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-7 h-7 shrink-0 rounded-xl border border-rose-200/60 bg-rose-50/60 flex items-center justify-center text-[11px] font-black font-mono text-rose-500">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900 truncate">{p.name}</span>
                      <span className="text-xs font-black font-mono text-rose-500 shrink-0">
                        {formatPrice(rankValue(p))}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-rose-300 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(8, Math.round((Math.abs(rankValue(p)) / maxBottomValue) * 100))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 font-mono">
                      <span>{p.profit !== null ? 'ربح تقديري' : 'إيراد'}</span>
                      <span>{formatNumber(p.qty)} وحدة فقط • {formatPrice(p.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Breakdown + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Expenses by Category */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs text-gray-400 font-mono">{formatPrice(totalExpensesFiltered)}</span>
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-rose-500" />
              </span>
              <span>توزيع المصروفات حسب الفئة</span>
            </h3>
          </div>

          {expenseCategoryRows.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              لا توجد مصروفات في هذه الفترة.
            </div>
          ) : (
            <div className="space-y-3">
              {expenseCategoryRows.map(({ cat, amount }) => {
                const meta = EXPENSE_CATEGORY_META[cat] || EXPENSE_CATEGORY_META.other;
                const pct = totalExpensesFiltered > 0 ? Math.round((amount / totalExpensesFiltered) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-black font-mono text-gray-900">
                        {formatPrice(amount)} <span className="text-gray-400 font-normal">({formatNumber(pct)}%)</span>
                      </span>
                      <span className="font-bold text-gray-700">{meta.label}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`${meta.color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders Summary */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
          <span className="text-xs text-gray-400 font-mono">آخر العمليات</span>
          <h3 className="font-bold text-base text-gray-900">ملخص الطلبات والمصروفات</h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-5">
          {/* أحدث الطلبات */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#2e5b9f]/10 flex items-center justify-center">
                  <ReceiptText className="w-3.5 h-3.5 text-[#2e5b9f]" />
                </span>
                <h4 className="text-xs font-bold text-gray-700">أحدث الطلبات</h4>
              </div>
              <span className="text-[10px] font-mono text-gray-400">{formatNumber(filteredOrders.length)} طلب</span>
            </div>
            {filteredOrders.slice(0, 5).map((order) => (
              <div key={order._id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white border border-gray-100 hover:border-[#2e5b9f]/30 hover:shadow-sm transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-[#faf8f5] border border-gray-100 flex items-center justify-center font-mono text-[10px] font-black text-gray-700 shrink-0">
                    #{String(order.orderNumber || order._id || '').slice(-4)}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${
                      order.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : order.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}>
                      {order.status === 'completed' ? 'مكتمل' : order.status === 'pending' ? 'قيد التحضير' : 'ملغي'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {(order.items || []).length} أصناف • طاولة #{order.tableNumber || '—'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="font-bold font-mono text-[#2e5b9f] text-xs">{formatPrice(order.totalAmount)}</span>
                  <span className="text-gray-400 font-mono text-[10px]">{formatDate(order.createdAt)}</span>
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">لا توجد طلبات في هذه الفترة.</div>
            )}
          </div>

          {/* أحدث المصروفات */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-rose-500" />
                </span>
                <h4 className="text-xs font-bold text-gray-700">أحدث المصروفات</h4>
              </div>
              <span className="text-[10px] font-mono text-gray-400">{formatNumber(filteredExpenses.length)} قيد</span>
            </div>
            {filteredExpenses.slice(0, 5).map((exp) => (
              <div key={exp._id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white border border-gray-100 hover:border-rose-200 hover:shadow-sm transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    exp.category === 'inventory' ? 'bg-blue-50 border border-blue-100' : 'bg-rose-50 border border-rose-100'
                  }`}>
                    {exp.category === 'inventory' ? '🛒' : '💸'}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-gray-900 text-xs truncate max-w-[160px]">{exp.description}</span>
                    <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {exp.category === 'inventory' ? 'مشتريات مخزون' : EXPENSE_CATEGORY_META[exp.category]?.label || 'مصروف'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={`font-bold font-mono text-xs ${exp.category === 'inventory' ? 'text-[#2e5b9f]' : 'text-[#9f1239]'}`}>
                    {formatPrice(exp.amount)}
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">{formatDate(exp.date)}</span>
                </div>
              </div>
            ))}
            {filteredExpenses.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">لا توجد مصروفات في هذه الفترة.</div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Export Selection Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        title="تصدير التقرير المالي للكافيه"
        periodLabel={dateRange.from && dateRange.to 
          ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
          : dateRange.preset !== 'custom' ? dateRange.preset : 'الكل'}
      />
    </div>
  );
};