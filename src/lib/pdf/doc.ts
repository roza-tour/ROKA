import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

import { drawText, drawParagraph, paragraphHeight, textWidth } from './text';
import type { Align, Direction } from './text';

/**
 * غلاف رقيق حول pdfkit يوفّر لبنات بناء المستندات: ترويسة، صناديق،
 * جداول، وتذييل بترقيم الصفحات — كلها واعية للاتجاه (RTL/LTR).
 *
 * كل القياسات بالنقطة (pt): صفحة A4 = 595.28 × 841.89
 */

export type PdfDoc = InstanceType<typeof PDFDocument>;

// ------------------------------------------------------------------ الخطوط

/**
 * IBM Plex Sans Arabic — رخصة OFL، يغطي العربية واللاتينية معاً بخط واحد،
 * فلا نحتاج تبديل خطوط عند اختلاط اللغات داخل السطر.
 */
const FONT_FILES = {
  body: 'IBMPlexSansArabic-Regular.ttf',
  bold: 'IBMPlexSansArabic-SemiBold.ttf',
} as const;

export type FontName = keyof typeof FONT_FILES;

const fontCache = new Map<string, Buffer>();

function fontPath(file: string): string {
  // في وضع standalone يتغيّر جذر التنفيذ، لذا نجرّب أكثر من مسار
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', file),
    path.join(process.cwd(), '..', '..', 'assets', 'fonts', file),
    path.join(process.cwd(), '.next', 'standalone', 'assets', 'fonts', file),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `ملف الخط غير موجود: ${file}. تأكد أن مجلد assets/fonts مرفوع مع التطبيق ` +
      `(راجع outputFileTracingIncludes في next.config.ts).`,
  );
}

function loadFont(name: FontName): Buffer {
  const cached = fontCache.get(name);
  if (cached) return cached;
  const buffer = fs.readFileSync(fontPath(FONT_FILES[name]));
  fontCache.set(name, buffer);
  return buffer;
}

// ------------------------------------------------------------------ الألوان

export const COLORS = {
  ink: '#111827',
  body: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#d1d5db',
  hairline: '#e5e7eb',
  fill: '#f3f4f6',
  accent: '#0f172a',
  danger: '#b91c1c',
  success: '#047857',
} as const;

// ------------------------------------------------------------------ الباني

export interface PdfBuilderOptions {
  size?: 'A4' | 'A5' | [number, number];
  margin?: number;
  baseDir?: Direction;
  title?: string;
  author?: string;
  /** نص يظهر في تذييل كل صفحة */
  footerNote?: string;
  /** تسمية «صفحة {x} من {y}» */
  pageLabel?: (current: number, total: number) => string;
}

export class PdfBuilder {
  readonly doc: PdfDoc;
  readonly baseDir: Direction;
  readonly margin: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;

  private readonly footerNote: string;
  private readonly pageLabel: (current: number, total: number) => string;
  private readonly chunks: Buffer[] = [];
  private readonly finished: Promise<Buffer>;

  /** أقصى إحداثي y يمكن الرسم عنده قبل الحاجة لصفحة جديدة */
  get bottomLimit(): number {
    return this.pageHeight - this.margin - 26;
  }

  constructor(options: PdfBuilderOptions = {}) {
    this.margin = options.margin ?? 36;
    this.baseDir = options.baseDir ?? 'rtl';
    this.footerNote = options.footerNote ?? '';
    this.pageLabel = options.pageLabel ?? ((c, t) => `${c} / ${t}`);

    this.doc = new PDFDocument({
      size: options.size ?? 'A4',
      margin: this.margin,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: options.title ?? 'ROKA',
        Author: options.author ?? 'ROKA ERP',
        Creator: 'ROKA ERP',
      },
    });

    this.doc.registerFont('body', loadFont('body'));
    this.doc.registerFont('bold', loadFont('bold'));
    this.doc.font('body').fontSize(9).fillColor(COLORS.body);

    this.pageWidth = this.doc.page.width;
    this.pageHeight = this.doc.page.height;
    this.contentWidth = this.pageWidth - this.margin * 2;

    this.finished = new Promise<Buffer>((resolve, reject) => {
      this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
    });
  }

  // ---------------------------------------------------------- أدوات أساسية

  font(name: FontName, size?: number, color?: string): this {
    this.doc.font(name);
    if (size !== undefined) this.doc.fontSize(size);
    if (color !== undefined) this.doc.fillColor(color);
    return this;
  }

  /**
   * إحداثي x لمنطقة فرعية بعرض `part` توضع في **جهة بداية القراءة** داخل
   * صندوق يبدأ عند `x` بعرض `width`.
   *
   * الإحداثيات في PDF تزيد دائماً نحو اليمين بغضّ النظر عن اتجاه اللغة،
   * لذا في RTL تكون بداية القراءة هي الحافة اليمنى للصندوق.
   */
  regionStart(x: number, width: number, part: number): number {
    return this.baseDir === 'rtl' ? x + width - part : x;
  }

  /** إحداثي x لمنطقة فرعية توضع في جهة نهاية القراءة */
  regionEnd(x: number, width: number, part: number): number {
    return this.baseDir === 'rtl' ? x : x + width - part;
  }

  /** المحاذاة الفعلية المقابلة لـ «نهاية السطر» */
  get endAlign(): 'left' | 'right' {
    return this.baseDir === 'rtl' ? 'left' : 'right';
  }

  text(
    value: string,
    x: number,
    y: number,
    width: number,
    options: { align?: Align; ellipsis?: boolean } = {},
  ): number {
    return drawText(this.doc, value, x, y, width, { ...options, baseDir: this.baseDir });
  }

  paragraph(
    value: string,
    x: number,
    y: number,
    width: number,
    options: { align?: Align; lineGap?: number; maxLines?: number } = {},
  ): number {
    return drawParagraph(this.doc, value, x, y, width, { ...options, baseDir: this.baseDir });
  }

  measureParagraph(value: string, width: number, lineGap = 2): number {
    return paragraphHeight(this.doc, value, width, { lineGap });
  }

  widthOf(value: string): number {
    return textWidth(this.doc, value, this.baseDir);
  }

  line(y: number, color = COLORS.hairline, width = 0.5): this {
    this.doc
      .save()
      .lineWidth(width)
      .strokeColor(color)
      .moveTo(this.margin, y)
      .lineTo(this.pageWidth - this.margin, y)
      .stroke()
      .restore();
    return this;
  }

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    options: { fill?: string; stroke?: string; radius?: number; lineWidth?: number } = {},
  ): this {
    const { fill, stroke, radius = 0, lineWidth = 0.5 } = options;
    this.doc.save().lineWidth(lineWidth);
    if (radius > 0) this.doc.roundedRect(x, y, width, height, radius);
    else this.doc.rect(x, y, width, height);

    if (fill && stroke) this.doc.fillColor(fill).strokeColor(stroke).fillAndStroke();
    else if (fill) this.doc.fillColor(fill).fill();
    else if (stroke) this.doc.strokeColor(stroke).stroke();
    this.doc.restore();
    return this;
  }

  image(dataUrl: string, x: number, y: number, options: { width?: number; height?: number }): boolean {
    if (!dataUrl?.startsWith('data:image/')) return false;
    try {
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      this.doc.image(Buffer.from(base64, 'base64'), x, y, options);
      return true;
    } catch (error) {
      console.error('[pdf] تعذّر إدراج صورة:', error);
      return false;
    }
  }

  /** يبدأ صفحة جديدة ويُرجع إحداثي y للبداية */
  newPage(): number {
    this.doc.addPage({ margin: this.margin });
    this.doc.font('body').fontSize(9).fillColor(COLORS.body);
    return this.margin;
  }

  /** يضمن توفّر مساحة `needed`، وإلا ينتقل لصفحة جديدة */
  ensureSpace(y: number, needed: number): number {
    return y + needed > this.bottomLimit ? this.newPage() : y;
  }

  // ------------------------------------------------------------- لبنات جاهزة

  /** عنوان قسم مع خط سفلي رفيع */
  sectionTitle(title: string, y: number, width = this.contentWidth, x = this.margin): number {
    this.font('bold', 9.5, COLORS.ink);
    this.text(title, x, y, width, { align: 'start' });
    const bottom = y + 13;
    this.doc
      .save()
      .lineWidth(0.5)
      .strokeColor(COLORS.hairline)
      .moveTo(x, bottom)
      .lineTo(x + width, bottom)
      .stroke()
      .restore();
    this.font('body', 8.5, COLORS.body);
    return bottom + 5;
  }

  /**
   * صف «تسمية : قيمة» داخل صندوق.
   * التسمية عند بداية السطر والقيمة عند نهايته.
   */
  labelValue(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    options: { valueBold?: boolean; valueColor?: string; ltrValue?: boolean } = {},
  ): number {
    this.font('body', 8, COLORS.muted);
    const labelWidth = Math.min(width * 0.5, this.widthOf(label) + 4);

    // التسمية في جهة بداية القراءة، القيمة في الجهة المقابلة
    this.text(label, this.regionStart(x, width, labelWidth), y, labelWidth, { align: 'start' });

    this.font(options.valueBold ? 'bold' : 'body', 8.5, options.valueColor ?? COLORS.ink);
    const valueWidth = width - labelWidth - 4;
    const valueX = this.regionEnd(x, width, valueWidth);

    if (options.ltrValue) {
      // أرقام الهواتف والمعرّفات تُقرأ دائماً من اليسار
      drawText(this.doc, value, valueX, y, valueWidth, {
        align: this.endAlign,
        baseDir: 'ltr',
        ellipsis: true,
      });
    } else {
      this.text(value, valueX, y, valueWidth, { align: 'end', ellipsis: true });
    }

    this.font('body', 8.5, COLORS.body);
    return y + 12;
  }

  /** يرسم التذييل وترقيم الصفحات على كل الصفحات ثم يُنهي المستند */
  async finalize(): Promise<Buffer> {
    const range = this.doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(range.start + i);
      const y = this.pageHeight - this.margin - 14;

      this.doc
        .save()
        .lineWidth(0.5)
        .strokeColor(COLORS.hairline)
        .moveTo(this.margin, y - 4)
        .lineTo(this.pageWidth - this.margin, y - 4)
        .stroke()
        .restore();

      this.font('body', 7, COLORS.faint);
      if (this.footerNote) {
        this.text(this.footerNote, this.margin, y, this.contentWidth * 0.7, {
          align: 'start',
          ellipsis: true,
        });
      }
      drawText(
        this.doc,
        this.pageLabel(i + 1, range.count),
        this.margin,
        y,
        this.contentWidth,
        { align: this.baseDir === 'rtl' ? 'left' : 'right', baseDir: 'ltr' },
      );
    }

    this.doc.end();
    return this.finished;
  }
}

// ------------------------------------------------------------------ الجداول

export interface TableColumn<Row> {
  /** عنوان العمود */
  header: string;
  /** نسبة العرض من عرض الجدول (المجموع = 1) */
  width: number;
  align?: Align;
  /** هل تُقرأ القيمة من اليسار دائماً (أرقام، مبالغ، تواريخ)؟ */
  ltr?: boolean;
  bold?: boolean;
  value: (row: Row, index: number) => string;
  /** سطر ثانوي أصغر تحت القيمة */
  sub?: (row: Row, index: number) => string | null;
}

export interface TableOptions {
  headerFill?: string;
  zebra?: boolean;
  rowPadding?: number;
  fontSize?: number;
}

/**
 * يرسم جدولاً مع ترحيل تلقائي للصفحات وإعادة رسم الترويسة في كل صفحة.
 * يُرجع إحداثي y بعد الجدول.
 */
export function drawTable<Row>(
  builder: PdfBuilder,
  columns: TableColumn<Row>[],
  rows: Row[],
  x: number,
  y: number,
  width: number,
  options: TableOptions = {},
): number {
  const { headerFill = COLORS.fill, zebra = true, rowPadding = 5, fontSize = 8 } = options;
  const rtl = builder.baseDir === 'rtl';

  // في الاتجاه من اليمين لليسار يبدأ العمود الأول من أقصى اليمين
  const ordered = rtl ? columns.slice().reverse() : columns;
  const widths = ordered.map((column) => column.width * width);
  const offsets: number[] = [];
  let acc = 0;
  for (const columnWidth of widths) {
    offsets.push(x + acc);
    acc += columnWidth;
  }

  const headerHeight = fontSize + rowPadding * 2;

  const drawHeader = (top: number): number => {
    builder.rect(x, top, width, headerHeight, { fill: headerFill, stroke: COLORS.line });
    builder.font('bold', fontSize, COLORS.ink);
    ordered.forEach((column, index) => {
      builder.text(column.header, offsets[index] + 4, top + rowPadding, widths[index] - 8, {
        align: column.align ?? 'start',
        ellipsis: true,
      });
    });
    return top + headerHeight;
  };

  let cursor = drawHeader(y);

  rows.forEach((row, rowIndex) => {
    // ارتفاع الصف = أطول خلية فيه
    builder.font('body', fontSize);
    let rowHeight = fontSize + rowPadding * 2;
    for (let i = 0; i < ordered.length; i++) {
      const column = ordered[i];
      const main = builder.measureParagraph(column.value(row, rowIndex), widths[i] - 8, 1);
      const subText = column.sub?.(row, rowIndex);
      const sub = subText ? builder.measureParagraph(subText, widths[i] - 8, 1) * 0.85 : 0;
      rowHeight = Math.max(rowHeight, main + sub + rowPadding * 2);
    }

    if (cursor + rowHeight > builder.bottomLimit) {
      cursor = builder.newPage();
      cursor = drawHeader(cursor);
    }

    if (zebra && rowIndex % 2 === 1) {
      builder.rect(x, cursor, width, rowHeight, { fill: '#fafafa' });
    }
    builder.rect(x, cursor, width, rowHeight, { stroke: COLORS.hairline });

    ordered.forEach((column, index) => {
      const cellX = offsets[index] + 4;
      const cellWidth = widths[index] - 8;
      const value = column.value(row, rowIndex);

      builder.font(column.bold ? 'bold' : 'body', fontSize, COLORS.ink);
      let innerY = cursor + rowPadding;

      if (column.ltr) {
        drawText(builder.doc, value, cellX, innerY, cellWidth, {
          align: column.align === 'start' ? (rtl ? 'right' : 'left') : (column.align ?? 'left'),
          baseDir: 'ltr',
          ellipsis: true,
        });
        innerY += builder.doc.currentLineHeight() + 1;
      } else {
        innerY += builder.paragraph(value, cellX, innerY, cellWidth, {
          align: column.align ?? 'start',
          lineGap: 1,
        });
      }

      const subText = column.sub?.(row, rowIndex);
      if (subText) {
        builder.font('body', fontSize - 1.2, COLORS.muted);
        builder.paragraph(subText, cellX, innerY, cellWidth, {
          align: column.align ?? 'start',
          lineGap: 1,
          maxLines: 2,
        });
      }
    });

    cursor += rowHeight;
  });

  builder.font('body', 8.5, COLORS.body);
  return cursor;
}
