/**
 * ضغط صور المنتجات قبل الرفع — بيقلل حجم الطلب ويمنع خطأ
 * "Request Entity Too Large" (413) من الـ Backend على Vercel
 * (الحد الأقصى لـ serverless functions = 4.5MB).
 */

interface Size {
  width: number;
  height: number;
}

export interface CompressOptions {
  /** أقصى عرض أو ارتفاع بالبكسل — الصورة الأكبر تتقلّص بنفس النسبة */
  maxSize?: number;
  /** جودة JPEG (0.7 - 0.9) */
  quality?: number;
}

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });

const drawScaled = (img: HTMLImageElement, maxSize: number): { canvas: HTMLCanvasElement; size: Size } => {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const size: Size = {
    width: Math.max(1, Math.round(img.naturalWidth * scale)),
    height: Math.max(1, Math.round(img.naturalHeight * scale)),
  };
  const canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(img, 0, 0, size.width, size.height);
  }
  return { canvas, size };
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> => {
  const fallbackToDataUrl = (): Promise<Blob> => fetch(canvas.toDataURL(type, quality)).then((r) => r.blob());
  // canvas.toBlob() طريقة حديثة موجودة في المتصفحات الأحدث — protected بدون TS error
  const maybeToBlob = (canvas as unknown as { toBlob?: (t: string, q: number) => Promise<Blob> }).toBlob;
  if (typeof maybeToBlob === 'function') {
    try {
      return new Promise((resolve) => {
        maybeToBlob(type, quality).then(resolve).catch(() => resolve(fallbackToDataUrl().catch(() => null)));
      });
    } catch {
      return fallbackToDataUrl();
    }
  }
  return fallbackToDataUrl();
};

/**
 * يضغط صورة مختارة (File) قبل رفعها:
 * - يقلّص الأبعاد لأقصى `maxSize` بكسل
 * - يحوّلها JPEG بجودة `quality` (ماعدا PNG الشفافة تفضل PNG)
 * - لو فشل الضغط لأي سبب يرجع الملف الأصلي (إرسال بأمان)
 */
export const compressImage = async (
  file: File,
  { maxSize = 1000, quality = 0.8 }: CompressOptions = {}
): Promise<File> => {
  try {
    if (!file.type.startsWith('image/')) return file;

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(objectUrl);

      // الصورة بالفعل صغيرة والأبعاد مش هتفرق → ابعتها زي ما هي (أسرع وأدق)
      if (Math.max(img.naturalWidth, img.naturalHeight) <= maxSize) {
        return file;
      }

      const { canvas, size } = drawScaled(img, maxSize);
      const isPng = file.type === 'image/png';
      const outType = isPng ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(canvas, outType, outType === 'image/jpeg' ? quality : 0.9);
      if (!blob) return file;

      // حاصل الضغط أكبر أو لا يوجد فايدة → الملف الأصلي
      if (blob.size >= file.size) return file;

      const ext = outType === 'image/png' ? 'png' : 'jpg';
      const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\u0600-\u06FF-]+/g, '-') || 'product';
      return new File([blob], `${safeName}.${ext}`, { type: outType });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // أي خطأ في الضغط → نرسل الملف الأصلي بدل ما يضيع منتج المستخدم
    return file;
  }
};