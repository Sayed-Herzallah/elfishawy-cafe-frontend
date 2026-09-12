import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, AlertTriangle, PackageX, Eye } from 'lucide-react';
import { formatPrice, formatNumber, formatDateTime, formatDate, formatTime } from '../../utils/formatters';
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
  ['html, body', `margin: 0; padding: 0; width: 100%; background: #ffffff; color: #000000; font-family: ${RECEIPT_FONT};`],
  ['#receipt', 'width: 70mm; max-width: 70mm; padding: 0 2.5mm; margin: 0 auto; direction: rtl; text-align: right; background: #ffffff; color: #000000;'],
  ['.r-header', 'margin: 0; padding: 0 0 1mm 0; text-align: center; border-bottom: 0.6mm solid #000000;'],
  ['.r-title', 'margin: 0; padding: 0; font-size: 13pt; font-weight: 900; line-height: 1.15;'],
  ['.r-invoice-row', 'margin-top: 1.5mm; border: 0.5mm solid #000000; border-radius: 2mm; padding: 0.8mm 2mm; display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; font-weight: 800;'],
  ['.r-dt-row', 'margin-top: 1.2mm; padding: 0 1mm; display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 800;'],
  ['.r-notes', 'margin-top: 1.2mm; border: 0.35mm solid #000000; border-radius: 1.5mm; padding: 1mm 1.5mm; font-size: 8.5pt; font-weight: 700; text-align: right;'],
  ['.r-shortage', 'margin-top: 1.5mm; border: 0.5mm solid #000000; background: #f3f4f6; padding: 1.5mm; font-size: 8.5pt; font-weight: 700; text-align: right;'],
  ['.r-shortage-title', 'color: #b91c1c; font-weight: 900; margin-bottom: 0.8mm;'],
  ['.r-shortage-line', 'font-weight: 700;'],
  ['.r-items', 'padding: 1mm 0; border-bottom: 0.6mm solid #000000;'],
  ['.r-items-head', 'display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 900; border-bottom: 0.5mm solid #000000; padding-bottom: 0.6mm; margin-bottom: 1mm;'],
  ['.r-item', 'padding-bottom: 0.8mm;'],
  ['.r-item-main', 'display: flex; justify-content: space-between; align-items: center; font-size: 9pt; font-weight: 900;'],
  ['.r-name', 'flex: 1; text-align: right;'],
  ['.r-amt', 'width: 14mm; text-align: left; font-weight: 900; white-space: nowrap;'],
  ['.r-totals', 'padding: 1mm 2mm; border-bottom: 0.6mm solid #000000;'],
  ['.r-count-total', 'display: flex; justify-content: space-between; align-items: center; padding-top: 1mm; font-size: 10.5pt; font-weight: 900;'],
  ['.r-warn', 'color: #b91c1c; font-size: 8pt; font-weight: 900; margin-top: 0.5mm; text-align: right;'],
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
    ? `width: 100% !important; height: ${pageHeightMm}mm !important; min-height: ${pageHeightMm}mm !important; max-height: none !important; overflow: visible !important;`
    : 'width: 100% !important; height: auto !important; min-height: 0 !important; overflow: visible !important;';

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

/** بناء HTML الفاتورة كاملة (هيدر + أصناف + عدد القطع + فوتر) بستايل مدمج
 *  ملاحظة: الفاتورة المطبوعة بتروح للبار — فبنشيل المبلغ الإجمالي منها تماماً،
 *  والإجمالي يفضل ظاهر على الشاشة (كاشير/أدمن) بس. */
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
              `<div class="r-shortage-line">${escapeHtmlText(productName)}: <span style="color:#b91c1c;font-weight:900">${escapeHtmlText(shortages.join('، '))} (نافذ)</span></div>`
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
        <span>رقم الفاتورة: <strong>${escapeHtmlText(String(order.orderNumber || order._id || '').slice(-6))}</strong></span>
        <span>طاولة: <strong>${escapeHtmlText(String(order.tableNumber ?? '—'))}</strong></span>
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
    // فحص ما إذا كان التطبيق يعمل داخل Electron على سطح المكتب لدعم الطباعة الصامتة المباشرة
    if ((window as any).desktopApi?.printReceipt) {
      (window as any).desktopApi.printReceipt(bodyHTML).then(() => {
        cleanup();
      }).catch(() => {
        window.print();
      });
      return;
    }

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
      // ⚠️ كان 4000px — documentElement.scrollHeight كان بيرجع ارتفاع الـ iframe نفسه
      // (4000px) بدل ارتفاع الفاتورة → @page بيطول أكتر من الفاتورة → صفحات فاضية بعد الفاتورة.
      // نقيس جوه iframe قصير: scrollHeight وقتها = ارتفاع محتوى الفاتورة الفعلي بالظبط.
      measureFrame.style.height = '120px';
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

        // ننتظر تحميل الخطوط (Cairo) — بحّرس زمني 1.5 ثانية: لو promise الخطوط
        // مش بيحل (iframe مخفي مثلاً) ما يعلّقش الطباعة كلها ومفيش ورق يطلع
        await Promise.race([
          (async () => { try { await measureWin.document.fonts.ready; } catch { /* تجاهل */ } })(),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
        await new Promise((r) => setTimeout(r, 250));

        const receiptEl = measureDoc.getElementById('receipt');
        const receiptHeight = receiptEl ? receiptEl.getBoundingClientRect().height : 0;
        const bodyHeight = measureDoc.body?.scrollHeight ?? 0;
        const docHeight = measureDoc.documentElement?.scrollHeight ?? 0;
        // نستخدم الأكبر بين القياسات الثلاثة لضمان عدم قطع أي محتوى
        heightPx = Math.max(receiptHeight, bodyHeight, docHeight);
      } finally {
        measureFrame.remove();
      }

      if (!heightPx || heightPx <= 0) heightPx = 300;

      // تحويل البكسل إلى ملم (96px = 25.4mm) + 1mm هامش أمان لمنع قطع آخر سطر
      const PX_PER_MM = 96 / 25.4;
      const heightMm = Math.min(1500, Math.max(30, Math.ceil(heightPx / PX_PER_MM) + 1));

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
      printFrame.style.height = `${Math.ceil(heightPx + 120)}px`;
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

      // نفس الحرس الزمني في مرحلة الطباعة الفعلية — لو الخطوط علّقت نكمل عادي
      await Promise.race([
        (async () => { try { await printWin.document.fonts.ready; } catch { /* تجاهل */ } })(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
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
    <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center p-4 min-h-screen print:p-0 print:m-0 print:static print:min-h-0 print:block">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs print:hidden" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md p-5 z-10 text-right animate-in fade-in zoom-in-95 duration-150 my-auto print:my-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:w-auto print:max-w-none">
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

        {/* معاينة الفاتورة داخل إطار عرض — للشاشة فقط (الطباعة بتتم عبر iframe مستقل) */}
        <div className="rounded-2xl border border-gray-200/80 bg-[#faf8f5] p-2.5 print:p-0 print:border-none print:bg-white print:rounded-none">
        {/* Printable Receipt Section */}
        <div id="printable-receipt" className="relative text-black font-sans p-3 print:p-0 text-right bg-white rounded-xl border border-gray-200/60 shadow-sm print:rounded-none print:shadow-none print:border-none" dir="rtl">

          {/* Cafe Header */}
          <div className="text-center pb-3 border-b border-dashed border-gray-300">
            <h2 className="text-xl font-black font-arabic-heading text-gray-900 tracking-wide">
              كافيه الفيشاوي
            </h2>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">فاتورة مبيعات — نقطة البيع</p>

            {/* رقم الفاتورة والطاولة — شرائح */}
            <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap" dir="rtl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2e5b9f]/10 border border-[#2e5b9f]/20 text-[#2e5b9f] text-[11px] font-black">
                <span>رقم الفاتورة:</span>
                <strong className="font-mono">{String(order.orderNumber || order._id || '').slice(-6)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-black">
                <span>طاولة:</span>
                <strong className="font-mono">{order.tableNumber || '—'}</strong>
              </span>
            </div>

            {/* التاريخ والوقت */}
            <div className="mt-2 flex items-center justify-center gap-2 text-[11px] font-bold text-gray-500 font-mono" dir="rtl">
              <span>{formatDate(order.createdAt)}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{formatTime(order.createdAt)}</span>
            </div>

            {(() => {
              const cleanNotes = getCleanNotes(order.notes);
              if (!cleanNotes) return null;
              return (
                <div className="mt-2.5 bg-amber-50/70 border border-amber-200/70 p-1.5 rounded-lg text-[11px] text-amber-900 text-right font-bold">
                  <span className="font-black">ملاحظات:</span> <span className="mr-1">{cleanNotes}</span>
                </div>
              );
            })()}
          </div>

          {/* بانر العجز الثانوي */}
          {hasAnyShortage && (
            <div className="my-2.5 bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 text-xs font-bold text-gray-800">
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

          {/* جدول الأصناف */}
          <div className="py-3 border-b border-dashed border-gray-300">
            <div className="flex justify-between text-[10px] font-black text-gray-400 tracking-wide mb-1" dir="rtl">
              <span className="flex-1 text-right">الصنف</span>
              <span className="w-20 text-left">الإجمالي</span>
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
                  <div key={idx} dir="rtl" className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-sm font-black text-gray-900 leading-snug">
                        {hasShortage && '⚠️ '}{prodName}
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold font-mono mt-0.5">
                        {formatNumber(item.quantity)} × {formatNumber(item.price)} جنيه
                      </div>
                      {hasShortage && (
                        <div className="text-[11px] font-black text-rose-600 mt-0.5">
                          ⚠️ نافذ: {itemShortages!.join(' — ')}
                        </div>
                      )}
                    </div>
                    <span className="w-20 shrink-0 text-left font-mono text-sm font-black text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* قسم الإجمالي والفوتر — الإجمالي ظاهر على الشاشة فقط (فاتورة الطباعة للبار بدون مبلغ) */}
          <div>
            <div className="pt-3 space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-gray-500" dir="rtl">
                <span>إجمالي عدد القطع</span>
                <span className="font-mono">{formatNumber(totalItemsCount)} قطعة</span>
              </div>
              <div className="flex justify-between items-center bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 rounded-xl px-3 py-2.5 mt-1" dir="rtl">
                <span className="text-sm font-black text-gray-900">المطلوب سداده</span>
                <span className="font-mono text-xl font-black text-[#2e5b9f]">
                  {formatPrice(order.totalAmount)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="text-[11px] font-bold text-gray-400">أهلاً وسهلاً بكم دائماً في كافيه الفيشاوي</p>
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
