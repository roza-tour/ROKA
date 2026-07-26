import 'server-only';

/**
 * تصدير البيانات إلى CSV و Excel.
 *
 * ملاحظة عن PDF: توليد PDF بالعربية على الخادم يتطلب تشكيل الحروف
 * (Arabic shaping) وخطوطاً مضمّنة، وهو ما لا تدعمه مكتبات PDF الخفيفة
 * بجودة كافية. لذلك يعتمد النظام على «الطباعة إلى PDF» من المتصفح
 * عبر صفحات مخصّصة للطباعة — النتيجة أدق وتحترم اتجاه النص.
 */

export interface ExportColumn<T> {
  key: string;
  header: string;
  /** استخراج القيمة من الصف */
  value: (row: T) => string | number | Date | null | undefined;
  /** عرض العمود في Excel (بالأحرف) */
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'date';
}

/** ترميز حقل CSV بأمان */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);

  // منع حقن الصيغ في Excel/Sheets
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** توليد ملف CSV (مع BOM حتى يعرض Excel العربية بشكل صحيح) */
export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvCell(c.value(row))).join(','))
    .join('\r\n');
  return `﻿${header}\r\n${body}`;
}

/** توليد ملف Excel (xlsx) */
export async function toExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  options: {
    sheetName?: string;
    title?: string;
    subtitle?: string;
    currency?: string;
    rtl?: boolean;
  } = {},
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ROKA ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(options.sheetName ?? 'Data', {
    views: [{ rightToLeft: options.rtl ?? true, state: 'frozen', ySplit: options.title ? 3 : 1 }],
  });

  let headerRowIndex = 1;

  // عنوان التقرير
  if (options.title) {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = options.title;
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    if (options.subtitle) {
      sheet.mergeCells(2, 1, 2, columns.length);
      const subtitleCell = sheet.getCell(2, 1);
      subtitleCell.value = options.subtitle;
      subtitleCell.font = { size: 10, color: { argb: 'FF666666' } };
      subtitleCell.alignment = { horizontal: 'center' };
    }
    headerRowIndex = options.subtitle ? 3 : 2;
  }

  // رأس الجدول
  const headerRow = sheet.getRow(headerRowIndex);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.height = 20;

  // البيانات
  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
    columns.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      const value = column.value(row);
      cell.value = value ?? '';

      if (column.type === 'currency') {
        cell.numFmt = `#,##0.00 "${options.currency ?? ''}"`;
        cell.alignment = { horizontal: 'left' };
      } else if (column.type === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'center' };
      } else if (column.type === 'date' && value instanceof Date) {
        cell.numFmt = 'yyyy-mm-dd';
        cell.alignment = { horizontal: 'center' };
      }

      cell.border = {
        top: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      };

      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  // عرض الأعمدة
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width ?? Math.max(12, column.header.length + 4);
  });

  // مرشّح تلقائي
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex + rows.length, column: columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** رأس الاستجابة لتحميل ملف */
export function downloadHeaders(filename: string, contentType: string): HeadersInit {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Cache-Control': 'no-store',
  };
}

export const CONTENT_TYPES = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json; charset=utf-8',
} as const;
