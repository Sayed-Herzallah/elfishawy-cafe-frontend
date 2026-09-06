import React, { useState, useEffect, useMemo } from 'react';
import { orderService, inventoryService } from '../../services/opsService';
import { productService, recipeService } from '../../services/catalogService';
import { Order, OrderStatus, Product } from '../../types';
import { getOrderShortages } from '../../utils/orderShortageJournal';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { ReceiptModal } from '../../components/ui/ReceiptModal';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Pagination } from '../../components/ui/Pagination';
import { DateRangeFilter, DateRange } from '../../components/ui/DateRangeFilter';
import { DashboardFilterBar } from '../../components/ui/DashboardFilterBar';
import { ProfessionalCard, OrderCard } from '../../components/ui/ProfessionalCard';
import { useNotification } from '../../contexts/NotificationContext';
import { formatPrice, formatNumber, formatDate, formatTime } from '../../utils/formatters';
import {
  ShoppingBag,
  TrendingUp,
  CreditCard,
  ReceiptText,
  Search,
  Printer,
  Calendar,
  Filter,
  ChevronLeft,
  MoreVertical,
  Eye,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
} from 'lucide-react';

export const AdminSalesPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [stockQualityFilter, setStockQualityFilter] = useState<'all' | 'clean' | 'shortage'>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null, preset: 'custom' });
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  
  // --- Pagination ---
  const [itemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // --- Edit Order States ---
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderData, setEditOrderData] = useState({
    tableNumber: '',
  });
  const [isEditOrderSubmitting, setIsEditOrderSubmitting] = useState<boolean>(false);

  const { showToast, showError } = useNotification();

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const res = await orderService.getOrders();
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // ✅ المنتجات لحل أسماء الأصناف في الفواتير (لو الـ API رجّع product كـ ID)
    productService.listProducts()
      .then((res) => { if (res.success && res.data) setProducts(res.data); })
      .catch(() => { /* تجاهل — الأسماء هتفضل من الطلب نفسه */ });
    // ✅ بيانات العجز الثانوي الآن تُقرأ من سجل لحظي (localStorage) مسجَّل عند كل فاتورة
    // ولا يتم جلب المخزن هنا لأنه كان يسبب أثراً رجعياً على الفواتير القديمة
  }, []);


  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, stockQualityFilter, dateRange]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'cancelled') {
      showToast('إلغاء الطلب سيتم إرجاع المنتجات للمخزون', 'info');
    }

    try {
      const res = await orderService.updateOrderStatus(orderId, newStatus);
      if (res.success) {
        showToast(
          newStatus === 'cancelled'
            ? 'تم إلغاء الطلب وإرجاع المنتجات للمخزون'
            : 'تم تحديث حالة الطلب بنجاح'
        );
        loadOrders();
      }
    } catch (err) {
      showError(err);
    }
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    try {
      setIsEditOrderSubmitting(true);
      const payload: Record<string, any> = {};
      if (editOrderData.tableNumber) {
        payload.tableNumber = Number(editOrderData.tableNumber);
      }

      const res = await orderService.updateOrder(editingOrder._id, payload as any);
      if (res.success) {
        showToast('تم تحديث بيانات الطلب بنجاح');
        setIsEditOrderModalOpen(false);
        setEditingOrder(null);
        loadOrders();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsEditOrderSubmitting(false);
    }
  };

  // ✅ فحص هل الطلب كان به عجز في أي خامة ثانوية (مثل السكر أو اللبن)
  // يفحص أولاً من السيرفر مباشرة (من notes الفاتورة المسجلة في الـ DB)
  // ثم من السجل المحلي (localStorage) كـ fallback — يعمل على Vercel وأي جهاز!
  const getOrderShortageItems = (o: Order): string[] => {
    const orderNum = typeof o.orderNumber === 'string' ? o.orderNumber : String(o.orderNumber || '');
    const stored = getOrderShortages(o._id, orderNum, o.notes);
    if (stored && stored.length > 0) return stored;
    return [];
  };

  // --- Filtered Orders (memoized) ---
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

      // فلتر جودة المخزون (كامل بدون عجز / به عجز ثانوي)
      const shortageItems = getOrderShortageItems(o);
      const hasShortage = shortageItems.length > 0;
      if (stockQualityFilter === 'clean' && hasShortage) return false;
      if (stockQualityFilter === 'shortage' && !hasShortage) return false;

      let matchesDate = true;
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

      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesStatus && matchesDate;

      const tableStr = o.tableNumber ? String(o.tableNumber) : '';
      const hasMatchingProduct = (o.items || []).some((item) => {
        const pName = item && typeof item.product === 'object' && item.product ? item.product.name : '';
        return String(pName || '').toLowerCase().includes(q);
      });

      const matchesSearch =
        String(o.orderNumber || '').toLowerCase().includes(q) ||
        String(o._id || '').toLowerCase().includes(q) ||
        tableStr.includes(q) ||
        hasMatchingProduct;

      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [orders, products, statusFilter, stockQualityFilter, dateRange, searchQuery]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = useMemo(
    () => filteredOrders.slice(startIndex, startIndex + itemsPerPage),
    [filteredOrders, startIndex, itemsPerPage]
  );

  // --- Existing calculations (post-filter) ---
  const completedOrders = filteredOrders.filter((o) => o.status === 'completed');
  const totalSalesAmount = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const averageOrderValue =
    completedOrders.length > 0 ? Math.round(totalSalesAmount / completedOrders.length) : 0;
  const completedRatio = filteredOrders.length > 0 ? Math.round((completedOrders.length / filteredOrders.length) * 100) : 0;

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
        <div>
          <h1 className="text-2xl font-bold font-arabic-heading text-gray-900">
            سجل المبيعات والطلبات
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            متابعة فواتير المبيعات، تفاصيل كل طلب، وإدارة الفواتير والطباعة.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي مبيعات الفلتر"
          value={formatPrice(totalSalesAmount)}
          percentage={completedRatio}
          icon={<TrendingUp className="w-5 h-5" />}
          variant="blue"
        />
        <StatCard
          title="عدد الطلبات المعروضة"
          value={`${formatNumber(filteredOrders.length)} طلب`}
          icon={<ShoppingBag className="w-5 h-5" />}
          variant="neutral"
        />
        <StatCard
          title="متوسط قيمة الفاتورة"
          value={formatPrice(averageOrderValue)}
          icon={<ReceiptText className="w-5 h-5" />}
          variant="neutral"
        />
        <StatCard
          title="الطلبات المكتملة"
          value={`${formatNumber(completedOrders.length)} طلب`}
          percentage={completedRatio}
          icon={<CreditCard className="w-5 h-5 text-emerald-600" />}
          variant="neutral"
        />
      </div>

      {/* ✨ شريط الفلترة الموحّد — بحث + حالة الطلب + منتقي تاريخ احترافي */}
      <DashboardFilterBar
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
        searchPlaceholder="ابحث برقم الطلب، اسم المشروب، أو رقم الطاولة"
        groupLabel="الحالة:"
        periods={[
          { id: 'all', label: `الكل (${formatNumber(orders.length)})` },
          { id: 'completed', label: `مكتمل (${formatNumber(orders.filter((o) => o.status === 'completed').length)})` },
          { id: 'pending', label: `قيد التحضير (${formatNumber(orders.filter((o) => o.status === 'pending').length)})` },
          { id: 'cancelled', label: `ملغي (${formatNumber(orders.filter((o) => o.status === 'cancelled').length)})` },
        ]}
        activePeriod={statusFilter}
        onPeriodChange={(id) => { setStatusFilter(id as typeof statusFilter); setCurrentPage(1); }}
        resultCount={filteredOrders.length}
        resultLabel="فاتورة مسجلة"
        alwaysShowReset
        resetLabel="مسح التصفية"
        activeCount={
          (searchQuery ? 1 : 0) +
          (statusFilter !== 'all' ? 1 : 0) +
          (stockQualityFilter !== 'all' ? 1 : 0) +
          (dateRange.from || dateRange.to ? 1 : 0)
        }
        onReset={() => {
          setStatusFilter('all');
          setStockQualityFilter('all');
          setDateRange({ from: null, to: null, preset: 'custom' });
          setSearchQuery('');
          setCurrentPage(1);
        }}
      >
        <DateRangeFilter
          value={dateRange}
          onChange={(newRange) => { setDateRange(newRange); setCurrentPage(1); }}
          maxDate={new Date()}
          showPresets={true}
          className="w-full sm:w-[260px]"
        />
      </DashboardFilterBar>

      {/* ✅ فلتر لمبيعات العجز الثانوي فقط أو الكل */}
      <div className="flex flex-wrap items-center gap-2 bg-gray-50/80 p-2.5 rounded-xl border border-gray-200/70">
        <span className="text-xs font-bold text-gray-700 ml-1">تصفية المبيعات حسب حالة المكونات:</span>
        <button
          type="button"
          onClick={() => { setStockQualityFilter('all'); setCurrentPage(1); }}
          className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            stockQualityFilter === 'all'
              ? 'bg-[#2e5b9f] text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          كل المبيعات ({formatNumber(orders.length)})
        </button>
        <button
          type="button"
          onClick={() => { setStockQualityFilter('shortage'); setCurrentPage(1); }}
          className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            stockQualityFilter === 'shortage'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>المبيعات التي كان بها عجز فقط ({formatNumber(orders.filter((o) => getOrderShortageItems(o).length > 0).length)})</span>
        </button>
      </div>

      {/* Orders as Cards (clickable) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <h3 className="font-bold text-base text-gray-900">سجل الفواتير والعمليات</h3>
        </div>

        {isLoading ? (
          <LoadingSkeleton type="tile" count={itemsPerPage} />
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-14 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400 mx-2">
            <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-gray-600 font-bold text-sm">لا توجد طلبات مطابقة</p>
            <p className="text-xs text-gray-500 mt-2">جرّب تعديل كلمة البحث أو اختيار فلترة مختلفة لعرض النتائج.</p>
          </div>
        ) : (
          <>
          {/* جدول سريع على سطح المكتب — نفس أسلوب جدول المخزون */}
          <div className="hidden md:block overflow-x-auto -mx-6 px-6 pb-3 border-b border-gray-100">
            <table className="w-full text-right border-collapse text-xs min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                  <th className="pb-3 px-3">رقم الفاتورة</th>
                  <th className="pb-3 px-3">التاريخ / الوقت</th>
                  <th className="pb-3 px-3">الأصناف</th>
                  <th className="pb-3 px-3">الطاولة</th>
                  <th className="pb-3 px-3">المبلغ</th>
                  <th className="pb-3 px-3">حالة المكونات</th>
                  <th className="pb-3 px-3">الحالة</th>
                  <th className="pb-3 px-3 text-left">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {paginatedOrders.map((order) => {
                  const safeItems = Array.isArray(order.items) ? order.items : [];
                  const productNameById = new Map<string, string>(products.map((p) => [p._id, p.name]));
                  const resolveName = (it: any): string =>
                    it && typeof it.product === 'object' && it.product
                      ? (it.product as any).name || 'صنف'
                      : productNameById.get(String(it?.product)) || 'صنف محذوف';
                  const itemsLabel =
                    safeItems
                      .slice(0, 2)
                      .map((it) => resolveName(it))
                      .join('، ') +
                    (safeItems.length > 2 ? ` +${safeItems.length - 2}` : '');

                  const shortageItems = getOrderShortageItems(order);
                  const hasShortage = shortageItems.length > 0;

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-[#faf8f5]/60 transition cursor-pointer"
                      onClick={() => setSelectedReceiptOrder(order)}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-[#2e5b9f]">
                        #{String(order.orderNumber || order._id || '').slice(-6)}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-500">
                        {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-gray-600 truncate max-w-[220px]">
                        {itemsLabel || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex py-0.5 px-2 bg-blue-50 text-[#2e5b9f] font-bold rounded-lg text-[10px]">
                          طاولة #{order.tableNumber || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-gray-900">
                        {formatPrice(order.totalAmount)}
                      </td>
                      <td className="py-3 px-3">
                        {hasShortage ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                            title={`نواقص ثانوية: ${shortageItems.join('، ')}`}
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            عجز: {shortageItems.join('، ')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" />
                            مكتمل
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : order.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}>
                          {order.status === 'completed' ? 'مكتمل' : order.status === 'pending' ? 'قيد التحضير' : 'ملغي'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedReceiptOrder(order); }}
                          className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-blue-50 text-[#2e5b9f] hover:bg-blue-100 font-bold transition text-[11px] cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          فاتورة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {paginatedOrders.map((order) => {
              const statusStyle = 
                order.status === 'completed' ? 'completed' :
                order.status === 'pending' ? 'pending' : 'cancelled';

              const safeItems = Array.isArray(order.items) ? order.items : [];
              const shortageItems = getOrderShortageItems(order);
              const hasShortage = shortageItems.length > 0;
              const itemsPreview = safeItems.slice(0, 3).map((item, idx) => {
                const pName =
                  item && typeof item.product === 'object' && (item.product as any)?.name
                    ? (item.product as any).name
                    : typeof item?.product === 'string'
                    ? 'صنف'
                    : 'مشروب';
                return (
                  <span key={idx} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {pName} ×{formatNumber(item.quantity)}
                  </span>
                );
              });
              const remaining = safeItems.length - 3;

              return (
                <OrderCard
                  key={order._id}
                  id={order._id}
                  status={statusStyle as any}
                  title={String(order.orderNumber || `طلب #${String(order._id || '').slice(-6)}`)}
                  subtitle={`#${order._id.slice(-6)} • ${formatDate(order.createdAt)}`}
                  onClick={() => setSelectedReceiptOrder(order)}
                  onDoubleClick={() => setSelectedReceiptOrder(order)}
                  amounts={{
                    primary: formatNumber(order.totalAmount),
                    currency: '',
                  }}
                  metadata={[
                    { label: 'الطاولة', value: `#${order.tableNumber || '—'}`, icon: <ShoppingBag className="w-3.5 h-3.5" /> },
                    { label: 'الوقت', value: formatTime(order.createdAt), icon: <Calendar className="w-3.5 h-3.5" /> },
                    { label: 'عدد الأصناف', value: formatNumber(safeItems.length), icon: <ShoppingBag className="w-3.5 h-3.5" /> },
                  ]}
                  tags={[`طاولة #${order.tableNumber || '—'}`]}
                  actions={[
                    {
                      icon: <Printer className="w-3.5 h-3.5" />,
                      label: 'طباعة',
                      onClick: (e) => { e.stopPropagation(); setSelectedReceiptOrder(order); },
                      variant: 'primary',
                    },
                    {
                      icon: <Eye className="w-3.5 h-3.5" />,
                      label: 'عرض',
                      onClick: (e) => { e.stopPropagation(); setSelectedReceiptOrder(order); },
                      variant: 'default',
                    },
                    ...(order.status !== 'cancelled' ? [{
                      icon: <Edit2 className="w-3.5 h-3.5" />,
                      label: 'تعديل',
                       onClick: (e: React.MouseEvent) => {
                         e.stopPropagation();
                         setEditingOrder(order);
                         setEditOrderData({
                           tableNumber: order.tableNumber ? String(order.tableNumber) : '',
                         });
                         setIsEditOrderModalOpen(true);
                       },
                      variant: 'default' as const,
                    }] : []),
                    ...(order.status === 'pending' ? [{
                      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                      label: 'إكمال',
                      onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleUpdateStatus(order._id, 'completed'); },
                      variant: 'primary' as const,
                    }] : []),
                    ...(order.status !== 'cancelled' ? [{
                      icon: <XCircle className="w-3.5 h-3.5" />,
                      label: 'إلغاء',
                      onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleUpdateStatus(order._id, 'cancelled'); },
                      variant: 'danger' as const,
                    }] : []),
                  ]}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-gray-500">الطاولة</span>
                      <span className="font-medium text-gray-900">
                        #{order.tableNumber || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500">الإجمالي</span>
                      <span className="font-bold font-mono text-[#2e5b9f]">{formatPrice(order.totalAmount)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500">الوقت</span>
                      <span className="font-mono text-gray-700 text-[10px]">
                        {formatTime(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500">الحالة</span>
                      <Badge
                        variant={
                          order.status === 'completed' ? 'completed' :
                          order.status === 'pending' ? 'pending' : 'cancelled'
                        }
                        size="sm"
                      >
                        {order.status === 'completed' ? 'مكتمل' :
                         order.status === 'pending' ? 'قيد التحضير' : 'ملغي'}
                      </Badge>
                    </div>
                    {/* ✅ حالة المكونات للموبايل */}
                    <div className="sm:col-span-2 flex items-center gap-1">
                      {hasShortage ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          <AlertTriangle className="w-3 h-3" />
                          عجز ثانوي: {shortageItems.join('، ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" />
                          مكتمل المكونات
                        </span>
                      )}
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-1">
                      {itemsPreview}
                      {remaining > 0 && (
                        <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                          +{formatNumber(remaining)} المزيد
                        </span>
                      )}
                    </div>
                  </div>
                </OrderCard>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* Pagination (Professional Google-style) */}
      {!isLoading && filteredOrders.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredOrders.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          maxPages={7}
        />
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={!!selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
        order={selectedReceiptOrder}
        products={products}
        shortageMap={
          selectedReceiptOrder
            ? (() => {
                const stored = getOrderShortages(
                  selectedReceiptOrder._id,
                  String(selectedReceiptOrder.orderNumber || ''),
                  selectedReceiptOrder.notes
                );
                if (!stored || stored.length === 0) return undefined;
                const map: Record<string, string[]> = {};
                (selectedReceiptOrder.items || []).forEach((item: any) => {
                  const pId = typeof item?.product === 'object' && item?.product
                    ? (item.product as any)._id
                    : String(item?.product || '');
                  if (pId) map[pId] = stored;
                });
                return map;
              })()
            : undefined
        }
      />


      {/* Edit Order Modal */}
      <Modal
        isOpen={isEditOrderModalOpen}
        onClose={() => {
          setIsEditOrderModalOpen(false);
          setEditingOrder(null);
        }}
        title={`تعديل الطلب: ${editingOrder?.orderNumber || ''}`}
        maxWidth="md"
      >
        <form noValidate onSubmit={handleUpdateOrder} className="space-y-4 text-right">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
            ⚠️ تعديل الطلب يحسب الفرق في المخزون تلقائياً. لا يمكن تعديل الأصناف من هنا — استخدم الإلغاء وإنشاء طلب جديد لتغيير المنتجات.
          </div>

          <Input
            label="رقم الطاولة"
            type="number"
            min="1"
            placeholder="اتركه فارغاً للإبقاء على الرقم الحالي"
            value={editOrderData.tableNumber}
            onChange={(e) =>
              setEditOrderData({ ...editOrderData, tableNumber: e.target.value })
            }
          />

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditOrderModalOpen(false);
                setEditingOrder(null);
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isEditOrderSubmitting}
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
