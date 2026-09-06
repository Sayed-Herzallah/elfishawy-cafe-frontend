import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, AlertTriangle, PackageX } from 'lucide-react';
import { formatPrice, formatNumber, formatDateTime } from '../../utils/formatters';
import { getCleanNotes } from '../../utils/orderShortageJournal';

interface ReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  /** قائمة المنتجات — لحل أسماء الأصناف لما الـ API يرجّع product كـ ID بس */
  products?: Array<{ _id: string; name: string }>;
  /** خريطة الخامات الثانوية النافذة لكل منتج */
  shortageMap?: Record<string, string[]>;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, isOpen, onClose, products, shortageMap }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = formatDateTime(order.createdAt);

  const receiptItems = Array.isArray(order.items) ? order.items : [];
  const totalItemsCount = receiptItems.reduce((acc, item) => acc + (item?.quantity || 0), 0);

  // خريطة أسماء المنتجات
  const productNameById = new Map<string, string>(
    (products || []).map((p) => [p._id, p.name])
  );

  const resolveProductName = (item: any): string => {
    if (!item || !item.product) return 'صنف';
    if (typeof item.product === 'object') return (item.product as any).name || 'صنف';
    return productNameById.get(String(item.product)) || 'صنف محذوف من المنيو';
  };

  // جمع كل عناصر العجز الثانوية مجمّعة لكل صنف
  const shortagesPerProduct = new Map<string, string[]>(); // productName -> shortageNames
  receiptItems.forEach((item) => {
    const pId =
      typeof item?.product === 'object' && item?.product
        ? (item.product as any)._id
        : String(item?.product || '');
    const pName = resolveProductName(item);
    const itemShortages = shortageMap && pId ? shortageMap[pId] : null;
    if (itemShortages && itemShortages.length > 0) {
      shortagesPerProduct.set(pName, itemShortages);
    }
  });

  const hasAnyShortage = shortagesPerProduct.size > 0;

  // قائمة موحّدة بكل الخامات الناقصة فريدة في الفاتورة
  const uniqueShortageIngredients = Array.from(
    new Set(Array.from(shortagesPerProduct.values()).flat())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md p-6 z-10 text-right animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors print:hidden"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Receipt Section */}
        <div id="printable-receipt" className="text-gray-900 font-sans p-2 text-right bg-white" dir="rtl">

          {/* Cafe Header */}
          <div className="text-center pb-4 border-b-2 border-dashed border-gray-300">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-900 mb-2 font-bold text-lg">
              ☕
            </div>
            <h2 className="text-2xl font-bold font-arabic-heading text-gray-900">
              مقهى الفيشاوي
            </h2>
            <p className="text-xs font-mono text-gray-500 mt-0.5">Elfishawy Cafe — Authentic Taste</p>
            <div className="mt-3 bg-gray-50 py-1.5 px-3 rounded-xl border border-gray-200/80 flex items-center justify-between text-xs text-gray-700" dir="rtl">
              <span>فاتورة طلب: <strong className="text-gray-900 font-mono text-sm font-bold">#{String(order.orderNumber || order._id || '').slice(-8)}</strong></span>
              <span className="font-mono text-[11px] text-gray-500">{formattedDate}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600 px-1" dir="rtl">
              <span className="font-bold text-gray-800">طاولة رقم: <strong className="text-[#2e5b9f] font-mono text-sm">#{order.tableNumber || '—'}</strong></span>
              <span className="font-mono text-[11px] text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded">{formatNumber(totalItemsCount)} صنف</span>
            </div>
            {(() => {
              const cleanNotes = getCleanNotes(order.notes);
              if (!cleanNotes) return null;
              return (
                <div className="mt-2 bg-amber-50/70 border border-amber-200/60 p-2 rounded-xl text-xs text-amber-900 text-right font-bold print:border-dashed">
                  <span>📝 ملاحظات:</span> <span className="mr-1 text-gray-800 font-medium">{cleanNotes}</span>
                </div>
              );
            })()}
          </div>

          {/* ✅ بانر العجز الثانوي — يظهر واضح وكبير لو فيه عجز في الفاتورة */}
          {hasAnyShortage && (
            <div className="my-3 rounded-2xl border-2 border-amber-400 bg-amber-50 overflow-hidden print:border-dashed">
              {/* رأس البانر */}
              <div className="flex items-center gap-2 bg-amber-400 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                <span className="text-white font-extrabold text-xs tracking-wide">
                  ⚠️ تنبيه: هذه الفاتورة بها عجز في مواد ثانوية
                </span>
              </div>

              {/* تفاصيل المواد الناقصة مقسّمة لكل صنف */}
              <div className="px-3 py-3 space-y-2.5">
                {Array.from(shortagesPerProduct.entries()).map(([productName, shortages]) => (
                  <div key={productName} dir="rtl">
                    <div className="text-[11px] font-extrabold text-amber-900 mb-1">
                      📦 {productName}:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {shortages.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 border border-red-300 px-2.5 py-1 rounded-full"
                        >
                          <PackageX className="w-3 h-3 shrink-0" />
                          {s} — نافذ
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* ملخص مدمج لكل الخامات الناقصة */}
                <div className="pt-2 mt-1 border-t border-amber-300 flex items-center gap-1.5 flex-wrap" dir="rtl">
                  <span className="text-[10px] font-extrabold text-amber-900">⚡ يلزم تعبئة:</span>
                  {uniqueShortageIngredients.map((ing) => (
                    <span
                      key={ing}
                      className="text-[10px] font-bold text-orange-800 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-md"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="py-4 border-b-2 border-dashed border-gray-300">
            <div className="text-xs font-bold text-gray-400 mb-3 flex justify-between px-1" dir="rtl">
              <span>المشروب / الصنف</span>
              <span className="text-center">الكمية × السعر</span>
              <span>الإجمالي</span>
            </div>
            <div className="space-y-2">
              {receiptItems.map((item, idx) => {
                const prodName = resolveProductName(item);
                const pId =
                  typeof item?.product === 'object' && item?.product
                    ? (item.product as any)._id
                    : String(item?.product || '');
                const itemShortages = shortageMap && pId ? shortageMap[pId] : null;
                const hasShortage = itemShortages && itemShortages.length > 0;

                return (
                  <div
                    key={idx}
                    className={`rounded-xl px-2 py-1.5 ${
                      hasShortage
                        ? 'bg-amber-50 border border-amber-200'
                        : ''
                    }`}
                    dir="rtl"
                  >
                    {/* صف الصنف الرئيسي */}
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {hasShortage && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className={`font-bold text-sm truncate ${hasShortage ? 'text-amber-900' : 'text-gray-800'}`}>
                          {prodName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-md">
                          {formatNumber(item.quantity)} × {formatNumber(item.price)}
                        </span>
                        <span className="font-bold text-gray-900 font-mono text-base">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>

                    {/* تاقات الخامات الناقصة لهذا الصنف */}
                    {hasShortage && (
                      <div className="flex flex-wrap gap-1 mt-1.5 pr-5">
                        {itemShortages!.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full"
                          >
                            <PackageX className="w-2.5 h-2.5 shrink-0" />
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Section */}
          <div className="py-4 border-b-2 border-dashed border-gray-300 space-y-2">
            <div className="flex justify-between text-xs text-gray-500" dir="rtl">
              <span>إجمالي عدد العناصر</span>
              <span className="font-mono font-bold text-gray-700">{formatNumber(totalItemsCount)} قطع</span>
            </div>

            <div className="flex justify-between items-center pt-2 text-gray-900 font-bold bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60" dir="rtl">
              <span className="text-base font-bold">المطلوب سداده</span>
              <span className="font-mono text-2xl text-[#2e5b9f]">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-2 text-center space-y-1">
            <div className="font-mono text-xs tracking-widest text-gray-400 select-none">
              ||||| ||| ||||||| |||| |||||||| ||||
            </div>
            <p className="text-xs font-bold text-gray-700">أهلاً وسهلاً بكم دائماً في مقهى الفيشاوي</p>
            <p className="text-[10px] text-gray-400 font-mono">شكراً لزيارتكم • نتمنى لكم يوماً سعيداً</p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="mt-6 print:hidden space-y-2">
          <Button
            onClick={handlePrint}
            variant="primary"
            className="w-full bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-3.5 text-base rounded-2xl shadow-sm cursor-pointer"
            leftIcon={<Printer className="w-5 h-5 ml-2" />}
          >
            طباعة الفاتورة الآن 🖨️
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full py-2.5 text-xs text-gray-600 rounded-xl"
          >
            إغلاق ومتابعة الطلب التالي
          </Button>
        </div>
      </div>
    </div>
  );
};
