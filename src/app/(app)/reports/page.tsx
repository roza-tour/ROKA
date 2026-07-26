import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import {
  buildReport,
  REPORT_KEYS,
  type ReportKey,
  type ReportResult,
} from '@/lib/reports';
import { reportLabels, reportMenu } from '@/lib/report-labels';
import { PERIODS } from '@/lib/analytics';
import {
  formatMoney,
  formatNumber,
  formatDate,
  startOfDay,
  endOfDay,
  cn,
} from '@/lib/utils';

import { PageHeader, Card } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { ReportPeriodPicker } from './period-picker';

export const metadata: Metadata = { title: 'التقارير' };
export const dynamic = 'force-dynamic';

function isReportKey(value: unknown): value is ReportKey {
  return typeof value === 'string' && (REPORT_KEYS as readonly string[]).includes(value);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('reports:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const reportKey: ReportKey = isReportKey(params.report) ? params.report : 'profit-loss';
  const preset = typeof params.preset === 'string' ? params.preset : 'month';

  // الفترة: إعداد جاهز أو مدى مخصّص
  let period = PERIODS.month();
  if (preset === 'today') period = PERIODS.today();
  else if (preset === 'year') period = PERIODS.year();
  else if (preset === 'week') period = PERIODS.days(7);
  else if (preset === 'custom') {
    const from = typeof params.from === 'string' ? new Date(params.from) : null;
    const to = typeof params.to === 'string' ? new Date(params.to) : null;
    if (from && !Number.isNaN(from.getTime())) {
      period = {
        from: startOfDay(from),
        to: to && !Number.isNaN(to.getTime()) ? endOfDay(to) : endOfDay(),
      };
    }
  }

  const labels = reportLabels(t);
  const report: ReportResult = await buildReport(reportKey, period, labels);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  function renderCell(
    value: string | number | Date | null,
    type: string | undefined,
  ): React.ReactNode {
    if (value === null || value === undefined || value === '') return '—';
    if (value instanceof Date) return formatDate(value, locale);
    if (type === 'currency' && typeof value === 'number') return money(value);
    if (type === 'number' && typeof value === 'number') return formatNumber(value, locale);
    return String(value);
  }

  const exportParams = new URLSearchParams({
    report: reportKey,
    preset,
    ...(typeof params.from === 'string' ? { from: params.from } : {}),
    ...(typeof params.to === 'string' ? { to: params.to } : {}),
  });

  const menu = reportMenu(t);

  return (
    <div>
      <PageHeader
        title={t.report.title}
        description={`${formatDate(period.from, locale)} — ${formatDate(period.to, locale)}`}
        actions={
          can(user, 'reports:export') && (
            <>
              <a href={`/api/reports/export?format=xlsx&${exportParams}`}>
                <Button variant="outline" icon={<FileSpreadsheet className="h-4 w-4" />}>
                  {t.report.exportExcel}
                </Button>
              </a>
              <a href={`/api/reports/export?format=csv&${exportParams}`}>
                <Button variant="outline" icon={<FileText className="h-4 w-4" />}>
                  {t.report.exportCsv}
                </Button>
              </a>
              <Link href={`/reports/print?${exportParams}`} target="_blank">
                <Button variant="outline" icon={<Printer className="h-4 w-4" />}>
                  {t.report.exportPdf}
                </Button>
              </Link>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* قائمة التقارير */}
        <nav className="no-print">
          <ul className="space-y-0.5 rounded-lg border border-border p-2">
            {menu.map((entry) => {
              const Icon =
                (Icons[entry.icon as keyof typeof Icons] as React.ElementType) ?? Icons.FileText;
              const active = reportKey === entry.key;
              const href = `/reports?${new URLSearchParams({
                report: entry.key,
                preset,
                ...(typeof params.from === 'string' ? { from: params.from } : {}),
                ...(typeof params.to === 'string' ? { to: params.to } : {}),
              })}`;
              return (
                <li key={entry.key}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{entry.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          <ReportPeriodPicker
            labels={{
              today: t.app.today,
              week: t.app.thisWeek,
              month: t.app.thisMonth,
              year: t.app.thisYear,
              custom: t.app.custom,
              from: t.app.from,
              to: t.app.to,
              apply: t.app.apply,
            }}
          />

          {/* بطاقات الملخص */}
          {report.summary && report.summary.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.summary.map((item) => (
                <div key={item.label} className="card p-4">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p
                    className={cn(
                      'numeric mt-1 text-xl font-bold',
                      item.type === 'currency' && item.value < 0 && 'text-danger',
                      item.type === 'currency' && item.value > 0 && 'text-foreground',
                    )}
                  >
                    {item.type === 'currency'
                      ? money(item.value)
                      : item.type === 'percent'
                        ? `${item.value.toFixed(1)}%`
                        : formatNumber(item.value, locale)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Card title={report.title} bodyClassName="p-0">
            {report.rows.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {t.report.noDataForPeriod}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      {report.columns.map((column) => (
                        <th
                          key={column.key}
                          className={
                            column.align === 'end'
                              ? 'text-end'
                              : column.align === 'center'
                                ? 'text-center'
                                : 'text-start'
                          }
                        >
                          {column.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, index) => (
                      <tr key={index}>
                        {report.columns.map((column) => {
                          const value = row[column.key] ?? null;
                          const isNegative =
                            column.type === 'currency' &&
                            typeof value === 'number' &&
                            value < 0;
                          return (
                            <td
                              key={column.key}
                              className={cn(
                                column.align === 'end'
                                  ? 'numeric text-end'
                                  : column.align === 'center'
                                    ? 'numeric text-center'
                                    : 'text-start',
                                isNegative && 'text-danger',
                              )}
                            >
                              {renderCell(value, column.type)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {report.totals && (
                    <tfoot className="bg-muted/50 font-semibold">
                      <tr>
                        {report.columns.map((column) => {
                          const value = report.totals?.[column.key] ?? null;
                          return (
                            <td
                              key={column.key}
                              className={cn(
                                'border-t-2 border-border',
                                column.align === 'end'
                                  ? 'numeric text-end'
                                  : column.align === 'center'
                                    ? 'numeric text-center'
                                    : 'text-start',
                              )}
                            >
                              {value === null ? '' : renderCell(value, column.type)}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
