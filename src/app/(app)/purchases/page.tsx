import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, normalizeDigits } from '@/lib/utils';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/repair-status-badge';

export const metadata: Metadata = { title: 'المشتريات' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type PurchaseRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  paidAmount: number;
  orderedAt: Date;
  receivedAt: Date | null;
  supplier: { name: string };
  _count: { items: number };
};

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('purchases:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const supplierId = typeof params.supplierId === 'string' ? params.supplierId : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(status ? { status } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(q
      ? {
          OR: [{ number: { contains: q } }, { supplier: { name: { contains: q } } }],
        }
      : {}),
  };

  const [rows, total, suppliers, totals] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        paidAmount: true,
        orderedAt: true,
        receivedAt: true,
        supplier: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.purchaseOrder.count({ where }),
    db.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.purchaseOrder.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<PurchaseRow>[] = [
    {
      key: 'number',
      header: t.purchase.number,
      render: (row) => (
        <div>
          <p className="numeric font-medium">{row.number}</p>
          <p className="numeric text-xs text-muted-foreground">
            {formatDate(row.orderedAt, locale)}
          </p>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: t.purchase.supplier,
      render: (row) => row.supplier.name,
    },
    {
      key: 'items',
      header: t.invoice.items,
      align: 'center',
      hideOnMobile: true,
      render: (row) => <span className="numeric">{row._count.items}</span>,
    },
    {
      key: 'status',
      header: t.purchase.status,
      align: 'center',
      render: (row) => <StatusBadge status={row.status} labels={t.purchase.statuses} />,
    },
    {
      key: 'total',
      header: t.app.total,
      align: 'end',
      render: (row) => (
        <div>
          <p className="numeric font-medium">{money(row.total)}</p>
          {row.total > row.paidAmount && (
            <p className="numeric text-[11px] text-danger">
              {t.invoice.due}: {money(row.total - row.paidAmount)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'received',
      header: t.purchase.receivedAt,
      align: 'end',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {row.receivedAt ? formatDate(row.receivedAt, locale) : '—'}
        </span>
      ),
    },
  ];

  const baseUrl = `/purchases?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  const outstanding = (totals._sum.total ?? 0) - (totals._sum.paidAmount ?? 0);

  return (
    <div>
      <PageHeader
        title={t.purchase.title}
        description={`إجمالي المشتريات ${money(totals._sum.total ?? 0)} · المستحق ${money(outstanding)}`}
        actions={
          can(user, 'purchases:create') && (
            <Link href="/purchases/new">
              <Button icon={<Plus className="h-4 w-4" />}>{t.purchase.new}</Button>
            </Link>
          )
        }
      />

      <SearchFilters
        placeholder="ابحث برقم الأمر أو اسم المورد"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.purchase.status,
            options: Object.entries(t.purchase.statuses).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: 'supplierId',
            label: t.purchase.supplier,
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/purchases/${r.id}`}
        empty={q ? t.app.noResults : t.app.noData}
      />

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
