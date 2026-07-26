import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Pencil,
  Phone,
  Mail,
  MapPin,
  Wrench,
  Receipt,
  Smartphone,
  Plus,
  ShieldCheck,
  StickyNote,
} from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber, formatDate, fullName } from '@/lib/utils';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RepairStatusBadge, InvoiceStatusBadge, StatusBadge } from '@/components/repair-status-badge';
import type { DeviceType } from '@/lib/constants';

export const metadata: Metadata = { title: 'ملف العميل' };
export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('customers:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      devices: { orderBy: { createdAt: 'desc' } },
      repairOrders: {
        select: {
          id: true,
          number: true,
          status: true,
          receivedAt: true,
          finalCost: true,
          device: { select: { brand: true, model: true } },
        },
        orderBy: { receivedAt: 'desc' },
        take: 15,
      },
      invoices: {
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          total: true,
          dueAmount: true,
          issuedAt: true,
        },
        orderBy: { issuedAt: 'desc' },
        take: 15,
      },
      warranties: {
        where: { status: 'ACTIVE' },
        select: { id: true, number: true, itemName: true, endsAt: true, status: true },
        orderBy: { endsAt: 'asc' },
        take: 10,
      },
    },
  });

  if (!customer) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });
  const name = fullName(customer.firstName, customer.lastName);

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="numeric">{customer.code}</span>
            {customer.type === 'COMPANY' && (
              <Badge tone="violet" size="sm">
                {t.customer.company}
              </Badge>
            )}
            {customer.isBlocked && (
              <Badge tone="red" size="sm">
                {t.customer.blocked}
              </Badge>
            )}
            {!customer.isActive && (
              <Badge tone="gray" size="sm">
                مؤرشف
              </Badge>
            )}
          </span>
        }
        backHref="/customers"
        breadcrumbs={[{ label: t.customer.title, href: '/customers' }, { label: name }]}
        actions={
          <>
            {can(user, 'repairs:create') && (
              <Link href={`/repairs/new?customerId=${customer.id}`}>
                <Button icon={<Wrench className="h-4 w-4" />}>{t.nav.newRepair}</Button>
              </Link>
            )}
            {can(user, 'invoices:create') && (
              <Link href={`/pos?customerId=${customer.id}`}>
                <Button variant="outline" icon={<Receipt className="h-4 w-4" />}>
                  {t.invoice.new}
                </Button>
              </Link>
            )}
            {can(user, 'customers:update') && (
              <Link href={`/customers/${customer.id}/edit`}>
                <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
                  {t.actions.edit}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* المؤشرات */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.customer.visitsCount}
          value={formatNumber(customer.visitsCount, locale)}
          icon={Wrench}
          tone="primary"
        />
        <StatCard
          label={t.customer.totalPurchases}
          value={money(customer.totalPurchases)}
          icon={Receipt}
          tone="info"
        />
        <StatCard
          label={t.customer.totalRepairs}
          value={money(customer.totalRepairs)}
          icon={Wrench}
          tone="default"
        />
        <StatCard
          label={t.customer.balance}
          value={
            customer.balance === 0
              ? money(0)
              : `${money(Math.abs(customer.balance))} ${customer.balance > 0 ? t.customer.credit : t.customer.debit}`
          }
          icon={ShieldCheck}
          tone={customer.balance < 0 ? 'danger' : customer.balance > 0 ? 'success' : 'default'}
          hint={`${t.customer.loyaltyPoints}: ${formatNumber(customer.loyaltyPoints, locale)}`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* بيانات الاتصال */}
        <div className="space-y-6">
          <Card title={t.customer.single}>
            <dl className="divide-y divide-border">
              <DetailRow label={t.customer.phone}>
                <a href={`tel:${customer.phone}`} className="numeric inline-flex items-center gap-1.5 hover:text-primary">
                  <Phone className="h-3.5 w-3.5" />
                  {customer.phone}
                </a>
              </DetailRow>
              {customer.phone2 && (
                <DetailRow label={t.customer.phone2}>
                  <a href={`tel:${customer.phone2}`} className="numeric hover:text-primary">
                    {customer.phone2}
                  </a>
                </DetailRow>
              )}
              {customer.email && (
                <DetailRow label={t.customer.email}>
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                    dir="ltr"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {customer.email}
                  </a>
                </DetailRow>
              )}
              {customer.address && (
                <DetailRow label={t.customer.address}>
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {customer.address}
                    {customer.city ? `، ${customer.city}` : ''}
                  </span>
                </DetailRow>
              )}
              {customer.taxNumber && (
                <DetailRow label={t.customer.taxNumber}>
                  <span className="numeric">{customer.taxNumber}</span>
                </DetailRow>
              )}
              <DetailRow label={t.app.from}>
                <span className="numeric">{formatDate(customer.createdAt, locale)}</span>
              </DetailRow>
            </dl>

            {customer.notes && (
              <div className="mt-4 rounded-md bg-muted/50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <StickyNote className="h-3.5 w-3.5" />
                  {t.customer.notes}
                </p>
                <p className="whitespace-pre-wrap text-sm">{customer.notes}</p>
              </div>
            )}
          </Card>

          {/* أجهزة العميل */}
          <Card
            title={t.customer.devices}
            actions={
              can(user, 'repairs:create') && (
                <Link
                  href={`/repairs/new?customerId=${customer.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  <Plus className="inline h-3.5 w-3.5" /> {t.actions.add}
                </Link>
              )
            }
            bodyClassName="p-0"
          >
            {customer.devices.length === 0 ? (
              <p className="p-5 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.devices.map((device) => (
                  <li key={device.id} className="flex items-start gap-3 px-5 py-3">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {device.brand} {device.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.device.types[device.type as DeviceType] ?? device.type}
                        {device.color ? ` · ${device.color}` : ''}
                      </p>
                      {(device.imei || device.serialNumber) && (
                        <p className="numeric mt-0.5 text-[11px] text-muted-foreground">
                          {device.imei ? `IMEI: ${device.imei}` : `S/N: ${device.serialNumber}`}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* الضمانات السارية */}
          {customer.warranties.length > 0 && (
            <Card title={t.warranty.title} bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {customer.warranties.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{w.itemName}</p>
                      <p className="numeric text-xs text-muted-foreground">{w.number}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <StatusBadge status={w.status} labels={t.warranty.statuses} />
                      <p className="numeric mt-1 text-[11px] text-muted-foreground">
                        {formatDate(w.endsAt, locale)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* السجل */}
        <div className="space-y-6 lg:col-span-2">
          <Card
            title={t.repair.title}
            actions={
              <Link
                href={`/repairs?q=${encodeURIComponent(customer.phone)}`}
                className="text-xs text-primary hover:underline"
              >
                {t.app.more}
              </Link>
            }
            bodyClassName="p-0"
          >
            {customer.repairOrders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.repairOrders.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/repairs/${r.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="numeric text-sm font-medium">{r.number}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.device.brand} {r.device.model}
                        </p>
                      </div>
                      <RepairStatusBadge status={r.status} labels={t.repair.statuses} />
                      <span className="numeric hidden w-24 shrink-0 text-end text-sm sm:block">
                        {money(r.finalCost)}
                      </span>
                      <span className="numeric hidden shrink-0 text-xs text-muted-foreground md:block">
                        {formatDate(r.receivedAt, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t.invoice.title}
            actions={
              <Link
                href={`/invoices?customerId=${customer.id}`}
                className="text-xs text-primary hover:underline"
              >
                {t.app.more}
              </Link>
            }
            bodyClassName="p-0"
          >
            {customer.invoices.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.invoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="numeric text-sm font-medium">{inv.number}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.invoice.types[inv.type as keyof typeof t.invoice.types] ?? inv.type}
                        </p>
                      </div>
                      <InvoiceStatusBadge status={inv.status} labels={t.invoice.statuses} />
                      <div className="shrink-0 text-end">
                        <p className="numeric text-sm font-medium">{money(inv.total)}</p>
                        {inv.dueAmount > 0 && (
                          <p className="numeric text-[11px] text-danger">
                            {t.invoice.due}: {money(inv.dueAmount)}
                          </p>
                        )}
                      </div>
                      <span className="numeric hidden shrink-0 text-xs text-muted-foreground md:block">
                        {formatDate(inv.issuedAt, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
