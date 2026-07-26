import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, TrendingDown, CalendarDays, CalendarRange, RefreshCcw, Tags } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { PERIODS, getExpensesTotal, getExpensesByCategory, getDailySeries } from '@/lib/analytics';
import { formatMoney, formatDate, normalizeDigits, endOfDay } from '@/lib/utils';
import { RECURRENCES, type Recurrence, type PaymentMethod } from '@/lib/constants';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters, DateRangeFilter } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DistributionPieChart, ComparisonBarChart } from '@/components/charts';
import { RecurringExpenseButton } from './recurring-button';

export const metadata: Metadata = { title: 'المصروفات' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type ExpenseRow = {
  id: string;
  number: string;
  description: string;
  amount: number;
  date: Date;
  paymentMethod: string;
  vendor: string | null;
  isRecurring: boolean;
  recurrence: string | null;
  nextDueDate: Date | null;
  category: { name: string; color: string | null } | null;
  user: { fullName: string } | null;
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('expenses:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : '';
  const recurring = params.recurring === '1';
  const from = typeof params.from === 'string' ? new Date(params.from) : null;
  const to = typeof params.to === 'string' ? endOfDay(new Date(params.to)) : null;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.ExpenseWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(recurring ? { isRecurring: true } : {}),
    ...(from || to
      ? {
          date: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { description: { contains: q } },
            { vendor: { contains: q } },
            { reference: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, categories, todayTotal, monthTotal, yearTotal, byCategory, series, dueRecurring] =
    await Promise.all([
      db.expense.findMany({
        where,
        select: {
          id: true,
          number: true,
          description: true,
          amount: true,
          date: true,
          paymentMethod: true,
          vendor: true,
          isRecurring: true,
          recurrence: true,
          nextDueDate: true,
          category: { select: { name: true, color: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.expense.count({ where }),
      db.expenseCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      getExpensesTotal(PERIODS.today()),
      getExpensesTotal(PERIODS.month()),
      getExpensesTotal(PERIODS.year()),
      getExpensesByCategory(PERIODS.month()),
      getDailySeries(30),
      db.expense.findMany({
        where: { isRecurring: true, nextDueDate: { lte: new Date() } },
        select: {
          id: true,
          description: true,
          amount: true,
          nextDueDate: true,
          category: { select: { name: true } },
        },
        orderBy: { nextDueDate: 'asc' },
        take: 10,
      }),
    ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'description',
      header: t.expense.description,
      render: (row) => (
        <div>
          <p className="font-medium">{row.description}</p>
          <p className="numeric text-xs text-muted-foreground">
            {row.number}
            {row.vendor ? ` · ${row.vendor}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: t.expense.category,
      hideOnMobile: true,
      render: (row) =>
        row.category ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            {row.category.color && (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.category.color }}
                aria-hidden
              />
            )}
            {row.category.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'date',
      header: t.expense.date,
      align: 'center',
      render: (row) => (
        <span className="numeric text-sm">{formatDate(row.date, locale)}</span>
      ),
    },
    {
      key: 'method',
      header: t.payment.method,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {t.payment.methods[row.paymentMethod as PaymentMethod] ?? row.paymentMethod}
        </span>
      ),
    },
    {
      key: 'recurring',
      header: t.expense.isRecurring,
      align: 'center',
      hideOnMobile: true,
      render: (row) =>
        row.isRecurring ? (
          <div className="flex flex-col items-center gap-0.5">
            <Badge tone="violet" size="sm">
              {t.expense.recurrences[row.recurrence as Recurrence] ?? row.recurrence}
            </Badge>
            {row.nextDueDate && (
              <span className="numeric text-[11px] text-muted-foreground">
                {formatDate(row.nextDueDate, locale)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'amount',
      header: t.expense.amount,
      align: 'end',
      render: (row) => (
        <span className="numeric font-semibold text-danger">{money(row.amount)}</span>
      ),
    },
  ];

  const baseUrl = `/expenses?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  const chartData = series.map((point) => ({
    date: formatDate(point.date, locale, { month: 'short', day: 'numeric' }),
    expenses: point.expenses,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.expense.title}
        actions={
          <>
            {can(user, 'expenses:create') && (
              <>
                <Link href="/expenses/categories">
                  <Button variant="outline" icon={<Tags className="h-4 w-4" />}>
                    {t.expense.categories}
                  </Button>
                </Link>
                <Link href="/expenses/new">
                  <Button icon={<Plus className="h-4 w-4" />}>{t.expense.new}</Button>
                </Link>
              </>
            )}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.expense.dailyTotal}
          value={money(todayTotal)}
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          label={t.expense.monthlyTotal}
          value={money(monthTotal)}
          icon={CalendarDays}
          tone="warning"
        />
        <StatCard
          label={t.expense.yearlyTotal}
          value={money(yearTotal)}
          icon={CalendarRange}
          tone="warning"
        />
        <StatCard
          label={t.dashboard.recurringExpensesAlert}
          value={String(dueRecurring.length)}
          icon={RefreshCcw}
          tone={dueRecurring.length > 0 ? 'danger' : 'default'}
          href="/expenses?recurring=1"
        />
      </section>

      {/* المصروفات الدورية المستحقة */}
      {dueRecurring.length > 0 && can(user, 'expenses:create') && (
        <Card title={t.dashboard.recurringExpensesAlert} bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {dueRecurring.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{expense.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.category?.name ?? '—'}
                    {expense.nextDueDate && (
                      <span className="numeric ms-2">
                        {formatDate(expense.nextDueDate, locale)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="numeric font-semibold text-danger">
                    {money(expense.amount)}
                  </span>
                  <RecurringExpenseButton
                    expenseId={expense.id}
                    label={t.actions.pay}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title={t.expense.trend} description="آخر 30 يوماً">
          <ComparisonBarChart
            data={chartData}
            locale={locale}
            currency={finance.currency}
            height={240}
            series={[{ key: 'expenses', label: t.expense.title, color: '#f59e0b' }]}
          />
        </Card>

        <Card title={t.expense.byCategory} description={t.app.thisMonth}>
          <DistributionPieChart
            data={byCategory.map((c) => ({ name: c.name, value: c.amount }))}
            locale={locale}
            currency={finance.currency}
            height={240}
          />
        </Card>
      </section>

      <div>
        <SearchFilters
          placeholder="ابحث بالوصف أو الجهة أو رقم المصروف"
          labels={{ clear: t.app.clear, filter: t.app.filter }}
          filters={[
            {
              name: 'categoryId',
              label: t.expense.category,
              options: categories.map((c) => ({ value: c.id, label: c.name })),
            },
          ]}
        >
          <DateRangeFilter labels={{ from: t.app.from, to: t.app.to }} />
        </SearchFilters>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/expenses/${r.id}`}
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
    </div>
  );
}
