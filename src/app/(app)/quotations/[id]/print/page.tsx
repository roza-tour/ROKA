import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getI18n } from '@/i18n';
import { getFinanceSettings, getShopInfo, getSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, fullName } from '@/lib/utils';
import { PrintTrigger } from '@/components/print-trigger';

export const metadata: Metadata = { title: 'طباعة عرض سعر' };
export const dynamic = 'force-dynamic';

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('quotations:view');
  const { locale, t } = await getI18n();
  const [finance, shop, settings] = await Promise.all([
    getFinanceSettings(),
    getShopInfo(),
    getSettings(),
  ]);
  const { id } = await params;

  const quotation = await db.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      device: true,
      user: { select: { fullName: true } },
      items: true,
    },
  });

  if (!quotation) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const terms = quotation.terms || settings['invoice.terms'] || '';

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
      <PrintTrigger label={t.app.print} backLabel={t.app.back} />

      <article className="text-[11px] leading-relaxed">
        <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
          <div>
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            {shop.legalName && <p className="text-[10px] text-gray-600">{shop.legalName}</p>}
            <div className="mt-1 space-y-0.5 text-[10px] text-gray-700">
              {shop.address && <p>{shop.address}</p>}
              {shop.phone && (
                <p dir="ltr" className="text-start">
                  {shop.phone}
                </p>
              )}
              {shop.taxNumber && <p>الرقم الضريبي: {shop.taxNumber}</p>}
            </div>
          </div>

          <div className="text-end">
            <h2 className="text-lg font-bold">{t.quotation.single}</h2>
            <p className="font-mono text-xl font-bold" dir="ltr">
              {quotation.number}
            </p>
            <p className="mt-1 text-[10px] text-gray-600">
              {t.audit.date}:{' '}
              <span dir="ltr">{formatDate(quotation.createdAt, locale)}</span>
            </p>
            {quotation.validUntil && (
              <p className="text-[10px] font-medium">
                {t.quotation.validUntil}:{' '}
                <span dir="ltr">{formatDate(quotation.validUntil, locale)}</span>
              </p>
            )}
          </div>
        </header>

        <section className="mt-3 rounded border border-gray-300 p-2.5">
          <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
            {t.invoice.customer}
          </h3>
          <div className="grid grid-cols-2 gap-x-6">
            <Row label={t.customer.fullName}>
              {fullName(quotation.customer.firstName, quotation.customer.lastName)}
            </Row>
            <Row label={t.customer.phone}>
              <span dir="ltr">{quotation.customer.phone}</span>
            </Row>
            {quotation.customer.address && (
              <Row label={t.customer.address}>{quotation.customer.address}</Row>
            )}
            {quotation.device && (
              <Row label={t.repair.device}>
                {quotation.device.brand} {quotation.device.model}
              </Row>
            )}
          </div>
        </section>

        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="w-8 border border-gray-300 px-1 py-1.5 text-center text-[10px]">#</th>
              <th className="border border-gray-300 px-2 py-1.5 text-start text-[10px]">
                {t.invoice.item}
              </th>
              <th className="w-14 border border-gray-300 px-1 py-1.5 text-center text-[10px]">
                {t.invoice.quantity}
              </th>
              <th className="w-24 border border-gray-300 px-2 py-1.5 text-end text-[10px]">
                {t.invoice.unitPrice}
              </th>
              <th className="w-24 border border-gray-300 px-2 py-1.5 text-end text-[10px]">
                {t.app.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, index) => (
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
                <td className="border border-gray-300 px-2 py-1 text-end font-medium" dir="ltr">
                  {money(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 ms-auto w-64">
          <table className="w-full border-collapse">
            <tbody>
              <SummaryLine label={t.app.subtotal} value={money(quotation.subtotal)} />
              {quotation.discountAmount > 0 && (
                <SummaryLine
                  label={t.invoice.discount}
                  value={`− ${money(quotation.discountAmount)}`}
                />
              )}
              {quotation.taxAmount > 0 && (
                <SummaryLine
                  label={`${t.invoice.tax} ${quotation.taxRate}%`}
                  value={money(quotation.taxAmount)}
                />
              )}
              <SummaryLine label={t.app.total} value={money(quotation.total)} strong />
            </tbody>
          </table>
        </div>

        {quotation.notes && (
          <section className="mt-3 rounded border border-gray-300 p-2.5">
            <h3 className="mb-1 text-[10px] font-bold">{t.invoice.notes}</h3>
            <p className="whitespace-pre-wrap text-[10px]">{quotation.notes}</p>
          </section>
        )}

        {terms && (
          <section className="mt-3 rounded border border-gray-300 bg-gray-50 p-2.5">
            <h3 className="mb-1 text-[10px] font-bold">{t.invoice.terms}</h3>
            <p className="whitespace-pre-wrap text-[9px] leading-relaxed text-gray-700">{terms}</p>
          </section>
        )}

        <footer className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="mb-6 text-[10px] font-medium">{t.invoice.customer}</p>
            <div className="border-t border-gray-400 pt-1 text-[9px] text-gray-600">
              التوقيع (موافقة على العرض)
            </div>
          </div>
          <div>
            <p className="mb-6 text-[10px] font-medium">{shop.name}</p>
            <div className="border-t border-gray-400 pt-1 text-[9px] text-gray-600">
              {quotation.user?.fullName ?? 'التوقيع والختم'}
            </div>
          </div>
        </footer>
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
