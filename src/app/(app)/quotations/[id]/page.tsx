import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { User, Smartphone, Printer, FileDown } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, fullName } from '@/lib/utils';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/repair-status-badge';
import { QuotationActions } from './quotation-actions';

export const metadata: Metadata = { title: 'عرض سعر' };
export const dynamic = 'force-dynamic';

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('quotations:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="numeric">{quotation.number}</span>
            <StatusBadge status={quotation.status} labels={t.quotation.statuses} size="md" />
          </span>
        }
        description={fullName(quotation.customer.firstName, quotation.customer.lastName)}
        backHref="/quotations"
        breadcrumbs={[
          { label: t.quotation.title, href: '/quotations' },
          { label: quotation.number },
        ]}
        actions={
          <>
            <Link href={`/api/pdf/quotation/${quotation.id}?dl=1`} target="_blank">
              <Button variant="outline" icon={<FileDown className="h-4 w-4" />}>
                {t.pdf.download}
              </Button>
            </Link>
            <Link href={`/quotations/${quotation.id}/print`} target="_blank">
              <Button variant="outline" icon={<Printer className="h-4 w-4" />}>
                {t.app.print}
              </Button>
            </Link>
            <QuotationActions
              quotationId={quotation.id}
              status={quotation.status}
              hasDevice={Boolean(quotation.deviceId)}
              canUpdate={can(user, 'quotations:update')}
              canConvertInvoice={can(user, 'invoices:create')}
              canConvertRepair={can(user, 'repairs:create')}
              convertedInvoiceId={quotation.convertedInvoiceId}
              convertedRepairId={quotation.convertedRepairId}
              labels={{
                statuses: t.quotation.statuses,
                send: t.actions.send,
                accept: t.actions.approve,
                reject: t.actions.reject,
                toInvoice: t.quotation.convertToInvoice,
                toRepair: t.quotation.convertToRepair,
                viewConverted: t.actions.view,
                needsDevice: 'اربط العرض بجهاز أولاً لتتمكن من تحويله إلى أمر صيانة',
              }}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t.invoice.customer}
              </span>
            }
            actions={
              <Link
                href={`/customers/${quotation.customer.id}`}
                className="text-xs text-primary hover:underline"
              >
                {t.actions.view}
              </Link>
            }
          >
            <dl className="divide-y divide-border">
              <DetailRow label={t.customer.fullName}>
                {fullName(quotation.customer.firstName, quotation.customer.lastName)}
              </DetailRow>
              <DetailRow label={t.customer.phone}>
                <span className="numeric">{quotation.customer.phone}</span>
              </DetailRow>
            </dl>
          </Card>

          {quotation.device && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  {t.repair.device}
                </span>
              }
            >
              <dl className="divide-y divide-border">
                <DetailRow label={t.device.brand}>
                  {quotation.device.brand} {quotation.device.model}
                </DetailRow>
                {quotation.device.imei && (
                  <DetailRow label={t.device.imei}>
                    <span className="numeric">{quotation.device.imei}</span>
                  </DetailRow>
                )}
              </dl>
            </Card>
          )}

          <Card title={t.app.details}>
            <dl className="divide-y divide-border">
              <DetailRow label={t.audit.date}>
                <span className="numeric">{formatDate(quotation.createdAt, locale)}</span>
              </DetailRow>
              {quotation.validUntil && (
                <DetailRow label={t.quotation.validUntil}>
                  <span className="numeric">{formatDate(quotation.validUntil, locale)}</span>
                </DetailRow>
              )}
              {quotation.user && (
                <DetailRow label={t.audit.user}>{quotation.user.fullName}</DetailRow>
              )}
            </dl>

            {quotation.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {quotation.notes}
              </p>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={t.invoice.items} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{t.invoice.item}</th>
                    <th className="w-20 text-center">{t.invoice.quantity}</th>
                    <th className="w-28 text-end">{t.invoice.unitPrice}</th>
                    <th className="w-24 text-end">{t.invoice.discount}</th>
                    <th className="w-28 text-end">{t.app.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="block text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="numeric text-center">{item.quantity}</td>
                      <td className="numeric text-end">{money(item.unitPrice)}</td>
                      <td className="numeric text-end">
                        {item.discount ? money(item.discount) : '—'}
                      </td>
                      <td className="numeric text-end font-medium">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border p-4">
              <dl className="ms-auto max-w-xs space-y-1.5">
                <Row label={t.app.subtotal} value={money(quotation.subtotal)} />
                {quotation.discountAmount > 0 && (
                  <Row
                    label={t.invoice.discount}
                    value={`− ${money(quotation.discountAmount)}`}
                  />
                )}
                {quotation.taxAmount > 0 && (
                  <Row
                    label={`${t.invoice.tax} (${quotation.taxRate}%)`}
                    value={money(quotation.taxAmount)}
                  />
                )}
                <div className="border-t border-border pt-1.5">
                  <Row label={t.app.total} value={money(quotation.total)} strong />
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-medium' : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd className={`numeric ${strong ? 'text-base font-bold' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}
