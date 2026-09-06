import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, CheckCircle, Coffee } from 'lucide-react';
import { formatPrice, formatNumber, formatDateTime } from '../../utils/formatters';

interface ReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  /** ✅ قائمة المنتجات — لحل أسماء الأصناف لما الـ API يرجّع product كـ ID بس */
  products?: Array<{ _id: string; name: string }>;
  /** ✅ خريطة الخامات الثانوية النافذة لكل منتج */
  shortageMap?: Record<string, string[]>;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, isOpen, onClose, products, shortageMap }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = formatDateTime(order.createdAt);

  const cashierName =
    order.cashierId && typeof order.cashierId === 'object'
      ? (order.cashierId as any).userName || 'الكاشير'
      : (order.cashierId as string) || 'الكاشير';

  const receiptItems = Array.isArray(order.items) ? order.items : [];
  const totalItemsCount = receiptItems.reduce((acc, item) => acc + (item?.quantity || 0), 0);

  // ✅ خريطة أسماء المنتجات — عشان الفاتورة تعرض اسم المشروب الحقيقي مش "صنف"
  const productNameById = new Map<string, string>(
    (products || []).map((p) => [p._id, p.name])
  );

  const resolveProductName = (item: any): string => {
    if (!item || !item.product) return 'صنف';
    if (typeof item.product === 'object') return (item.product as any).name || 'صنف';
    return productNameById.get(String(item.product)) || 'صنف محذوف من المنيو';
  };

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
            {order.notes && order.notes.trim() !== '' && (
              <div className="mt-2 bg-amber-50/70 border border-amber-200/60 p-2 rounded-xl text-xs text-amber-900 text-right font-bold print:border-dashed">
                <span>📝 ملاحظات:</span> <span className="mr-1 text-gray-800 font-medium">{order.notes}</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="py-4 border-b-2 border-dashed border-gray-300">
            <div className="text-xs font-bold text-gray-400 mb-3 flex justify-between px-1" dir="rtl">
              <span>المشروب / الصنف</span>
              <span className="text-center">الكمية × السعر</span>
              <span>الإجمالي</span>
            </div>
            <div className="space-y-3">
              {receiptItems.map((item, idx) => {
                const prodName = resolveProductName(item);
                const pId = typeof item?.product === 'object' && item?.product ? (item.product as any)._id : String(item?.product || '');
                const itemShortages = shortageMap && pId ? shortageMap[pId] : null;

                return (
                  <div key={idx} className="flex justify-between items-center text-sm py-0.5" dir="rtl">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm">
                        {prodName}
                      </span>
                      {itemShortages && itemShortages.length > 0 && (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block w-fit">
                          ⚠️ بيع بعجز: {itemShortages.join('، ')}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-md">
                      {formatNumber(item.quantity)} × {formatNumber(item.price)}
                    </span>
                    <span className="font-bold text-gray-900 font-mono text-base">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Section (No Tax, Simple and Direct) */}
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

          {/* Footer simulation */}
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
