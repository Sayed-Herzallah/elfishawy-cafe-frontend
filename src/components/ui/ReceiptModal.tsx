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
    // ✅ نافذة طباعة حرارية مخصصة 80mm — Portrait — ورقة واحدة — تغلق أوتوماتيك بعد الطباعة
    const receiptEl = document.getElementById('printable-receipt');
    if (!receiptEl) return;

    const receiptHTML = receiptEl.innerHTML;

    // نفتح نافذة بعرض 302px (= 80mm تقريباً على شاشات 96dpi)
    const printWindow = window.open(
      '',
      '_blank',
      'width=302,height=800,toolbar=0,menubar=0,scrollbars=0,resizable=0,status=0,location=0'
    );
    if (!printWindow) {
      // Fallback لو المتصفح منع الـ popup
      window.print();
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة مقهى الفيشاوي</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      width: 80mm;
    }
    body {
      width: 80mm;
      max-width: 80mm;
      font-family: 'Tahoma', Arial, sans-serif;
      font-size: 11px;
      color: #000 !important;
      background: #fff !important;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #receipt-root {
      width: 76mm;
      padding: 2mm 2mm;
    }

    /* ===== Tailwind mapping للطباعة الحرارية ===== */
    .text-center  { text-align: center; }
    .text-right   { text-align: right; }
    .font-bold    { font-weight: 700; }
    .font-extrabold { font-weight: 800; }
    .font-mono    { font-family: 'Courier New', monospace; }
    .font-arabic-heading { font-weight: 700; }
    .font-sans    { font-family: 'Tahoma', Arial, sans-serif; }

    /* Borders */
    .border-b-2.border-dashed { border-bottom: 2px dashed #aaa !important; }
    .border-b-2   { border-bottom: 2px solid #aaa; }
    .border-b     { border-bottom: 1px solid #ccc; }
    .border-t     { border-top: 1px solid #ccc; }
    .border       { border: 1px solid #ccc; }
    .border-2     { border: 2px solid #ccc; }
    .border-dashed { border-style: dashed !important; }
    .border-gray-200, .border-gray-300 { border-color: #d1d5db !important; }
    .border-amber-200  { border-color: #fde68a !important; }
    .border-amber-300  { border-color: #fcd34d !important; }
    .border-amber-400  { border-color: #fbbf24 !important; }
    .border-red-200    { border-color: #fecaca !important; }
    .border-red-300    { border-color: #fca5a5 !important; }
    .border-orange-300 { border-color: #fdba74 !important; }

    /* Backgrounds */
    .bg-white          { background: #fff; }
    .bg-gray-50        { background: #f9fafb; }
    .bg-gray-100       { background: #f3f4f6; }
    .bg-amber-50       { background: #fffbeb; }
    .bg-amber-400      { background: #fbbf24; }
    .bg-red-50         { background: #fef2f2; }
    .bg-red-100        { background: #fee2e2; }
    .bg-orange-100     { background: #ffedd5; }

    /* Colors */
    .text-gray-400  { color: #9ca3af; }
    .text-gray-500  { color: #6b7280; }
    .text-gray-600  { color: #4b5563; }
    .text-gray-700  { color: #374151; }
    .text-gray-800  { color: #1f2937; }
    .text-gray-900  { color: #111827; }
    .text-amber-900 { color: #78350f; }
    .text-amber-500 { color: #f59e0b; }
    .text-red-700   { color: #b91c1c; }
    .text-red-800   { color: #991b1b; }
    .text-orange-800{ color: #9a3412; }
    .text-white     { color: #fff !important; }

    /* Arbitrary color values */
    [class*="text-[#2e5b9f]"] { color: #2e5b9f; }

    /* Font sizes */
    .text-xs    { font-size: 10px; }
    .text-sm    { font-size: 11px; }
    .text-base  { font-size: 12px; }
    .text-lg    { font-size: 13px; }
    .text-2xl   { font-size: 16px; font-weight: 700; }

    /* Spacing — Padding */
    .p-1\\.5  { padding: 1.5mm; }
    .p-2      { padding: 2mm; }
    .p-2\\.5  { padding: 2mm; }
    .p-3      { padding: 2mm; }
    .p-3\\.5  { padding: 2.5mm; }
    .px-1     { padding-left: 1mm; padding-right: 1mm; }
    .px-2     { padding-left: 2mm; padding-right: 2mm; }
    .px-2\\.5 { padding-left: 2mm; padding-right: 2mm; }
    .px-3     { padding-left: 2mm; padding-right: 2mm; }
    .py-0\\.5 { padding-top: 0.5mm; padding-bottom: 0.5mm; }
    .py-1     { padding-top: 1mm;   padding-bottom: 1mm; }
    .py-1\\.5 { padding-top: 1.5mm; padding-bottom: 1.5mm; }
    .py-2     { padding-top: 2mm;   padding-bottom: 2mm; }
    .py-2\\.5 { padding-top: 2mm;   padding-bottom: 2mm; }
    .py-3     { padding-top: 2mm;   padding-bottom: 2mm; }
    .py-4     { padding-top: 3mm;   padding-bottom: 3mm; }
    .pb-4     { padding-bottom: 3mm; }
    .pt-2     { padding-top: 2mm; }
    .pr-5     { padding-right: 4mm; }

    /* Spacing — Margin */
    .mt-0\\.5  { margin-top: 0.5mm; }
    .mt-1      { margin-top: 1mm; }
    .mt-1\\.5  { margin-top: 1.5mm; }
    .mt-2      { margin-top: 2mm; }
    .mt-3      { margin-top: 2mm; }
    .mt-4      { margin-top: 3mm; }
    .mt-6      { margin-top: 3mm; }
    .mb-1      { margin-bottom: 1mm; }
    .mb-2      { margin-bottom: 2mm; }
    .mb-3      { margin-bottom: 2mm; }
    .my-3      { margin-top: 2mm; margin-bottom: 2mm; }
    .mr-1      { margin-right: 1mm; }

    /* Flex */
    .flex          { display: flex; }
    .inline-flex   { display: inline-flex; }
    .flex-1        { flex: 1; }
    .flex-wrap     { flex-wrap: wrap; }
    .shrink-0      { flex-shrink: 0; }
    .min-w-0       { min-width: 0; }
    .items-center  { align-items: center; }
    .justify-center  { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .gap-0\\.5  { gap: 0.5mm; }
    .gap-1      { gap: 1mm; }
    .gap-1\\.5  { gap: 1.5mm; }
    .gap-2      { gap: 2mm; }

    /* Utils */
    .overflow-hidden  { overflow: hidden; }
    .truncate         { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tracking-widest  { letter-spacing: 2px; }
    .tracking-wide    { letter-spacing: 1px; }
    .select-none      { user-select: none; }
    .rounded-xl, .rounded-2xl, .rounded-3xl { border-radius: 3px; }
    .rounded-full     { border-radius: 9999px; }
    .rounded-md, .rounded { border-radius: 2px; }
    .w-12  { width: 10mm; }
    .h-12  { height: 10mm; }
    .font-medium { font-weight: 500; }

    /* Space-y helpers */
    .space-y-1   > * + * { margin-top: 1mm; }
    .space-y-2   > * + * { margin-top: 1.5mm; }
    .space-y-2\\.5 > * + * { margin-top: 2mm; }

    /* إخفاء أيقونات SVG — الطابعة الحرارية لا تطبعها بشكل صحيح */
    svg { display: none !important; }
  </style>
</head>
<body>
  <div id="receipt-root">${receiptHTML}</div>
  <script>
    // ✅ طباعة أوتوماتيك بعد 150ms من تحميل النافذة — يعطي وقت لرسم الـ CSS
    window.onload = function () {
      setTimeout(function () { window.print(); }, 150);
    };
    // ✅ إغلاق النافذة فور انتهاء الطباعة أو إلغائها
    window.onafterprint = function () { window.close(); };
  <\/script>
</body>
</html>`);
    printWindow.document.close();
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
