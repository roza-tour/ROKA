import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Phone, Mail, MapPin, Package, ShoppingCart, Plus } from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber, formatDate } from '@/lib/utils';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/repair-status-badge';

export const metadata: Metadata = { title: 'مورد' };
export const dynamic = 'force-dynamic';

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('suppliers:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          costPrice: true,
          sellPrice: true,
        },
        orderBy: { name: 'asc' },
        take: 50,
      },
      purchases: {
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          paidAmount: true,
          orderedAt: true,
        },
        orderBy: { orderedAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!supplier) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const totalPurchased = supplier.purchases.reduce((sum, p) => sum + p.total, 0);
  const stockValue = supplier.products.reduce((sum, p) => sum + p.quantity * p.costPrice, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={
          <span className="numeric">
            {supplier.code}
            {supplier.company ? ` · ${supplier.company}` : ''}
          </span>
        }
        backHref="/suppliers"
        breadcrumbs={[{ label: t.supplier.title, href: '/suppliers' }, { label: supplier.name }]}
        actions={
          <>
            {can(user, 'purchases:create') && (
              <Link href={`/purchases/new?supplierId=${supplier.id}`}>
                <Button icon={<Plus className="h-4 w-4" />}>{t.purchase.new}</Button>
              </Link>
            )}
            {can(user, 'suppliers:update') && (
              <Link href={`/suppliers/${supplier.id}/edit`}>
                <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
                  {t.actions.edit}
                </Button>
              </Link>
            )}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.supplier.balance}
          value={money(supplier.balance)}
          icon={ShoppingCart}
          tone={supplier.balance > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="إجمالي المشتريات"
          value={money(totalPurchased)}
          icon={ShoppingCart}
          tone="info"
          hint={`${formatNumber(supplier.purchases.length, locale)} أمر شراء`}
        />
        <StatCard
          label={t.supplier.products}
          value={formatNumber(supplier.products.length, locale)}
          icon={Package}
          tone="primary"
        />
        <StatCard
          label={t.product.stockValue}
          value={money(stockValue)}
          icon={Package}
          tone="default"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t.app.details}>
          <dl className="divide-y divide-border">
            {supplier.phone && (
              <DetailRow label={t.supplier.phone}>
                <a
                  href={`tel:${supplier.phone}`}
                  className="numeric inline-flex items-center gap-1.5 hover:text-primary"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {supplier.phone}
                </a>
              </DetailRow>
            )}
            {supplier.phone2 && (
              <DetailRow label={t.customer.phone2}>
                <span className="numeric">{supplier.phone2}</span>
              </DetailRow>
            )}
            {supplier.email && (
              <DetailRow label={t.supplier.email}>
                <a
                  href={`mailto:${supplier.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-primary"
                  dir="ltr"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {supplier.email}
                </a>
              </DetailRow>
            )}
            {supplier.address && (
              <DetailRow label={t.supplier.address}>
                <span className="inline-flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {supplier.address}
                </span>
              </DetailRow>
            )}
            {supplier.taxNumber && (
              <DetailRow label={t.customer.taxNumber}>
                <span className="numeric">{supplier.taxNumber}</span>
              </DetailRow>
            )}
          </dl>

          {supplier.notes && (
            <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
              {supplier.notes}
            </p>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title={t.supplier.purchases} bodyClassName="p-0">
            {supplier.purchases.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <ul className="divide-y divide-border">
                {supplier.purchases.map((purchase) => (
                  <li key={purchase.id}>
                    <Link
                      href={`/purchases/${purchase.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="numeric text-sm font-medium">{purchase.number}</p>
                        <p className="numeric text-xs text-muted-foreground">
                          {formatDate(purchase.orderedAt, locale)}
                        </p>
                      </div>
                      <StatusBadge status={purchase.status} labels={t.purchase.statuses} />
                      <div className="shrink-0 text-end">
                        <p className="numeric text-sm font-medium">{money(purchase.total)}</p>
                        {purchase.total > purchase.paidAmount && (
                          <p className="numeric text-[11px] text-danger">
                            {money(purchase.total - purchase.paidAmount)}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t.supplier.products} bodyClassName="p-0">
            {supplier.products.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{t.product.name}</th>
                      <th className="text-center">{t.product.quantity}</th>
                      <th className="text-end">{t.product.costPrice}</th>
                      <th className="text-end">{t.product.sellPrice}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <Link
                            href={`/inventory/${product.id}`}
                            className="hover:text-primary"
                          >
                            <span className="block font-medium">{product.name}</span>
                            <span className="numeric block text-xs text-muted-foreground">
                              {product.sku}
                            </span>
                          </Link>
                        </td>
                        <td className="numeric text-center">
                          {formatNumber(product.quantity, locale)}
                        </td>
                        <td className="numeric text-end">{money(product.costPrice)}</td>
                        <td className="numeric text-end font-medium">
                          {money(product.sellPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
