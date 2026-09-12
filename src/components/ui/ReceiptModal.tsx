import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, AlertTriangle, Eye } from 'lucide-react';
import { formatPrice, formatNumber, formatDate, formatTime } from '../../utils/formatters';
import { getCleanNotes } from '../../utils/orderShortageJournal';

const escapeHtmlText = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** HTML فاتورة البار للطباعة — صنف + عدد + إجمالي القطع (بدون أسعار) */
const buildBarReceiptHTML = (
  order: Order,
  products?: Array<{ _id: string; name: string }>,
  shortageMap?: Record<string, string[]>
): string => {
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const totalItemsCount = items.reduce((acc, item) => acc + (item?.quantity || 0), 0);

  const productNameById = new Map<string, string>(
    (products || []).map((p) => [p._id, p.name])
  );
  const resolveProductName = (item: any): string => {
    if (!item || !item.product) return 'صنف';
    if (typeof item.product === 'object') return (item.product as any).name || 'صنف';
    return productNameById.get(String(item.product)) || 'صنف محذوف من المنيو';
  };
  const getProductId = (item: any): string =>
    typeof item?.product === 'object' && item?.product
      ? (item.product as any)._id
      : String(item?.product || '');

  const shortagesPerProduct = new Map<string, string[]>();
  items.forEach((item) => {
    const pId = getProductId(item);
    const itemShortages = shortageMap && pId ? shortageMap[pId] : null;
    if (itemShortages && itemShortages.length > 0) {
      shortagesPerProduct.set(resolveProductName(item), itemShortages);
    }
  });
  const hasAnyShortage = shortagesPerProduct.size > 0;
  const cleanNotes = getCleanNotes(order.notes);

  const itemsHTML = items
    .map((item) => {
      const prodName = resolveProductName(item);
      const pId = getProductId(item);
      const itemShortages = shortageMap && pId ? shortageMap[pId] : null;
      const hasShortage = itemShortages && itemShortages.length > 0;

      return `<div class="r-item">
        <div class="r-item-main">
          <span class="r-name">${hasShortage ? '⚠️ ' : ''}${escapeHtmlText(prodName)}</span>
          <span class="r-amt">${formatNumber(item.quantity)}</span>
        </div>
        ${hasShortage ? `<div class="r-warn">⚠️ نافذ: ${escapeHtmlText(itemShortages!.join(' — '))}</div>` : ''}
      </div>`;
    })
    .join('');

  const shortageBannerHTML = hasAnyShortage
    ? `<div class="r-shortage">
        <div class="r-shortage-title">⚠️ تنبيه: عجز في مواد الفاتورة</div>
        ${Array.from(shortagesPerProduct.entries())
          .map(
            ([productName, shortages]) =>
              `<div class="r-shortage-line">${escapeHtmlText(productName)}: <span class="r-shortage-missing">${escapeHtmlText(shortages.join('، '))} (نافذ)</span></div>`
          )
          .join('')}
      </div>`
    : '';

  const notesHTML = cleanNotes
    ? `<div class="r-notes"><span>ملاحظات:</span> ${escapeHtmlText(cleanNotes)}</div>`
    : '';

  return `<div id="receipt">
    <div class="r-header">
      <div class="r-title">كافيه الفيشاوي</div>
      <div class="r-invoice-row">
        <span>رقم الفاتورة :  <strong>${escapeHtmlText(String(order.orderNumber || order._id || '').slice(-6))}</strong></span>
        <span>طاولة :  <strong>${escapeHtmlText(String(order.tableNumber ?? '—'))}</strong></span>
      </div>
      <div class="r-dt-row">
        <span>التاريخ: <strong>${formatDate(order.createdAt)}</strong></span>
        <span>الوقت: <strong>${formatTime(order.createdAt)}</strong></span>
      </div>
      ${notesHTML}
    </div>
    ${shortageBannerHTML}
    <div class="r-items">
      <div class="r-items-head"><span class="r-name">الصنف</span><span class="r-amt">العدد</span></div>
      ${itemsHTML}
    </div>
    <div class="r-totals">
      <div class="r-count-total"><span>إجمالي عدد القطع:</span><span>${formatNumber(totalItemsCount)} قطعة</span></div>
    </div>
    <div class="r-feed" aria-hidden="true">&nbsp;</div>
  </div>`;
};

/** CSS كامل داخل iframe الطباعة — معزول عن Tailwind حتى لا يُقصّ المحتوى */
const BAR_RECEIPT_PRINT_CSS = `
  @page { size: 72mm 297mm; margin: 0mm !important; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    width: 72mm !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
    overflow: visible !important;
    font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
  }
  #receipt {
    width: 70mm;
    max-width: 70mm;
    margin: 0 auto;
    padding: 0 1mm 15mm 1mm;
    direction: rtl;
    text-align: right;
    overflow: visible !important;
  }
  .r-header { padding: 0 0 1.5mm 0; text-align: center; border-bottom: 0.6mm solid #000; }
  .r-title { font-size: 14pt; font-weight: 900; line-height: 1.2; }
  .r-invoice-row {
    margin-top: 1.5mm; border: 0.5mm solid #000; border-radius: 2mm; padding: 1mm 2mm;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8.5pt; font-weight: 800;
  }
  .r-dt-row {
    margin-top: 1.2mm; padding: 0 1mm;
    display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 800;
  }
  .r-notes {
    margin-top: 1.2mm; border: 0.35mm solid #000; border-radius: 1.5mm;
    padding: 1mm 1.5mm; font-size: 8.5pt; font-weight: 700; text-align: right;
  }
  .r-shortage {
    margin-top: 1.5mm; border: 0.5mm solid #000; background: #f3f4f6;
    padding: 1.5mm; font-size: 8.5pt; font-weight: 700; text-align: right;
  }
  .r-shortage-title { color: #b91c1c; font-weight: 900; margin-bottom: 0.8mm; }
  .r-shortage-missing { color: #b91c1c; font-weight: 900; }
  .r-items { padding: 1.5mm 0; border-bottom: 0.6mm solid #000; }
  .r-items-head {
    display: flex; justify-content: space-between; align-items: center; gap: 3mm;
    font-size: 9pt; font-weight: 900; border-bottom: 0.5mm solid #000;
    padding-bottom: 1mm; margin-bottom: 0.5mm;
  }
  .r-items-head .r-name { flex: 1; text-align: right; border: none; padding: 0; }
  .r-items-head .r-amt { min-width: 20mm; text-align: center; border: none; padding: 0; font-size: 9pt; }
  .r-item { padding: 1.2mm 0; border-bottom: 0.25mm dashed #999; }
  .r-item:last-child { border-bottom: none; }
  .r-item-main {
    display: flex; justify-content: space-between; align-items: center; gap: 3mm;
    font-size: 10pt; font-weight: 900;
  }
  .r-name { flex: 1; text-align: right; font-size: 10.5pt; font-weight: 900; line-height: 1.35; word-break: break-word; }
  .r-amt {
    min-width: 20mm; max-width: 22mm; text-align: center; font-weight: 900; font-size: 14pt;
    line-height: 1.1; white-space: nowrap; border: 0.6mm solid #000; border-radius: 2mm; padding: 0.8mm 1mm;
  }
  .r-warn { color: #b91c1c; font-size: 8pt; font-weight: 900; margin-top: 0.5mm; text-align: right; }
  .r-totals { padding: 1.5mm 1mm 0; }
  .r-count-total {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 1mm; font-size: 11pt; font-weight: 900;
  }
  .r-feed { height: 10mm; width: 100%; }
`;

const buildBarReceiptDocument = (
  order: Order,
  products?: Array<{ _id: string; name: string }>,
  shortageMap?: Record<string, string[]>
): string => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة كافيه الفيشاوي</title>
  <style>${BAR_RECEIPT_PRINT_CSS}</style>
</head>
<body>${buildBarReceiptHTML(order, products, shortageMap)}</body>
</html>`;

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

    document.getElementById('print-portal')?.remove();
    document.getElementById('receipt-print-frame')?.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const doc = printWindow?.document;
    if (!doc) {
      window.print();
      setTimeout(() => setIsPrinting(false), 2000);
      return;
    }

    doc.open();
    doc.write(buildBarReceiptDocument(order, products, shortageMap));
    doc.close();

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      printWindow?.removeEventListener('afterprint', cleanup);
      iframe.remove();
      setTimeout(() => setIsPrinting(false), 1500);
    };
    printWindow?.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      try {
        printWindow?.focus();
        printWindow?.print();
      } catch {
        window.print();
      }
      setTimeout(cleanup, 60000);
    }, 250);
  };

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center p-4 min-h-screen print:p-0 print:m-0 print:static print:min-h-0 print:block">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs print:hidden" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg p-5 z-10 text-right animate-in fade-in zoom-in-95 duration-150 my-auto print:my-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:w-auto print:max-w-none">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-red-600 bg-red-50 hover:text-white hover:bg-red-600 border border-red-200 p-1.5 rounded-xl transition-colors print:hidden"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* شارة المعاينة — مشاهدة فقط (لا تُطبع) */}
        <div className="flex items-center justify-center gap-1.5 mb-2 px-3 py-1.5 rounded-full bg-[#2e5b9f]/10 border border-[#2e5b9f]/20 text-[#2e5b9f] text-xs font-black print:hidden">
          <Eye className="w-3.5 h-3.5" />
          <span>معاينة الفاتورة — مشاهدة فقط</span>
        </div>

        {/* معاينة الفاتورة للشاشة — الطباعة الفعلية تتم عبر iframe معزول بفاتورة البار (صنف + عدد) */}
        <div className="rounded-2xl border border-gray-200/80 bg-[#faf8f5] p-2.5 flex justify-center print:block print:p-0 print:border-none print:bg-white print:rounded-none">
        {/* Printable Receipt Section */}
        <div id="printable-receipt" className="relative w-full text-black font-sans p-4 print:p-0 print:w-auto text-right bg-white rounded-xl border border-gray-200/60 shadow-sm print:rounded-none print:shadow-none print:border-none" dir="rtl">

          {/* Cafe Header */}
          <div className="text-center pb-3 border-b border-dashed border-gray-300">
            <h2 className="text-3xl font-black font-arabic-heading text-gray-900 tracking-wide">
              كافيه الفيشاوي
            </h2>
            <p className="text-xs font-bold text-gray-400 mt-1">فاتورة مبيعات — نقطة البيع</p>

            {/* رقم الفاتورة والطاولة — شرائح */}
            <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap" dir="rtl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2e5b9f]/10 border border-[#2e5b9f]/20 text-[#2e5b9f] text-sm font-black">
                <span>رقم الفاتورة :  </span>
                <strong className="font-mono">{String(order.orderNumber || order._id || '').slice(-6)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 text-sm font-black">
                <span>طاولة : </span>
                <strong className="font-mono">{order.tableNumber || '—'}</strong>
              </span>
            </div>

            {/* التاريخ والوقت */}
            <div className="mt-2.5 flex items-center justify-center gap-2 text-sm font-bold text-gray-500 font-mono" dir="rtl">
              <span>{formatDate(order.createdAt)}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{formatTime(order.createdAt)}</span>
            </div>

            {(() => {
              const cleanNotes = getCleanNotes(order.notes);
              if (!cleanNotes) return null;
              return (
                <div className="mt-2.5 bg-amber-50/70 border border-amber-200/70 p-2 rounded-lg text-xs text-amber-900 text-right font-bold">
                  <span className="font-black">ملاحظات:</span> <span className="mr-1">{cleanNotes}</span>
                </div>
              );
            })()}
          </div>

          {/* بانر العجز الثانوي */}
          {hasAnyShortage && (
            <div className="my-2.5 bg-rose-50/80 border border-rose-200 rounded-xl p-3 text-sm font-bold text-gray-800">
              <div className="flex items-center gap-1.5 text-rose-700 font-black mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>تنبيه: عجز في مواد الفاتورة</span>
              </div>
              {Array.from(shortagesPerProduct.entries()).map(([productName, shortages]) => (
                <div key={productName} dir="rtl" className="leading-relaxed">
                  <span className="font-black text-gray-900">{productName}: </span>
                  <span className="text-rose-700 font-black">{shortages.join('، ')} (نافذ)</span>
                </div>
              ))}
            </div>
          )}

          {/* جدول الأصناف — العدد في خانة واضحة ببوكس مميز */}
          <div className="py-3 border-b border-dashed border-gray-300">
            <div className="flex items-center justify-between text-xs font-black text-gray-500 tracking-wide mb-2" dir="rtl">
              <span className="flex-1 text-right">الصنف</span>
              <span className="w-20 shrink-0 text-center">العدد</span>
              <span className="w-24 shrink-0 text-left">الإجمالي</span>
            </div>

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
                  <div key={idx} dir="rtl" className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-base font-black text-gray-900 leading-snug">
                        {hasShortage && '⚠️ '}{prodName}
                      </div>
                      <div className="text-xs text-gray-500 font-bold font-mono mt-0.5">
                        {formatNumber(item.price)} جنيه للقطعة
                      </div>
                      {hasShortage && (
                        <div className="text-xs font-black text-rose-600 mt-0.5">
                          ⚠️ نافذ: {itemShortages!.join(' — ')}
                        </div>
                      )}
                    </div>
                    {/* ✅ خانة العدد — بوكس عريض بخط كبير، نفس شكل الفاتورة المطبوعة */}
                    <span className="w-20 shrink-0 text-center font-mono text-xl font-black text-gray-900 bg-gray-100 border-2 border-gray-900 rounded-lg px-1 py-0.5 leading-none">
                      {formatNumber(item.quantity)}
                    </span>
                    <span className="w-24 shrink-0 text-left font-mono text-base font-black text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* قسم الإجمالي والفوتر — الإجمالي ظاهر على الشاشة فقط (فاتورة الطباعة للبار بدون مبلغ) */}
          <div>
            <div className="pt-3 space-y-2">
              <div className="flex justify-between text-sm font-bold text-gray-500" dir="rtl">
                <span>إجمالي عدد القطع</span>
                <span className="font-mono">{formatNumber(totalItemsCount)} قطعة</span>
              </div>
              <div className="flex justify-between items-center bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 rounded-xl px-3 py-3 mt-1" dir="rtl">
                <span className="text-base font-black text-gray-900">المطلوب سداده</span>
                <span className="font-mono text-2xl font-black text-[#2e5b9f]">
                  {formatPrice(order.totalAmount)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs font-bold text-gray-400">أهلاً وسهلاً بكم دائماً في كافيه الفيشاوي</p>
            </div>
          </div>
        </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="mt-4 print:hidden space-y-2">
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
