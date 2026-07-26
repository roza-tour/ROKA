import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Wrench,
  PackageCheck,
  Truck,
  AlarmClock,
  ShoppingBag,
  TrendingUp,
  CalendarDays,
  CalendarRange,
  TrendingDown,
  Wallet,
  Boxes,
  Plus,
  ScanLine,
  UserPlus,
  FileText,
} from 'lucide-react';

import { can } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { formatMoney, formatNumber, formatDate, percentChange } from '@/lib/utils';
import {
  PERIODS,
  previousPeriod,
  getProfitAndLoss,
  getRepairCounts,
  getStockSummary,
  getDailySeries,
  getRepairSeries,
  getTopServices,
  getTopProducts,
  getDashboardAlerts,
} from '@/lib/analytics';
import { db } from '@/lib/db';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { RevenueAreaChart, TrendLineChart } from '@/components/charts';
import { RepairStatusBadge } from '@/components/repair-status-badge';
import { AlertsPanel } from './alerts-panel';

export const metadata: Metadata = { title: 'لوحة التحكم' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await pagePermission('dashboard:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const today = PERIODS.today();
  const month = PERIODS.month();
  const year = PERIODS.year();

  const [
    todayPL,
    yesterdayPL,
    monthPL,
    lastMonthPL,
    yearPL,
    repairs,
    stock,
    dailySeries,
    repairSeries,
    topServices,
    topProducts,
    alerts,
    recentRepairs,
  ] = await Promise.all([
    getProfitAndLoss(today),
    getProfitAndLoss(previousPeriod(today)),
    getProfitAndLoss(month),
    getProfitAndLoss(previousPeriod(month)),
    getProfitAndLoss(year),
    getRepairCounts(month),
    getStockSummary(),
    getDailySeries(30),
    getRepairSeries(30),
    getTopServices(month, 6),
    getTopProducts(month, 6),
    getDashboardAlerts(5),
    db.repairOrder.findMany({
      select: {
        id: true,
        number: true,
        status: true,
        receivedAt: true,
        promisedAt: true,
        customer: { select: { firstName: true, lastName: true } },
        device: { select: { brand: true, model: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  const chartData = dailySeries.map((p) => ({
    ...p,
    date: formatDate(p.date, locale, { month: 'short', day: 'numeric' }),
  }));
  const repairChartData = repairSeries.map((p) => ({
    ...p,
    date: formatDate(p.date, locale, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t.dashboard.welcome}، ${user?.fullName ?? ''}`}
        description={formatDate(new Date(), locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
        actions={
          <>
            {can(user, 'repairs:create') && (
              <QuickAction href="/repairs/new" icon={Plus} label={t.nav.newRepair} primary />
            )}
            {can(user, 'pos:view') && (
              <QuickAction href="/pos" icon={ScanLine} label={t.nav.pos} />
            )}
            {can(user, 'customers:create') && (
              <QuickAction href="/customers/new" icon={UserPlus} label={t.customer.new} />
            )}
            {can(user, 'quotations:create') && (
              <QuickAction href="/quotations/new" icon={FileText} label={t.quotation.new} />
            )}
          </>
        }
      />

      {/* مؤشرات الصيانة */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.dashboard.devicesInRepair}
          value={formatNumber(repairs.active, locale)}
          icon={Wrench}
          tone="primary"
          href="/repairs?status=active"
          hint={`${formatNumber(repairs.byStatus.WAITING_PARTS ?? 0, locale)} بانتظار قطع غيار`}
        />
        <StatCard
          label={t.dashboard.devicesReady}
          value={formatNumber(repairs.ready, locale)}
          icon={PackageCheck}
          tone="success"
          href="/repairs?status=READY"
        />
        <StatCard
          label={t.dashboard.devicesDelivered}
          value={formatNumber(repairs.deliveredInPeriod, locale)}
          icon={Truck}
          tone="info"
          href="/repairs?status=DELIVERED"
          hint={t.app.thisMonth}
        />
        <StatCard
          label={t.dashboard.devicesOverdue}
          value={formatNumber(repairs.overdue, locale)}
          icon={AlarmClock}
          tone={repairs.overdue > 0 ? 'danger' : 'default'}
          href="/repairs?overdue=1"
        />
      </section>

      {/* المؤشرات المالية */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.dashboard.dailySales}
          value={money(todayPL.revenue)}
          icon={ShoppingBag}
          tone="primary"
          change={percentChange(todayPL.revenue, yesterdayPL.revenue)}
          changeLabel={t.app.yesterday}
          hint={`${formatNumber(todayPL.invoiceCount, locale)} فاتورة`}
        />
        <StatCard
          label={t.dashboard.dailyProfit}
          value={money(todayPL.netProfit)}
          icon={TrendingUp}
          tone={todayPL.netProfit >= 0 ? 'success' : 'danger'}
          change={percentChange(todayPL.netProfit, yesterdayPL.netProfit)}
          changeLabel={t.app.yesterday}
        />
        <StatCard
          label={t.dashboard.monthlyProfit}
          value={money(monthPL.netProfit)}
          icon={CalendarDays}
          tone={monthPL.netProfit >= 0 ? 'success' : 'danger'}
          change={percentChange(monthPL.netProfit, lastMonthPL.netProfit)}
          changeLabel={t.app.lastMonth}
        />
        <StatCard
          label={t.dashboard.yearlyProfit}
          value={money(yearPL.netProfit)}
          icon={CalendarRange}
          tone={yearPL.netProfit >= 0 ? 'success' : 'danger'}
          hint={`${t.report.margin}: ${yearPL.margin.toFixed(1)}%`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`${t.dashboard.expenses} · ${t.app.thisMonth}`}
          value={money(monthPL.expenses)}
          icon={TrendingDown}
          tone="warning"
          change={percentChange(monthPL.expenses, lastMonthPL.expenses)}
          invertChange
          href="/expenses"
        />
        <StatCard
          label={`${t.dashboard.revenue} · ${t.app.thisMonth}`}
          value={money(monthPL.revenue)}
          icon={Wallet}
          tone="info"
          change={percentChange(monthPL.revenue, lastMonthPL.revenue)}
          hint={`${t.invoice.due}: ${money(monthPL.outstanding)}`}
        />
        <StatCard
          label={t.dashboard.stockValue}
          value={money(stock.totalValue)}
          icon={Boxes}
          tone="default"
          href="/inventory"
          hint={`${formatNumber(stock.itemCount, locale)} صنف · ${formatNumber(stock.lowStockCount, locale)} منخفض`}
        />
        <StatCard
          label={t.dashboard.netProfit}
          value={money(monthPL.netProfit)}
          icon={TrendingUp}
          tone={monthPL.netProfit >= 0 ? 'success' : 'danger'}
          hint={`${t.report.grossProfit}: ${money(monthPL.profit)}`}
        />
      </section>

      {/* الرسوم البيانية */}
      <section className="grid gap-4 xl:grid-cols-3">
        <Card title={t.dashboard.profitChart} description="آخر 30 يوماً" className="xl:col-span-2">
          <RevenueAreaChart
            data={chartData}
            locale={locale}
            currency={finance.currency}
            series={[
              { key: 'revenue', label: t.dashboard.revenue, color: '#0d9488' },
              { key: 'profit', label: t.dashboard.profit, color: '#10b981' },
              { key: 'expenses', label: t.dashboard.expenses, color: '#f59e0b' },
            ]}
          />
        </Card>

        <Card title={t.dashboard.alerts} bodyClassName="p-0">
          <AlertsPanel
            alerts={alerts}
            locale={locale}
            currency={finance.currency}
            decimals={finance.decimals}
            labels={{
              lowStock: t.dashboard.lowStockAlert,
              overdueRepairs: t.dashboard.overdueRepairsAlert,
              unpaidInvoices: t.dashboard.unpaidInvoicesAlert,
              warranties: t.dashboard.warrantyExpiringAlert,
              expenses: t.dashboard.recurringExpensesAlert,
              empty: t.dashboard.noAlerts,
            }}
          />
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card title={t.dashboard.repairsChart} description="آخر 30 يوماً">
          <TrendLineChart
            data={repairChartData}
            locale={locale}
            height={220}
            series={[
              { key: 'received', label: t.repair.receivedAt, color: '#6366f1' },
              { key: 'delivered', label: t.repair.deliveredAt, color: '#10b981' },
            ]}
          />
        </Card>

        <Card title={t.dashboard.topServices} description={t.app.thisMonth}>
          <RankedList
            items={topServices}
            locale={locale}
            emptyText={t.app.noData}
            valueFormatter={money}
          />
        </Card>

        <Card title={t.dashboard.topParts} description={t.app.thisMonth}>
          <RankedList
            items={topProducts}
            locale={locale}
            emptyText={t.app.noData}
            valueFormatter={money}
          />
        </Card>
      </section>

      {/* آخر أوامر الصيانة */}
      <Card
        title={t.dashboard.recentRepairs}
        actions={
          <Link href="/repairs" className="text-sm text-primary hover:underline">
            {t.app.more}
          </Link>
        }
        bodyClassName="p-0"
      >
        {recentRepairs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentRepairs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/repairs/${r.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="numeric">{r.number}</span>
                      <span className="truncate text-muted-foreground">
                        {[r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ')}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.device.brand} {r.device.model}
                    </p>
                  </div>
                  <RepairStatusBadge status={r.status} labels={t.repair.statuses} />
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {formatDate(r.receivedAt, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-600'
          : 'inline-flex h-10 items-center gap-2 rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent'
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function RankedList({
  items,
  locale,
  emptyText,
  valueFormatter,
}: {
  items: { id: string; name: string; count: number; revenue: number; extra?: string }[];
  locale: string;
  emptyText: string;
  valueFormatter: (v: number) => string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.id} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="numeric w-4 shrink-0 text-xs text-muted-foreground">
                {index + 1}
              </span>
              <span className="truncate font-medium">{item.name}</span>
            </span>
            <span className="numeric shrink-0 text-xs text-muted-foreground">
              {valueFormatter(item.revenue)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
              />
            </div>
            <Badge size="sm" tone="gray">
              <span className="numeric">{formatNumber(item.count, locale as never)}</span>
            </Badge>
          </div>
        </li>
      ))}
    </ol>
  );
}
