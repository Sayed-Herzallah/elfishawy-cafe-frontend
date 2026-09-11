import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, AlertTriangle, PackageX } from 'lucide-react';
import { formatPrice, formatNumber, formatDateTime, formatDate, formatTime } from '../../utils/formatters';
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

  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);

    const source = document.getElementById('printable-receipt');
    if (!source) {
      window.print();
      setTimeout(() => setIsPrinting(false), 2000);
      return;
    }

    // إزالة أي iframe طباعة قديم
    const oldIframe = document.getElementById('receipt-print-frame');
    if (oldIframe) {
      oldIframe.remove();
    }

    // إنشاء iframe خفي معزول تماماً عن DOM الصفحة لتجنب أي قيود للـ Modal
    const iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '72mm';
    iframe.style.height = '1000px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      setTimeout(() => setIsPrinting(false), 2000);
      return;
    }

    // جمع كل ملفات الـ CSS لتطبيق خطوط وألوان الفاتورة في الـ iframe
    const styleElements = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة مقهى الفيشاوي #${String(order.orderNumber || order._id || '').slice(-6)}</title>
  ${styleElements}
  <style>
    @page {
      size: auto;
      margin: 0mm !important;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      max-width: 72mm !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
    }
    #printable-receipt {
      width: 100% !important;
      max-width: 72mm !important;
      margin: 0 auto !important;
      padding: 0 1mm 2mm 1mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      display: block !important;
    }
    .receipt-keep-together {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${source.outerHTML}
</body>
</html>`);
    doc.close();

    // تشغيل أمر الطباعة من الـ iframe بعد تحميل التنسيقات
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => setIsPrinting(false), 2000);
      }
    }, 250);
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
        <div id="printable-receipt" className="text-black font-sans p-2 text-right bg-white" dir="rtl">

          {/* Cafe Header */}
          <div className="text-center pb-3 border-b-2 border-black">
            <h2 className="text-2xl font-black font-arabic-heading text-black">
              مقهى الفيشاوي
            </h2>
            <p className="text-xs font-mono font-bold text-gray-800 mt-1">Elfishawy Cafe</p>

            {/* رقم الفاتورة والطاولة */}
            <div className="mt-2 border-2 border-black rounded-lg py-1 px-2 flex items-center justify-between text-xs font-bold text-black" dir="rtl">
              <span>رقم الفاتورة: <strong className="font-mono text-sm font-black">#{String(order.orderNumber || order._id || '').slice(-6)}</strong></span>
              <span>طاولة: <strong className="font-mono text-sm font-black">#{order.tableNumber || '—'}</strong></span>
            </div>

            {/* التاريخ والوقت مكتوبين بالعربي بدون إيموجي نهائياً وبخط أسود عريض */}
            <div className="mt-1.5 flex items-center justify-between text-xs font-bold text-black px-1 border-b border-gray-300 pb-1" dir="rtl">
              <span>التاريخ: <strong className="font-mono font-black">{formatDate(order.createdAt)}</strong></span>
              <span>الوقت: <strong className="font-mono font-black">{formatTime(order.createdAt)}</strong></span>
            </div>

            {/* عدد الأصناف واضح وعريض */}
            <div className="mt-1.5 text-center text-xs font-black text-black">
              <span>عدد الأصناف بالفاتورة: <strong className="font-mono text-sm">{formatNumber(totalItemsCount)} صنف</strong></span>
            </div>

            {(() => {
              const cleanNotes = getCleanNotes(order.notes);
              if (!cleanNotes) return null;
              return (
                <div className="mt-2 border border-black p-1.5 rounded text-xs text-black text-right font-bold">
                  <span>ملاحظات:</span> <span className="mr-1">{cleanNotes}</span>
                </div>
              );
            })()}
          </div>

          {/* ✅ بانر العجز الثانوي */}
          {hasAnyShortage && (
            <div className="my-2 border-2 border-black bg-gray-100 p-2 text-xs font-bold text-black">
              <div className="text-red-700 font-black mb-1">
                ⚠️ تنبيه: عجز في مواد الفاتورة
              </div>
              {Array.from(shortagesPerProduct.entries()).map(([productName, shortages]) => (
                <div key={productName} dir="rtl">
                  <span>{productName}: </span>
                  <span className="text-red-700 font-black">{shortages.join('، ')} (نافذ)</span>
                </div>
              ))}
            </div>
          )}

          {/* جدول الأصناف — عمودان فقط: الصنف (مع كميته وسعره) والإجمالي */}
          <div className="py-3 border-b-2 border-black">
            {/* رأس الجدول: الصنف يميناً والإجمالي يساراً */}
            <div className="flex justify-between text-xs font-black text-black mb-2 border-b-2 border-black pb-1" dir="rtl">
              <span className="flex-1 text-right">الصنف</span>
              <span className="w-24 text-left font-mono">الإجمالي</span>
            </div>

            {/* الأصناف */}
            <div className="space-y-2.5">
              {receiptItems.map((item, idx) => {
                const prodName = resolveProductName(item);
                const pId =
                  typeof item?.product === 'object' && item?.product
                    ? (item.product as any)._id
                    : String(item?.product || '');
                const itemShortages = shortageMap && pId ? shortageMap[pId] : null;
                const hasShortage = itemShortages && itemShortages.length > 0;

                return (
                  <div key={idx} dir="rtl" className="border-b border-gray-400 pb-2 pt-0.5">
                    {/* اسم الصنف وإجمالي السعر */}
                    <div className="flex justify-between items-center text-sm font-black text-black">
                      <span className="flex-1 text-right">
                        {hasShortage && '⚠️ '}{prodName}
                        {item.quantity > 1 ? ` (${formatNumber(item.quantity)})` : ''}
                      </span>
                      <span className="w-24 text-left font-mono text-base font-black text-black">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>

                    {/* سطر توضيحي نقي بدون خلفيات: الكمية × سعر القطعة */}
                    <div className="text-xs text-gray-800 font-bold mt-0.5 font-mono">
                      {formatNumber(item.quantity)} × {formatNumber(item.price)} جنيه
                    </div>

                    {/* تحذير العجز */}
                    {hasShortage && (
                      <div className="text-xs font-black text-red-700 mt-0.5">
                        ⚠️ نافذ: {itemShortages!.join(' — ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* قسم الإجمالي والفوتر مع مسافة التغذية مجمعين لمنع انقسام الصفحة وضمان خروج كامل الفاتورة */}
          <div className="receipt-keep-together" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            {/* الإجمالي وسداد الفاتورة */}
            <div className="py-3 border-b-2 border-black space-y-1.5">
              <div className="flex justify-between text-xs text-black font-black" dir="rtl">
                <span>إجمالي عدد القطع:</span>
                <span className="font-mono text-sm font-black">{formatNumber(totalItemsCount)} قطعة</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-black" dir="rtl">
                <span className="text-base font-black text-black">المطلوب سداده:</span>
                <span className="font-mono text-2xl font-black text-black">
                  {formatPrice(order.totalAmount)}
                </span>
              </div>
            </div>

            {/* Footer — أسود واضح وكامل */}
            <div className="mt-3 text-center space-y-1 text-black">
              <p className="text-xs font-black">أهلاً وسهلاً بكم دائماً في مقهى الفيشاوي</p>
              <p className="text-xs font-bold font-mono">شكراً لزيارتكم — نتمنى لكم يوماً سعيداً</p>
            </div>

            {/* مسافة تغذية كافية (40 مم) مع خط تنقيط نهاية الفاتورة لإجبار موتور الطابعة على سحب الورقة بالكامل وتجاوز شفرة القاطع */}
            <div
              style={{
                height: '42mm',
                minHeight: '42mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}
              className="w-full select-none"
              aria-hidden="true"
            >
              <div className="w-full text-center text-[10px] text-gray-500 font-mono tracking-widest border-t border-dashed border-gray-400 pt-1">
                - - - - - - - - - - - - - - - - - - - -
              </div>
            </div>
          </div>
        </div>


        {/* Modal Action Buttons */}
        <div className="mt-6 print:hidden space-y-2">
          <Button
            onClick={handlePrint}
            variant="primary"
            disabled={isPrinting}
            className={`w-full bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-3.5 text-base rounded-2xl shadow-sm cursor-pointer ${
              isPrinting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            leftIcon={<Printer className={`w-5 h-5 ml-2 ${isPrinting ? 'animate-spin' : ''}`} />}
          >
            {isPrinting ? 'جاري إرسال الفاتورة للطابعة...' : 'طباعة الفاتورة الآن 🖨️'}
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
