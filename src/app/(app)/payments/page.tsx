import type { Metadata } from 'next';
import Link from 'next/link';
import { Wallet, TrendingUp, CreditCard } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import {
  formatMoney,
  formatDateTime,
  fullName,
  normalizeDigits,
  endOfDay,
  round,
} from '@/lib/utils';
import { PERIODS } from '@/lib/analytics';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/constants';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters, DateRangeFilter } from '@/components/ui/search-filters';
import { Badge } from '@/components/ui/badge';
import { DistributionPieChart } from '@/components/charts';

export const metadata: Metadata = { title: 'المدفوعات' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

const METHOD_TONES: Record<string, 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'gray'> = {
  CASH: 'emerald',
  CARD: 'blue',
  BANK_TRANSFER: 'violet',
  WALLET: 'amber',
  CREDIT: 'rose',
  CHECK: 'gray',
};

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  direction: string;
  createdAt: Date;
  invoice: { id: string; number: string } | null;
  customer: { id: string; firstName: string; lastName: string | null } | null;
  user: { fullName: string } | null;
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('payments:view');
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const method = typeof params.method === 'string' ? params.method : '';
  const from = typeof params.from === 'string' ? new Date(params.from) : null;
  const to = typeof params.to === 'string' ? endOfDay(new Date(params.to)) : null;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.PaymentWhereInput = {
    ...(method ? { method } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { notes: { contains: q } },
            { invoice: { number: { contains: q } } },
            { customer: { firstName: { contains: q } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : {}),
  };

  const today = PERIODS.today();
  const month = PERIODS.month();

  const [rows, total, todaySum, monthSum, byMethod] = await Promise.all([
    db.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        direction: true,
        createdAt: true,
        invoice: { select: { id: true, number: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.payment.count({ where }),
    db.payment.aggregate({
      where: { createdAt: { gte: today.from, lte: today.to }, direction: 'IN' },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { createdAt: { gte: month.from, lte: month.to }, direction: 'IN' },
      _sum: { amount: true },
    }),
    db.payment.groupBy({
      by: ['method'],
      where: { createdAt: { gte: month.from, lte: month.to }, direction: 'IN' },
      _sum: { amount: true },
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<PaymentRow>[] = [
    {
      key: 'date',
      header: t.payment.date,
      render: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {formatDateTime(row.createdAt, locale)}
        </span>
      ),
    },
    {
      key: 'invoice',
      header: t.invoice.single,
      render: (row) =>
        row.invoice ? (
          <Link
            href={`/invoices/${row.invoice.id}`}
            className="numeric text-sm font-medium hover:text-primary"
          >
            {row.invoice.number}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">تسوية رصيد</span>
        ),
    },
    {
      key: 'customer',
      header: t.invoice.customer,
      render: (row) =>
        row.customer ? (
          <Link href={`/customers/${row.customer.id}`} className="text-sm hover:text-primary">
            {fullName(row.customer.firstName, row.customer.lastName)}
          </Link>
        ) : (
          <span className="text-muted-foreground">{t.invoice.walkIn}</span>
        ),
    },
    {
      key: 'method',
      header: t.payment.method,
      align: 'center',
      render: (row) => (
        <Badge tone={METHOD_TONES[row.method] ?? 'gray'} size="sm">
          {t.payment.methods[row.method as PaymentMethod] ?? row.method}
        </Badge>
      ),
    },
    {
      key: 'reference',
      header: t.payment.reference,
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric text-xs text-muted-foreground">{row.reference ?? '—'}</span>
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
    {
      key: 'amount',
      header: t.payment.amount,
      align: 'end',
      render: (row) => (
        <span
          className={`numeric font-semibold ${
            row.direction === 'IN' ? 'text-success' : 'text-danger'
          }`}
        >
          {row.direction === 'IN' ? '+' : '−'} {money(row.amount)}
        </span>
      ),
    },
  ];

  const baseUrl = `/payments?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t.payment.title} />

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label={`${t.payment.title} · ${t.app.today}`}
          value={money(todaySum._sum.amount ?? 0)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label={`${t.payment.title} · ${t.app.thisMonth}`}
          value={money(monthSum._sum.amount ?? 0)}
          icon={TrendingUp}
          tone="primary"
        />
        <Card title={t.payment.method} description={t.app.thisMonth} className="lg:row-span-2">
          <DistributionPieChart
            data={byMethod.map((row) => ({
              name: t.payment.methods[row.method as PaymentMethod] ?? row.method,
              value: round(row._sum.amount ?? 0),
            }))}
            locale={locale}
            currency={finance.currency}
            height={220}
          />
        </Card>
      </section>

      <div>
        <SearchFilters
          placeholder="ابحث برقم الفاتورة أو المرجع أو العميل"
          labels={{ clear: t.app.clear, filter: t.app.filter }}
          filters={[
            {
              name: 'method',
              label: t.payment.method,
              options: PAYMENT_METHODS.map((m) => ({ value: m, label: t.payment.methods[m] })),
            },
          ]}
        >
          <DateRangeFilter labels={{ from: t.app.from, to: t.app.to }} />
        </SearchFilters>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          empty={t.app.noData}
          dense
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
    </div>
  );
}
