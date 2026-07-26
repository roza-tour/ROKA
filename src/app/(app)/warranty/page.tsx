import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { formatDate, formatNumber, fullName, daysUntil, addDays, normalizeDigits } from '@/lib/utils';

import { PageHeader } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { StatusBadge } from '@/components/repair-status-badge';
import { Badge } from '@/components/ui/badge';
import { WarrantyMaintenanceButton } from './maintenance-button';

export const metadata: Metadata = { title: 'الضمانات' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

type WarrantyRow = {
  id: string;
  number: string;
  itemName: string;
  serial: string | null;
  days: number;
  startsAt: Date;
  endsAt: Date;
  status: string;
  customer: { id: string; firstName: string; lastName: string | null; phone: string };
  invoice: { id: string; number: string } | null;
  repairOrder: { id: string; number: string } | null;
};

export default async function WarrantyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('warranty:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.max(1, Number(params.page) || 1);
  const now = new Date();

  const where: Prisma.WarrantyWhereInput = {
    ...(status === 'expiring'
      ? { status: 'ACTIVE', endsAt: { gte: now, lte: addDays(now, 30) } }
      : status
        ? { status }
        : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { itemName: { contains: q } },
            { serial: { contains: q } },
            { customer: { firstName: { contains: q } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : {}),
  };

  const [rows, total, activeCount, expiringCount, expiredCount] = await Promise.all([
    db.warranty.findMany({
      where,
      select: {
        id: true,
        number: true,
        itemName: true,
        serial: true,
        days: true,
        startsAt: true,
        endsAt: true,
        status: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        invoice: { select: { id: true, number: true } },
        repairOrder: { select: { id: true, number: true } },
      },
      orderBy: { endsAt: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.warranty.count({ where }),
    db.warranty.count({ where: { status: 'ACTIVE', endsAt: { gte: now } } }),
    db.warranty.count({
      where: { status: 'ACTIVE', endsAt: { gte: now, lte: addDays(now, 30) } },
    }),
    db.warranty.count({ where: { OR: [{ status: 'EXPIRED' }, { endsAt: { lt: now } }] } }),
  ]);

  const columns: Column<WarrantyRow>[] = [
    {
      key: 'number',
      header: t.warranty.number,
      render: (row) => (
        <div>
          <p className="numeric font-medium">{row.number}</p>
          <p className="text-xs text-muted-foreground">{row.itemName}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t.invoice.customer,
      render: (row) => (
        <Link href={`/customers/${row.customer.id}`} className="block hover:text-primary">
          <p className="text-sm">{fullName(row.customer.firstName, row.customer.lastName)}</p>
          <p className="numeric text-xs text-muted-foreground">{row.customer.phone}</p>
        </Link>
      ),
    },
    {
      key: 'source',
      header: t.product.reference,
      hideOnMobile: true,
      render: (row) =>
        row.invoice ? (
          <Link href={`/invoices/${row.invoice.id}`} className="numeric text-sm hover:text-primary">
            {row.invoice.number}
          </Link>
        ) : row.repairOrder ? (
          <Link
            href={`/repairs/${row.repairOrder.id}`}
            className="numeric text-sm hover:text-primary"
          >
            {row.repairOrder.number}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'period',
      header: t.warranty.startsAt,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric text-xs">
          {formatDate(row.startsAt, locale)} → {formatDate(row.endsAt, locale)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: t.warranty.remaining,
      align: 'center',
      render: (row) => {
        const remaining = daysUntil(row.endsAt);
        if (row.status !== 'ACTIVE' || remaining === null || remaining < 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <Badge tone={remaining <= 7 ? 'rose' : remaining <= 30 ? 'amber' : 'emerald'} size="sm">
            <span className="numeric">{remaining}</span> يوم
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: t.invoice.status,
      align: 'center',
      render: (row) => {
        const expired = row.status === 'ACTIVE' && row.endsAt < now;
        return (
          <StatusBadge
            status={expired ? 'EXPIRED' : row.status}
            labels={t.warranty.statuses as Record<string, string>}
          />
        );
      },
    },
  ];

  const baseUrl = `/warranty?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.warranty.title}
        actions={
          can(user, 'warranty:update') && (
            <WarrantyMaintenanceButton
              labels={{
                refresh: 'تحديث الحالات المنتهية',
                remind: t.dashboard.warrantyExpiringAlert,
              }}
              canNotify={can(user, 'notifications:create')}
            />
          )
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.warranty.statuses.ACTIVE}
          value={formatNumber(activeCount, locale)}
          icon={ShieldCheck}
          tone="success"
          href="/warranty?status=ACTIVE"
        />
        <StatCard
          label={t.warranty.expiringSoon}
          value={formatNumber(expiringCount, locale)}
          icon={ShieldAlert}
          tone={expiringCount > 0 ? 'warning' : 'default'}
          href="/warranty?status=expiring"
          hint="خلال 30 يوماً"
        />
        <StatCard
          label={t.warranty.statuses.EXPIRED}
          value={formatNumber(expiredCount, locale)}
          icon={ShieldX}
          tone="default"
          href="/warranty?status=EXPIRED"
        />
      </section>

      <SearchFilters
        placeholder="ابحث برقم الضمان أو اسم المنتج أو العميل"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.invoice.status,
            options: [
              { value: 'expiring', label: t.warranty.expiringSoon },
              ...Object.entries(t.warranty.statuses).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
        ]}
      />

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={t.app.noData} />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        baseUrl={baseUrl}
        labels={{
          page: t.app.page,
          of: t.app.of,
          previous: t.app.previous,
          next: t.app.next,
        }}
      />
    </div>
  );
}
