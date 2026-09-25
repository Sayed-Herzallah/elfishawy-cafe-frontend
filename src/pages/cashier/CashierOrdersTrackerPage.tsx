import React, { useState, useEffect, useMemo, useRef } from 'react';
import { orderService } from '../../services/opsService';
import { productService } from '../../services/catalogService';
import { Order, OrderStatus, Product } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ReceiptModal } from '../../components/ui/ReceiptModal';
import { ExportModal } from '../../components/ui/ExportModal';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { exportElementToPdf } from '../../utils/pdfExport';
import { formatPrice, formatNumber, formatTime, formatDate, formatDateTime, isToday } from '../../utils/formatters';
import { displayOrderNumber } from '../../utils/orderDisplay';
import {
  Clock,
  Printer,
  Search,
  RefreshCw,
  ShoppingBag,
  Check,
  LayoutGrid,
  ListFilter,
  Download,
  Receipt,
  Armchair,
  Coffee,
  Hash,
} from 'lucide-react';

export const CashierOrdersTrackerPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<'all' | 'orderNumber' | 'table' | 'product'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  // مرجع لمحتوى السجل عشان تصدير الـ PDF
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const { showToast, showError } = useNotification();
  // 🔐 تحديث حالة الطلب (تسليم/إعادة للتحضير) صلاحية أدمن في الـ Backend —
  // لا نعرض هذه الأزرار للكاشير حتى لا يرى إجراءً سيفشل دائماً بخطأ 403
  const { isAdmin } = useAuth();

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const res = await orderService.getOrders();
      if (res.success && res.data) {
        // Filter strictly to today's orders (supports createdAt or created_at fallback)
        const todayOrders = res.data.filter((o) => isToday(o.createdAt || (o as any).created_at));
        // Sort newest on top
        const sorted = [...todayOrders].sort((a, b) => {
          const timeA = new Date(a.createdAt || (a as any).created_at || 0).getTime();
          const timeB = new Date(b.createdAt || (b as any).created_at || 0).getTime();
          return timeB - timeA;
        });
        setOrders(sorted);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // ✅ المنتجات لحل أسماء الأصناف في الفواتير (لو الـ API رجّع product كـ ID)
    productService.listProducts()
      .then((res) => { if (res.success && res.data) setProducts(res.data); })
      .catch(() => { /* الأسماء هتفضل من قاعدة البيانات نفسها */ });
    const interval = setInterval(loadOrders, 12000);
    const cleanupSync = window.electronAPI?.onDataUpdated?.(() => {
      loadOrders();
    });
    return () => {
      clearInterval(interval);
      if (cleanupSync) cleanupSync();
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await orderService.updateOrderStatus(orderId, newStatus);
      if (res.success) {
        const label =
          newStatus === 'completed'
            ? 'تم تسليم الطلب للزبون بنجاح ✓'
            : newStatus === 'pending'
            ? 'الطلب قيد التجهيز في البار ⏳'
            : 'تم تحديث حالة الطلب';
        showToast(label, 'success');
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (err) {
      showError(err);
    }
  };

  const handlePrintReceipt = (order: Order) => {
    setSelectedReceiptOrder(order);
  };

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p?._id && p?.name) map.set(p._id, p.name);
    });
    return map;
  }, [products]);

  const getProductName = (it: any): string => {
    if (!it) return 'مشروب';
    if (it.product && typeof it.product === 'object' && (it.product as any).name) {
      return (it.product as any).name;
    }
    const id = typeof it.product === 'string' ? it.product : '';
    return (id && productNameById.get(id)) || 'مشروب';
  };

  // Filter & Search Logic (Differentiates between Order Number vs Table Number vs Product)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();

      if (!q) return matchesStatus;

      if (searchMode === 'orderNumber') {
        // Specific search for order number
        const cleanQ = q.replace('#', '');
        return matchesStatus && String(order.orderNumber || '').toLowerCase().includes(cleanQ);
      }

      if (searchMode === 'table') {
        // Specific search for table number
        const cleanQ = q.replace(/[^0-9]/g, '');
        if (!cleanQ) return false;
        return matchesStatus && order.tableNumber === Number(cleanQ);
      }

      if (searchMode === 'product') {
        // Specific search for product name inside items
        const hasProd = (order.items || []).some((it) => {
          const name = getProductName(it);
          return String(name || '').toLowerCase().includes(q);
        });
        return matchesStatus && hasProd;
      }

      // 'all' mode: matches any of the above
      const cleanQ = q.replace('#', '');
      const matchesOrderNum = String(order.orderNumber || '').toLowerCase().includes(cleanQ);
      const matchesTable = order.tableNumber && String(order.tableNumber).includes(cleanQ);
      const matchesProd = (order.items || []).some((it) => {
        const name = getProductName(it);
        return String(name || '').toLowerCase().includes(q);
      });

      return matchesStatus && (matchesOrderNum || matchesTable || matchesProd);
    });
  }, [orders, statusFilter, searchQuery, searchMode, productNameById]);

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const totalRevenue = filteredOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // PDF & CSV Export Handlers
  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    try {
      setIsExportingPdf(true);
      showToast('جاري تجهيز ملف الـ PDF... ⏳', 'info');
      await exportElementToPdf(contentRef.current, `سجل_طلبات_الكاشير_${new Date().toISOString().slice(0, 10)}`);
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
        ['سجل يومية طلبات الكاشير - مقهى الفيشاوي', `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`],
        ['التسلسل', 'رقم الفاتورة', 'الوقت', 'الطاولة', 'عدد الأصناف', 'المبلغ', 'الحالة'],
        ...filteredOrders.map((o, idx) => [
          `#${filteredOrders.length - idx}`,
          `#${displayOrderNumber(o) || '—'}`,
          formatTime(o.createdAt),
          `طاولة #${o.tableNumber || 1}`,
          `${(o.items || []).length} أصناف`,
          `${o.totalAmount} جنيها`,
          o.status === 'completed' ? 'تم التسليم' : 'قيد التحضير',
        ]),
      ];

      const csvContent = '\uFEFF' + csvRows.map((row) => row.map((val) => `"${val}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `سجل_طلبات_الكاشير_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('تم تصدير ملف CSV لسجل اليومية بنجاح 📊', 'success');
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className="space-y-5 text-right font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-200/70">
        <div>
          <h1 className="text-xl font-bold font-arabic-heading text-gray-900 flex items-center gap-2">
            سجل فواتير وطلبات اليوم
            <span className="text-xs font-mono font-bold bg-[#2e5b9f]/10 text-[#2e5b9f] px-2.5 py-0.5 rounded-full">
              {filteredOrders.length} طلب
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            سجل كامل مرتب زمنياً (الأحدث أولاً) مع تمييز دقيق بين البحث بالفاتورة، الطاولة أو الصنف.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              loadOrders();
            }}
            disabled={isRefreshing}
            className="p-2.5 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer shadow-2xs"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2e5b9f]' : ''}`} />
          </button>

          {/* View Toggle (Cards vs Table) */}
          <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-xl transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-[#2e5b9f] text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
              title="عرض البطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-xl transition cursor-pointer ${
                viewMode === 'table' ? 'bg-[#2e5b9f] text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
              title="عرض الجدول اليومي"
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الكل ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              قيد التحضير ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`py-1.5 px-3 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              تم التسليم ({completedCount})
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#2e5b9f] hover:bg-[#244b85] text-white py-2 px-3.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير السجل</span>
          </button>
        </div>
      </div>

      {/* Smart Search Bar with Dedicated Search Modes */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                searchMode === 'orderNumber'
                  ? 'ابحث برقم الفاتورة فقط — مثال: 1 أو 15'
                  : searchMode === 'table'
                  ? 'ابحث برقم الطاولة فقط — مثال: 4'
                  : searchMode === 'product'
                  ? 'ابحث باسم المشروب — مثال: قهوة، شاي...'
                  : 'بحث عام برقم الفاتورة، رقم الطاولة، أو اسم المشروب...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#faf8f5] border border-gray-200 rounded-2xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2e5b9f]/30"
            />
          </div>

          {/* Search Mode Selector (Differentiates between Table vs Invoice vs All) */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl self-stretch sm:self-auto text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setSearchMode('all')}
              className={`py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                searchMode === 'all' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>الكل</span>
            </button>

            <button
              onClick={() => setSearchMode('orderNumber')}
              className={`py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                searchMode === 'orderNumber'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>رقم الفاتورة</span>
            </button>

            <button
              onClick={() => setSearchMode('table')}
              className={`py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                searchMode === 'table'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>رقم الطاولة</span>
            </button>

            <button
              onClick={() => setSearchMode('product')}
              className={`py-1.5 px-3 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                searchMode === 'product'
                  ? 'bg-[#2e5b9f] text-white shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>الصنف</span>
            </button>
          </div>
        </div>

        {/* Quick summary stats bar */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 font-mono">
          <div className="flex items-center gap-4">
            <span>
              إجمالي فواتير البحث: <strong className="text-gray-900">
                {isLoading ? <span className="inline-block h-3 w-8 rounded bg-gray-200/90 animate-pulse align-middle" /> : filteredOrders.length}
              </strong>
            </span>
            <span>
              إجمالي المبيعات المكتملة: <strong className="text-emerald-700">
                {isLoading ? <span className="inline-block h-3 w-16 rounded bg-gray-200/90 animate-pulse align-middle" /> : formatPrice(totalRevenue)}
              </strong>
            </span>
          </div>
          <span className="text-gray-400 text-[11px]">مرتب: الأحدث في الأعلى ↓</span>
        </div>
      </div>

      {/* Orders View */}
      {isLoading ? (
        <LoadingSkeleton type="tile" count={4} />
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-6 shadow-2xs">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-400" />
          <p className="text-gray-700 font-bold text-sm">لا توجد طلبات مسجلة تطابق البحث المحدد</p>
          <p className="text-xs text-gray-400 mt-1">تأكد من اختيار وضع البحث المناسب أو امسح حقل البحث</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order, idx) => {
            const isPending = order.status === 'pending';
            const formattedTime = formatTime(order.createdAt);
            const sequentialIndex = filteredOrders.length - idx;

            return (
              <div
                key={order._id}
                onClick={() => handlePrintReceipt(order)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePrintReceipt(order); }}
                title="اضغط في أي مكان لعرض وطباعة الفاتورة"
                className={`bg-white rounded-3xl border transition p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:shadow-md hover:shadow-[#2e5b9f]/5 active:scale-[0.99] ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-300/20'
                    : 'border-gray-200/80 hover:border-[#2e5b9f]/40'
                }`}
              >
                <div>
                  {/* Order Top Bar - RTL: Index and Order Number on Right, Status & Time on Left */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100" dir="rtl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-[#2e5b9f]/10 text-[#2e5b9f] px-2 py-0.5 rounded-lg">
                        تسلسل #{sequentialIndex}
                      </span>
                      <span className="text-xs font-bold font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg">
                        فاتورة #{order.orderNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                          isPending
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isPending ? 'قيد التحضير ⏳' : 'تم التسليم ✓'}
                      </span>
                      <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formattedTime}
                      </span>
                    </div>
                  </div>

                  {/* Order Meta */}
                  <div className="py-2.5 flex items-center justify-between text-xs text-gray-700" dir="rtl">
                    <span className="font-bold">
                      طاولة رقم #{order.tableNumber || '—'}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {formatNumber((order.items || []).length)} أصناف
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2 py-2.5 border-y border-dashed border-gray-200 bg-[#faf8f5]/80 p-3 rounded-2xl">
                    {(order.items || []).map((item, itemIdx) => {
                      const name = getProductName(item);
                      return (
                        <div key={itemIdx} className="flex justify-between items-center text-xs" dir="rtl">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-gray-900 truncate text-xs">{name}</span>
                            <span className="font-bold font-mono text-[#2e5b9f] bg-blue-50 px-1.5 py-0.5 rounded text-xs">
                              ×{formatNumber(item.quantity)}
                            </span>
                          </div>
                          <span className="font-mono text-gray-700 font-bold">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total & Action Buttons */}
                <div className="mt-3.5 pt-3 border-t border-gray-100" dir="rtl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-600 font-bold">المجموع الإجمالي:</span>
                    <span className="text-lg font-bold font-mono text-[#2e5b9f]">
                      {formatPrice(order.totalAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePrintReceipt(order); }}
                      className="inline-flex items-center justify-center gap-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-2.5 px-3 rounded-2xl text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-gray-500" />
                      <span>طباعة الفاتورة</span>
                    </button>

                    {isAdmin && (isPending ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order._id, 'completed'); }}
                        className="inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-2xl text-xs font-bold transition shadow-2xs cursor-pointer"
                        title="تأكيد تسليم الطلب — متاح للمدير"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تم التسليم ✓</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order._id, 'pending'); }}
                        className="inline-flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-2.5 px-3 rounded-2xl text-xs font-bold transition cursor-pointer"
                        title="إرجاع الطلب إلى قيد التحضير — متاح للمدير"
                      >
                        <span>إعادة للتحضير ⏳</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-3xl border border-gray-200/80 p-5 shadow-2xs overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                <th className="pb-3 px-3">التسلسل</th>
                <th className="pb-3 px-3">رقم الفاتورة</th>
                <th className="pb-3 px-3">الوقت والتاريخ</th>
                <th className="pb-3 px-3">الطاولة</th>
                <th className="pb-3 px-3">الأصناف المطلوبة</th>
                <th className="pb-3 px-3">المبلغ الإجمالي</th>
                <th className="pb-3 px-3">الحالة</th>
                <th className="pb-3 px-3 text-left">الإجراء والطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {filteredOrders.map((order, idx) => {
                const isPending = order.status === 'pending';
                const sequentialIndex = filteredOrders.length - idx;

                return (
                  <tr key={order._id} className="hover:bg-[#faf8f5]/80 transition">
                    <td className="py-3.5 px-3 font-mono font-bold text-[#2e5b9f]">
                      #{sequentialIndex}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-gray-900">
                      #{order.orderNumber}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-gray-500 text-[11px]">
                      {formatTime(order.createdAt)}
                    </td>
                    <td className="py-3.5 px-3 font-bold">
                      <span className="inline-flex py-0.5 px-2 bg-blue-50 text-[#2e5b9f] rounded-lg">
                        طاولة #{order.tableNumber || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-gray-600">
                      {(order.items || []).map((it) => `${getProductName(it)} (×${it.quantity})`).join(', ')}
                    </td>
                    <td className="py-3.5 px-3 font-bold font-mono text-[#2e5b9f] text-sm">
                      {formatPrice(order.totalAmount)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 py-0.5 px-2.5 text-[11px] font-bold rounded-lg ${
                          isPending
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isPending ? 'قيد التحضير' : 'تم التسليم ✓'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition cursor-pointer"
                          title="طباعة الفاتورة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {isAdmin && isPending && (
                          <button
                            onClick={() => handleUpdateStatus(order._id, 'completed')}
                            className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
                            title="تأكيد تسليم الطلب — متاح للمدير"
                          >
                            تسليم ✓
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        order={selectedReceiptOrder}
        isOpen={!!selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
        products={products}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        title="تصدير سجل يومية الكاشير"
        periodLabel="اليومية الحالية"
      />
    </div>
  );
};

