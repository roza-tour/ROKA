import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getI18n } from '@/i18n';
import { getFinanceSettings, getShopInfo, getSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { generateQrDataUrl, generateBarcodeDataUrl } from '@/lib/codes';
import { formatMoney, formatDate, formatDateTime, fullName } from '@/lib/utils';
import type { InvoiceType, PaymentMethod } from '@/lib/constants';
import { PrintTrigger } from '@/components/print-trigger';

export const metadata: Metadata = { title: 'طباعة فاتورة' };
export const dynamic = 'force-dynamic';

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('invoices:view');
  const { locale, t } = await getI18n();
  const [finance, shop, settings] = await Promise.all([
    getFinanceSettings(),
    getShopInfo(),
    getSettings(),
  ]);
  const { id } = await params;

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

  if (!invoice) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const [qr, barcode] = await Promise.all([
    generateQrDataUrl(
      `${appUrl}/invoices/${invoice.id}|${invoice.number}|${invoice.total}`,
      { size: 120 },
    ),
    generateBarcodeDataUrl(invoice.number, { height: 8, scale: 2 }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const terms = invoice.terms || settings['invoice.terms'] || '';
  const footer = settings['invoice.footer'] || '';

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
      <PrintTrigger label={t.invoice.print} backLabel={t.app.back} />

      <article className="text-[11px] leading-relaxed">
        {/* الترويسة */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            {shop.legalName && <p className="text-[10px] text-gray-600">{shop.legalName}</p>}
            <div className="mt-1 space-y-0.5 text-[10px] text-gray-700">
              {shop.address && <p>{shop.address}</p>}
              {(shop.phone || shop.phone2) && (
                <p dir="ltr" className="text-start">
                  {[shop.phone, shop.phone2].filter(Boolean).join(' · ')}
                </p>
              )}
              {shop.email && (
                <p dir="ltr" className="text-start">
                  {shop.email}
                </p>
              )}
              {shop.taxNumber && <p>الرقم الضريبي: {shop.taxNumber}</p>}
            </div>
          </div>

          <div className="shrink-0 text-center">
            <h2 className="mb-1 text-lg font-bold">
              {t.invoice.single} · {t.invoice.types[invoice.type as InvoiceType] ?? invoice.type}
            </h2>
            <p className="font-mono text-xl font-bold" dir="ltr">
              {invoice.number}
            </p>
            {barcode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={barcode} alt={invoice.number} className="mx-auto mt-1 h-[32px]" />
            )}
          </div>
        </header>

        {/* العميل والتواريخ */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <section className="rounded border border-gray-300 p-2.5">
            <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
              {t.invoice.customer}
            </h3>
            {invoice.customer ? (
              <>
                <Row label={t.customer.fullName}>
                  {fullName(invoice.customer.firstName, invoice.customer.lastName)}
                </Row>
                <Row label={t.customer.phone}>
                  <span dir="ltr">{invoice.customer.phone}</span>
                </Row>
                {invoice.customer.address && (
                  <Row label={t.customer.address}>{invoice.customer.address}</Row>
                )}
                {invoice.customer.taxNumber && (
                  <Row label={t.customer.taxNumber}>
                    <span dir="ltr">{invoice.customer.taxNumber}</span>
                  </Row>
                )}
              </>
            ) : (
              <p className="text-gray-500">{t.invoice.walkIn}</p>
            )}
          </section>

          <section className="rounded border border-gray-300 p-2.5">
            <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
              {t.app.details}
            </h3>
            <Row label={t.invoice.issuedAt}>
              <span dir="ltr">{formatDateTime(invoice.issuedAt, locale)}</span>
            </Row>
            {invoice.dueDate && (
              <Row label={t.invoice.dueDate}>
                <span dir="ltr">{formatDate(invoice.dueDate, locale)}</span>
              </Row>
            )}
            {invoice.repairOrder && (
              <Row label={t.repair.single}>
                <span dir="ltr">{invoice.repairOrder.number}</span>
              </Row>
            )}
            {invoice.user && <Row label={t.audit.user}>{invoice.user.fullName}</Row>}
            {invoice.warrantyEndsAt && (
              <Row label={t.repair.warrantyEnds}>
                <span dir="ltr">{formatDate(invoice.warrantyEndsAt, locale)}</span>
              </Row>
            )}
          </section>
        </div>

        {/* البنود */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="w-8 border border-gray-300 px-1 py-1.5 text-center text-[10px]">
                #
              </th>
              <th className="border border-gray-300 px-2 py-1.5 text-start text-[10px]">
                {t.invoice.item}
              </th>
              <th className="w-14 border border-gray-300 px-1 py-1.5 text-center text-[10px]">
                {t.invoice.quantity}
              </th>
              <th className="w-24 border border-gray-300 px-2 py-1.5 text-end text-[10px]">
                {t.invoice.unitPrice}
              </th>
              <th className="w-20 border border-gray-300 px-2 py-1.5 text-end text-[10px]">
                {t.invoice.discount}
              </th>
              <th className="w-24 border border-gray-300 px-2 py-1.5 text-end text-[10px]">
                {t.app.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-gray-300 px-1 py-1 text-center" dir="ltr">
                  {index + 1}
                </td>
                <td className="border border-gray-300 px-2 py-1">
                  {item.name}
                  {item.description && (
                    <span className="block text-[9px] text-gray-600">{item.description}</span>
                  )}
                </td>
                <td className="border border-gray-300 px-1 py-1 text-center" dir="ltr">
                  {item.quantity}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-end" dir="ltr">
                  {money(item.unitPrice)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-end" dir="ltr">
                  {item.discount ? money(item.discount) : '—'}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-end font-medium" dir="ltr">
                  {money(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* المجاميع */}
        <div className="mt-3 flex items-start justify-between gap-6 print-avoid-break">
          <div className="flex-1">
            {invoice.payments.length > 0 && (
              <section className="rounded border border-gray-300 p-2.5">
                <h3 className="mb-1 text-[10px] font-bold">{t.payment.title}</h3>
                <table className="w-full">
                  <tbody>
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="py-0.5 text-gray-600">
                          {t.payment.methods[payment.method as PaymentMethod] ?? payment.method}
                        </td>
                        <td className="py-0.5 text-gray-600" dir="ltr">
                          {formatDate(payment.createdAt, locale)}
                        </td>
                        <td className="py-0.5 text-end font-medium" dir="ltr">
                          {money(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {qr && (
              <div className="mt-3 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR" className="h-[60px] w-[60px]" />
                <p className="text-[8px] text-gray-500">
                  امسح الرمز للتحقق من الفاتورة
                </p>
              </div>
            )}
          </div>

          <div className="w-64 shrink-0">
            <table className="w-full border-collapse">
              <tbody>
                <SummaryLine label={t.app.subtotal} value={money(invoice.subtotal)} />
                {invoice.discountAmount > 0 && (
                  <SummaryLine
                    label={t.invoice.discount}
                    value={`− ${money(invoice.discountAmount)}`}
                  />
                )}
                {invoice.taxAmount > 0 && (
                  <SummaryLine
                    label={`${t.invoice.tax} ${invoice.taxRate}%`}
                    value={money(invoice.taxAmount)}
                  />
                )}
                <SummaryLine label={t.app.total} value={money(invoice.total)} strong />
                <SummaryLine label={t.invoice.paid} value={money(invoice.paidAmount)} />
                {invoice.dueAmount > 0 && (
                  <SummaryLine label={t.invoice.due} value={money(invoice.dueAmount)} strong />
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* الملاحظات والشروط */}
        {invoice.notes && (
          <section className="mt-3 rounded border border-gray-300 p-2.5">
            <h3 className="mb-1 text-[10px] font-bold">{t.invoice.notes}</h3>
            <p className="whitespace-pre-wrap text-[10px]">{invoice.notes}</p>
          </section>
        )}

        {terms && (
          <section className="mt-3 rounded border border-gray-300 bg-gray-50 p-2.5 print-avoid-break">
            <h3 className="mb-1 text-[10px] font-bold">{t.invoice.terms}</h3>
            <p className="whitespace-pre-wrap text-[9px] leading-relaxed text-gray-700">
              {terms}
            </p>
          </section>
        )}

        {/* التواقيع */}
        <footer className="mt-6 grid grid-cols-2 gap-8 print-avoid-break">
          <div>
            <p className="mb-6 text-[10px] font-medium">{t.invoice.customer}</p>
            <div className="border-t border-gray-400 pt-1 text-[9px] text-gray-600">
              التوقيع
            </div>
          </div>
          <div>
            <p className="mb-6 text-[10px] font-medium">{shop.name}</p>
            <div className="border-t border-gray-400 pt-1 text-[9px] text-gray-600">
              التوقيع والختم
            </div>
          </div>
        </footer>

        {footer && (
          <p className="mt-4 border-t border-gray-200 pt-2 text-center text-[10px] font-medium">
            {footer}
          </p>
        )}
      </article>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-gray-600">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? 'bg-gray-100 font-bold' : ''}>
      <td className="border border-gray-300 px-2 py-1 text-gray-700">{label}</td>
      <td className="border border-gray-300 px-2 py-1 text-end" dir="ltr">
        {value}
      </td>
    </tr>
  );
}
