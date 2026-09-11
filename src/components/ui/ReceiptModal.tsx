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
      size: 72mm auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html {
      width: 72mm;
      max-width: 72mm;
      margin: 0;
      padding: 0;
    }
    body {
      width: 72mm;
      max-width: 72mm;
      margin: 0;
      padding: 0;
      font-family: 'Tahoma', Arial, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #000 !important;
      background: #fff !important;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #receipt-root {
      width: 70mm;
      max-width: 70mm;
      margin: 0 auto;
      padding: 2mm 1mm;
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
    /* Font sizes — خطوط أكبر وأوضح للطباعة الحرارية */
    .text-xs    { font-size: 12px; font-weight: 700; }
    .text-sm    { font-size: 13px; font-weight: 700; }
    .text-base  { font-size: 15px; font-weight: 800; }
    .text-lg    { font-size: 16px; font-weight: 800; }
    .text-2xl   { font-size: 20px; font-weight: 900; }
    [class*="text-[10px]"], [class*="text-[11px]"] { font-size: 12px; font-weight: 700; }
    [class*="text-[9px]"] { font-size: 11px; font-weight: 600; }

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
