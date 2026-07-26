import 'server-only';

import type { PdfBuilder } from './doc';

/**
 * علامة FIXEL مرسومة بمتّجهات pdfkit مباشرةً — لا صورة نقطية.
 *
 * السبب: العلامة تُطبع عند 8mm تقريباً في ترويسة الفاتورة، وأي PNG بهذا
 * الحجم يظهر مهترئاً على الطابعات الليزرية (600dpi وما فوق). المتّجه يبقى
 * حادّاً عند أي دقّة، وحجم الملف أصغر.
 *
 * الشكل مطابق لما في src/components/brand.tsx و public/icon.svg —
 * أي تعديل يجب أن يطال الثلاثة معاً.
 */

/** البكسلات الثلاثة الممتلئة في مربّع 64×64 */
const FILLED: [number, number][] = [
  [14, 14],
  [34, 14],
  [14, 34],
];
const PIXEL = 16;
const RADIUS = 4;

/** البكسل الرابع — بحدّ فقط، «في طريقه للعودة» */
const RESTORED = { x: 35.6, y: 35.6, size: 12.8, radius: 3, stroke: 3.2 };

export interface BrandMarkOptions {
  /** طول ضلع المربّع بالنقاط */
  size: number;
  /** لون البكسلات — الافتراضي أسود للطباعة */
  color?: string;
  /** لون خلفية المربّع المستدير؛ اتركه فارغاً لعلامة بلا خلفية */
  background?: string | null;
  /** لون حدّ البكسل العائد — يرث `color` إن لم يُحدَّد */
  outline?: string;
}

/**
 * يرسم العلامة عند (x, y). القياسات كلها نسبية إلى `size`
 * فتبقى النسب صحيحة عند أي حجم.
 */
export function drawBrandMark(
  builder: PdfBuilder,
  x: number,
  y: number,
  options: BrandMarkOptions,
): void {
  const { size, color = '#000000', background = null, outline } = options;
  const scale = size / 64;
  const px = (n: number) => x + n * scale;
  const py = (n: number) => y + n * scale;

  const doc = builder.doc;
  doc.save();

  if (background) {
    doc.roundedRect(x, y, size, size, 15 * scale).fillColor(background).fill();
  }

  // البكسلات الممتلئة
  doc.fillColor(color);
  for (const [cx, cy] of FILLED) {
    doc.roundedRect(px(cx), py(cy), PIXEL * scale, PIXEL * scale, RADIUS * scale).fill();
  }

  // البكسل العائد — حدّ فقط
  doc
    .lineWidth(RESTORED.stroke * scale)
    .strokeColor(outline ?? color)
    .roundedRect(
      px(RESTORED.x),
      py(RESTORED.y),
      RESTORED.size * scale,
      RESTORED.size * scale,
      RESTORED.radius * scale,
    )
    .stroke();

  doc.restore();
}
