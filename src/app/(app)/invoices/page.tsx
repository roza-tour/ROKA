import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, ScanLine } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, fullName, normalizeDigits, endOfDay } from '@/lib/utils';
import { INVOICE_STATUSES, INVOICE_TYPES, type InvoiceType } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters, DateRangeFilter } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from '@/components/repair-status-badge';
import { Receipt, Wallet, AlertCircle } from 'lucide-react';

export const metadata: Metadata = { title: 'الفواتير' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type InvoiceRow = {
  id: string;
  number: string;
  type: string;
  status: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  profit: number;
  issuedAt: Date;
  customer: { id: string; firstName: string; lastName: string | null } | null;
  user: { fullName: string } | null;
  _count: { items: number };
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('invoices:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const type = typeof params.type === 'string' ? params.type : '';
  const customerId = typeof params.customerId === 'string' ? params.customerId : '';
  const from = typeof params.from === 'string' ? new Date(params.from) : null;
  const to = typeof params.to === 'string' ? endOfDay(new Date(params.to)) : null;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.InvoiceWhereInput = {
    ...(status === 'unpaid'
      ? { status: { in: ['UNPAID', 'PARTIAL'] } }
      : status
        ? { status }
        : {}),
    ...(type ? { type } : {}),
    ...(customerId ? { customerId } : {}),
    ...(from || to
      ? {
          issuedAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
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

  const [rows, total, totals, unpaidTotals] = await Promise.all([
    db.invoice.findMany({
      where,
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        total: true,
        paidAmount: true,
        dueAmount: true,
        profit: true,
        issuedAt: true,
        customer: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({
      where: { ...where, status: { notIn: ['CANCELLED', 'DRAFT'] } },
      _sum: { total: true, paidAmount: true, profit: true },
    }),
    db.invoice.aggregate({
      where: { status: { in: ['UNPAID', 'PARTIAL'] } },
      _sum: { dueAmount: true },
      _count: true,
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'number',
      header: t.invoice.number,
      render: (row) => (
        <div>
          <p className="numeric font-medium">{row.number}</p>
          <p className="numeric text-xs text-muted-foreground">
            {formatDate(row.issuedAt, locale)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t.invoice.customer,
      render: (row) =>
        row.customer ? (
          fullName(row.customer.firstName, row.customer.lastName)
        ) : (
          <span className="text-muted-foreground">{t.invoice.walkIn}</span>
        ),
    },
    {
      key: 'type',
      header: t.invoice.type,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm">
          {t.invoice.types[row.type as InvoiceType] ?? row.type}
          <span className="numeric block text-xs text-muted-foreground">
            {row._count.items} بند
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t.invoice.status,
      align: 'center',
      render: (row) => <InvoiceStatusBadge status={row.status} labels={t.invoice.statuses} />,
    },
    {
      key: 'total',
      header: t.app.total,
      align: 'end',
      render: (row) => (
        <div>
          <p className="numeric font-medium">{money(row.total)}</p>
          {row.dueAmount > 0 && (
            <p className="numeric text-[11px] text-danger">
              {t.invoice.due}: {money(row.dueAmount)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'profit',
      header: t.invoice.profit,
      align: 'end',
      hideOnMobile: true,
      render: (row) => (
        <span
          className={`numeric text-sm ${row.profit >= 0 ? 'text-success' : 'text-danger'}`}
        >
          {money(row.profit)}
        </span>
      ),
    },
    {
      key: 'user',
      header: t.audit.user,
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.user?.fullName ?? '—'}</span>
      ),
    },
  ];

  const baseUrl = `/invoices?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.invoice.title}
        actions={
          can(user, 'pos:view') && (
            <Link href="/pos">
              <Button icon={<ScanLine className="h-4 w-4" />}>{t.pos.title}</Button>
            </Link>
          )
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.report.grossRevenue}
          value={money(totals._sum.total ?? 0)}
          icon={Receipt}
          tone="primary"
          hint={`${total} فاتورة`}
        />
        <StatCard
          label={t.invoice.paid}
          value={money(totals._sum.paidAmount ?? 0)}
          icon={Wallet}
          tone="success"
          hint={`${t.invoice.profit}: ${money(totals._sum.profit ?? 0)}`}
        />
        <StatCard
          label={t.dashboard.unpaidInvoicesAlert}
          value={money(unpaidTotals._sum.dueAmount ?? 0)}
          icon={AlertCircle}
          tone={(unpaidTotals._sum.dueAmount ?? 0) > 0 ? 'danger' : 'default'}
          href="/invoices?status=unpaid"
          hint={`${unpaidTotals._count} فاتورة`}
        />
      </section>

      <SearchFilters
        placeholder="ابحث برقم الفاتورة أو اسم العميل"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.invoice.status,
            options: INVOICE_STATUSES.map((s) => ({ value: s, label: t.invoice.statuses[s] })),
          },
          {
            name: 'type',
            label: t.invoice.type,
            options: INVOICE_TYPES.map((it) => ({ value: it, label: t.invoice.types[it] })),
          },
        ]}
      >
        <DateRangeFilter labels={{ from: t.app.from, to: t.app.to }} />
      </SearchFilters>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/invoices/${r.id}`}
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
