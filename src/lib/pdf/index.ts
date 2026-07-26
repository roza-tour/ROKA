import 'server-only';

import { db } from '../db';
import { getLocale, type Locale } from '@/i18n';
import type { PdfKind } from './kinds';
import { buildInvoicePdf } from './invoice';
import { buildReceiptPdf } from './receipt';
import { buildQuotationPdf } from './quotation';
export { buildInvoicePdf } from './invoice';
export { buildReceiptPdf } from './receipt';
export { buildQuotationPdf } from './quotation';
export { PdfBuilder, drawTable, COLORS } from './doc';
export type { PdfDoc, TableColumn } from './doc';

export {
  PDF_KINDS,
  PDF_PERMISSION,
  PDF_ENTITY,
  isPdfKind,
  kindForEntity,
  appUrl,
  type PdfKind,
} from './kinds';
export { signedPdfUrl, verifyPdfLink, DEFAULT_LINK_TTL } from './links';

export interface GeneratedPdf {
  buffer: Buffer;
  /** اسم الملف بدون امتداد — يُستخدم في Content-Disposition */
  filename: string;
  /** رقم المستند لسجل التدقيق */
  number: string;
  /** اسم الكيان في سجل التدقيق */
  entity: string;
  entityId: string;
}

/**
 * يولّد مستند PDF حسب نوعه ومعرّفه.
 * يُرجع null إن لم يوجد السجل — لتفرّق نقطة النهاية بين 404 و500.
 */
export async function generatePdf(
  kind: PdfKind,
  id: string,
  locale?: Locale,
): Promise<GeneratedPdf | null> {
  const activeLocale = locale ?? (await getLocale());

  if (kind === 'invoice') {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { fullName: true } },
        repairOrder: { select: { number: true } },
        items: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!invoice) return null;
    return {
      buffer: await buildInvoicePdf(invoice, activeLocale),
      filename: invoice.number,
      number: invoice.number,
      entity: 'Invoice',
      entityId: invoice.id,
    };
  }

  if (kind === 'repair') {
    const order = await db.repairOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        device: true,
        receivedBy: { select: { fullName: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) return null;
    return {
      buffer: await buildReceiptPdf(order, activeLocale),
      filename: order.number,
      number: order.number,
      entity: 'RepairOrder',
      entityId: order.id,
    };
  }

  const quotation = await db.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      device: true,
      user: { select: { fullName: true } },
      items: true,
    },
  });
  if (!quotation) return null;
  return {
    buffer: await buildQuotationPdf(quotation, activeLocale),
    filename: quotation.number,
    number: quotation.number,
    entity: 'Quotation',
    entityId: quotation.id,
  };
}

/** ترويسات تحميل ملف PDF — inline للعرض في المتصفح، attachment للتنزيل */
export function pdfHeaders(filename: string, disposition: 'inline' | 'attachment' = 'inline') {
  // ASCII احتياطي + النسخة المرمّزة للأسماء العربية (RFC 5987)
  const ascii = filename.replace(/[^\w.-]/g, '_');
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`,
    'Cache-Control': 'private, no-store',
  };
}
