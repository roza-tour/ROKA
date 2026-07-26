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
import { formatMoney, formatDate, fullName, normalizeDigits, daysUntil } from '@/lib/utils';
import { QUOTATION_STATUSES } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/repair-status-badge';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'عروض الأسعار' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type QuotationRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  validUntil: Date | null;
  createdAt: Date;
  customer: { firstName: string; lastName: string | null };
  _count: { items: number };
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('quotations:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.QuotationWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { customer: { firstName: { contains: q } } },
            { customer: { lastName: { contains: q } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.quotation.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        validUntil: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.quotation.count({ where }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<QuotationRow>[] = [
    {
      key: 'number',
      header: t.quotation.number,
      render: (row) => (
        <div>
          <p className="numeric font-medium">{row.number}</p>
          <p className="numeric text-xs text-muted-foreground">
            {formatDate(row.createdAt, locale)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t.invoice.customer,
      render: (row) => fullName(row.customer.firstName, row.customer.lastName),
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
      header: t.invoice.status,
      align: 'center',
      render: (row) => <StatusBadge status={row.status} labels={t.quotation.statuses} />,
    },
    {
      key: 'validUntil',
      header: t.quotation.validUntil,
      align: 'center',
      hideOnMobile: true,
      render: (row) => {
        if (!row.validUntil) return <span className="text-muted-foreground">—</span>;
        const remaining = daysUntil(row.validUntil);
        const expired =
          remaining !== null && remaining < 0 && !['CONVERTED', 'REJECTED'].includes(row.status);
        return (
          <span className={`numeric text-xs ${expired ? 'text-danger' : 'text-muted-foreground'}`}>
            {formatDate(row.validUntil, locale)}
            {expired && (
              <Badge tone="rose" size="sm" className="ms-1">
                {t.quotation.statuses.EXPIRED}
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: t.app.total,
      align: 'end',
      render: (row) => <span className="numeric font-medium">{money(row.total)}</span>,
    },
  ];

  const baseUrl = `/quotations?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.quotation.title}
        actions={
          can(user, 'quotations:create') && (
            <Link href="/quotations/new">
              <Button icon={<Plus className="h-4 w-4" />}>{t.quotation.new}</Button>
            </Link>
          )
        }
      />

      <SearchFilters
        placeholder="ابحث برقم العرض أو اسم العميل"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.invoice.status,
            options: QUOTATION_STATUSES.map((s) => ({
              value: s,
              label: t.quotation.statuses[s],
            })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/quotations/${r.id}`}
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
