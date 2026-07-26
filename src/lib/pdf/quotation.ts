import 'server-only';

import type { Prisma } from '@prisma/client';

import { PdfBuilder, drawTable, COLORS, type TableColumn } from './doc';
import { drawText } from './text';
import { drawShopHeader, signatureBlock, summaryRows } from './shared';
import { getFinanceSettings, getShopInfo, getSettings } from '../settings';
import { formatMoney, formatDate, fullName } from '../utils';
import { getDictionary, getDirection, type Locale } from '@/i18n';

export type QuotationForPdf = Prisma.QuotationGetPayload<{
  include: {
    customer: true;
    device: true;
    user: { select: { fullName: true } };
    items: true;
  };
}>;

/** عرض سعر — نفس هيكل الفاتورة مع تاريخ صلاحية بدل المدفوعات */
export async function buildQuotationPdf(
  quotation: QuotationForPdf,
  locale: Locale = 'ar',
): Promise<Buffer> {
  const t = getDictionary(locale);
  const baseDir = getDirection(locale);
  const [finance, shop, settings] = await Promise.all([
    getFinanceSettings(),
    getShopInfo(),
    getSettings(),
  ]);

  const money = (value: number) =>
    formatMoney(value, { currency: finance.currency, decimals: finance.decimals, locale });

  const terms = quotation.terms || settings['invoice.terms'] || '';

  const builder = new PdfBuilder({
    baseDir,
    title: `${t.quotation.single} ${quotation.number}`,
    footerNote: shop.name,
  });

  const { margin, contentWidth } = builder;

  let y = drawShopHeader(builder, shop, {
    documentTitle: t.quotation.single,
    documentNumber: quotation.number,
    subtitle: formatDate(quotation.createdAt, locale),
    taxLabel: t.customer.taxNumber,
  });

  // ----------------------------------------------------- العميل + بيانات العرض
  const gap = 10;
  const boxWidth = (contentWidth - gap) / 2;
  const leftX = margin;
  const rightX = margin + boxWidth + gap;
  const firstX = baseDir === 'rtl' ? rightX : leftX;
  const secondX = baseDir === 'rtl' ? leftX : rightX;

  const customerRows: [string, string, boolean][] = quotation.customer
    ? [
        [
          t.customer.fullName,
          fullName(quotation.customer.firstName, quotation.customer.lastName),
          false,
        ],
        [t.customer.phone, quotation.customer.phone, true],
      ]
    : [[t.invoice.walkIn, '—', false]];

  const detailRows: [string, string, boolean][] = [
    [t.invoice.issuedAt, formatDate(quotation.createdAt, locale), true],
  ];
  if (quotation.validUntil) {
    detailRows.push([t.quotation.validUntil, formatDate(quotation.validUntil, locale), true]);
  }
  if (quotation.device) {
    detailRows.push([
      t.device.single,
      [quotation.device.brand, quotation.device.model].filter(Boolean).join(' '),
      false,
    ]);
  }
  if (quotation.user) detailRows.push([t.audit.user, quotation.user.fullName, false]);

  const rowsCount = Math.max(customerRows.length, detailRows.length);
  const boxHeight = 20 + rowsCount * 12 + 6;

  for (const [boxX, title, rows] of [
    [firstX, t.invoice.customer, customerRows],
    [secondX, t.app.details, detailRows],
  ] as const) {
    builder.rect(boxX, y, boxWidth, boxHeight, { stroke: COLORS.line, radius: 3 });
    builder.font('bold', 8.5, COLORS.ink);
    builder.text(title, boxX + 8, y + 6, boxWidth - 16, { align: 'start' });
    let rowY = y + 20;
    for (const [label, value, ltr] of rows) {
      rowY = builder.labelValue(label, value, boxX + 8, rowY, boxWidth - 16, { ltrValue: ltr });
    }
  }
  y += boxHeight + 12;

  // ---------------------------------------------------------------- البنود
  const columns: TableColumn<QuotationForPdf['items'][number]>[] = [
    { header: '#', width: 0.06, align: 'center', ltr: true, value: (_r, i) => String(i + 1) },
    {
      header: t.invoice.item,
      width: 0.48,
      align: 'start',
      value: (row) => row.name,
      sub: (row) => row.description,
    },
    {
      header: t.invoice.quantity,
      width: 0.1,
      align: 'center',
      ltr: true,
      value: (row) => String(row.quantity),
    },
    {
      header: t.invoice.unitPrice,
      width: 0.18,
      align: 'end',
      ltr: true,
      value: (row) => money(row.unitPrice),
    },
    {
      header: t.app.total,
      width: 0.18,
      align: 'end',
      ltr: true,
      bold: true,
      value: (row) => money(row.total),
    },
  ];

  y = drawTable(builder, columns, quotation.items, margin, y, contentWidth);
  y += 12;

  // -------------------------------------------------------------- المجاميع
  const summary: { label: string; value: string; strong?: boolean }[] = [
    { label: t.app.subtotal, value: money(quotation.subtotal) },
  ];
  if (quotation.discountAmount > 0) {
    summary.push({ label: t.invoice.discount, value: `− ${money(quotation.discountAmount)}` });
  }
  if (quotation.taxAmount > 0) {
    summary.push({
      label: `${t.invoice.tax} ${quotation.taxRate}%`,
      value: money(quotation.taxAmount),
    });
  }
  summary.push({ label: t.app.total, value: money(quotation.total), strong: true });

  const summaryWidth = 210;
  y = builder.ensureSpace(y, summary.length * 16 + 80);
  const summaryX = baseDir === 'rtl' ? margin : margin + contentWidth - summaryWidth;

  const summaryY = summaryRows(builder, summary, summaryX, y, summaryWidth);

  y = summaryY + 12;

  // ------------------------------------------------------ الملاحظات والشروط
  for (const [title, body] of [
    [t.invoice.notes, quotation.notes ?? ''],
    [t.invoice.terms, terms],
  ] as const) {
    if (!body) continue;
    builder.font('body', 7.5);
    const height = builder.measureParagraph(body, contentWidth - 16) + 22;
    y = builder.ensureSpace(y, height);
    builder.rect(margin, y, contentWidth, height, {
      fill: '#fafafa',
      stroke: COLORS.hairline,
      radius: 3,
    });
    builder.font('bold', 8, COLORS.ink);
    builder.text(title, margin + 8, y + 6, contentWidth - 16, { align: 'start' });
    builder.font('body', 7.5, COLORS.muted);
    builder.paragraph(body, margin + 8, y + 18, contentWidth - 16, { align: 'start' });
    y += height + 8;
  }

  y = builder.ensureSpace(y, 70);
  signatureBlock(builder, y + 10, [
    { title: t.invoice.customer, caption: t.pdf.signature },
    { title: shop.name, caption: t.pdf.signatureAndStamp },
  ]);

  return builder.finalize();
}
