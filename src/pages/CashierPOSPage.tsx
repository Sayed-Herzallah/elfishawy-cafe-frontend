import React, { useState, useEffect, useMemo, useRef } from 'react';
import { productService, categoryService, recipeService } from '../services/catalogService';
import { orderService } from '../services/opsService';
import { inventoryService } from '../services/opsService';
// ⚡ تمت إزالة syncAllProductsStock — كان بيبطّئ تحميل الصفحة وبيعيد كتابة
// تعديلات الأدمن اليدوية على الجرامات (stockQuantity) بقيمة محسوبة من الوصفات
import { Product, Category, Order, InventoryItem } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { ReceiptModal } from '../components/ui/ReceiptModal';
import { Modal } from '../components/ui/Modal';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatPrice, formatNumber, formatTime } from '../utils/formatters';
import { toBase } from '../utils/stockSync';
import { productStockState } from '../utils/stockStatus';
import { playAlertSound } from '../utils/soundFeedback';
import { recordOrderShortages, appendShortagesToNotes } from '../utils/orderShortageJournal';
import {
  Plus,
  Trash2,
  Search,
  SearchX,
  Coffee,
  Printer,
  Receipt,
  FileText,
  Clock,
  CheckCircle2,
  ShoppingBag,
  X,
  AlertTriangle,
  Eye,
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

export const CashierPOSPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // ✅ فلتر حالة التوفر — الكاشير يشوف المنخفض والنافذ بضغطة واحدة
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState<string>('');
  // ✅ Validation أحمر لرقم الطاولة — الحقل يظهر بخطأ واضح لما يتأكد الطلب وهو فاضي
  const [tableNumberError, setTableNumberError] = useState<string>('');
  const [orderNote, setOrderNote] = useState<string>('');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [warnedProducts, setWarnedProducts] = useState<Record<string, boolean>>({});
  // خريطة لتسجيل الخامات الثانوية النافذة لكل منتج لعرضها على شاشة المبيعات (POS)
  const [recipeDepletedMap, setRecipeDepletedMap] = useState<Record<string, string[]>>({});
  // خريطة لتسجيل الخامة الأساسية النافذة لكل منتج ليعرف الكاشير سبب نفاذ المنتج بدقة (مثل: نفاذ البن أو الشاي)
  const [primaryDepletedMap, setPrimaryDepletedMap] = useState<Record<string, string[]>>({});
  // ✅ نافذة تفاصيل المنتج وعين الوصفة والمخزون في المبيعات (مثل الأدمن)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [recipeData, setRecipeData] = useState<{ availableProductQty: number; ingredientDetails: any[]; depletedSecondary?: { name: string; unit: string; currentStock: number }[] } | null>(null);
  // ✅ تأكيد قبل تفريغ السلة — "طلب جديد" كان يمسح السلة فوراً بدون تحذير
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState<boolean>(false);

  // Edit Order State — تمت الإزالة: تعديل الطلبات من الـ POS لم يكن يعمل أبداً
  // (القائمة تعرض الطلبات المكتملة فقط، وتعديل الطلبات صلاحية أدمن في الـ Backend)

  // Today's Orders Modal & Search
  const [isTodayOrdersOpen, setIsTodayOrdersOpen] = useState<boolean>(false);
  const [orderSearchText, setOrderSearchText] = useState<string>('');
  const [todaySearchMode, setTodaySearchMode] = useState<'all' | 'orderNumber' | 'table' | 'product'>('all');

  const { showToast, showError } = useNotification();

  const applyProducts = (data: Product[]) =>
    setProducts(
      data.map((p) => {
        const recipeQty = p.availableQuantityByRecipe;
        if (recipeQty === null || recipeQty === undefined) return p;
        return {
          ...p,
          stockQuantity: recipeQty,
          inStock: recipeQty > 0,
        };
      })
    );
  const applyOrders = (data: Order[]) => {
    // Only allow Completed orders to be visible to the cashier POS view
    const completedOrders = data.filter((o: Order) => o.status === 'completed');
    setAllOrders(completedOrders);
    setRecentOrders(completedOrders.slice(0, 4));
  };

  // 🔔 تنبيه صوتي ومرئي لحظة نفاد أو انخفاض مخزون أي منتج —
  // بيقارن حالة المنتجات الجديدة باللقطة السابقة بعد كل تحديث (كل ١٥ ثانية أو بعد البيع)
  const prevStockStates = useRef<Map<string, 'out' | 'low' | 'available'> | null>(null);

  useEffect(() => {
    if (products.length === 0) return;

    const prev = prevStockStates.current;
    prevStockStates.current = new Map(
      products.map((p) => [p._id, productStockState(p)])
    );

    // أول تحميل — بنسجل الحالة فقط بدون تنبيهات قديمة
    if (!prev) return;

    products.forEach((product) => {
      const next = productStockState(product);
      const before = prev.get(product._id);
      // منتج جديد مش موجود في اللقطة السابقة — بنسجله فقط بدون تنبيه
      if (before === undefined || before === next) return;

      if (next === 'out') {
        playAlertSound('out');
        showToast(`🚫 نفذ "${product.name}" من المخزن — أصبح نافذاً ولا يمكن بيعه`, 'error');
      } else if (next === 'low') {
        playAlertSound('low');
        showToast(`⚠️ مخزون منخفض: "${product.name}" — تبقي ${formatNumber(product.stockQuantity)} وحدة فقط`, 'info');
      }
    });
  }, [products, showToast]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // ⚡ تحسين السرعة: كل طلب بيحل لوحده — شبكة المنتجات مبتستنيش الطلبات
      // (الطلبات بتتاخر أحياناً بسبب حجمها، وفل ما كانت Promise.all بتحبس الشاشة كلها)
      const prodPromise = productService.listProducts();
      const catPromise = categoryService.listCategories();
      const ordPromise = orderService.getOrders();
      const recPromise = recipeService.listRecipes().catch(() => null);

      prodPromise
        .then((res) => { if (res.success && res.data) applyProducts(res.data); })
        .catch((err) => showError(err))
        .finally(() => setIsLoading(false));

      catPromise
        .then((res) => { if (res.success && res.data) setCategories(res.data); })
        .catch((err) => console.error('Silent categories load error:', err));

      ordPromise
        .then((res) => { if (res.success && res.data) applyOrders(res.data); })
        .catch((err) => console.error('Silent orders load error:', err));

      recPromise
        .then((res) => {
          if (res && res.success && res.data) {
            const secMap: Record<string, string[]> = {};
            const priMap: Record<string, string[]> = {};
            res.data.forEach((r: any) => {
              const pId = typeof r.product === 'string' ? r.product : r.product?._id;
              if (!pId || !r.ingredients) return;
              const depletedSecNames: string[] = [];
              const depletedPriNames: string[] = [];
              r.ingredients.forEach((ing: any) => {
                const inv = ing.inventoryItem;
                const qty = Number(inv?.quantity) || 0;
                if (qty <= 0) {
                  if (ing.isPrimary === false) {
                    depletedSecNames.push(inv?.name || 'خامة ثانوية');
                  } else {
                    depletedPriNames.push(inv?.name || 'خامة أساسية');
                  }
                }
              });
              if (depletedSecNames.length > 0) secMap[pId] = depletedSecNames;
              if (depletedPriNames.length > 0) priMap[pId] = depletedPriNames;
            });
            setRecipeDepletedMap(secMap);
            setPrimaryDepletedMap(priMap);
          }
        })
        .catch(() => {});

      await Promise.allSettled([prodPromise, catPromise, ordPromise, recPromise]);
    } catch (err) {
      showError(err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 🔄 تحديث صامت دوري — بيشتغل بس لما التاب مفتوح، ومن غير ما يلمس حالة التحميل
    // فمش بيمسح الشاشة ولا بيعيد رسم الشبكات على الفاضي
    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const [prodRes, ordRes, recRes] = await Promise.all([
          productService.listProducts(),
          orderService.getOrders(),
          recipeService.listRecipes().catch(() => null),
        ]);
        if (prodRes.success && prodRes.data) applyProducts(prodRes.data);
        if (ordRes.success && ordRes.data) applyOrders(ordRes.data);
        if (recRes && recRes.success && recRes.data) {
          const secMap: Record<string, string[]> = {};
          const priMap: Record<string, string[]> = {};
          recRes.data.forEach((r: any) => {
            const pId = typeof r.product === 'string' ? r.product : r.product?._id;
            if (!pId || !r.ingredients) return;
            const depletedSecNames: string[] = [];
            const depletedPriNames: string[] = [];
            r.ingredients.forEach((ing: any) => {
              const inv = ing.inventoryItem;
              const qty = Number(inv?.quantity) || 0;
              if (qty <= 0) {
                if (ing.isPrimary === false) {
                  depletedSecNames.push(inv?.name || 'خامة ثانوية');
                } else {
                  depletedPriNames.push(inv?.name || 'خامة أساسية');
                }
              }
            });
            if (depletedSecNames.length > 0) secMap[pId] = depletedSecNames;
            if (depletedPriNames.length > 0) priMap[pId] = depletedPriNames;
          });
          setRecipeDepletedMap(secMap);
          setPrimaryDepletedMap(priMap);
        }
      } catch (err) {
        console.error('Silent POS data refresh error:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleViewProduct = (prod: Product) => {
    setViewingProduct(prod);
    setIsViewModalOpen(true);
    setRecipeData(null);
    recipeService.getRecipeByProduct(prod._id).then((res) => {
      if (res.success && res.data) {
        setRecipeData({
          availableProductQty: res.data.availableProductQty,
          ingredientDetails: res.data.ingredientDetails || [],
          depletedSecondary: res.data.depletedSecondary || [],
        });
      }
    }).catch(() => {
      setRecipeData(null);
    });
  };

  const handleAddToCart = (product: Product) => {
    // ✅ نفس منطق "نافذ" الموحد (≤ 0.01) المستخدم في العرض والفلاتر —
    // بقايا الكسور (مثل 0.005) مبتكفيش أي وحدة بيع فتُحجب زي ما بتظهر.
    if (!product.inStock || productStockState(product) === 'out') {
      // ✅ رسالة واضحة تحدد السلعة/الخامة التي انتهت بالضبط (مثل: نفاد البن أو الشاي)
      const missingIngredients = primaryDepletedMap[product._id];
      const detailMsg = missingIngredients && missingIngredients.length > 0
        ? `بسبب نفاذ (${missingIngredients.join('، ')}) من المخزن`
        : 'رصيد الخامة بالمخزن 0';
      showToast(`صنف "${product.name}" نافد من المخزن ${detailMsg} — لا يمكن إضافته للطلب`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product._id === product._id);
      if (existing) {
        // Increment smoothly if within stock
        if (existing.quantity < product.stockQuantity) {
          return prev.map((item) =>
            item.product._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          // Reached max limit - show alert ONLY ONCE
          if (!warnedProducts[product._id]) {
            showToast(`أقصى كمية متوفرة من "${product.name}" بالمخزن هي ${product.stockQuantity}`, 'info');
            setWarnedProducts((w) => ({ ...w, [product._id]: true }));
          }
          return prev;
        }
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleSetExactQuantity = (productId: string, newQty: number) => {
    const targetProduct = products.find((p) => p._id === productId);
    const maxLimit = targetProduct ? targetProduct.stockQuantity : 999;

    if (newQty >= maxLimit && targetProduct && !warnedProducts[productId]) {
      showToast(`أقصى كمية متوفرة من "${targetProduct.name}" هي ${maxLimit}`, 'info');
      setWarnedProducts((w) => ({ ...w, [productId]: true }));
    }

    const clampedQty = Math.min(Math.max(0, isNaN(newQty) ? 0 : newQty), maxLimit);

    setCart((prev) =>
      prev
        .map((item) => (item.product._id === productId ? { ...item, quantity: clampedQty } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleUpdateQuantityDelta = (productId: string, delta: number) => {
    const targetProduct = products.find((p) => p._id === productId);
    const maxLimit = targetProduct ? targetProduct.stockQuantity : 999;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product._id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > maxLimit) {
              if (targetProduct && !warnedProducts[productId]) {
                showToast(`أقصى كمية متوفرة هي ${maxLimit}`, 'info');
                setWarnedProducts((w) => ({ ...w, [productId]: true }));
              }
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product._id !== productId));
  };

  const getProductImageUrl = (img: any): string => {
    if (typeof img === 'string' && img.trim()) return img;
    if (img && typeof img === 'object' && img.secure_url) return img.secure_url;
    return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
  };

  const handleClearCart = () => {
    setCart([]);
    setTableNumber('');
    setTableNumberError('');
    setOrderNote('');
    setWarnedProducts({});
    showToast('تم بدء طلب جديد وتفريغ السلة', 'info');
  };

  // ✅ "طلب جديد": لو السلة فيها أصناف نطلب تأكيداً أولاً حتى لا يفقد الكاشير طلبه بالخطأ
  const handleNewOrderClick = () => {
    if (cart.length > 0) {
      setIsClearCartConfirmOpen(true);
    } else {
      showToast('السلة فارغة بالفعل — اختر الأصناف لبدء الطلب', 'info');
    }
  };

  const handleConfirmedNewOrder = () => {
    setIsClearCartConfirmOpen(false);
    handleClearCart();
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckoutAndPrint = async () => {
    if (cart.length === 0) {
      showToast('السلة فارغة. الرجاء اختيار طلبات أولاً', 'error');
      return;
    }

    // ✅ رقم الطاولة إجباري — Validation أحمر على الحقل نفسه
    const parsedTableNumber = tableNumber ? parseInt(tableNumber, 10) : NaN;
    if (isNaN(parsedTableNumber) || parsedTableNumber < 1) {
      setTableNumberError('رقم الطاولة مطلوب — اكتب رقم الطاولة قبل تأكيد الطلب');
      showToast('الرجاء إدخال رقم الطاولة قبل تأكيد الطلب', 'error');
      return;
    }
    setTableNumberError('');

    try {
      setIsSubmitting(true);

      // ✅ حساب العجز اللحظي للمواد الثانوية (مثل السكر أو اللبن) وقت إنشاء الفاتورة
      const shortagesForThisOrder = new Set<string>();
      cart.forEach((cartItem) => {
        const depSec = recipeDepletedMap[cartItem.product._id];
        if (depSec && depSec.length > 0) {
          depSec.forEach((name) => shortagesForThisOrder.add(name));
        }
      });
      const shortagesList = Array.from(shortagesForThisOrder);

      // ✅ دمج وسم العجز داخل notes لترسل وتخزن في قاعدة البيانات في السيرفر (Vercel)
      // ليقرأها أي جهاز وسيرفر السحاب بنفس الدقة للأبد!
      const payloadNotes = appendShortagesToNotes(orderNote, shortagesList);

      const orderPayload = {
        items: cart.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
        })),
        tableNumber: parsedTableNumber,
        notes: payloadNotes,
      };

      const orderRes = await orderService.createOrder(orderPayload);
      if (orderRes.success && orderRes.data) {
        // ✅ لا حاجة لخصم المخزون من هنا — الـ Backend يخصم stockQuantity والمخزون الخام
        // (عبر الوصفات) تلقائياً عند إنشاء الطلب. أي خصم إضافي كان يسبب خصماً مزدوجاً.

        if (shortagesList.length > 0) {
          recordOrderShortages(
            orderRes.data._id,
            String(orderRes.data.orderNumber || ''),
            shortagesList
          );
        }

        showToast('تم تأكيد الطلب وحفظ الفاتورة بنجاح!');
        setSelectedReceiptOrder(orderRes.data);
        handleClearCart();
        loadData();
      }
    } catch (err: any) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!p || typeof p !== 'object') return false;
    // 🛡️ حماية من تصنيف محذوف (null) كانت بتكسر الصفحة كلها
    const catId = p.category
      ? (typeof p.category === 'string' ? p.category : p.category._id)
      : '';
    const matchesCat = activeCategory === 'all' || catId === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    // ✅ فلتر حالة التوفر: نافذ / منخفض / الكل
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'out' && productStockState(p) === 'out') ||
      (stockFilter === 'low' && productStockState(p) === 'low');
    return matchesCat && matchesSearch && matchesStock;
  });

  // Filter today's orders by drink product name, order ID, or table with specific modes
  // 🛡️ حمايات null: طلب ناقص أو منتج محذوف كانت بتعمل TypeError وشاشة بيضاء كاملة
  const filteredTodayOrders = useMemo(() => {
    return allOrders.filter((ord) => {
      if (!ord || typeof ord !== 'object') return false;
      const items = Array.isArray(ord.items) ? ord.items : [];
      const q = (orderSearchText || '').trim().toLowerCase();
      if (!q) return true;

      if (todaySearchMode === 'orderNumber') {
        const cleanQ = q.replace('#', '');
        return String(ord.orderNumber || '').toLowerCase().includes(cleanQ);
      }

      if (todaySearchMode === 'table') {
        const cleanQ = q.replace(/[^0-9]/g, '');
        if (!cleanQ) return false;
        return ord.tableNumber === Number(cleanQ);
      }

      if (todaySearchMode === 'product') {
        return items.some((it) => {
          const name = it && typeof it.product === 'object' && it.product ? it.product.name : '';
          return String(name).toLowerCase().includes(q);
        });
      }

      // 'all' mode
      const cleanQ = q.replace('#', '');
      const matchesId = String(ord.orderNumber || '').toLowerCase().includes(cleanQ) || String(ord._id || '').toLowerCase().includes(cleanQ);
      const matchesTable = ord.tableNumber ? String(ord.tableNumber).includes(cleanQ) : false;
      const matchesDrink = items.some((it) => {
        const pName = it && typeof it.product === 'object' && it.product ? it.product.name : '';
        return String(pName).toLowerCase().includes(q);
      });

      return matchesId || matchesTable || matchesDrink;
    });
  }, [allOrders, orderSearchText, todaySearchMode]);

  // const todayRevenue = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="flex flex-col gap-4 text-right font-sans">
      {/* Top Bar: Action, View All Today's Orders, & Quick Last 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200/70">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleNewOrderClick}
            className="inline-flex items-center gap-1.5 bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-2 px-3.5 rounded-xl text-xs transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>طلب جديد</span>
          </button>

          <button
            onClick={() => setIsTodayOrdersOpen(true)}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 text-[#2e5b9f] border border-blue-200 font-bold py-2 px-3.5 rounded-xl text-xs transition shadow-2xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>سجل فواتير اليوم</span>
          </button>
        </div>

        {recentOrders.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-gray-500 font-bold whitespace-nowrap">
              آخر 4 طلبات سابقة:
            </span>
            {recentOrders.slice(0, 4).map((ord) => (
              <div key={ord._id} className="inline-flex items-center gap-1">
                <button
                  onClick={() => setSelectedReceiptOrder(ord)}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  title="نقر لطباعة أو معاينة الفاتورة"
                >
                  <Printer className="w-3.5 h-3.5 text-[#2e5b9f]" />
                  <span className="font-bold">#{String(ord.orderNumber || '----').slice(-4)}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main 2-Column POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Cart Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-5 flex flex-col justify-between order-2 lg:order-1 sticky top-16">
          <div>
            {/* Header — العنوان على اليمين وعداد الأصناف على اليسار */}
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 mb-3.5">
              <h2 className="text-base font-bold font-arabic-heading text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#2e5b9f]" />
                <span>الطلب الحالي (السلة)</span>
              </h2>
              <span className="inline-flex items-baseline gap-1.5 bg-blue-50 text-[#2e5b9f] px-4 py-1.5 rounded-xl font-bold border border-blue-100">
                <span className="text-2xl font-bold font-mono leading-none">
                  {formatNumber(totalItemsCount)}
                </span>
                <span className="text-sm font-bold leading-none">صنف</span>
              </span>
            </div>

            {/* Cart Items with clear spacious typography */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-[#faf8f5]">
                <Coffee className="w-9 h-9 mx-auto mb-2 opacity-30 text-[#2e5b9f]" />
                <p className="text-sm font-bold text-gray-700">السلة فارغة</p>
                <p className="text-xs text-gray-400 mt-1">انقر على المشروبات لإضافتها للطلب</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.product._id}
                    className="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-2xs hover:border-gray-300 transition select-none"
                  >
                    {/* الصف الأول: اسم المنتج يمين — زر الإزالة يسار */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {item.product.name}
                      </span>
                      <button
                        onClick={() => handleRemoveFromCart(item.product._id)}
                        className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer shrink-0"
                        title="إزالة من الطلب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* الصف الثاني: تفاصيل السعر يمين — الكمية والإجمالي يسار */}
                    <div className="flex items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-700 leading-relaxed min-w-0 select-none">
                        <span className="whitespace-nowrap">{formatPrice(item.product.price)} للقطعة</span>
                        <span className="mx-1.5 text-gray-300">•</span>
                        <span className="whitespace-nowrap">الحد الأقصى: {formatNumber(item.product.stockQuantity)}</span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center bg-[#faf8f5] border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantityDelta(item.product._id, 1)}
                            className="w-8 h-8 flex items-center justify-center text-sm font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                          >
                            +
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stockQuantity}
                            value={item.quantity}
                            onChange={(e) =>
                              handleSetExactQuantity(item.product._id, parseInt(e.target.value, 10))
                            }
                            className="w-10 text-center text-sm font-bold font-mono text-gray-900 focus:outline-none bg-transparent py-1 border-x border-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantityDelta(item.product._id, -1)}
                            className="w-8 h-8 flex items-center justify-center text-sm font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                          >
                            -
                          </button>
                        </div>

                        {/* إجمالي الصنف */}
                        <span className="text-base font-extrabold font-mono text-[#2e5b9f] whitespace-nowrap text-left">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* رقم الطاولة والملاحظات — عناوين واضحة فوق كل حقل */}
            <div className="mt-4 pt-3.5 border-t border-gray-100 grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1 text-xs font-bold text-gray-700 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2e5b9f] inline-block" />
                  رقم الطاولة
                  <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="مثال: 4"
                  value={tableNumber}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault();
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setTableNumber('');
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > 0) {
                        setTableNumber(String(num));
                        setTableNumberError('');
                      }
                    }
                  }}
                  style={tableNumberError ? { borderColor: '#dc2626', backgroundColor: '#fef2f2' } : undefined}
                  aria-invalid={!!tableNumberError}
                  className={`w-full bg-[#faf8f5] border rounded-xl px-3.5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 text-right shadow-2xs ${
                    tableNumberError
                      ? 'border-rose-500 focus:ring-rose-300 focus:border-rose-500'
                      : 'border-gray-300 focus:ring-[#2e5b9f]/30 focus:border-[#2e5b9f]'
                  }`}
                />
                {tableNumberError && (
                  <p className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block shrink-0" />
                    {tableNumberError}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-bold text-gray-700 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  ملاحظات
                  <span className="text-gray-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="text"
                  placeholder="سكر زيادة، دبل..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full bg-[#faf8f5] border border-gray-300 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2e5b9f]/30 focus:border-[#2e5b9f] text-right shadow-2xs"
                />
              </div>
            </div>

            {/* Total Row — الرقم على اليسار والوصف على اليمين */}
            <div className="mt-4 p-5 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-between text-gray-900 shadow-2xs">
              <span className="text-base font-bold font-arabic-heading">المجموع الإجمالي:</span>
              <span className="font-mono text-3xl font-bold text-[#2e5b9f] leading-none">
                {formatPrice(totalAmount)}
              </span>
            </div>
          </div>

          {/* Direct Print Button */}
          <div className="mt-4">
            <button
              onClick={handleCheckoutAndPrint}
              disabled={isSubmitting || cart.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-[#2e5b9f] hover:bg-[#244b85] disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-5 h-5 ml-1" />
              <span>
                {isSubmitting ? 'جاري الحفظ...' : 'تأكيد الطلب وطباعة الفاتورة 🖨️'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Side: Products Grid & Search (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5 order-1 lg:order-2">
          {/* Search and Category Filter Bar */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-2xs space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#2e5b9f] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث عن مشروب، صنف، قهوة، تحلية — مثال: كابتشينو"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#faf8f5] border border-gray-200 rounded-xl pr-10 pl-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2e5b9f] text-right"
              />
            </div>

            {/* Category + Availability Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setActiveCategory('all');
                  setStockFilter('all');
                }}
                className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === 'all' && stockFilter === 'all'
                    ? 'bg-[#2e5b9f] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الكل ({products.length})
              </button>
              {categories.map((cat) => {
                const countInCat = products.filter((p) => {
                  const catId = p.category
                    ? (typeof p.category === 'string' ? p.category : p.category._id)
                    : '';
                  return catId === cat._id;
                }).length;

                return (
                  <button
                    key={cat._id}
                    onClick={() => setActiveCategory(activeCategory === cat._id ? 'all' : cat._id)}
                    className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                      activeCategory === cat._id
                        ? 'bg-[#2e5b9f] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name} ({countInCat})
                  </button>
                );
              })}

              <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden />

              {/* فلتر التوفر — أزرار تبديل: يظهر عدد المنتجات حسب التصنيف المختار إن وجد */}
              {(() => {
                const scopedProducts = activeCategory === 'all'
                  ? products
                  : products.filter((p) => {
                      const catId = p.category
                        ? (typeof p.category === 'string' ? p.category : p.category._id)
                        : '';
                      return catId === activeCategory;
                    });
                const lowCount = scopedProducts.filter((p) => productStockState(p) === 'low').length;
                const outCount = scopedProducts.filter((p) => productStockState(p) === 'out').length;

                return (
                  <>
                    <button
                      onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                      className={`inline-flex items-center gap-1 py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition cursor-pointer border ${
                        stockFilter === 'low'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                      title={stockFilter === 'low' ? 'إلغاء التحديد — إظهار الكل' : 'إظهار المنتجات منخفضة المخزون فقط'}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      منخفض ({lowCount})
                    </button>

                    <button
                      onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
                      className={`inline-flex items-center gap-1 py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition cursor-pointer border ${
                        stockFilter === 'out'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                      title={stockFilter === 'out' ? 'إلغاء التحديد — إظهار الكل' : 'إظهار المنتجات النافدة فقط'}
                    >
                      <X className="w-3 h-3" />
                      نافذ ({outCount})
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Product Items Grid */}
          {isLoading ? (
            <LoadingSkeleton type="tile" count={6} />
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
                <SearchX className="w-6 h-6" />
              </div>
              <p className="text-gray-600 font-bold text-sm">لا توجد منتجات مطابقة للبحث</p>
              <p className="text-xs text-gray-500 mt-2">جرّب كتابة اسم آخر أو اختر تصنيفاً مختلفاً من الأعلى</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const productState = productStockState(product);
                const isOutOfStock = productState === 'out';
                const isLowStock = productState === 'low';
                const cartQty = cart.find((i) => i.product._id === product._id)?.quantity || 0;

                return (
                  <button
                    key={product._id}
                    onClick={() => handleAddToCart(product)}
                    aria-disabled={isOutOfStock}
                    className={`relative bg-white rounded-2xl border overflow-hidden text-right flex flex-col transition-all duration-200 group cursor-pointer ${
                      isOutOfStock
                        ? 'opacity-55 border-gray-200 cursor-not-allowed bg-gray-50'
                        : cartQty > 0
                        ? 'border-[#2e5b9f] ring-2 ring-[#2e5b9f]/30 bg-[#2e5b9f]/[0.04] shadow-md'
                        : 'border-gray-200/90 hover:border-[#2e5b9f] hover:shadow-lg hover:-translate-y-1'
                    }`}
                  >
                    {/* شارة الكمية في السلة — تظهر عند الاختيار */}
                    {cartQty > 0 && (
                      <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 bg-[#2e5b9f] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg ring-2 ring-white">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {formatNumber(cartQty)}×
                      </span>
                    )}

                    {/* Image */}
                    <div className="w-full h-32 overflow-hidden bg-gray-100 relative">
                      {/* زرار العين 👁️ لمعرفة تفاصيل المخزون والخامات النافذة بدقة */}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProduct(product);
                        }}
                        className="absolute top-2 right-2 z-20 p-2 bg-white/95 hover:bg-white text-gray-600 hover:text-[#2e5b9f] rounded-xl shadow-md border border-gray-200 transition cursor-pointer"
                        title="عرض تفاصيل المكونات والعجز"
                      >
                        <Eye className="w-4 h-4" />
                      </span>
                      <img
                        src={getProductImageUrl(product.image)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                      {isOutOfStock && (
                        <span className="absolute inset-0 bg-white/65 flex items-center justify-center p-2 text-center">
                          <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm leading-tight">
                            {primaryDepletedMap[product._id] && primaryDepletedMap[product._id].length > 0
                              ? `نفذ: ${primaryDepletedMap[product._id].join('، ')}`
                              : 'نافد من المخزن'}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">
                        {product.name}
                      </h3>

                      {/* السعر — أهم معلومة للكاشير */}
                      <span className="text-lg font-extrabold font-mono text-[#2e5b9f] leading-none">
                        {formatPrice(product.price)}
                      </span>

                      {/* الحالة + عدد الأكواب الجاهزة للبيع */}
                        <div className="flex flex-col gap-1.5">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                              <X className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {primaryDepletedMap[product._id] && primaryDepletedMap[product._id].length > 0
                                  ? `نفاد: ${primaryDepletedMap[product._id].join('، ')}`
                                  : 'نافذ (0 كوب)'}
                              </span>
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center justify-between text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                متبقي:
                              </span>
                              <span className="font-mono font-extrabold">{formatNumber(product.stockQuantity)} كوب</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-between text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                متاح للبيع:
                              </span>
                              <span className="font-mono font-extrabold">{formatNumber(product.stockQuantity)} كوب</span>
                            </span>
                          )}

                          {/* تنبيه وجود عجز في خامة ثانوية (مثل السكر) */}
                          {recipeDepletedMap[product._id] && recipeDepletedMap[product._id].length > 0 && !isOutOfStock && (
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-lg"
                              title={`خامات ثانوية نفذت: ${recipeDepletedMap[product._id].join('، ')}`}
                            >
                              <span className="shrink-0">🥄 عجز:</span>
                              <span className="truncate">{recipeDepletedMap[product._id].join('، ')}</span>
                            </span>
                          )}
                        </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: All Today's Orders & Product Search */}
      <Modal
        isOpen={isTodayOrdersOpen}
        onClose={() => setIsTodayOrdersOpen(false)}
        title="سجل فواتير وطلبات اليوم"
        maxWidth="lg"
      >
        <div className="space-y-4 text-right font-sans">
          {/* 🔢 عداد بسيط — عدد فواتير اليوم فقط بدون أي أرقام مالية */}
          <div className="flex items-center justify-between gap-2 p-3 bg-[#faf8f5] border border-gray-200/80 rounded-2xl shadow-2xs">
            <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2e5b9f] animate-pulse" />
              إجمالي فواتير اليوم الصادرة
            </span>
            <span className="text-sm font-extrabold font-mono text-[#2e5b9f]">
              {formatNumber(allOrders.length)}
              {orderSearchText.trim() && (
                <span className="text-[11px] text-gray-500 font-bold"> • معروض {formatNumber(filteredTodayOrders.length)}</span>
              )}
            </span>
          </div>

          {/* Search Inputs & Mode Tabs */}
          <div className="bg-white rounded-2xl border border-gray-150 p-3 shadow-3xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  todaySearchMode === 'orderNumber'
                    ? 'ابحث برقم الفاتورة فقط...'
                    : todaySearchMode === 'table'
                    ? 'ابحث برقم الطاولة فقط...'
                    : todaySearchMode === 'product'
                    ? 'ابحث باسم المشروب...'
                    : 'ابحث برقم الفاتورة، أو الطاولة، أو اسم المشروب...'
                }
                value={orderSearchText}
                onChange={(e) => setOrderSearchText(e.target.value)}
                className="w-full bg-[#faf8f5] border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2e5b9f]"
                autoFocus
              />
            </div>

            {/* Smart Search Mode Selector Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-[10px] sm:text-xs font-bold">
              <button
                type="button"
                onClick={() => setTodaySearchMode('all')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                  todaySearchMode === 'all' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                الكل
              </button>

              <button
                type="button"
                onClick={() => setTodaySearchMode('orderNumber')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                  todaySearchMode === 'orderNumber'
                    ? 'bg-[#2e5b9f] text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                رقم الفاتورة
              </button>

              <button
                type="button"
                onClick={() => setTodaySearchMode('table')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                  todaySearchMode === 'table'
                    ? 'bg-[#2e5b9f] text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                رقم الطاولة
              </button>

              <button
                type="button"
                onClick={() => setTodaySearchMode('product')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                  todaySearchMode === 'product'
                    ? 'bg-[#2e5b9f] text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                المشروب / الصنف
              </button>
            </div>
          </div>

          {/* Orders List */}
          {filteredTodayOrders.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-[#faf8f5] border border-dashed border-gray-200 rounded-xl">
              <SearchX className="w-6 h-6 text-[#2e5b9f] mx-auto mb-2 opacity-60" />
              <p className="text-xs font-bold text-gray-600">لا توجد فواتير تطابق بحثك</p>
              <p className="text-[11px] text-gray-400 mt-1">جرّب كتابة تفاصيل بحث أخرى</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredTodayOrders.map((ord, idx) => {
                const sequentialIndex = filteredTodayOrders.length - idx;
                return (
                  <div
                    key={ord._id}
                    onClick={() => setSelectedReceiptOrder(ord)}
                    role="button"
                    title="اضغط لعرض وطباعة الفاتورة مباشرة"
                    className="p-3.5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs hover:border-[#2e5b9f]/50 hover:shadow-md hover:shadow-[#2e5b9f]/5 active:scale-[0.99] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right group"
                    dir="rtl"
                  >
                    <div className="space-y-1 text-right flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-[#2e5b9f]/10 text-[#2e5b9f] px-2 py-0.5 rounded-md">
                          تسلسل #{sequentialIndex}
                        </span>
                        <span className="text-xs font-bold font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                          فاتورة #{ord.orderNumber}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatTime(ord.createdAt)}
                        </span>
                        <span className="text-[11px] text-[#2e5b9f] font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                          طاولة #{ord.tableNumber || '—'}
                        </span>
                      </div>

                      {/* Drink items preview */}
                      <div className="text-xs text-gray-600 flex flex-wrap gap-1.5 pt-1">
                        {(ord.items || []).map((item, itemIdx) => {
                          const name = item && typeof item.product === 'object' && item.product ? (item.product as any).name : 'مشروب';
                          return (
                            <span key={itemIdx} className="bg-[#faf8f5] border border-gray-100 px-2 py-0.5 rounded text-[11px] font-medium">
                              {name} <strong className="text-[#2e5b9f] font-mono">×{formatNumber(item.quantity)}</strong>
                            </span>
                          );
                        })}
                      </div>

                      {/* Notes preview if exists */}
                      {ord.notes && ord.notes.trim() !== '' && (
                        <div className="text-[11px] text-amber-700 bg-amber-50/50 p-1.5 rounded-lg inline-block border border-amber-100 mt-1">
                          📝 ملاحظة: <span className="text-gray-700">{ord.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      {/* 👁️ الفاتورة بتفتح بالضغط على الكارت كله — الزرار للطباعة السريعة */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceiptOrder(ord);
                        }}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-l from-[#4a7cc9] to-[#2e5b9f] hover:from-[#2e5b9f] hover:to-[#1d4277] text-white py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-[#2e5b9f]/25 cursor-pointer"
                        title="عرض وطباعة الفاتورة"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>عرض / طباعة</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ✅ نافذة تفاصيل المنتج والمخزون والخامات النافذة (زرار العين 👁️ للكاشير) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="تفاصيل المشروب ومكونات المخزون"
        maxWidth="md"
      >
        {viewingProduct && (
          <div className="space-y-4 text-right font-sans">
            {/* معلومات المنتج */}
            <div className="flex items-center gap-4 p-4 bg-[#faf8f5] rounded-2xl border border-gray-100">
              <img
                src={getProductImageUrl(viewingProduct.image)}
                alt={viewingProduct.name}
                className="w-24 h-24 rounded-2xl object-cover border border-gray-200 shadow-sm"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
                }}
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{viewingProduct.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{viewingProduct.description || 'لا يوجد وصف'}</p>
                <span className="inline-block mt-2 font-mono font-extrabold text-xl text-[#2e5b9f]">
                  {formatPrice(viewingProduct.price)}
                </span>
              </div>
            </div>

            {/* الأكواب المتاحة — بارز في الأعلى */}
            <div className="p-5 bg-gradient-to-l from-[#eef3fc] to-[#f5f8ff] rounded-2xl border border-[#c5d5f0] flex items-center justify-between">
              <div>
                <span className="text-sm text-[#2e5b9f] font-bold block mb-1">الأكواب المتاحة للبيع (من الخامات الأساسية)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-[#2e5b9f]">
                    {recipeData ? formatNumber(recipeData.availableProductQty) : formatNumber(viewingProduct.stockQuantity)}
                  </span>
                  <span className="text-base font-bold text-[#2e5b9f]">كوب</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  viewingProduct.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {viewingProduct.inStock ? 'متوفر للبيع' : 'نافذ من المخزن'}
                </span>
              </div>
            </div>

            {/* تحذير: خامات ثانوية نفذت (مثل السكر) */}
            {recipeData && recipeData.depletedSecondary && recipeData.depletedSecondary.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-600 text-lg">⚠️</span>
                  <span className="text-sm font-bold text-amber-700">
                    خامات ثانوية نفذت — لا تمنع بيع الكوب لكن يجب الانتباه:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipeData.depletedSecondary.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-bold rounded-lg border border-amber-200"
                    >
                      🥄 {item.name}
                      <span className="text-amber-500 font-semibold">(نفذ)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* تفصيل حالة مكونات الوصفة ورصد العجز بدقة */}
            {recipeData && recipeData.ingredientDetails && recipeData.ingredientDetails.length > 0 && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">تفاصيل الخامات ورصد العجز (الوصفة)</span>
                  <span className="text-xs text-gray-500">حساب كفاية المخزون لكل خامة</span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {recipeData.ingredientDetails.map((detail, idx) => {
                    const itemName = detail.inventoryItem?.name || `خامة #${idx + 1}`;
                    const itemUnit = detail.inventoryItem?.unit || '';
                    const itemStock = Number(detail.inventoryItem?.quantity) || 0;
                    const availableCups = Number(detail.availableFromThisIngredient) || 0;
                    const isPrimary = detail.isPrimary !== false;
                    const isDepleted = itemStock <= 0 || availableCups <= 0;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          isDepleted
                            ? isPrimary
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-white border-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                            isPrimary ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isPrimary ? 'أساسية' : 'ثانوية'}
                          </span>
                          <span className="font-bold text-sm">{itemName}</span>
                          <span className="text-xs text-gray-400">
                            (رصيد: {formatNumber(itemStock)} {itemUnit})
                          </span>
                        </div>

                        <div className="text-left font-mono shrink-0 mr-2">
                          {isDepleted ? (
                            <span className="font-bold text-sm flex items-center gap-1">
                              {isPrimary ? '⛔ عجز أساسي (نفذ)' : '⚠️ عجز ثانوي (نفذ)'}
                            </span>
                          ) : (
                            <span className="font-bold text-sm">
                              تكفي: {formatNumber(availableCups)} كوب
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="py-2.5 px-6 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Direct Receipt Print Modal */}
      <ReceiptModal
        order={selectedReceiptOrder}
        isOpen={!!selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
        products={products}
        shortageMap={recipeDepletedMap}
      />

      {/* ✅ تأكيد بدء طلب جديد عندما تحتوي السلة على أصناف */}
      <ConfirmDialog
        isOpen={isClearCartConfirmOpen}
        title="بدء طلب جديد؟"
        message={`السلة الحالية تحتوي على ${formatNumber(totalItemsCount)} صنف بقيمة ${formatPrice(totalAmount)}. سيتم تفريغ السلة ولن يتم حفظ هذا الطلب.`}
        confirmText="نعم، ابدأ طلباً جديداً"
        cancelText="إلغاء"
        variant="warning"
        onConfirm={handleConfirmedNewOrder}
        onCancel={() => setIsClearCartConfirmOpen(false)}
      />
    </div>
  );
};
