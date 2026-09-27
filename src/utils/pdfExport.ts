import jsPDF from 'jspdf';
// ⚠️ ملاحظة مهمة: html2canvas القديمة (1.4.1) بتفشل مع ألوان Tailwind CSS v4 (oklch)
// وده كان سبب إن تصدير الـ PDF مش شغال خالص. html2canvas-pro بيدعم oklch/lab بالكامل.
import html2canvas from 'html2canvas-pro';

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
