import type { Permission } from '../permissions';

/**
 * ثوابت خفيفة مشتركة بين وحدات PDF — بلا أي استيراد لـ pdfkit.
 * وجودها في ملف مستقل يمنع الاستيراد الدائري ويُبقي وحدة الروابط
 * الموقّعة (links.ts) خفيفة، فلا تُحمَّل مكتبة الرسم لمجرد توليد رابط.
 */

/** أنواع المستندات التي يولّدها النظام بصيغة PDF */
export const PDF_KINDS = ['invoice', 'repair', 'quotation'] as const;
export type PdfKind = (typeof PDF_KINDS)[number];

export function isPdfKind(value: unknown): value is PdfKind {
  return typeof value === 'string' && (PDF_KINDS as readonly string[]).includes(value);
}

/** الصلاحية المطلوبة لعرض كل نوع مستند */
export const PDF_PERMISSION: Record<PdfKind, Permission> = {
  invoice: 'invoices:view',
  repair: 'repairs:view',
  quotation: 'quotations:view',
};

/** اسم الكيان في قاعدة البيانات المقابل لكل نوع — يُستخدم في سجل التدقيق */
export const PDF_ENTITY: Record<PdfKind, string> = {
  invoice: 'Invoice',
  repair: 'RepairOrder',
  quotation: 'Quotation',
};

/** النوع المقابل لاسم الكيان — لعكس الاتجاه من سجل الإشعارات */
export function kindForEntity(entity: string | null | undefined): PdfKind | null {
  if (entity === 'Invoice') return 'invoice';
  if (entity === 'RepairOrder') return 'repair';
  if (entity === 'Quotation') return 'quotation';
  return null;
}

/** عنوان التطبيق العام — يُستخدم في روابط QR والروابط الموقّعة */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
