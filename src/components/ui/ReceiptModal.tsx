import React from 'react';
import { Order } from '../../types';
import { Button } from './Button';
import { X, Printer, AlertTriangle, PackageX, ReceiptText, Clock, Calendar, Hash } from 'lucide-react';
import { formatPrice, formatNumber, formatDateTime, formatDate, formatTime, formatStat } from '../../utils/formatters';
import { displayOrderNumber } from '../../utils/orderDisplay';
import { getCleanNotes } from '../../utils/orderShortageJournal';
import { useNotification } from '../../contexts/NotificationContext';
import {
  getConfiguredCashierPrinters,
  setConfiguredCashierPrinters,
  CashierPrinterInfo,
} from '../../utils/printerConfig';

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

/**
 * F: خط Cairo محلي (public/fonts) بدل Google Fonts CDN داخل مستند الطباعة —
 * نفس الرندر في Web وDesktop حتى أوفلاين. المسار يُحل مطلقاً من baseURI الحالي:
 * - Web Online:  https://<domain>/fonts/...
 * - Web Offline: من كاش المتصفح إن توفر
 * - Electron:    file:///.../fonts/... (يعمل أوفلاين دائماً — ملف محلي)
 * الأوزان متغيرة 200-1000 تغطي كل أوزان الفاتورة (700/800/900) بملف واحد لكل مجموعة حروف.
 */
const buildCairoFontFaceCss = (): string => {
  try {
    const base = new URL('fonts/', document.baseURI).href;
    return [
      `@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 200 1000; font-display: swap; src: url('${base}cairo-arabic-variable.woff2') format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1; }`,
      `@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 200 1000; font-display: swap; src: url('${base}cairo-latin-ext-variable.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }`,
      `@font-face { font-family: 'Cairo'; font-style: normal; font-weight: 200 1000; font-display: swap; src: url('${base}cairo-latin-variable.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }`,
    ].join('\n');
  } catch {
    // فشل نادر في تحديد المسار — يبقى fallback النظام (نفس السلوك السابق)
    return '';
  }
};

/** كل قواعد CSS الخاصة بفاتورة الطباعة (مقاسات ملم — مناسبة لطابعة حرارية 80mm) */
const RECEIPT_RULES: Array<[string, string]> = [
  ['*', 'box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact;'],
  ['html, body', `margin: 0; padding: 0; width: 72mm; background: #ffffff; color: #000000; font-family: ${RECEIPT_FONT};`],
  ['#receipt', 'width: 72mm; max-width: 72mm; padding: 0 1.5mm; margin: 0 auto !important; box-sizing: border-box !important; direction: rtl; text-align: right; background: #ffffff; color: #000000;'],
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
const wrapReceiptDocument = (bodyHTML: string, _pageHeightMm: number | null): string => {
  const cairoFontFaceCss = buildCairoFontFaceCss();
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة كافيه الفيشاوي</title>
  ${cairoFontFaceCss
    ? `<style>${cairoFontFaceCss}</style>`
    : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap">'}
  <style>
    @page {
      size: 72mm auto !important;
      margin: 0 !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 72mm !important;
      max-width: 72mm !important;
      min-height: 0 !important;
      height: auto !important;
      background: #ffffff !important;
      overflow: visible !important;
    }
    body {
      display: block !important;
      position: static !important;
      margin: 0 !important;
      padding: 0 !important;
    }
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

  // جمع كل الخامات النافذة الفريدة من كل المنتجات → "سكر نافذ، لبن نافذ"
  const uniqueShortageIngredients = hasAnyShortage
    ? Array.from(new Set(Array.from(shortagesPerProduct.values()).flat()))
    : [];
  const shortageNote = uniqueShortageIngredients.length > 0
    ? uniqueShortageIngredients.map((ing) => `${ing} نافذ`).join('، ')
    : '';

  // الملاحظات: فقط لو في نص مكتوب / عجز — ولو الاثنين موجودين يظهر كل منهما في سطر
  let notesHTML = '';
  if (cleanNotes && shortageNote) {
    notesHTML = `<div class="r-notes"><strong>ملاحظات:</strong> ${escapeHtmlText(cleanNotes)}<br>${escapeHtmlText(shortageNote)}</div>`;
  } else if (cleanNotes) {
    notesHTML = `<div class="r-notes"><strong>ملاحظات:</strong> ${escapeHtmlText(cleanNotes)}</div>`;
  } else if (shortageNote) {
    notesHTML = `<div class="r-notes">${escapeHtmlText(shortageNote)}</div>`;
  }

  return `<div id="receipt">
    <div class="r-header">
      <div class="r-title">كافيه الفيشاوي</div>
      <div class="r-invoice-row">
        <span>رقم الفاتورة: <strong>${escapeHtmlText(displayOrderNumber(order))}</strong></span>
        <span>طاولة: <strong>${escapeHtmlText(String(order.tableNumber ?? '—'))}</strong></span>
      </div>
      ${(order as any)?.syncStatus === 'PENDING_SYNC' || (order as any)?.sync_status === 'PENDING_SYNC'
        ? `<div class="r-dt-row"><span>⏳ فاتورة مؤقتة — الرقم النهائي بعد المزامنة</span></div>`
        : ''}
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
    // F: نفس خط Cairo المحلي في مسار الطباعة الاحتياطي (اتساق مع مستند الطباعة الأساسي)
    const cairoFontFaceCss = buildCairoFontFaceCss();
    style.textContent = `
      #${holderId} { display: none; }
      @media print {
        ${cairoFontFaceCss}
        @page {
          size: 72mm auto !important;
          margin: 0 !important;
        }
        *, *::before, *::after {
          box-sizing: border-box !important;
        }
        html, body {
          width: 72mm !important;
          max-width: 72mm !important;
          min-height: 0 !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }
        body > *:not(#${holderId}) { display: none !important; }
        #${holderId} {
          display: block !important;
          position: static !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 72mm !important;
          max-width: 72mm !important;
        }
${buildReceiptCss(`#${holderId}`)}
        #${holderId} #receipt { margin: 0 auto !important; width: 72mm !important; max-width: 72mm !important; }
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
  const isElectron = !!(window as any).electronAPI?.isElectron;
  const { showToast } = useNotification();

  const [isPrinting, setIsPrinting] = React.useState(false);
  const [printInfo, setPrintInfo] = React.useState('');

  // --- طابعات الكاشير المخصصة لهذا الـ Desktop ---
  const [configuredPrinters, setConfiguredPrintersState] = React.useState<string[]>(() =>
    getConfiguredCashierPrinters()
  );
  const [availablePrinters, setAvailablePrinters] = React.useState<CashierPrinterInfo[]>([]);
  const [showPrinterSettings, setShowPrinterSettings] = React.useState(false);

  // تحديث قائمة الطابعات المكتشفة من النظام (Desktop فقط)
  React.useEffect(() => {
    if (!isOpen || !isElectron) return;
    if (typeof (window as any).electronAPI?.getPrinters !== 'function') return;

    (window as any).electronAPI.getPrinters().then((res: any) => {
      if (res?.ok && Array.isArray(res.printers)) {
        setAvailablePrinters(res.printers);
        // لو مفيش أي طابعة مخصصة بعد، نحدد الافتراضية
        const saved = getConfiguredCashierPrinters();
        if (saved.length === 0) {
          const def = res.printers.find((p: any) => p.isDefault);
          if (def?.name) {
            const initial = [def.name];
            setConfiguredPrintersState(initial);
            setConfiguredCashierPrinters(initial);
          }
        } else {
          setConfiguredPrintersState(saved);
        }
      }
    }).catch(() => {});
  }, [isOpen, isElectron]);

  const toggleConfiguredPrinter = (printerName: string) => {
    const isSelected = configuredPrinters.includes(printerName);
    const updated = isSelected
      ? configuredPrinters.filter((p) => p !== printerName)
      : [...configuredPrinters, printerName];
    setConfiguredPrintersState(updated);
    setConfiguredCashierPrinters(updated);
  };

  // وسم body + حقن @page مخصص لطابعة 80mm أثناء فتح الفاتورة
  React.useEffect(() => {
    if (!isOpen) return undefined;
    const pageStyleId = 'receipt-print-page-style';
    document.getElementById(pageStyleId)?.remove();

    const pageStyle = document.createElement('style');
    pageStyle.id = pageStyleId;
    pageStyle.textContent = `
      @media print {
        @page { size: 72mm auto !important; margin: 0 !important; }
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
    if (!order || isPrinting) return;
    setIsPrinting(true);
    setShowPrinterSettings(false);

    try {
      const bodyHTML = buildReceiptBodyHTML(order, products, shortageMap);

      // ===== Desktop (Electron): طباعة صامتة إلى جميع طابعات الكاشير المخصصة بدون Windows Dialog =====
      if (isElectron && (window as any).electronAPI?.silentPrint) {
        // 1. جلب الطابعات المخصصة لهذا الجهاز
        const targetPrinters = getConfiguredCashierPrinters();

        // فحص الطابعات المتاحة فعلياً على ويندوز
        let sysPrinters: CashierPrinterInfo[] = availablePrinters;
        if (sysPrinters.length === 0) {
          try {
            const pRes = await (window as any).electronAPI.getPrinters();
            if (pRes?.ok && Array.isArray(pRes.printers)) {
              sysPrinters = pRes.printers;
              setAvailablePrinters(sysPrinters);
            }
          } catch {}
        }

        const sysPrinterNames = new Set(sysPrinters.map((p) => p.name));

        // إذا لم تكن هناك أي طابعة كاشير مخصصة للجهاز
        if (targetPrinters.length === 0) {
          showToast('لم يتم تحديد أي طابعة كاشير مخصصة لهذا الجهاز. يرجى اختيار طابعات الكاشير من إعدادات الطابعة.', 'error');
          setIsPrinting(false);
          return;
        }

        // فحص الطابعات المخصصة: المتاحة وغير المتاحة
        const availableTargets = targetPrinters.filter((p) => sysPrinterNames.has(p));
        const missingTargets = targetPrinters.filter((p) => !sysPrinterNames.has(p));

        // إذا كانت جميع طابعات الكاشير المخصصة غير متاحة
        if (availableTargets.length === 0) {
          showToast(
            `جميع طابعات الكاشير المخصصة غير متاحة (${targetPrinters.join('، ')}). لن يتم إرسال الفاتورة لأي طابعة أخرى.`,
            'error'
          );
          setIsPrinting(false);
          return;
        }

        // إذا كانت طابعة متاحة وأخرى غير متاحة: نظهر تنبيهاً واضحاً
        if (missingTargets.length > 0) {
          showToast(
            `تنبيه: إحدى طابعات الكاشير المخصصة غير متصلة (${missingTargets.join('، ')}). سيتم إرسال الفاتورة إلى الطابعات المتاحة فقط.`,
            'info'
          );
        }

        const fullHtml = wrapReceiptDocument(bodyHTML, null);
        let printedCount = 0;
        const failedPrinters: string[] = [];

        // طباعة نسخة على كل طابعة كاشير مخصصة ومتاحة بالتوازي
        await Promise.all(
          availableTargets.map(async (printerName) => {
            try {
              const res = await (window as any).electronAPI.silentPrint(fullHtml, printerName);
              if (res?.ok) {
                printedCount++;
              } else {
                console.warn(`[Receipt] Silent print to ${printerName} failed:`, res?.reason);
                failedPrinters.push(printerName);
              }
            } catch (err: any) {
              console.error(`[Receipt] Error printing to ${printerName}:`, err);
              failedPrinters.push(printerName);
            }
          })
        );

        if (printedCount > 0) {
          setPrintInfo(`تمت الطباعة الصامتة على ${printedCount} طابعة كاشير`);
          if (failedPrinters.length > 0) {
            showToast(`تعذرت الطباعة على: ${failedPrinters.join('، ')}`, 'error');
          } else {
            showToast(`تمت طباعة الفاتورة بنجاح على طابعات الكاشير (${printedCount})`);
          }
        } else {
          showToast(`تعذرت الطباعة على طابعات الكاشير المحددة. لن يتم الإرسال لأي طابعة غير مخصصة.`, 'error');
        }

        return;
      }

      // ===== Browser (Non-Electron): طباعة عبر iframe =====
      await _printViaIframe(bodyHTML);

    } catch (err) {
      console.error('[Receipt] Print error:', err);
      showToast('حدث خطأ أثناء إرسال الفاتورة للطباعة', 'error');
    } finally {
      setTimeout(() => setIsPrinting(false), 1500);
    }
  };


  /** طباعة عبر iframe معزول (Browser + Electron fallback) */
  const _printViaIframe = async (bodyHTML: string) => {
    const measureFrame = document.createElement('iframe');
    measureFrame.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:72mm;height:4000px;border:none;visibility:hidden;';
    document.body.appendChild(measureFrame);

    let heightPx = 0;
    try {
      const measureWin = measureFrame.contentWindow;
      const measureDoc = measureWin?.document;
      if (!measureWin || !measureDoc) throw new Error('measure-frame-unavailable');
      measureDoc.open();
      measureDoc.write(wrapReceiptDocument(bodyHTML, null));
      measureDoc.close();
      try { await measureWin.document.fonts.ready; } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 250));
      const receiptEl = measureDoc.getElementById('receipt');
      heightPx = receiptEl ? receiptEl.getBoundingClientRect().height : 0;
    } finally {
      measureFrame.remove();
    }

    if (!heightPx || heightPx <= 0) heightPx = 300;
    const PX_PER_MM = 96 / 25.4;
    const heightMm = Math.min(1500, Math.max(75, Math.ceil(heightPx / PX_PER_MM) + 4));
    setPrintInfo(`iframe · ${heightMm}mm`);

    const oldFrame = document.getElementById('receipt-print-frame');
    if (oldFrame) oldFrame.remove();
    const printFrame = document.createElement('iframe');
    printFrame.id = 'receipt-print-frame';
    printFrame.setAttribute('title', 'فاتورة كافيه الفيشاوي');
    printFrame.style.cssText = `position:fixed;top:0;left:0;width:72mm;height:${Math.ceil(heightPx + 60)}px;border:none;z-index:-99999;opacity:0.01;pointer-events:none;`;
    document.body.appendChild(printFrame);

    const printWin = printFrame.contentWindow;
    const printDoc = printWin?.document;
    if (!printWin || !printDoc) throw new Error('print-frame-unavailable');
    printDoc.open();
    printDoc.write(wrapReceiptDocument(bodyHTML, heightMm));
    printDoc.close();
    try { await printWin.document.fonts.ready; } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 300));
    try {
      printWin.focus();
      printWin.print();
    } catch {
      setPrintInfo(`main-window · ${heightMm}mm`);
      await printViaMainWindow(bodyHTML, heightMm);
    }
    setTimeout(() => printFrame.remove(), 60000);
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

  // ✅ الآن بعد استدعاء جميع الـ Hooks، يمكن الخروج بأمان إذا لم يكن المودال مفتوحاً أو لا يوجد طلب
  if (!isOpen || !order) return null;

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
              {(order as any)?.syncStatus === 'PENDING_SYNC' || (order as any)?.sync_status === 'PENDING_SYNC' ? (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 bg-amber-500/20 border border-amber-300/40 rounded-full px-2.5 py-0.5">
                  ⏳ فاتورة مؤقتة — ستتحول للرقم النهائي بعد المزامنة
                </p>
              ) : null}
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

          {/* شريط طابعات الكاشير المخصصة — Desktop فقط */}
          {isElectron && (
            <div className="mt-2.5 relative">
              <button
                type="button"
                onClick={() => setShowPrinterSettings((v) => !v)}
                className="w-full flex items-center justify-between gap-2 bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Printer className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  <span className="opacity-75 shrink-0">طابعات الكاشير:</span>
                  <span className="truncate">
                    {configuredPrinters.length === 0
                      ? '⚠️ لم تحدد أي طابعة كاشير'
                      : configuredPrinters.join(' + ')}
                  </span>
                </span>
                <span className="opacity-75 text-[10px] shrink-0 bg-white/15 px-2 py-0.5 rounded-lg hover:bg-white/25">
                  إعدادات الطابعات ▾
                </span>
              </button>

              {/* قائمة طابعات الكاشير المخصصة (Desktop Settings) */}
              {showPrinterSettings && (
                <div className="absolute top-full mt-1.5 right-0 left-0 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 text-gray-800 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-[10px] text-gray-400 font-mono">
                      محدد: {configuredPrinters.length}
                    </span>
                    <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-[#2e5b9f]" />
                      طابعات الكاشير المخصصة لهذا الجهاز
                    </h4>
                  </div>

                  <p className="text-[10px] text-gray-500 leading-tight">
                    حدد الطابعات المخصصة لطباعة الفواتير. ستطبع الفاتورة عليها تلقائياً وبدون أي Dialog.
                  </p>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                    {availablePrinters.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-400">جاري فحص الطابعات المتاحة...</div>
                    ) : (
                      availablePrinters.map((p) => {
                        const isConfigured = configuredPrinters.includes(p.name);
                        const isOnline = p.status === 0 || p.status === undefined;
                        return (
                          <div
                            key={p.name}
                            onClick={() => toggleConfiguredPrinter(p.name)}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              isConfigured
                                ? 'bg-blue-50/70 border-[#2e5b9f] text-[#1e3a8a] font-bold'
                                : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isOnline ? 'متصلة' : 'مشغولة/غير متاحة'}
                            </span>

                            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                              <span className="truncate text-right">
                                {p.displayName || p.name}
                              </span>
                              <input
                                type="checkbox"
                                checked={isConfigured}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 text-[#2e5b9f] rounded cursor-pointer pointer-events-none"
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowPrinterSettings(false)}
                      className="w-full py-1.5 bg-[#2e5b9f] hover:bg-[#244b85] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      حفظ واعتماد الطابعات
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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

            {/* ملاحظات + عجز في صندوق واحد — يظهر فقط لو في محتوى */}
            {(cleanNotes || hasAnyShortage) && (
              <div className="receipt-notes-preview mt-1.5 border border-gray-400 p-1.5 rounded text-xs text-gray-700 text-right font-bold bg-gray-50">
                {cleanNotes && (
                  <div><span>ملاحظات:</span> <span className="mr-1">{cleanNotes}</span></div>
                )}
                {hasAnyShortage && (
                  <div className="text-red-700">
                    {Array.from(new Set(Array.from(shortagesPerProduct.values()).flat()))
                      .map((ing) => `${ing} نافذ`)
                      .join('، ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* بانر العجز — محذوف: العجز الآن داخل صندوق الملاحظات مباشرة */}
          {false && hasAnyShortage && (
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
