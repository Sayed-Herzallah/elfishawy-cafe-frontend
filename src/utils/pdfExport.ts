import jsPDF from 'jspdf';
// ⚠️ ملاحظة مهمة: html2canvas القديمة (1.4.1) بتفشل مع ألوان Tailwind CSS v4 (oklch)
// وده كان سبب إن تصدير الـ PDF مش شغال خالص. html2canvas-pro بيدعم oklch/lab بالكامل.
import html2canvas from 'html2canvas-pro';

export interface OnePageReportMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'neutral';
}

export interface OnePageReportSection {
  title: string;
  rows: Array<{ label: string; value: string; detail?: string }>;
}

export interface OnePageReport {
  title: string;
  subtitle: string;
  period: string;
  metrics: OnePageReportMetric[];
  sections: OnePageReportSection[];
  footer?: string;
}

const REPORT_TONES = {
  blue: { background: '#eff6ff', border: '#bfdbfe', value: '#1d4ed8' },
  green: { background: '#ecfdf5', border: '#a7f3d0', value: '#047857' },
  red: { background: '#fff1f2', border: '#fecdd3', value: '#be123c' },
  purple: { background: '#f5f3ff', border: '#ddd6fe', value: '#6d28d9' },
  amber: { background: '#fffbeb', border: '#fde68a', value: '#b45309' },
  neutral: { background: '#f8fafc', border: '#e2e8f0', value: '#172554' },
} as const;

const makeReportNode = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration>,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Build a compact, purpose-specific A4 report instead of screenshotting the long page UI. */
export const exportOnePageSummaryToPdf = async (
  report: OnePageReport,
  fileName: string
): Promise<void> => {
  const root = makeReportNode('div', {
    position: 'fixed', left: '0', top: '0', width: '794px', height: '1123px',
    boxSizing: 'border-box', padding: '42px', display: 'flex', flexDirection: 'column',
    gap: '20px', overflow: 'hidden', background: '#ffffff', color: '#172033',
    direction: 'rtl', textAlign: 'right', fontFamily: 'Arial, Tahoma, sans-serif',
    opacity: '0', pointerEvents: 'none', zIndex: '2147483647',
  });
  root.id = `one-page-report-${Date.now()}`;

  const header = makeReportNode('header', {
    borderBottom: '3px solid #2e5b9f', paddingBottom: '18px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexShrink: '0',
  });
  const brand = makeReportNode('div', { minWidth: '0' });
  brand.append(
    makeReportNode('div', { color: '#64748b', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }, 'EL FISHAWY CAFE  •  تقرير موجز'),
    makeReportNode('h1', { color: '#173967', fontSize: '27px', lineHeight: '1.25', margin: '0 0 6px', fontWeight: '800' }, report.title),
    makeReportNode('div', { color: '#64748b', fontSize: '13px', lineHeight: '1.5' }, report.subtitle)
  );
  const periodBadge = makeReportNode('div', {
    flexShrink: '0', maxWidth: '230px', padding: '10px 14px', border: '1px solid #dbeafe',
    borderRadius: '12px', background: '#eff6ff', color: '#1e40af', fontSize: '13px',
    fontWeight: '700', lineHeight: '1.5', overflowWrap: 'anywhere',
  }, `الفترة\n${report.period}`);
  periodBadge.style.whiteSpace = 'pre-line';
  header.append(brand, periodBadge);
  root.append(header);

  const metricGrid = makeReportNode('section', {
    display: 'grid', gridTemplateColumns: report.metrics.length > 4 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
    gap: '12px', flexShrink: '0',
  });
  report.metrics.slice(0, 6).forEach((metric) => {
    const tone = REPORT_TONES[metric.tone || 'neutral'];
    const card = makeReportNode('div', {
      boxSizing: 'border-box', height: '104px', padding: '15px 17px', borderRadius: '14px',
      border: `1px solid ${tone.border}`, background: tone.background, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    });
    card.append(
      makeReportNode('div', { color: '#64748b', fontSize: '13px', fontWeight: '700' }, metric.label),
      makeReportNode('div', { color: tone.value, fontSize: '21px', fontWeight: '800', lineHeight: '1.3', overflowWrap: 'anywhere' }, metric.value),
      makeReportNode('div', { color: '#64748b', fontSize: '11px', minHeight: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, metric.detail || '')
    );
    metricGrid.append(card);
  });
  root.append(metricGrid);

  const sectionGrid = makeReportNode('section', {
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px',
    alignContent: 'start', flex: '1 1 auto', minHeight: '0', overflow: 'hidden',
  });
  report.sections.slice(0, 4).forEach((section) => {
    const card = makeReportNode('div', {
      boxSizing: 'border-box', padding: '15px 17px', borderRadius: '14px',
      border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden',
      alignSelf: 'start',
    });
    card.append(makeReportNode('h2', {
      color: '#173967', fontSize: '15px', fontWeight: '800', margin: '0 0 9px',
      paddingBottom: '9px', borderBottom: '1px solid #e2e8f0',
    }, section.title));
    const rows = section.rows.slice(0, 6);
    if (rows.length === 0) {
      card.append(makeReportNode('div', { color: '#94a3b8', fontSize: '12px', padding: '8px 0' }, 'لا توجد بيانات في هذه الفترة'));
    }
    rows.forEach((row, index) => {
      const line = makeReportNode('div', {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px',
        padding: '7px 0', borderBottom: index < rows.length - 1 ? '1px solid #f1f5f9' : '0',
        fontSize: '12px', lineHeight: '1.45',
      });
      const label = makeReportNode('div', { color: '#64748b', flex: '1 1 52%', overflowWrap: 'anywhere' }, row.label);
      const valueGroup = makeReportNode('div', { flex: '0 1 48%', textAlign: 'left', overflowWrap: 'anywhere' });
      valueGroup.append(makeReportNode('div', { color: '#172554', fontWeight: '700' }, row.value));
      if (row.detail) valueGroup.append(makeReportNode('div', { color: '#94a3b8', fontSize: '10px', marginTop: '2px' }, row.detail));
      line.append(label, valueGroup);
      card.append(line);
    });
    sectionGrid.append(card);
  });
  root.append(sectionGrid);

  const generatedAt = new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo',
  }).format(new Date());
  root.append(makeReportNode('footer', {
    flexShrink: '0', borderTop: '1px solid #e2e8f0', paddingTop: '11px',
    display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#64748b',
    fontSize: '10px', lineHeight: '1.5',
  }, `${report.footer || 'ملخص مؤشرات الفترة حسب البيانات المتاحة'}\nتاريخ الإصدار: ${generatedAt}`));

  document.body.appendChild(root);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(root, {
      width: 794, height: 1123, scale: 2, useCORS: true, allowTaint: false,
      backgroundColor: '#ffffff', logging: false, windowWidth: 794, windowHeight: 1123,
      scrollX: 0, scrollY: 0,
      onclone: (clonedDocument) => {
        const clonedRoot = clonedDocument.getElementById(root.id);
        if (clonedRoot) clonedRoot.style.opacity = '1';
      },
    });
    if (!canvas.width || !canvas.height) throw new Error('تعذر تجهيز صفحة التقرير.');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  } catch (err) {
    console.error('One-page PDF export failed:', err);
    throw new Error('فشل تجهيز التقرير المختصر. حاول التصدير مرة أخرى.');
  } finally {
    root.remove();
  }
};

/**
 * تصدير أي عنصر HTML إلى ملف PDF احترافي (A4 متعدد الصفحات).
 * العربي والـ RTL بيطلعوا مظبوطين 100% لأن المحتوى بيتلقط كصورة عالية الدقة.
 *
 * @param element العنصر المطلوب تصديره
 * @param fileName اسم الملف بدون امتداد
 */
export const exportElementToPdf = async (
  element: HTMLElement,
  fileName: string
): Promise<void> => {
  const contentWidth = Math.ceil(element.scrollWidth || element.getBoundingClientRect().width);
  const contentHeight = Math.ceil(element.scrollHeight || element.getBoundingClientRect().height);
  if (!contentWidth || !contentHeight) {
    throw new Error('التقرير فاضي أو لم يتم التقاطه بشكل صحيح.');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 6;
  const maxImageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const usablePageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
  // Capture one printable page at a time. A single giant canvas for a long
  // dashboard can exceed Chromium's canvas limit and produce empty/clipped PDFs.
  const maxSliceHeightPx = Math.max(1, Math.floor(contentWidth * usablePageHeight / maxImageWidth));
  const estimatedPages = Math.ceil(contentHeight / maxSliceHeightPx);
  const finalPageHeight = contentHeight - (estimatedPages - 1) * maxSliceHeightPx;
  // Avoid exporting a nearly empty last sheet: spread a tiny remainder across
  // the existing pages and shrink their width just enough to preserve aspect.
  const pageCount = estimatedPages > 1 && finalPageHeight < maxSliceHeightPx * 0.12
    ? estimatedPages - 1
    : estimatedPages;
  const sliceHeightPx = Math.ceil(contentHeight / pageCount);
  const imageWidth = Math.min(maxImageWidth, usablePageHeight * contentWidth / sliceHeightPx);

  try {
    let offsetY = 0;
    let pageIndex = 0;
    while (offsetY < contentHeight) {
      const pageContentHeight = Math.min(sliceHeightPx, contentHeight - offsetY);
      const canvas = await html2canvas(element, {
        x: 0,
        y: offsetY,
        width: contentWidth,
        height: pageContentHeight,
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: contentWidth,
        windowHeight: contentHeight,
        scrollX: 0,
        scrollY: 0,
      });
      if (!canvas.width || !canvas.height) throw new Error('تعذر التقاط جزء من التقرير.');
      if (pageIndex > 0) pdf.addPage();
      const renderedHeight = (canvas.height * imageWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imageWidth, renderedHeight);
      offsetY += pageContentHeight;
      pageIndex++;
    }
  } catch (err) {
    console.error('html2canvas capture failed:', err);
    throw new Error('فشل تحويل التقرير لملف PDF. جرّب تاني أو استخدم تصدير CSV.');
  }

  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};
