import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { analyticsService, orderService, inventoryService, expenseService } from '../../services/opsService';
import { productService } from '../../services/catalogService';
import { KPIStats, ChartsData, Order, InventoryItem, Expense, Product } from '../../types';
import { ReceiptModal } from '../../components/ui/ReceiptModal';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { AttaGlowingChart, ChartDataPoint } from '../../components/ui/AttaGlowingChart';
import { AttaStatCard } from '../../components/ui/AttaStatCard';
import { ComparisonStatCard } from '../../components/ui/ComparisonStatCard';
import { ExportModal } from '../../components/ui/ExportModal';
import { DateRangeFilter, DateRange } from '../../components/ui/DateRangeFilter';
import { isStockLow, isStockOut } from '../../utils/stockStatus';
import { exportElementToPdf } from '../../utils/pdfExport';
import {
  formatPrice,
  formatNumber,
  formatDate,
  formatTime,
  formatDateTime
} from '../../utils/formatters';
import {
  useSalesComparison,
  useOrdersCountComparison,
  useProfitComparison,
  useExplicitRangeComparison,
  type ComparisonResult
} from '../../hooks/useStatisticsComparison';
import { usePersistentState, readSessionCache, writeSessionCache } from '../../hooks/usePersistentState';
import {
  TrendingUp,
  TrendingDown,
  ReceiptText,
  ShoppingBag,
  Coins,
  AlertTriangle,
  Download,
  Eye,
  Plus,
  Store,
  Boxes,
  RefreshCw,
  Calendar,
  Sparkles,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showError } = useNotification();
  const navigate = useNavigate();
  const DASH_CACHE_KEY = 'dash_cache_v1';
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // ✅ الفلاتر محفوظة في localStorage — بعد أي Refresh بترجع نفس الفترة اللي كانت مختارة
  const [timeRange, setTimeRange] = usePersistentState<'today' | 'week' | 'month' | 'year'>('dash_timeRange', 'today');
  const [dateRange, setDateRange] = usePersistentState<DateRange>('dash_dateRange', { from: null, to: null, preset: 'custom' });
  // ✅ لو فيه كاش من آخر مرة، نبدأ بعرضه فورًا بدون سكيليتون فاضي (التحديث الصامت هيجي بعدها)
  const [isLoading, setIsLoading] = useState<boolean>(!readSessionCache<any>(DASH_CACHE_KEY));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  // مرجع لمحتوى التقرير عشان تصدير الـ PDF
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [statsRes, chartsRes, ordersRes, invRes, expRes, prodRes] = await Promise.all([
        analyticsService.getStats(),
        analyticsService.getCharts(),
        orderService.getOrders(),
        inventoryService.listInventory(),
        expenseService.listExpenses(),
        productService.listProducts().catch(() => null),
      ]);

      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (chartsRes.success && chartsRes.data) setCharts(chartsRes.data);
      if (ordersRes.success && ordersRes.data) {
        setAllOrders(ordersRes.data);
        setRecentOrders(ordersRes.data.slice(0, 6));
      }
      if (invRes.success && invRes.data) {
        // ✅ القائمة الكاملة لحساب قيمة المخزون + اشتقاق النواقص منها (منخفض + نافذ)
        setAllInventory(invRes.data);
        setLowStockItems(invRes.data.filter((i) => isStockLow(i.quantity, i.minLimit) || isStockOut(i.quantity)));
      }
      if (expRes.success && expRes.data) setExpenses(expRes.data);
      if (prodRes?.success && prodRes.data) setAllProducts(prodRes.data);

      // ✅ حفظ آخر داتا ناجحة في كاش الجلسة — بعد أي Refresh الصفحة تظهر فورًا بيها
      writeSessionCache(DASH_CACHE_KEY, {
        savedAt: Date.now(),
        stats: statsRes.success ? statsRes.data : null,
        charts: chartsRes.success ? chartsRes.data : null,
        orders: ordersRes.success ? ordersRes.data : null,
        inventory: invRes.success ? invRes.data : null,
        expenses: expRes.success ? expRes.data : null,
        products: prodRes?.success ? prodRes.data : null,
      });
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
      // اعرض الخطأ للمستخدم بدل الهياكل المعلقة بصمت
      showError(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // ✅ استرجاع فوري من كاش الجلسة — الداشبورد يظهر بآخر داتا معروفة بدون وميض تحميل
    try {
      const cached = readSessionCache<any>(DASH_CACHE_KEY);
      if (cached) {
        if (cached.stats) setStats(cached.stats);
        if (cached.charts) setCharts(cached.charts);
        if (Array.isArray(cached.orders)) {
          setAllOrders(cached.orders);
          setRecentOrders(cached.orders.slice(0, 6));
        }
        if (Array.isArray(cached.inventory)) {
          setAllInventory(cached.inventory);
          setLowStockItems(cached.inventory.filter((i: InventoryItem) => isStockLow(i.quantity, i.minLimit) || isStockOut(i.quantity)));
        }
        if (Array.isArray(cached.expenses)) setExpenses(cached.expenses);
        if (Array.isArray(cached.products)) setAllProducts(cached.products);
      }
    } catch {
      /* تجاهل — الكاش تحسيني */
    }

    fetchData();
    // ⚡ تحديث ديناميكي تلقائي كل دقيقة عندما تكون الصفحة ظاهرة (بدون وميض التحميل)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Note: no early return here — useMemo below must not be called conditionally (Rules of Hooks)

  // ✅ النطاق المخصص من منتقي التاريخ له الأولوية — وساعتها نطاق الأزرار السريعة يتجاهل تماماً
  // (بدل ما كان الفلترين بيتصافوا والنتيجة بتطلع أصفار)
  const hasCustomRange = Boolean(dateRange.from || dateRange.to);

  // Filter orders by time range (+ نطاق تاريخ مخصص من الفلتر إن وجد)
  const filteredOrders = allOrders.filter((o) => {
    const orderDate = new Date(o.createdAt);
    const now = new Date();

    // ✅ توصيل فلتر التاريخ المخصص — كان معزولاً عن منطق التصفية
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

    // ✅ الفلتر المخصص شغال؟ يبقى متقيدش بنطاق الأزرار السريعة
    if (hasCustomRange) return true;

    if (timeRange === 'today') {
      return orderDate.toDateString() === now.toDateString();
    } else if (timeRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= weekAgo;
    } else if (timeRange === 'month') {
      return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    } else if (timeRange === 'year') {
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return orderDate >= yearAgo;
    }
    return true;
  });

  // Dynamic KPIs from filtered data
  const totalSales = filteredOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // 🛒 فصل مصروفات الفترة: تشغيلية vs مشتريات مخزون
  const periodExpenses = expenses
    .filter((e) => {
      const expDate = new Date(e.date || e.createdAt || '');
      const now = new Date();

      // ✅ نفس فلتر التاريخ المخصص على المصروفات
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

      // ✅ الفلتر المخصص شغال؟ يبقى متقيدش بنطاق الأزرار السريعة
      if (hasCustomRange) return true;

      if (timeRange === 'today') {
        return expDate.toDateString() === now.toDateString();
      } else if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return expDate >= weekAgo;
      } else if (timeRange === 'month') {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      } else if (timeRange === 'year') {
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return expDate >= yearAgo;
      }
      return true;
    });

  const totalPurchases = periodExpenses
    .filter((e) => e.category === 'inventory')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalOperating = periodExpenses
    .filter((e) => e.category !== 'inventory')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalOperating + totalPurchases;

  const ordersCount = filteredOrders.length;
  // ✅ صافي الربح الحقيقي — السالب يعني خسارة (المصروفات أكبر من المبيعات)
  const netProfit = totalSales - totalExpenses;

  // 💰 قيمة المخزون الحالية = Σ (الكمية × سعر تكلفة الوحدة)
  const inventoryValue = allInventory.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0),
    0
  );

  // Dynamic comparison with previous period
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneDayMs = 24 * 60 * 60 * 1000;

  let prevStart: Date;
  let prevEnd: Date;
  let prevPeriodLabel = 'أمس';

  if (timeRange === 'today') {
    prevStart = new Date(todayStart.getTime() - oneDayMs);
    prevEnd = todayStart;
    prevPeriodLabel = 'اليوم السابق (أمس)';
  } else if (timeRange === 'week') {
    prevStart = new Date(now.getTime() - 14 * oneDayMs);
    prevEnd = new Date(now.getTime() - 7 * oneDayMs);
    prevPeriodLabel = 'الأسبوع السابق';
  } else if (timeRange === 'month') {
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    prevPeriodLabel = 'الشهر السابق';
  } else {
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(now.getFullYear(), 0, 1);
    prevPeriodLabel = 'العام السابق';
  }

  const prevOrdersList = allOrders.filter((o) => {
    const orderDate = new Date(o.createdAt);
    return orderDate >= prevStart && orderDate < prevEnd;
  });

  const prevSales = prevOrdersList
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const prevPeriodExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date || e.createdAt || '');
    return expDate >= prevStart && expDate < prevEnd;
  });
  const prevOperating = prevPeriodExpenses
    .filter((e) => e.category !== 'inventory')
    .reduce((sum, e) => sum + e.amount, 0);
  const prevExpenses = prevPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);

  const prevOrdersCount = prevOrdersList.length;
  const prevNetProfit = prevSales - prevExpenses;

  const getChangePct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : curr < 0 ? -100 : 0;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const salesChange = getChangePct(totalSales, prevSales);
  const expensesChange = getChangePct(totalExpenses, prevExpenses);
  const profitChange = getChangePct(netProfit, prevNetProfit);
  const ordersChange = getChangePct(ordersCount, prevOrdersCount);

  // Use new comparison hooks for dynamic period comparisons
  // 1) مقارنات النطاق السريع (اليوم / الأسبوع / الشهر / العام)
  const quickSales = useSalesComparison(timeRange, allOrders);
  const quickOrders = useOrdersCountComparison(timeRange, allOrders);
  const quickProfit = useProfitComparison(timeRange, allOrders, expenses);

  // 2) ✅ مقارنات نطاق منتقي التاريخ المخصص — الفلتر بقى يجيب إحصائيات فعلاً
  const customFrom = useMemo(() => {
    const d = dateRange.from ? new Date(dateRange.from) : new Date(0);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateRange.from]);
  const customTo = useMemo(() => {
    const d = dateRange.to ? new Date(dateRange.to) : new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, [dateRange.to]);

  const customSales = useExplicitRangeComparison(allOrders, (o: Order) => (o.status === 'completed' ? o.totalAmount : 0), customFrom, customTo);
  const customOrders = useExplicitRangeComparison(allOrders, () => 1, customFrom, customTo);
  const customExpensesAll = useExplicitRangeComparison(expenses, (e: Expense) => e.amount, customFrom, customTo);
  const customOperating = useExplicitRangeComparison(expenses, (e: Expense) => (e.category !== 'inventory' ? e.amount : 0), customFrom, customTo);

  const customProfit: ComparisonResult = useMemo(() => {
    const current = customSales.current - customExpensesAll.current;
    const previous = customSales.previous - customExpensesAll.previous;
    const changeAbsolute = current - previous;
    const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((changeAbsolute / Math.abs(previous)) * 100);
    return {
      current,
      previous,
      changeAbsolute,
      changePercent,
      trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral',
      currentPeriodLabel: 'الفترة المحددة',
      previousPeriodLabel: 'الفترة السابقة',
    };
  }, [customSales, customExpensesAll]);

  // الاختيار النهائي: منتقي التاريخ المخصص له الأولوية على الأزرار السريعة
  const salesComparison = hasCustomRange ? customSales : quickSales;
  const ordersComparison = hasCustomRange ? customOrders : quickOrders;
  const profitComparison = hasCustomRange ? customProfit : quickProfit;

  // Generate multi-series Chart Data points for AttaGlowingChart
  const chartDataPoints: ChartDataPoint[] = useMemo(() => {
    if (timeRange === 'today') {
      // ✅ يوم كامل 24 ساعة (12:00 ص → 11:00 م) بدل 10ص-12ص فقط
      const hourLabel = (h: number) => {
        const period = h < 12 ? 'ص' : 'م';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${String(h12).padStart(2, '0')}:00 ${period}`;
      };

      // مصروفات اليوم فقط (لتوزيعها على ساعاتها الحقيقية)
      const todayExpenses = expenses.filter((e) => {
        const d = new Date(e.date || e.createdAt || '');
        return d.toDateString() === now.toDateString();
      });

      return Array.from({ length: 24 }, (_, h) => {
        // ✅ المبيعات من الطلبات المكتملة فقط (الملغي مش بيع)
        const slotOrders = filteredOrders.filter((o) =>
          o.status === 'completed' && new Date(o.createdAt).getHours() === h
        );
        const s = slotOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const ords = slotOrders.length;
        const exp = todayExpenses
          .filter((e) => new Date(e.date || e.createdAt || '').getHours() === h)
          .reduce((sum, e) => sum + e.amount, 0);
        const p = Math.max(0, s - exp);

        return {
          label: hourLabel(h),
          sales: s,
          orders: ords,
          expenses: exp,
          profit: p,
        };
      });
    }

    if (timeRange === 'week') {
      const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
      const map = new Map<string, { sales: number; orders: number; expenses: number }>();
      days.forEach((d) => map.set(d, { sales: 0, orders: 0, expenses: 0 }));

      filteredOrders.forEach((o) => {
        const day = new Date(o.createdAt).toLocaleDateString('ar-EG', { weekday: 'long' });
        const cur = map.get(day) || { sales: 0, orders: 0, expenses: 0 };
        cur.sales += o.totalAmount;
        cur.orders += 1;
        map.set(day, cur);
      });

      expenses.forEach((e) => {
        const day = new Date(e.date || e.createdAt || '').toLocaleDateString('ar-EG', { weekday: 'long' });
        if (map.has(day)) {
          const cur = map.get(day)!;
          cur.expenses += e.amount;
          map.set(day, cur);
        }
      });

      return days.map((day) => {
        const val = map.get(day) || { sales: 0, orders: 0, expenses: 0 };
        return {
          label: day,
          sales: val.sales,
          orders: val.orders,
          expenses: val.expenses,
          profit: Math.max(0, val.sales - val.expenses),
        };
      });
    }

    if (timeRange === 'month') {
      const weeks = [
        { label: 'الأسبوع 1', startDay: 1, endDay: 7 },
        { label: 'الأسبوع 2', startDay: 8, endDay: 14 },
        { label: 'الأسبوع 3', startDay: 15, endDay: 21 },
        { label: 'الأسبوع 4', startDay: 22, endDay: 31 },
      ];
      return weeks.map(({ label, startDay, endDay }) => {
        const weekOrders = filteredOrders.filter((o) => {
          const d = new Date(o.createdAt);
          return d.getDate() >= startDay && d.getDate() <= endDay && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const s = weekOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const ords = weekOrders.length;
        // ✅ مصروفات كل أسبوع من تواريخ المصروفات الفعلية — بدل توزيع الإجمالي بالتساوي (بيانات مختلقة)
        const exp = Math.round(
          expenses
            .filter((e) => {
              const d = new Date(e.date || e.createdAt || '');
              return d.getDate() >= startDay && d.getDate() <= endDay && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            })
            .reduce((sum, e) => sum + e.amount, 0)
        );
        return {
          label: label,
          sales: s,
          orders: ords,
          expenses: exp,
          profit: Math.max(0, s - exp),
        };
      });
    }

    // Year (آخر 12 شهر) — ✅ تسميات ديناميكية وبيانات حقيقية فقط بدون أي تعبئة تقديرية
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const last12Months: { label: string; year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12Months.push({ label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() });
    }

    return last12Months.map(({ label, year, month }) => {
      const monthOrders = allOrders.filter((o) => {
        const d = new Date(o.createdAt);
        return o.status === 'completed' && d.getFullYear() === year && d.getMonth() === month;
      });

      const s = monthOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const ords = monthOrders.length;
      const exp = Math.round(
        expenses
          .filter((e) => {
            const d = new Date(e.date || e.createdAt || '');
            return d.getFullYear() === year && d.getMonth() === month;
          })
          .reduce((sum, e) => sum + e.amount, 0)
      );
      return {
        label,
        sales: Math.round(s),
        orders: ords,
        expenses: exp,
        profit: Math.max(0, Math.round(s - exp)),
      };
    });
  }, [timeRange, filteredOrders, allOrders, expenses]);

  // Top products
  // ⚠️ حماية من البيانات الناقصة: منتج محذوف (null) أو items ناقصة كانت بتعمل
  // TypeError وواقعة الصفحة كلها — دلوقتي بنتخطى العنصر التالف بأمان
  const productSales = new Map<string, { name: string; quantitySold: number; revenueGenerated: number }>();
  filteredOrders.forEach((order) => {
    if (!order || !Array.isArray(order.items)) return;
    order.items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const productName = (item as any).product;
      // ✅ نتخطى العناصر التي لا تحتوي منتجاً حقيقياً (محذوف من قاعدة البيانات)
      // حتى لا يظهر "منتج محذوف" في قائمة أكثر المنتجات مبيعاً
      if (!productName || typeof productName !== 'object') return;
      const pName = typeof productName.name === 'string' && productName.name.trim()
        ? productName.name
        : null;
      if (!pName) return;
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      const existing = productSales.get(pName) || { name: pName, quantitySold: 0, revenueGenerated: 0 };
      existing.quantitySold += quantity;
      existing.revenueGenerated += price * quantity;
      productSales.set(pName, existing);
    });
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenueGenerated - a.revenueGenerated)
    .slice(0, 4);

  // 🛒 "بتشتري إيه بالظبط؟" — تجميع مشتريات الفترة حسب صنف المخزن المرتبط
  const purchasesBreakdown = (() => {
    const map = new Map<string, { name: string; amount: number; qty: number; count: number }>();
    periodExpenses
      .filter((e) => e.category === 'inventory')
      .forEach((e) => {
        const linked = e.inventoryItemLinked;
        const isObj = typeof linked === 'object' && linked !== null;
        const key = isObj ? linked._id : 'unlinked';
        const name = isObj ? linked.name : 'توريدات غير مرتبطة بصنف';
        const cur = map.get(key) || { name, amount: 0, qty: 0, count: 0 };
        cur.amount += e.amount;
        cur.qty += e.inventoryQuantityAdded || 0;
        cur.count += 1;
        map.set(key, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  })();

  // 🧾 آخر عمليات الشراء والتوريد — مين عمل إيه وإمتى (أحدث 5 قيود مشتريات)
  const recentPurchases = periodExpenses
    .filter((e) => e.category === 'inventory')
    .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime())
    .slice(0, 5);

  const addedByLabelOf = (e: Expense): string =>
    typeof e.addedBy === 'object' ? e.addedBy.userName : e.addedBy || 'المدير';

  const linkedItemNameOf = (e: Expense): string => {
    const linked = e.inventoryItemLinked;
    return typeof linked === 'object' && linked !== null ? linked.name : '';
  };

  // 😴 المنتجات الراكدة — موجودة في المنيو لكن مبيعاتها صفر في الفترة المختارة
  const soldProductIds = new Set<string>();
  filteredOrders.forEach((o) => {
    (o.items || []).forEach((it) => {
      const p = it?.product;
      if (p && typeof p === 'object' && p._id) soldProductIds.add(p._id);
    });
  });
  const dormantProducts = allProducts.filter((p) => !soldProductIds.has(p._id));

  // مقارنة المصروفات التشغيلية بالفترة السابقة (بدون مشتريات المخزن) — تتبع النطاق المخصص أيضاً
  const operatingChange = getChangePct(totalOperating, prevOperating);
  const operatingComparison: ComparisonResult = hasCustomRange
    ? {
        current: customOperating.current,
        previous: customOperating.previous,
        changePercent: customOperating.changePercent,
        changeAbsolute: customOperating.changeAbsolute,
        trend: customOperating.trend,
        currentPeriodLabel: 'الفترة المحددة',
        previousPeriodLabel: 'الفترة السابقة',
      }
    : {
        current: totalOperating,
        previous: prevOperating,
        changePercent: operatingChange,
        changeAbsolute: totalOperating - prevOperating,
        trend: (totalOperating > prevOperating ? 'up' : totalOperating < prevOperating ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
        currentPeriodLabel: 'الفترة الحالية',
        previousPeriodLabel: prevPeriodLabel,
      };

  // PDF & CSV Export Handlers
  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    try {
      setIsExportingPdf(true);
      showToast('جاري تجهيز ملف الـ PDF... ⏳', 'info');
      await exportElementToPdf(contentRef.current, `تقرير_كافيه_الفيشاوي_${timeRange}`);
      showToast('تم تنزيل ملف الـ PDF بنجاح ✅', 'success');
    } catch (err) {
      console.error('PDF export failed', err);
      showError(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csvRows = [
        ['تقرير لوحة تحكم مقهى الفيشاوي', `الفترة: ${timeRange === 'today' ? 'اليوم' : timeRange === 'week' ? 'الأسبوع' : timeRange === 'month' ? 'الشهر' : 'السنة'}`],
        ['المؤشر المالي', 'القيمة الحالية', 'قيمة الفترة السابقة', 'نسبة التغير %'],
        ['إجمالي المبيعات', `${salesComparison.current.toLocaleString('en-US')} جنيها`, `${salesComparison.previous.toLocaleString('en-US')} جنيها`, `${salesComparison.changePercent >= 0 ? '+' : ''}${salesComparison.changePercent}%`],
        ['المصروفات التشغيلية', `${totalOperating.toLocaleString('en-US')}جنيها`, `${prevOperating.toLocaleString('en-US')} جنيها`, `${operatingChange >= 0 ? '+' : ''}${operatingChange}%`],
        ['مشتريات المخزون', `${totalPurchases.toLocaleString('en-US')} جنيها`, '—', '—'],
        ['صافي الأرباح', `${profitComparison.current.toLocaleString('en-US')}  `, `${profitComparison.previous.toLocaleString('en-US')} جنيها`, `${profitComparison.changePercent >= 0 ? '+' : ''}${profitComparison.changePercent}%`],
        ['حجم الطلبات', `${ordersComparison.current.toLocaleString('en-US')} طلب`, `${ordersComparison.previous.toLocaleString('en-US')} طلب`, `${ordersComparison.changePercent >= 0 ? '+' : ''}${ordersComparison.changePercent}%`],
      ];

      const csvContent = '\uFEFF' + csvRows.map((row) => row.map((val) => `"${val}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `تقرير_كافيه_الفيشاوي_${timeRange}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('تم تصدير ملف CSV بنجاح 📊', 'success');
    } catch (err) {
      showError(err);
    }
  };

  return isLoading && !stats ? <LoadingSkeleton type="stat" count={4} /> : (
    <div className="space-y-6 text-right font-sans">
      {/* Top Header - RTL Layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-200/70">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-arabic-heading text-gray-900 flex items-center gap-2">
            لوحة الإدارة والإحصائيات
            
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            متابعة فورية للمبيعات، الإيرادات، المصروفات، وأعداد الطلبات بدقة ومقارنة تلقائية مع الفترات السابقة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer shadow-2xs"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2e5b9f]' : ''}`} />
          </button>

          {/* Professional Date Range Filter */}
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            maxDate={new Date()}
            showPresets={true}
            className="min-w-[220px]"
          />

          {/* Time Range Preset Buttons (Quick Select) */}
          <div className="bg-[#f0ebe1] p-1 rounded-2xl border border-gray-200/70 flex items-center gap-1 text-xs">
            <button
              onClick={() => setTimeRange('today')}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                timeRange === 'today'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                timeRange === 'week'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الأسبوع
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                timeRange === 'month'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الشهر
            </button>
          </div>

          {/* Export Button (Opens PDF/CSV selector) */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 bg-[#2e5b9f] hover:bg-[#244b85] disabled:opacity-60 text-white py-2 px-3.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
            <span>{isExportingPdf ? 'جاري التجهيز...' : 'تصدير (PDF / إكسل)'}</span>
          </button>
        </div>
      </div>

      {/* ====== محتوى التقرير القابل للتصدير كـ PDF ====== */}
      <div ref={contentRef} className="space-y-6">

      {/* Quick Action Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center justify-between p-3 bg-white hover:bg-blue-50/40 border border-gray-200/80 rounded-2xl transition shadow-2xs cursor-pointer min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2e5b9f] flex items-center justify-center font-bold flex-shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="text-right ml-2 min-w-0">
            <span className="text-xs font-bold text-gray-900 block truncate">نقطة البيع (POS)</span>
            <span className="text-[10px] text-gray-400 truncate block">شاشة طلبات الكاشير</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/products')}
          className="flex items-center justify-between p-3 bg-white hover:bg-emerald-50/40 border border-gray-200/80 rounded-2xl transition shadow-2xs cursor-pointer min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          <div className="text-right ml-2 min-w-0">
            <span className="text-xs font-bold text-gray-900 block truncate">إضافة منتج</span>
            <span className="text-[10px] text-gray-400 truncate block">المنيو والأسعار</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/inventory')}
          className="flex items-center justify-between p-3 bg-white hover:bg-amber-50/40 border border-gray-200/80 rounded-2xl transition shadow-2xs cursor-pointer min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div className="text-right ml-2 min-w-0">
            <span className="text-xs font-bold text-gray-900 block truncate">جرد المخزن</span>
            <span className="text-[10px] text-gray-400 truncate block">أرصدة الخامات</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/expenses')}
          className="flex items-center justify-between p-3 bg-white hover:bg-rose-50/40 border border-gray-200/80 rounded-2xl transition shadow-2xs cursor-pointer min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#9f1239] flex items-center justify-center font-bold flex-shrink-0">
            <ReceiptText className="w-4 h-4" />
          </div>
          <div className="text-right ml-2 min-w-0">
            <span className="text-xs font-bold text-gray-900 block truncate">تسجيل مصروف</span>
            <span className="text-[10px] text-gray-400 truncate block">نفقات وتشغيل</span>
          </div>
        </button>
      </div>

      {/* 4 Sleek Comparison Stat Cards with dynamic period comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: المبيعات */}
        <ComparisonStatCard
          title="إجمالي المبيعات"
          value={formatPrice(salesComparison.current)}
          icon={<TrendingUp className="w-6 h-6" />}
          accentColor="blue"
          comparison={salesComparison}
        />

        {/* Card 2: المصروفات التشغيلية — منفصلة عن مشتريات المخزن */}
        <ComparisonStatCard
          title="المصروفات التشغيلية"
          value={formatPrice(totalOperating)}
          icon={<ReceiptText className="w-6 h-6" />}
          accentColor="rose"
          invertColors
          comparison={operatingComparison}
        />

        {/* Card 3: صافي الأرباح — بالسالب لو خسارة */}
        <ComparisonStatCard
          title={profitComparison.current < 0 ? 'صافي الخسارة' : 'صافي الأرباح'}
          value={profitComparison.current < 0 ? formatPrice(Math.abs(profitComparison.current)) : formatPrice(profitComparison.current)}
          icon={profitComparison.current < 0 ? <TrendingDown className="w-6 h-6" /> : <Coins className="w-6 h-6" />}
          accentColor={profitComparison.current < 0 ? 'rose' : 'emerald'}
          comparison={profitComparison}
        />

        {/* Card 4: حجم الطلبات */}
        <ComparisonStatCard
          title="حجم الطلبات"
          value={`${formatNumber(ordersComparison.current)} طلب`}
          icon={<ShoppingBag className="w-6 h-6" />}
          accentColor="purple"
          comparison={ordersComparison}
        />
      </div>

      {/* Main Atta Glowing Chart Section */}
      <AttaGlowingChart
        data={chartDataPoints}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        totalSales={totalSales}
        totalOrders={ordersCount}
        totalExpenses={totalExpenses}
        netProfit={netProfit}
        growthRate={salesComparison.changePercent}
        title="مخطط نشاط ومبيعات الكافيه"
      />

      {/* Lower Section: Top Products & Low Stock Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Top Selling Products (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <span className="text-[11px] text-gray-400 font-mono">الأكثر طلباً</span>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              ☕ المشروبات الأكثر مبيعاً
            </h3>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs font-bold">
              لا توجد مبيعات مسجلة في هذه الفترة بعد.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {topProducts.map((prod, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#faf8f5] border border-gray-100 hover:border-gray-200 transition"
                >
                  <span className="font-bold text-xs font-mono text-[#2e5b9f]">
                    {formatPrice(prod.revenueGenerated)}
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900 block truncate max-w-[140px]">
                      {prod.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {formatNumber(prod.quantitySold)} كوب مباع
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Stock Alerts (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <button
              onClick={() => navigate('/admin/inventory')}
              className="text-xs font-bold text-[#2e5b9f] hover:underline"
            >
              إدارة المخزن ←
            </button>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              📦 تنبيهات نواقص الخامات
            </h3>
          </div>

          {/* 💰 قيمة المخزون الحالية */}
          <div className="flex items-center justify-between gap-2 bg-[#faf8f5] border border-gray-100 rounded-xl px-3 py-2">
            <span className="font-mono font-bold text-[#2e5b9f] text-xs">
              {formatPrice(inventoryValue)}
            </span>
            <span className="text-[11px] text-gray-500 font-bold">
              💰 قيمة المخزون الحالية (كمية × تكلفة)
            </span>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="text-center py-6 text-emerald-600 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs font-bold">
              ✓ كافة خامات المخزن متوفرة وبأرصدة آمنة.
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 3).map((item) => {
                const out = isStockOut(item.quantity);
                return (
                  <div
                    key={item._id}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                      out ? 'bg-rose-50/70 border-rose-200' : 'bg-amber-50/70 border-amber-200'
                    }`}
                  >
                    <button
                      onClick={() => navigate('/admin/inventory')}
                      className={`font-bold hover:underline text-[11px] ${out ? 'text-rose-700' : 'text-[#2e5b9f]'}`}
                    >
                      توريد ←
                    </button>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <span className={`font-bold text-xs block ${out ? 'text-rose-900' : 'text-amber-900'}`}>
                          {item.name}: <strong className="font-mono text-amber-950">{formatNumber(item.quantity)} {item.unit}</strong>
                          <span className={`text-[10px] font-bold mr-1.5 ${out ? 'text-rose-600' : 'text-amber-600'}`}>
                            ({out ? 'نافذ — يحتاج توريد فوري' : 'منخفض — قريب من حد الأمان'})
                          </span>
                        </span>
                        {item.costPrice ? (
                          <span className="text-[10px] text-amber-700 font-mono block mt-0.5">
                            التكلفة: {formatPrice(item.costPrice)} / {item.unit}
                          </span>
                        ) : null}
                      </div>
                      <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${out ? 'text-rose-600' : 'text-amber-600'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Purchases Insight + Dormant Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 🛒 بتشتري إيه؟ (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <span className="text-[11px] text-gray-400 font-mono">إجمالي الفترة: {formatPrice(totalPurchases)}</span>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              🛒 المشتريات والتوريد — بتشتري إيه للمخزن؟
            </h3>
          </div>

          {purchasesBreakdown.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs font-bold">
              لا توجد مشتريات مخزن مسجلة في هذه الفترة بعد.
            </div>
          ) : (
            <div className="space-y-2">
              {purchasesBreakdown.slice(0, 5).map((pb, idx) => {
                const pct = totalPurchases > 0 ? Math.round((pb.amount / totalPurchases) * 100) : 0;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-[#faf8f5] border border-gray-100 hover:border-gray-200 transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-bold text-[11px] text-[#2e5b9f] shrink-0">
                        {formatPrice(pb.amount)}
                      </span>
                      <span className="text-xs font-bold text-gray-900 truncate max-w-[60%]">
                        {pb.name}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-blue-400 to-[#2e5b9f] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 font-mono">
                      <span>{formatNumber(pb.count)} عملية شراء</span>
                      {pb.qty > 0 && <span>+{formatNumber(pb.qty)} وحدة دخلت المخزن</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 🧾 آخر عمليات الشراء والتوريد — مين عمل إيه وإمتى */}
          {recentPurchases.length > 0 && (
            <div className="pt-3 border-t border-gray-100 space-y-1.5">
              <span className="text-[10px] text-gray-400 font-bold block">
                🧾 آخر عمليات الشراء والتوريد — بواسطة مين
              </span>
              {recentPurchases.map((log) => {
                const itemName = linkedItemNameOf(log);
                return (
                  <div
                    key={log._id}
                    className="text-[11px] bg-[#faf8f5] border border-gray-100 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="font-bold text-gray-800 truncate min-w-0">
                      ✅ تم {itemName ? 'توريد' : 'شراء'}
                      {log.inventoryQuantityAdded ? (
                        <span className="font-mono text-emerald-700"> +{formatNumber(log.inventoryQuantityAdded)}</span>
                      ) : null}
                      {itemName ? (
                        <span className="text-gray-500"> — {itemName}</span>
                      ) : (
                        <span className="text-gray-500 font-normal"> — {log.description.slice(0, 40)}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-gray-400">
                      <span className="font-bold text-[#2e5b9f]">{formatPrice(log.amount)}</span>
                      <span>
                        بواسطة <span className="font-bold text-gray-700 font-sans">{addedByLabelOf(log)}</span>
                      </span>
                      <span>{formatDate(log.date || log.createdAt)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 😴 منتجات راكدة (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <button
              onClick={() => navigate('/admin/products')}
              className="text-xs font-bold text-[#2e5b9f] hover:underline"
            >
              إدارة المنتجات ←
            </button>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              😴 منتجات مش بتتباع
            </h3>
          </div>

          {dormantProducts.length === 0 ? (
            <div className="text-center py-6 text-emerald-600 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs font-bold">
              ✓ كل منتجات المنيو اتباعت في هذه الفترة — أداء ممتاز!
            </div>
          ) : (
            <div className="space-y-2">
              {dormantProducts.slice(0, 4).map((prod) => (
                <div
                  key={prod._id}
                  className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <button
                    onClick={() => navigate('/admin/products')}
                    className="text-[10px] font-bold text-gray-400 hover:text-[#2e5b9f]"
                  >
                    مراجعة ←
                  </button>
                  <div className="flex items-center gap-2 text-right min-w-0">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-800 text-xs block truncate max-w-[140px]">{prod.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {formatPrice(prod.price)} • {prod.inStock ? 'متاح' : 'غير متاح'}
                      </span>
                    </div>
                    <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 text-sm">
                      💤
                    </span>
                  </div>
                </div>
              ))}
              {dormantProducts.length > 4 && (
                <p className="text-[10px] text-gray-400 text-center">
                  و{formatNumber(dormantProducts.length - 4)} منتجات أخرى بدون مبيعات في الفترة.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
          <button
            onClick={() => navigate('/admin/sales')}
            className="text-xs font-bold text-[#2e5b9f] hover:underline"
          >
            عرض سجل المبيعات الكامل ←
          </button>
          <h3 className="font-bold text-sm text-gray-900">🧾 أحدث الفواتير المسجلة</h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400 mx-2">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-600 font-bold text-xs">لا توجد طلبات مسجلة في هذه الفترة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                  <th className="pb-2 px-3">رقم الفاتورة</th>
                  <th className="pb-2 px-3">التاريخ والوقت</th>
                  <th className="pb-2 px-3">الطاولة</th>
                  <th className="pb-2 px-3">عدد الأصناف</th>
                  <th className="pb-2 px-3">المبلغ المطلوب</th>
                  <th className="pb-2 px-3">الحالة</th>
                  <th className="pb-2 px-3 text-left">طباعة ومعاينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {filteredOrders.slice(0, 6).map((order) => (
                  <tr key={order._id} className="hover:bg-[#faf8f5]/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-gray-900">
                      #{order.orderNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-gray-700 text-[11px] font-bold">
                          {formatDate(order.createdAt)}
                        </span>
                        <span className="font-mono text-gray-400 text-[10px]">
                          {formatTime(order.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex py-0.5 px-2 bg-blue-50 text-[#2e5b9f] font-bold rounded-lg text-[10px]">
                        طاولة #{order.tableNumber || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500 font-mono">{formatNumber((order.items || []).length)} أصناف</td>
                    <td className="py-3 px-3 font-bold font-mono text-[#2e5b9f]">
                      {formatPrice(order.totalAmount)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 py-0.5 px-2 text-[11px] font-bold rounded-lg ${
                        order.status === 'cancelled'
                          ? 'bg-rose-50 text-[#9f1239]'
                          : order.status === 'pending'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {order.status === 'cancelled' ? 'ملغي' : order.status === 'pending' ? 'قيد التحضير' : 'مكتمل ✓'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-1 text-[#2e5b9f] hover:underline font-bold text-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض الفاتورة</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      {/* ====== نهاية محتوى التصدير ====== */}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        products={allProducts}
      />

      {/* PDF / Excel Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        title="تصدير التقرير المالي للكافيه"
        periodLabel={timeRange === 'today' ? 'اليوم' : timeRange === 'week' ? 'الأسبوع' : timeRange === 'month' ? 'الشهر' : 'العام'}
      />
    </div>
  );
};