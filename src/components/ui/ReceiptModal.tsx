import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, AlertTriangle, PackageX, ReceiptText, Clock, Calendar, Hash } from 'lucide-react';
import { formatPrice, formatNumber, formatDateTime, formatDate, formatTime, formatStat } from '../../utils/formatters';
import { displayOrderNumber } from '../../utils/orderDisplay';
import { getCleanNotes } from '../../utils/orderShortageJournal';

/* ============================================================================
 * نظام طباعة الفواتير المستقل (Self-Contained Receipt Printing)
 * ----------------------------------------------------------------------------
 * المشكلة السابقة: كنا بننسخ كل ستايلات التطبيق (Tailwind) جوه iframe الطباعة
 * ونقيس الارتفاع بـ timeout ثابت قبل ما الـ CSS والخطوط تتحمّل → قياس غلط →
 * فاتورة بتتقطع أو صفحة فيها فراغ جامد قبل/بين الفواتير.
 *
 * الحل: فاتورة طباعة مستقلة تماماً (HTML + CSS مدمج) لا تعتمد على أي ستايل
 * خارجي، مع قياس دقيق للارتفاع بعد تحميل الخطوط، وحجم صفحة @page مطابق
 * للمحتوى بالمللي → الفاتورة تطلع كاملة بدون قطع وبدون فراغات.
 * ==========================================================================*/

/** حماية النصوص العربية والأسماء من كسر الـ HTML */
const escapeHtmlText = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const RECEIPT_FONT = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";

/** كل قواعد CSS الخاصة بفاتورة الطباعة (مقاسات ملم — مناسبة لطابعة حرارية 80mm) */
const RECEIPT_RULES: Array<[string, string]> = [
  ['*', 'box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact;'],
  ['html, body', `margin: 0; padding: 0; width: 80mm; background: #ffffff; color: #000000; font-family: ${RECEIPT_FONT};`],
  // 80mm paper - 70mm receipt: pin the physical left offset to 5mm. Some RTL drivers
  // ignore symmetric auto margins and otherwise pin the receipt against the left edge.
  ['#receipt', 'width: 70mm; max-width: 70mm; padding: 0 3mm; margin: 0 !important; margin-left: 5mm !important; direction: rtl; text-align: right; background: #ffffff; color: #000000;'],
  ['.r-header', 'margin: 0; padding: 0 0 1.5mm 0; text-align: center; border-bottom: 0.6mm solid #000000;'],
  ['.r-title', 'margin: 0; padding: 0; font-size: 15pt; font-weight: 900; line-height: 1.15;'],
  ['.r-invoice-row', 'margin-top: 1.5mm; border: 0.5mm solid #000000; border-radius: 2mm; padding: 0.8mm 2mm; display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; font-weight: 800;'],
  ['.r-dt-row', 'margin-top: 1.2mm; padding: 0 1mm; display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 800;'],
  ['.r-notes', 'margin-top: 1.2mm; border: 0.35mm solid #000000; border-radius: 1.5mm; padding: 1mm 1.5mm; font-size: 10pt !important; line-height: 1.45; font-weight: 800; text-align: right;'],
  // نص الملاحظات وبياناتها: حجم ثابت موحّد في كل الفواتير (Browser Print) — لا يتأثر بأي وراثة أو مسار طباعة
  ['.r-notes, .r-notes *', 'font-size: 10pt !important; line-height: 1.45 !important;'],
  ['.r-shortage', 'margin-top: 1.5mm; border: 0.5mm solid #000000; background: #f3f4f6; padding: 1.5mm; font-size: 8.5pt; font-weight: 700; text-align: right;'],
  ['.r-shortage-title', 'color: #b91c1c; font-weight: 900; margin-bottom: 0.8mm;'],
  ['.r-shortage-line', 'font-weight: 700;'],
  ['.r-items', 'padding: 1.5mm 0; border-bottom: 0.6mm solid #000000;'],
  ['.r-items-head', 'display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 900; border-bottom: 0.5mm solid #000000; padding-bottom: 0.6mm; margin-bottom: 1mm;'],
  ['.r-item', 'padding-bottom: 1mm;'],
  ['.r-item-main', 'display: flex; justify-content: space-between; align-items: center; font-size: 10pt; font-weight: 900;'],
  ['.r-name', 'flex: 1; text-align: right;'],
  ['.r-amt', 'width: 20mm; text-align: left; font-weight: 900; white-space: nowrap;'],
  ['.r-item-sub', 'font-size: 8pt; font-weight: 700; color: #1f2937;'],
  ['.r-warn', 'color: #b91c1c; font-size: 8pt; font-weight: 900; margin-top: 0.5mm; text-align: right;'],
  ['.r-totals', 'padding: 1.5mm 2mm; border-bottom: 0.6mm solid #000000;'],
  ['.r-count-row', 'display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; font-weight: 900;'],
  ['.r-total-row', 'display: flex; justify-content: space-between; align-items: center; border-top: 0.6mm solid #000000; padding-top: 1.2mm; margin-top: 1.2mm; font-size: 9pt; font-weight: 900;'],
  ['.r-grand', 'font-size: 15pt; font-weight: 900; white-space: nowrap; padding-left: 1mm;'],
  ['.r-footer', 'margin-top: 1.5mm; text-align: center; font-size: 8.5pt; font-weight: 900;'],
  // مساحة أمان صغيرة داخل نهاية الفاتورة حتى لا يقص القاطع سطر إجمالي القطع.
  ['.r-feed', 'height: 8mm; display: block;'],
];

/** توليد CSS الفاتورة — مع prefix اختياري للاستخدام داخل النافذة الرئيسية */
const buildReceiptCss = (scope?: string): string =>
  RECEIPT_RULES.filter(([sel]) => !(scope && sel === 'html, body'))
    .map(([sel, body]) => `${scope ? `${scope} ${sel}` : sel} { ${body} }`)
    .join('\n');

/** لفّ فاتورة مستقلة في مستند HTML كامل — pageHeightMm = null لوضع القياس */
const wrapReceiptDocument = (bodyHTML: string, pageHeightMm: number | null): string => {
  const pageSizeRule = pageHeightMm
    ? `size: 80mm ${pageHeightMm}mm;`
    : 'size: 80mm auto;';
  const heightLockRule = pageHeightMm
    ? `width: 80mm !important; height: ${pageHeightMm}mm !important; min-height: ${pageHeightMm}mm !important; max-height: none !important; overflow: visible !important;`
    : 'width: 80mm !important; height: auto !important; min-height: 0 !important; overflow: visible !important;';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة كافيه الفيشاوي</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap">
  <style>
    @page { ${pageSizeRule} margin: 0 !important; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      ${heightLockRule}
      background: #ffffff !important;
    }
    body { display: block !important; position: relative !important; top: 0 !important; left: 0 !important; }
${buildReceiptCss()}
  </style>
</head>
<body>${bodyHTML}</body>
</html>`;
};

/** بناء HTML الفاتورة كاملة (هيدر + أصناف + إجماليات + فوتر) بستايل مدمج */
const buildReceiptBodyHTML = (
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

  // تجميع الخامات النافذة لكل صنف
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
          <span class="r-name">${escapeHtmlText(prodName)}</span>
          <span class="r-amt">${formatNumber(item.quantity)}</span>
        </div>
      </div>`;
    })
    .join('');

  const shortageNote = hasAnyShortage
    ? Array.from(shortagesPerProduct.entries())
        .map(([productName, shortages]) => `${productName}: ${shortages.join('، ')} (نافذ)`)
        .join(' — ')
    : '';
  const combinedNotes = [cleanNotes, shortageNote].filter(Boolean).join(' — ');
  const notesHTML = combinedNotes
    ? `<div class="r-notes"><strong>ملاحظات:</strong> ${escapeHtmlText(combinedNotes)}</div>`
    : '';

  return `<div id="receipt">
    <div class="r-header">
      <div class="r-title">كافيه الفيشاوي</div>
      <div class="r-invoice-row">
        <span>رقم الفاتورة: <strong>${escapeHtmlText(displayOrderNumber(order))}</strong></span>
        <span>طاولة: <strong>${escapeHtmlText(String(order.tableNumber ?? '—'))}</strong></span>
      </div>
      <div class="r-dt-row">
        <span>التاريخ: <strong>${formatDate(order.createdAt)}</strong></span>
        <span>الوقت: <strong>${formatTime(order.createdAt)}</strong></span>
      </div>
      ${notesHTML}
    </div>
    <div class="r-items">
      <div class="r-items-head"><span class="r-name">الصنف</span><span class="r-amt">العدد</span></div>
      ${itemsHTML}
    </div>
    <div class="r-totals">
      <div class="r-count-row"><span>إجمالي عدد القطع:</span><span>${formatNumber(totalItemsCount)} قطعة</span></div>
    </div>
    <div class="r-feed"></div>
  </div>`;
};

/** حلقة أمان أخيرة: طباعة من النافذة الرئيسية بإخفاء كل شيء ما عدا الفاتورة */
const printViaMainWindow = (bodyHTML: string, heightMm: number): Promise<void> => {
  return new Promise((resolve) => {
    const holderId = 'receipt-print-fallback';
    const styleId = 'receipt-print-fallback-style';
    document.getElementById(holderId)?.remove();
    document.getElementById(styleId)?.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #${holderId} { display: none; }
      @media print {
        @page { size: 80mm ${heightMm}mm; margin: 0 !important; }
        html, body {
          width: 80mm !important;
          max-width: none !important;
          height: ${heightMm}mm !important;
          min-height: ${heightMm}mm !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }
        body > *:not(#${holderId}) { display: none !important; }
        #${holderId} {
          display: block !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          margin: 0 auto !important;
          width: 70mm !important;
        }
${buildReceiptCss(`#${holderId}`)}
      }
    `;
    document.head.appendChild(style);

    const holder = document.createElement('div');
    holder.id = holderId;
    holder.innerHTML = bodyHTML;
    document.body.appendChild(holder);

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      window.removeEventListener('afterprint', cleanup);
      document.body.classList.remove('receipt-main-print');
      setTimeout(() => {
        holder.remove();
        style.remove();
      }, 1000);
      resolve();
    };
    // كتم قواعد receipt-modal-open في index.css أثناء الطباعة الاحتياطية
    // (لأن الحاوية هنا holder مستقل مش #printable-receipt)
    document.body.classList.add('receipt-main-print');
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 60000);
  });
};

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
  // معلومات تشخيصية لآخر عملية طباعة — للتأكد من إن النظام المستقل v2 شغال
  const [printInfo, setPrintInfo] = React.useState('');

  // وسم body + حقن @page مخصص لطابعة 80mm أثناء فتح الفاتورة
  React.useEffect(() => {
    if (!isOpen) return undefined;
    const pageStyleId = 'receipt-print-page-style';
    document.getElementById(pageStyleId)?.remove();

    const pageStyle = document.createElement('style');
    pageStyle.id = pageStyleId;
    pageStyle.textContent = `
      @media print {
        @page { size: 80mm auto !important; margin: 0 !important; }
        /* توحيد حجم خط الملاحظات حتى في مسار window.print الأخير (طباعة المعاينة مباشرة) */
        .receipt-notes-preview { font-size: 10pt !important; line-height: 1.45 !important; }
      }
    `;
    document.head.appendChild(pageStyle);
    document.body.classList.add('receipt-modal-open');

    return () => {
      document.body.classList.remove('receipt-modal-open');
      document.getElementById(pageStyleId)?.remove();
    };
  }, [isOpen]);

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      // 1) بناء فاتورة مستقلة تماماً — CSS مدمج بداخلها بدون أي اعتماد على ستايلات التطبيق
      const bodyHTML = buildReceiptBodyHTML(order, products, shortageMap);

      // 2) قياس الارتفاع الفعلي بعد تحميل الخطوط واستقرار الرندر (القياس الخاطئ هو سبب القطع)
      const measureFrame = document.createElement('iframe');
      measureFrame.style.position = 'fixed';
      measureFrame.style.top = '-99999px';
      measureFrame.style.left = '-99999px';
      measureFrame.style.width = '80mm';
      measureFrame.style.height = '4000px';
      measureFrame.style.border = 'none';
      measureFrame.style.visibility = 'hidden';
      document.body.appendChild(measureFrame);

      let heightPx = 0;
      try {
        const measureWin = measureFrame.contentWindow;
        const measureDoc = measureWin?.document;
        if (!measureWin || !measureDoc) throw new Error('measure-frame-unavailable');

        measureDoc.open();
        measureDoc.write(wrapReceiptDocument(bodyHTML, null));
        measureDoc.close();

        // ننتظر تحميل الخطوط (Cairo) ثم هامش استقرار بسيط قبل القياس
        try { await measureWin.document.fonts.ready; } catch { /* تجاهل */ }
        await new Promise((r) => setTimeout(r, 250));

        const receiptEl = measureDoc.getElementById('receipt');
        const receiptHeight = receiptEl ? receiptEl.getBoundingClientRect().height : 0;
        // لا نستخدم scrollHeight للـ body/document هنا: ارتفاع iframe نفسه 4000px
        // فيُحسب كأنه جزء من الفاتورة وينتج عنه صفحات فارغة متعددة.
        heightPx = receiptHeight;
      } finally {
        measureFrame.remove();
      }

      if (!heightPx || heightPx <= 0) heightPx = 300;

      // تحويل البكسل إلى ملم (96px = 25.4mm). الحد الأدنى أكبر من عرض 80mm
      // حتى لا يفسر تعريف الطابعة الفواتير القصيرة كصفحات أفقية.
      // 4mm أمان محسوب يحمي آخر سطر من القص بسبب تقريب الطابعة والخطوط.
      const PX_PER_MM = 96 / 25.4;
      const heightMm = Math.min(1500, Math.max(81, Math.ceil(heightPx / PX_PER_MM) + 4));

      // تشخيص: تسجيل القياس الفعلي
      setPrintInfo(`iframe · ${heightMm}mm`);
      console.log(`[Receipt v2] heightPx=${heightPx.toFixed(1)} → page=${heightMm}mm`);

      // 3) الطباعة عبر iframe معزول — حجم الصفحة @page مطابق تماماً لحجم الفاتورة
      const oldFrame = document.getElementById('receipt-print-frame');
      if (oldFrame) oldFrame.remove();

      const printFrame = document.createElement('iframe');
      printFrame.id = 'receipt-print-frame';
      printFrame.setAttribute('title', 'فاتورة كافيه الفيشاوي');
      printFrame.style.position = 'fixed';
      printFrame.style.top = '0px';
      printFrame.style.left = '0px';
      printFrame.style.width = '80mm';
      printFrame.style.height = `${Math.ceil(heightPx + 60)}px`;
      printFrame.style.border = 'none';
      printFrame.style.zIndex = '-99999';
      printFrame.style.opacity = '0.01';
      printFrame.style.pointerEvents = 'none';
      document.body.appendChild(printFrame);

      const printWin = printFrame.contentWindow;
      const printDoc = printWin?.document;
      if (!printWin || !printDoc) throw new Error('print-frame-unavailable');

      printDoc.open();
      printDoc.write(wrapReceiptDocument(bodyHTML, heightMm));
      printDoc.close();

      try { await printWin.document.fonts.ready; } catch { /* تجاهل */ }
      await new Promise((r) => setTimeout(r, 300));

      try {
        printWin.focus();
        printWin.print();
      } catch {
        setPrintInfo(`main-window · ${heightMm}mm`);
        await printViaMainWindow(bodyHTML, heightMm);
      }

      // تنظيف مؤجل بعد انتهاء حوار الطباعة
      setTimeout(() => printFrame.remove(), 60000);
    } catch {
      // آخر حلقة أمان: طباعة من النافذة الرئيسية بمقاس افتراضي
      setPrintInfo('fallback · 200mm');
      try {
        await printViaMainWindow(buildReceiptBodyHTML(order, products, shortageMap), 200);
      } catch {
        window.print();
      }
    } finally {
      setTimeout(() => setIsPrinting(false), 2000);
    }
  };

  // اعتراض Ctrl+P: أي طباعة أثناء فتح الفاتورة تمر تلقائياً عبر نظام الطباعة المستقل v2
  // (حتى لو المستخدم ضغط Ctrl+P أو Print من قائمة المتصفح بدل زرار الطباعة)
  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order, products, shortageMap]);

  const formattedDate = formatDateTime(order.createdAt);

  const receiptItems = Array.isArray(order.items) ? order.items : [];
  const totalItemsCount = receiptItems.reduce((acc, item) => acc + (item?.quantity || 0), 0);
  // ملاحظات المعاينة فقط — مخرجات iframe المستقلة لها معالجها الخاص ولا تتغير هنا.
  const cleanNotes = getCleanNotes(order.notes);

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
    <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-start p-2 sm:p-4 min-h-screen print:p-0 print:m-0 print:static print:min-h-0 print:block">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs print:hidden" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md z-10 text-right animate-in fade-in zoom-in-95 duration-150 my-0 sm:my-2 overflow-hidden print:my-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:w-auto print:max-w-none">
        {/* ===== رأس المودال الاحترافي — للشاشة فقط (print:hidden) ===== */}
        <div className="print:hidden relative bg-gradient-to-l from-[#1e3a8a] via-[#2e5b9f] to-[#3f6db3] px-5 pt-5 pb-4 text-white overflow-hidden">
          {/* زخارف دائرية خفيفة */}
          <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-16 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-red-500/90 hover:bg-red-600 active:scale-90 text-white transition-all duration-200 shadow-lg cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center flex-shrink-0 shadow-inner">
              <ReceiptText className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-blue-200/80 tracking-wide">
                كافيه الفيشاوي
              </p>
              <p className="text-xl font-black font-arabic-heading leading-tight truncate">
                فاتورة #{displayOrderNumber(order)}
              </p>
            </div>
          </div>

          {/* شرائح الملخص السريع */}
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold relative">
            <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-1">
              <Hash className="w-3 h-3 opacity-70" />
              طاولة {order.tableNumber || '—'}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-1">
              <Clock className="w-3 h-3 opacity-70" />
              {formatTime(order.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-1">
              <Calendar className="w-3 h-3 opacity-70" />
              {formatDate(order.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-1">
              {formatStat(totalItemsCount, 'قطعة')}
            </span>
          </div>
        </div>

        {/* ===== جسم المودال ===== */}
        <div className="p-3 pt-2 print:p-0">
          {/* تسمية إطار المعاينة — للشاشة فقط */}


          {/* إطار المعاينة المنقّط — يتشال تماماً عند الطباعة (print:reset) */}
          <div className="rounded-2xl border-2 border-dashed border-[#2e5b9f]/25 bg-[#f8fafc] p-2 print:p-0 print:border-none print:bg-transparent print:rounded-none">

        {/* Printable Receipt Section */}
        <div id="printable-receipt" className="text-gray-900 p-2.5 print:p-0 text-right bg-white" dir="rtl" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif" }}>

          {/* Cafe Header */}
          <div className="text-center pb-2 border-b-2 border-gray-800">
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
              كافيه الفيشاوي
            </h2>

            {/* صف الفاتورة والطاولة */}
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-800 font-bold" dir="rtl">
              <span className="border-2 border-gray-700 rounded-md py-1 px-3 bg-gray-50">
                فاتورة: <strong className="font-mono text-sm font-extrabold text-gray-900">{displayOrderNumber(order)}</strong>
              </span>
              <span className="border-2 border-gray-700 rounded-md py-1 px-3 bg-gray-50">
                طاولة: <strong className="font-mono text-sm font-extrabold text-gray-900">{order.tableNumber || '—'}</strong>
              </span>
            </div>

            {/* التاريخ والوقت */}
            <div className="mt-2 flex items-center justify-between text-xs text-gray-700 font-bold px-1" dir="rtl">
              <span>التاريخ: <strong className="font-mono text-sm text-gray-900">{formatDate(order.createdAt)}</strong></span>
              <span>الوقت: <strong className="font-mono text-sm text-gray-900">{formatTime(order.createdAt)}</strong></span>
            </div>

            {cleanNotes && (
              <div className="receipt-notes-preview mt-1.5 border border-gray-400 p-1.5 rounded text-xs text-gray-700 text-right font-bold bg-gray-50">
                <span>ملاحظات:</span> <span className="mr-1">{cleanNotes}</span>
              </div>
            )}
          </div>

          {/* بانر العجز */}
          {hasAnyShortage && (
            <div className="my-2 border-2 border-red-300 bg-red-50 p-2 text-xs font-bold text-gray-800 rounded">
              <div className="text-red-700 font-extrabold mb-1">⚠️ تنبيه: عجز في مواد الفاتورة</div>
              {Array.from(shortagesPerProduct.entries()).map(([productName, shortages]) => (
                <div key={productName} dir="rtl">
                  <span>{productName}: </span>
                  <span className="text-red-700 font-extrabold">{shortages.join('، ')} (نافذ)</span>
                </div>
              ))}
            </div>
          )}

          {/* جدول الأصناف */}
          <div className="py-2 border-b-2 border-gray-800">
            <div className="flex items-center text-xs text-gray-800 font-extrabold mb-2 border-b border-gray-300 pb-1.5" dir="rtl">
              <span className="flex-1 text-right">الصنف</span>
              <span className="w-16 text-left">العدد</span>
            </div>

            <div className="space-y-0">
              {receiptItems.map((item, idx) => {
                const prodName = resolveProductName(item);
                const pId =
                  typeof item?.product === 'object' && item?.product
                    ? (item.product as any)._id
                    : String(item?.product || '');
                const itemShortages = shortageMap && pId ? shortageMap[pId] : null;
                const hasShortage = itemShortages && itemShortages.length > 0;

                return (
                  <div key={idx} dir="rtl" className="py-2 border-b border-dashed border-gray-200 last:border-0 last:pb-0">
                    <div className="flex items-center text-sm text-gray-900 font-bold">
                      <span className="flex-1 text-right text-gray-800">
                        {hasShortage && <span className="text-red-600">⚠️ </span>}{prodName}
                      </span>
                      <span className="w-16 text-left font-mono text-sm font-extrabold text-gray-800">
                        {formatNumber(item.quantity)}
                      </span>
                    </div>
                    {hasShortage && (
                      <div className="text-xs font-bold text-red-600 mt-1 mr-1">
                        نافذ: {itemShortages!.join(' — ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ملخص الفاتورة المعروض في المعاينة */}
          <div className="pt-2">
            <div className="space-y-2 rounded-xl border border-gray-200 bg-[#f8fafc] p-3 text-xs font-bold text-gray-700" dir="rtl">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">إجمالي القطع:</span>
                <span className="font-mono text-sm text-[#2e5b9f] font-extrabold">{formatNumber(totalItemsCount)} قطعة</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                <span className="text-gray-500">إجمالي الفاتورة:</span>
                <span className="font-mono text-sm text-emerald-700 font-extrabold">{formatPrice(order.totalAmount)}</span>
              </div>
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
    </div>
  );
};
