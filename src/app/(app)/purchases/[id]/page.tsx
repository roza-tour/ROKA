import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Truck, PackageCheck, Wallet } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, formatNumber, round } from '@/lib/utils';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { StatusBadge } from '@/components/repair-status-badge';
import { ReceiveGoodsPanel } from './receive-panel';

export const metadata: Metadata = { title: 'أمر شراء' };
export const dynamic = 'force-dynamic';

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('purchases:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;

  const order = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, phone: true } },
      user: { select: { fullName: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
    },
  });

  if (!order) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const remaining = round(order.total - order.paidAmount);
  const canReceive =
    can(user, 'purchases:update') && !['RECEIVED', 'CANCELLED'].includes(order.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="numeric">{order.number}</span>
            <StatusBadge status={order.status} labels={t.purchase.statuses} size="md" />
          </span>
        }
        description={
          <Link href={`/suppliers/${order.supplier.id}`} className="hover:text-primary">
            {order.supplier.name}
          </Link>
        }
        backHref="/purchases"
        breadcrumbs={[{ label: t.purchase.title, href: '/purchases' }, { label: order.number }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                {t.app.details}
              </span>
            }
          >
            <dl className="divide-y divide-border">
              <DetailRow label={t.purchase.supplier}>{order.supplier.name}</DetailRow>
              {order.supplier.phone && (
                <DetailRow label={t.supplier.phone}>
                  <span className="numeric">{order.supplier.phone}</span>
                </DetailRow>
              )}
              <DetailRow label={t.purchase.orderedAt}>
                <span className="numeric">{formatDate(order.orderedAt, locale)}</span>
              </DetailRow>
              <DetailRow label={t.purchase.receivedAt}>
                <span className="numeric">
                  {order.receivedAt ? formatDate(order.receivedAt, locale) : '—'}
                </span>
              </DetailRow>
              {order.user && (
                <DetailRow label={t.audit.user}>{order.user.fullName}</DetailRow>
              )}
            </dl>

            {order.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {order.notes}
              </p>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {t.app.summary}
              </span>
            }
          >
            <dl className="space-y-2">
              <SummaryRow label={t.app.subtotal} value={money(order.subtotal)} />
              {order.discount > 0 && (
                <SummaryRow label={t.invoice.discount} value={`- ${money(order.discount)}`} />
              )}
              {order.tax > 0 && <SummaryRow label={t.invoice.tax} value={money(order.tax)} />}
              {order.shipping > 0 && (
                <SummaryRow label={t.purchase.shipping} value={money(order.shipping)} />
              )}
              <div className="border-t border-border pt-2">
                <SummaryRow label={t.app.total} value={money(order.total)} strong />
              </div>
              <SummaryRow label={t.invoice.paid} value={money(order.paidAmount)} />
              <SummaryRow
                label={t.invoice.due}
                value={money(remaining)}
                tone={remaining > 0 ? 'danger' : 'success'}
                strong
              />
            </dl>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title={
              <span className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4" />
                {t.invoice.items}
              </span>
            }
            bodyClassName="p-0"
          >
            <ReceiveGoodsPanel
              purchaseId={order.id}
              canReceive={canReceive}
              items={order.items.map((item) => ({
                id: item.id,
                productId: item.product.id,
                name: item.product.name,
                sku: item.product.sku,
                quantity: item.quantity,
                receivedQuantity: item.receivedQuantity,
                unitCost: item.unitCost,
                total: item.total,
              }))}
              currency={finance.currency}
              decimals={finance.decimals}
              locale={locale}
              labels={{
                product: t.product.single,
                ordered: t.invoice.quantity,
                received: t.purchase.receivedQuantity,
                toReceive: t.purchase.receiveGoods,
                unitCost: t.product.costPrice,
                total: t.app.total,
                receive: t.purchase.receiveGoods,
                receiveAll: t.app.all,
              }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-medium' : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd
        className={`numeric ${strong ? 'text-base font-bold' : 'text-sm'} ${
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
