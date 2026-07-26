import 'server-only';

import type { Prisma } from '@prisma/client';

import { PdfBuilder, drawTable, COLORS, type TableColumn } from './doc';
import { drawText } from './text';
import { getFinanceSettings, getShopInfo, getSettings } from '../settings';
import { generateQrDataUrl, generateBarcodeDataUrl } from '../codes';
import { formatMoney, formatDate, formatDateTime, fullName } from '../utils';
import { getDictionary, getDirection, type Locale } from '@/i18n';
import type { InvoiceType, PaymentMethod } from '../constants';
import { drawShopHeader, signatureBlock, summaryRows, appUrl } from './shared';

export type InvoiceForPdf = Prisma.InvoiceGetPayload<{
  include: {
    customer: true;
    user: { select: { fullName: true } };
    repairOrder: { select: { number: true } };
    items: true;
    payments: true;
  };
}>;

/** يبني ملف PDF لفاتورة — نفس محتوى صفحة الطباعة تماماً */
export async function buildInvoicePdf(
  invoice: InvoiceForPdf,
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

  const [qr, barcode] = await Promise.all([
    generateQrDataUrl(
      `${appUrl()}/invoices/${invoice.id}|${invoice.number}|${invoice.total}`,
      { size: 160 },
    ),
    generateBarcodeDataUrl(invoice.number, { height: 7, scale: 2 }),
  ]);

  const terms = invoice.terms || settings['invoice.terms'] || '';
  const footerNote = settings['invoice.footer'] || '';

  const builder = new PdfBuilder({
    baseDir,
    title: `${t.invoice.single} ${invoice.number}`,
    footerNote: shop.name,
    pageLabel: (current, total) => `${current} / ${total}`,
  });

  const { margin, contentWidth } = builder;
  let y = margin;

  // ------------------------------------------------------------- الترويسة
  y = drawShopHeader(builder, shop, {
    documentTitle: `${t.invoice.single} · ${t.invoice.types[invoice.type as InvoiceType] ?? invoice.type}`,
    documentNumber: invoice.number,
    barcode,
    taxLabel: t.customer.taxNumber,
  });

  // -------------------------------------------------- العميل + تفاصيل الفاتورة
  const boxGap = 10;
  const boxWidth = (contentWidth - boxGap) / 2;
  const boxTop = y;

  const customerLines: [string, string, boolean][] = [];
  if (invoice.customer) {
    customerLines.push([
      t.customer.fullName,
      fullName(invoice.customer.firstName, invoice.customer.lastName),
      false,
    ]);
    customerLines.push([t.customer.phone, invoice.customer.phone, true]);
    if (invoice.customer.address) {
      customerLines.push([t.customer.address, invoice.customer.address, false]);
    }
    if (invoice.customer.taxNumber) {
      customerLines.push([t.customer.taxNumber, invoice.customer.taxNumber, true]);
    }
  } else {
    customerLines.push([t.invoice.walkIn, '—', false]);
  }

  const detailLines: [string, string, boolean][] = [
    [t.invoice.issuedAt, formatDateTime(invoice.issuedAt, locale), true],
  ];
  if (invoice.dueDate) {
    detailLines.push([t.invoice.dueDate, formatDate(invoice.dueDate, locale), true]);
  }
  if (invoice.repairOrder) {
    detailLines.push([t.repair.single, invoice.repairOrder.number, true]);
  }
  if (invoice.user) detailLines.push([t.audit.user, invoice.user.fullName, false]);
  if (invoice.warrantyEndsAt) {
    detailLines.push([t.repair.warrantyEnds, formatDate(invoice.warrantyEndsAt, locale), true]);
  }

  const rowsCount = Math.max(customerLines.length, detailLines.length);
  const boxHeight = 20 + rowsCount * 12 + 6;

  const leftX = margin;
  const rightX = margin + boxWidth + boxGap;
  // الصندوق الأول يوضع في جهة بداية القراءة
  const customerX = baseDir === 'rtl' ? rightX : leftX;
  const detailX = baseDir === 'rtl' ? leftX : rightX;

  for (const [boxX, title, lines] of [
    [customerX, t.invoice.customer, customerLines],
    [detailX, t.app.details, detailLines],
  ] as const) {
    builder.rect(boxX, boxTop, boxWidth, boxHeight, {
      stroke: COLORS.line,
      radius: 3,
    });
    builder.font('bold', 8.5, COLORS.ink);
    builder.text(title, boxX + 8, boxTop + 6, boxWidth - 16, { align: 'start' });
    let lineY = boxTop + 20;
    for (const [label, value, ltr] of lines) {
      lineY = builder.labelValue(label, value, boxX + 8, lineY, boxWidth - 16, { ltrValue: ltr });
    }
  }

  y = boxTop + boxHeight + 12;

  // ---------------------------------------------------------------- البنود
  const columns: TableColumn<InvoiceForPdf['items'][number]>[] = [
    {
      header: '#',
      width: 0.05,
      align: 'center',
      ltr: true,
      value: (_row, index) => String(index + 1),
    },
    {
      header: t.invoice.item,
      width: 0.43,
      align: 'start',
      value: (row) => row.name,
      sub: (row) => row.description,
    },
    {
      header: t.invoice.quantity,
      width: 0.09,
      align: 'center',
      ltr: true,
      value: (row) => String(row.quantity),
    },
    {
      header: t.invoice.unitPrice,
      width: 0.15,
      align: 'end',
      ltr: true,
      value: (row) => money(row.unitPrice),
    },
    {
      header: t.invoice.discount,
      width: 0.12,
      align: 'end',
      ltr: true,
      value: (row) => (row.discount ? money(row.discount) : '—'),
    },
    {
      header: t.app.total,
      width: 0.16,
      align: 'end',
      ltr: true,
      bold: true,
      value: (row) => money(row.total),
    },
  ];

  y = drawTable(builder, columns, invoice.items, margin, y, contentWidth);
  y += 12;

  // -------------------------------------------------------------- المجاميع
  const summaryWidth = 210;
  const summary: { label: string; value: string; strong?: boolean }[] = [
    { label: t.app.subtotal, value: money(invoice.subtotal) },
  ];
  if (invoice.discountAmount > 0) {
    summary.push({ label: t.invoice.discount, value: `− ${money(invoice.discountAmount)}` });
  }
  if (invoice.taxAmount > 0) {
    summary.push({ label: `${t.invoice.tax} ${invoice.taxRate}%`, value: money(invoice.taxAmount) });
  }
  summary.push({ label: t.app.total, value: money(invoice.total), strong: true });
  summary.push({ label: t.invoice.paid, value: money(invoice.paidAmount) });
  if (invoice.dueAmount > 0) {
    summary.push({ label: t.invoice.due, value: money(invoice.dueAmount), strong: true });
  }

  const summaryHeight = summary.length * 16 + 4;
  y = builder.ensureSpace(y, summaryHeight + 70);

  // المجاميع في جهة نهاية القراءة، والمدفوعات + QR في الجهة المقابلة
  const summaryX = baseDir === 'rtl' ? margin : margin + contentWidth - summaryWidth;
  const asideX = baseDir === 'rtl' ? margin + summaryWidth + 14 : margin;
  const asideWidth = contentWidth - summaryWidth - 14;

  const summaryY = summaryRows(builder, summary, summaryX, y, summaryWidth);

  // المدفوعات — ثلاثة أعمدة: الطريقة | التاريخ | المبلغ
  let asideY = y;
  if (invoice.payments.length > 0) {
    builder.font('bold', 8.5, COLORS.ink);
    builder.text(t.payment.title, asideX, asideY, asideWidth, { align: 'start' });
    asideY += 13;

    const methodWidth = asideWidth * 0.4;
    const dateWidth = asideWidth * 0.3;
    const amountWidth = asideWidth * 0.3;

    for (const payment of invoice.payments) {
      builder.font('body', 8, COLORS.muted);
      builder.text(
        t.payment.methods[payment.method as PaymentMethod] ?? payment.method,
        builder.regionStart(asideX, asideWidth, methodWidth),
        asideY,
        methodWidth,
        { align: 'start', ellipsis: true },
      );
      drawText(
        builder.doc,
        formatDate(payment.createdAt, locale),
        baseDir === 'rtl' ? asideX + amountWidth : asideX + methodWidth,
        asideY,
        dateWidth,
        { align: 'center', baseDir: 'ltr' },
      );
      builder.font('bold', 8, COLORS.ink);
      drawText(
        builder.doc,
        money(payment.amount),
        builder.regionEnd(asideX, asideWidth, amountWidth),
        asideY,
        amountWidth,
        { align: builder.endAlign, baseDir: 'ltr' },
      );
      asideY += 11;
    }
    asideY += 6;
  }

  if (qr) {
    const qrSize = 54;
    const qrX = builder.regionStart(asideX, asideWidth, qrSize);
    builder.image(qr, qrX, asideY, { width: qrSize, height: qrSize });
    builder.font('body', 6.5, COLORS.faint);
    builder.paragraph(
      t.invoice.qrHint,
      builder.regionEnd(asideX, asideWidth, asideWidth - qrSize - 6),
      asideY + 18,
      asideWidth - qrSize - 6,
      { align: 'start', maxLines: 2 },
    );
    asideY += qrSize + 6;
  }

  y = Math.max(summaryY, asideY) + 12;

  // ------------------------------------------------------ الملاحظات والشروط
  for (const [title, body, small] of [
    [t.invoice.notes, invoice.notes ?? '', false],
    [t.invoice.terms, terms, true],
  ] as const) {
    if (!body) continue;
    builder.font('body', small ? 7.5 : 8);
    const height = builder.measureParagraph(body, contentWidth - 16) + 24;
    y = builder.ensureSpace(y, height);
    builder.rect(margin, y, contentWidth, height, {
      fill: small ? '#fafafa' : undefined,
      stroke: COLORS.hairline,
      radius: 3,
    });
    builder.font('bold', 8, COLORS.ink);
    builder.text(title, margin + 8, y + 6, contentWidth - 16, { align: 'start' });
    builder.font('body', small ? 7.5 : 8, small ? COLORS.muted : COLORS.body);
    builder.paragraph(body, margin + 8, y + 19, contentWidth - 16, { align: 'start' });
    y += height + 8;
  }

  // -------------------------------------------------------------- التواقيع
  y = builder.ensureSpace(y, 60);
  signatureBlock(builder, y + 12, [
    { title: t.invoice.customer, caption: t.pdf.signature },
    { title: shop.name, caption: t.pdf.signatureAndStamp },
  ]);

  if (footerNote) {
    builder.font('body', 8, COLORS.muted);
    builder.text(footerNote, margin, y + 78, contentWidth, { align: 'center' });
  }

  return builder.finalize();
}
