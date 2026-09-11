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

    // نفتح نافذة بعرض 302px (= 80mm على 96dpi) — بدون تحديد height حتى تتحجم للمحتوى
    const printWindow = window.open(
      '',
      '_blank',
      'width=320,toolbar=0,menubar=0,scrollbars=0,resizable=0,status=0,location=0'
    );
    if (!printWindow) {
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
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    html {
      width: 80mm;
      max-width: 80mm;
      overflow: hidden;
    }
    body {
      width: 80mm;
      max-width: 80mm;
      overflow: hidden;
      font-family: 'Tahoma', Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #000 !important;
      background: #fff !important;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #receipt-root {
      width: 76mm;
      padding: 3mm 2mm;
    }

    /* ===== Tailwind mapping للطباعة الحرارية — خطوط واضحة وأسمك ===== */
    .text-center  { text-align: center; }
    .text-right   { text-align: right; }
    .font-bold    { font-weight: 800 !important; }
    .font-extrabold { font-weight: 900 !important; }
    .font-medium  { font-weight: 700; }
    .font-mono    { font-family: 'Courier New', monospace; }
    .font-arabic-heading { font-weight: 900; letter-spacing: -0.5px; }
    .font-sans    { font-family: 'Tahoma', Arial, sans-serif; }

    /* ===== خطوط فاصل سميكة وواضحة للطباعة الحرارية ===== */
    .border-b-2.border-dashed,
    .border-b-2 { border-bottom: 2.5px solid #000 !important; }
    .border-b     { border-bottom: 1.5px solid #333 !important; }
    .border-t     { border-top: 1.5px solid #333 !important; }
    .border       { border: 1.5px solid #444 !important; }
    .border-2     { border: 2px solid #222 !important; }
    .border-dashed { border-style: dashed !important; }

    /* ألوان الخطوط — أسود قاتم للطباعة الحرارية */
    .border-gray-200, .border-gray-300 { border-color: #555 !important; }
    .border-amber-200  { border-color: #888 !important; }
    .border-amber-300  { border-color: #777 !important; }
    .border-amber-400  { border-color: #555 !important; }
    .border-red-200    { border-color: #888 !important; }
    .border-red-300    { border-color: #777 !important; }
    .border-orange-300 { border-color: #888 !important; }

    /* ألوان الخلفيات — باهتة للحرارية */
    .bg-white          { background: #fff; }
    .bg-gray-50, .bg-gray-100 { background: #f0f0f0; }
    .bg-amber-50       { background: #f5f5f5; }
    .bg-amber-400      { background: #333; }
    .bg-red-50, .bg-red-100   { background: #f0f0f0; }
    .bg-orange-100     { background: #f0f0f0; }

    /* ألوان النصوص — كلها أسود أو رمادي داكن */
    .text-gray-400  { color: #555; }
    .text-gray-500  { color: #444; }
    .text-gray-600  { color: #333; }
    .text-gray-700  { color: #222; }
    .text-gray-800  { color: #111; }
    .text-gray-900  { color: #000; }
    .text-amber-900 { color: #000; }
    .text-amber-500 { color: #333; }
    .text-red-700   { color: #000; }
    .text-red-800   { color: #000; }
    .text-orange-800{ color: #000; }
    .text-white     { color: #fff !important; }
    [class*="text-[#2e5b9f]"] { color: #000; font-weight: 900; }

    /* Font sizes — أكبر قليلاً للوضوح */
    .text-xs    { font-size: 11px; font-weight: 600; }
    .text-sm    { font-size: 12px; font-weight: 600; }
    .text-base  { font-size: 13px; font-weight: 700; }
    .text-lg    { font-size: 14px; font-weight: 700; }
    .text-2xl   { font-size: 18px; font-weight: 900; }
    [class*="text-[10px]"], [class*="text-[11px]"] { font-size: 11px; font-weight: 600; }
    [class*="text-[9px]"] { font-size: 10px; }

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
    .tracking-widest  { letter-spacing: 3px; }
    .tracking-wide    { letter-spacing: 1px; }
    .select-none      { user-select: none; }
    .rounded-xl, .rounded-2xl, .rounded-3xl { border-radius: 2px; }
    .rounded-full     { border-radius: 9999px; }
    .rounded-md, .rounded { border-radius: 1px; }
    .w-12  { width: 10mm; }
    .h-12  { height: 10mm; }

    /* Space-y helpers */
    .space-y-1   > * + * { margin-top: 1mm; }
    .space-y-2   > * + * { margin-top: 1.5mm; }
    .space-y-2\\.5 > * + * { margin-top: 2mm; }

    /* إخفاء أيقونات SVG — لا تُطبع على الحرارية */
    svg { display: none !important; }

    /* خط فاصل واضح بين الأقسام */
    .border-b-2.border-dashed.border-gray-300 {
      border-bottom: 2.5px solid #000 !important;
      margin-bottom: 1mm;
      margin-top: 1mm;
    }
  </style>
</head>
<body>
  <div id="receipt-root">${receiptHTML}</div>
  <script>
    // ✅ طباعة فورية بمجرد تحميل النافذة — بدون أي تأخير
    window.onload = function () { window.print(); };
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

          {/* Cafe Header — بدون لوجو */}
          <div className="text-center pb-3 border-b-2 border-gray-300">
            <h2 className="text-2xl font-bold font-arabic-heading text-gray-900">
              مقهى الفيشاوي
            </h2>
            <p className="text-xs font-mono text-gray-500 mt-1">Elfishawy Cafe — Authentic Taste</p>

            {/* رقم الفاتورة */}
            <div className="mt-2 border border-gray-300 rounded-xl py-1 px-2 flex items-center justify-between text-xs" dir="rtl">
              <span className="font-bold text-gray-700">فاتورة رقم: <strong className="font-mono text-sm">#{String(order.orderNumber || order._id || '').slice(-6)}</strong></span>
              <span className="font-bold text-gray-700">طاولة: <strong className="font-mono text-sm">#{order.tableNumber || '—'}</strong></span>
            </div>

            {/* التاريخ والوقت منفصلَين */}
            <div className="mt-1 flex items-center justify-between text-xs px-1" dir="rtl">
              <span className="font-mono text-gray-600">📅 {formatDate(order.createdAt)}</span>
              <span className="font-mono text-gray-600">🕐 {formatTime(order.createdAt)}</span>
            </div>

            {/* عدد الأصناف */}
            <div className="mt-1 text-center">
              <span className="font-bold text-xs text-gray-700">عدد الأصناف: <strong className="font-mono">{formatNumber(totalItemsCount)} قطعة</strong></span>
            </div>

            {(() => {
              const cleanNotes = getCleanNotes(order.notes);
              if (!cleanNotes) return null;
              return (
                <div className="mt-2 border border-gray-400 p-2 rounded-xl text-xs text-gray-900 text-right font-bold">
                  <span>ملاحظات:</span> <span className="mr-1 font-medium">{cleanNotes}</span>
                </div>
              );
            })()}
          </div>

          {/* ✅ بانر العجز الثانوي */}
          {hasAnyShortage && (
            <div className="my-2 border-2 border-gray-700 bg-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-700 px-3 py-2">
                <span className="text-white font-extrabold text-xs tracking-wide">
                  ⚠️ تنبيه: الفاتورة بها عجز في مواد ثانوية
                </span>
              </div>
              <div className="px-2 py-2 space-y-1">
                {Array.from(shortagesPerProduct.entries()).map(([productName, shortages]) => (
                  <div key={productName} dir="rtl">
                    <div className="text-[11px] font-extrabold text-gray-900 mb-1">
                      {productName}: {shortages.join(' — ')} (نافذ)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* جدول الأصناف */}
          <div className="py-3 border-b-2 border-gray-300">
            {/* رأس الجدول */}
            <div className="flex justify-between text-xs font-bold text-gray-600 mb-2 border-b border-gray-300 pb-1" dir="rtl">
              <span className="flex-1">الصنف</span>
              <span className="w-16 text-center">الكمية</span>
              <span className="w-20 text-left">الإجمالي</span>
            </div>

            {/* الأصناف */}
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
                  <div key={idx} dir="rtl" className="border-b border-gray-200 pb-1">
                    {/* اسم الصنف */}
                    <div className="flex justify-between items-start">
                      <span className={`font-bold text-sm flex-1 ${hasShortage ? 'text-gray-900' : 'text-gray-900'}`}>
                        {hasShortage && '⚠️ '}{prodName}
                      </span>
                      <span className="font-bold text-gray-900 font-mono text-sm w-20 text-left">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                    {/* الكمية والسعر */}
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-gray-600 font-mono text-xs">
                        {formatNumber(item.quantity)} قطعة × {formatNumber(item.price)} جنيه
                      </span>
                    </div>
                    {/* تحذير العجز */}
                    {hasShortage && (
                      <div className="text-xs font-bold text-gray-700 mt-0.5">
                        ناقص: {itemShortages!.join(' — ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* الإجمالي */}
          <div className="py-3 border-b-2 border-gray-300 space-y-1">
            <div className="flex justify-between text-xs text-gray-600" dir="rtl">
              <span>إجمالي القطع</span>
              <span className="font-mono font-bold">{formatNumber(totalItemsCount)} قطعة</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t-2 border-gray-900" dir="rtl">
              <span className="text-base font-extrabold text-gray-900">المطلوب سداده</span>
              <span className="font-mono text-xl font-extrabold text-gray-900">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Footer — بدون خطوط باركود */}
          <div className="mt-3 text-center space-y-1">
            <p className="text-xs font-bold text-gray-800">أهلاً وسهلاً بكم في مقهى الفيشاوي</p>
            <p className="text-xs text-gray-600 font-mono">شكراً لزيارتكم — نتمنى لكم يوماً سعيداً</p>
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
