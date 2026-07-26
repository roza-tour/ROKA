import 'server-only';

import type { PdfBuilder } from './doc';

/**
 * علامة ROKA مرسومة بمتّجهات pdfkit مباشرةً — لا صورة نقطية.
 *
 * السبب: العلامة تُطبع عند 8mm تقريباً في ترويسة الفاتورة، وأي PNG بهذا
 * الحجم يظهر مهترئاً على الطابعات الليزرية (600dpi وما فوق). المتّجه يبقى
 * حادّاً عند أي دقّة، وحجم الملف أصغر.
 *
 * الشكل مطابق لما في src/components/brand.tsx و public/icon.svg —
 * أي تعديل يجب أن يطال الثلاثة معاً.
 */

/** إحداثيات الشكل في مربّع 64×64 — نفس مسارات BRAND_PATHS */
const HEX: [number, number][] = [
  [32, 11],
  [49.3, 21],
  [49.3, 41],
  [32, 51],
  [14.7, 41],
  [14.7, 21],
];

/** نقاط خطّ النبض بالترتيب */
const PULSE: [number, number][] = [
  [21.5, 33],
  [26, 33],
  [29.5, 24],
  [34, 39.5],
  [37, 33],
  [43, 33],
];

export interface BrandMarkOptions {
  /** طول ضلع المربّع بالنقاط */
  size: number;
  /** لون العلامة — الافتراضي أسود للطباعة */
  color?: string;
  /** لون خلفية المربّع المستدير؛ اتركه فارغاً لعلامة بلا خلفية */
  background?: string | null;
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
  const { size, color = '#000000', background = null } = options;
  const scale = size / 64;
  const px = (n: number) => x + n * scale;
  const py = (n: number) => y + n * scale;

  const doc = builder.doc;
  doc.save();

  if (background) {
    doc.roundedRect(x, y, size, size, 15 * scale).fillColor(background).fill();
  }

  doc.lineWidth(3.2 * scale).strokeColor(color).lineJoin('round').lineCap('round');

  // السداسي — مضلّع مغلق
  doc.moveTo(px(HEX[0][0]), py(HEX[0][1]));
  for (const [hx, hy] of HEX.slice(1)) doc.lineTo(px(hx), py(hy));
  doc.closePath().stroke();

  // خطّ النبض — مسار مفتوح
  doc.moveTo(px(PULSE[0][0]), py(PULSE[0][1]));
  for (const [lx, ly] of PULSE.slice(1)) doc.lineTo(px(lx), py(ly));
  doc.stroke();

  doc.restore();
}
