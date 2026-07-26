import 'server-only';

import { PdfBuilder, COLORS } from './doc';
import { drawText } from './text';
import { drawBrandMark } from './brand';
import type { ShopInfo } from '../settings';

export { appUrl } from './kinds';

export interface ShopHeaderOptions {
  documentTitle: string;
  documentNumber: string;
  barcode?: string;
  taxLabel: string;
  /** سطر إضافي تحت رقم المستند (تاريخ مثلاً) */
  subtitle?: string;
}

/**
 * ترويسة موحّدة: بيانات المحل في جهة البداية، ونوع المستند ورقمه
 * والباركود في الجهة المقابلة، يفصلها خط سميك.
 */
export function drawShopHeader(
  builder: PdfBuilder,
  shop: ShopInfo,
  options: ShopHeaderOptions,
): number {
  const { margin, contentWidth, baseDir } = builder;
  const top = margin;
  const rtl = baseDir === 'rtl';

  const rightBlockWidth = 190;
  const leftBlockWidth = contentWidth - rightBlockWidth - 12;

  const shopX = rtl ? margin + rightBlockWidth + 12 : margin;
  const docX = rtl ? margin : margin + leftBlockWidth + 12;

  // ------------------------------------------------------------ بيانات المحل
  // العلامة ثم الاسم على نفس السطر، والعلامة في جهة بداية القراءة
  const markSize = 26;
  const markX = rtl ? shopX + leftBlockWidth - markSize : shopX;
  drawBrandMark(builder, markX, top - 2, {
    size: markSize,
    color: '#ffffff',
    background: COLORS.accent,
  });

  const nameX = rtl ? shopX : shopX + markSize + 8;
  const nameWidth = leftBlockWidth - markSize - 8;

  builder.font('bold', 16, COLORS.ink);
  let shopY = top;
  builder.text(shop.name, nameX, shopY + 3, nameWidth, { align: 'start', ellipsis: true });
  shopY += 22;

  if (shop.legalName) {
    builder.font('body', 7.5, COLORS.muted);
    builder.text(shop.legalName, shopX, shopY, leftBlockWidth, { align: 'start', ellipsis: true });
    shopY += 10;
  }

  builder.font('body', 7.5, COLORS.body);
  if (shop.address) {
    shopY += builder.paragraph(shop.address, shopX, shopY, leftBlockWidth, {
      align: 'start',
      maxLines: 2,
      lineGap: 1,
    });
  }

  const contact = [shop.phone, shop.phone2].filter(Boolean).join('  ·  ');
  if (contact) {
    drawText(builder.doc, contact, shopX, shopY, leftBlockWidth, {
      align: rtl ? 'right' : 'left',
      baseDir: 'ltr',
    });
    shopY += 10;
  }
  if (shop.email) {
    drawText(builder.doc, shop.email, shopX, shopY, leftBlockWidth, {
      align: rtl ? 'right' : 'left',
      baseDir: 'ltr',
    });
    shopY += 10;
  }
  if (shop.taxNumber) {
    builder.font('body', 7.5, COLORS.muted);
    builder.text(`${options.taxLabel}: ${shop.taxNumber}`, shopX, shopY, leftBlockWidth, {
      align: 'start',
    });
    shopY += 10;
  }

  // ------------------------------------------------------------ نوع المستند
  let docY = top;
  builder.font('bold', 11, COLORS.ink);
  builder.text(options.documentTitle, docX, docY, rightBlockWidth, {
    align: 'center',
    ellipsis: true,
  });
  docY += 16;

  builder.font('bold', 14, COLORS.accent);
  drawText(builder.doc, options.documentNumber, docX, docY, rightBlockWidth, {
    align: 'center',
    baseDir: 'ltr',
  });
  docY += 18;

  if (options.subtitle) {
    builder.font('body', 7.5, COLORS.muted);
    drawText(builder.doc, options.subtitle, docX, docY, rightBlockWidth, {
      align: 'center',
      baseDir: 'ltr',
    });
    docY += 11;
  }

  if (options.barcode) {
    const barcodeWidth = 150;
    if (
      builder.image(options.barcode, docX + (rightBlockWidth - barcodeWidth) / 2, docY, {
        width: barcodeWidth,
        height: 30,
      })
    ) {
      docY += 34;
    }
  }

  const bottom = Math.max(shopY, docY) + 4;
  builder.doc
    .save()
    .lineWidth(1.4)
    .strokeColor(COLORS.accent)
    .moveTo(margin, bottom)
    .lineTo(margin + contentWidth, bottom)
    .stroke()
    .restore();

  builder.font('body', 8.5, COLORS.body);
  return bottom + 10;
}

export interface SummaryRow {
  label: string;
  value: string;
  /** صف مميّز بخلفية وخط عريض (الإجمالي، المتبقي) */
  strong?: boolean;
}

/**
 * جدول المجاميع: التسمية في جهة بداية القراءة والمبلغ في الجهة المقابلة
 * — المبلغ يُرسم دائماً باتجاه LTR حتى لا تنقلب الفواصل والأرقام.
 * يُرجع إحداثي y بعد آخر صف.
 */
export function summaryRows(
  builder: PdfBuilder,
  rows: SummaryRow[],
  x: number,
  y: number,
  width: number,
  rowHeight = 16,
): number {
  const labelWidth = width * 0.55;
  const valueWidth = width * 0.45 - 6;

  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    builder.rect(x, rowY, width, rowHeight, {
      fill: row.strong ? COLORS.fill : undefined,
      stroke: COLORS.hairline,
    });

    builder.font(row.strong ? 'bold' : 'body', 8.5, row.strong ? COLORS.ink : COLORS.body);
    builder.text(
      row.label,
      builder.regionStart(x + 6, width - 12, labelWidth),
      rowY + 4,
      labelWidth,
      { align: 'start', ellipsis: true },
    );

    drawText(
      builder.doc,
      row.value,
      builder.regionEnd(x + 6, width - 12, valueWidth),
      rowY + 4,
      valueWidth,
      { align: builder.endAlign, baseDir: 'ltr' },
    );
  });

  return y + rows.length * rowHeight;
}

export interface SignatureSlot {
  title: string;
  caption: string;
  /** صورة توقيع بصيغة data URL — تُرسم فوق الخط إن وُجدت */
  image?: string | null;
}

/** صفّ خانات توقيع موزّعة بالتساوي على عرض الصفحة */
export function signatureBlock(
  builder: PdfBuilder,
  y: number,
  slots: SignatureSlot[],
): number {
  const { margin, contentWidth } = builder;
  const gap = 24;
  const slotWidth = (contentWidth - gap * (slots.length - 1)) / slots.length;

  slots.forEach((slot, index) => {
    const x = margin + index * (slotWidth + gap);

    builder.font('body', 8, COLORS.body);
    builder.text(slot.title, x, y, slotWidth, { align: 'center', ellipsis: true });

    if (slot.image) {
      builder.image(slot.image, x + slotWidth / 2 - 45, y + 12, { width: 90, height: 34 });
    }

    const lineY = y + 50;
    builder.doc
      .save()
      .lineWidth(0.6)
      .strokeColor(COLORS.line)
      .moveTo(x, lineY)
      .lineTo(x + slotWidth, lineY)
      .stroke()
      .restore();

    builder.font('body', 7, COLORS.faint);
    builder.text(slot.caption, x, lineY + 3, slotWidth, { align: 'center' });
  });

  return y + 66;
}
