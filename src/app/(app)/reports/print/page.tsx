import type { Metadata } from 'next';

import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings, getShopInfo } from '@/lib/settings';
import { buildReport, REPORT_KEYS, type ReportKey } from '@/lib/reports';
import { reportLabels } from '@/lib/report-labels';
import { PERIODS } from '@/lib/analytics';
import {
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  startOfDay,
  endOfDay,
} from '@/lib/utils';
import { PrintTrigger } from '@/components/print-trigger';

export const metadata: Metadata = { title: 'طباعة تقرير' };
export const dynamic = 'force-dynamic';

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('reports:view');
  const { locale, t } = await getI18n();
  const [finance, shop] = await Promise.all([getFinanceSettings(), getShopInfo()]);
  const params = await searchParams;

  const reportKey = (
    typeof params.report === 'string' && (REPORT_KEYS as readonly string[]).includes(params.report)
      ? params.report
      : 'profit-loss'
  ) as ReportKey;
  const preset = typeof params.preset === 'string' ? params.preset : 'month';

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

  const report = await buildReport(reportKey, period, reportLabels(t));

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  function cell(value: string | number | Date | null, type?: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (value instanceof Date) return formatDate(value, locale);
    if (type === 'currency' && typeof value === 'number') return money(value);
    if (type === 'number' && typeof value === 'number') return formatNumber(value, locale);
    return String(value);
  }

  return (
    <div className="mx-auto max-w-[297mm] bg-white p-6 text-black print:p-0">
      <PrintTrigger label={t.app.print} backLabel={t.app.back} />

      <article className="text-[10px]">
        <header className="mb-4 flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
          <div>
            <h1 className="text-xl font-bold">{shop.name}</h1>
            {shop.address && <p className="text-[9px] text-gray-600">{shop.address}</p>}
            {shop.phone && (
              <p className="text-[9px] text-gray-600" dir="ltr">
                {shop.phone}
              </p>
            )}
          </div>
          <div className="text-end">
            <h2 className="text-lg font-bold">{report.title}</h2>
            <p className="text-[9px] text-gray-600" dir="ltr">
              {formatDate(period.from, locale)} — {formatDate(period.to, locale)}
            </p>
            <p className="text-[8px] text-gray-500" dir="ltr">
              {formatDateTime(new Date(), locale)}
            </p>
          </div>
        </header>

        {report.summary && report.summary.length > 0 && (
          <div className="mb-4 grid grid-cols-4 gap-2">
            {report.summary.map((item) => (
              <div key={item.label} className="rounded border border-gray-300 p-2 text-center">
                <p className="text-[9px] text-gray-600">{item.label}</p>
                <p className="text-sm font-bold" dir="ltr">
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

        {report.rows.length === 0 ? (
          <p className="py-10 text-center text-gray-500">{t.report.noDataForPeriod}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {report.columns.map((column) => (
                  <th
                    key={column.key}
                    className={`border border-gray-300 px-1.5 py-1 text-[9px] ${
                      column.align === 'end'
                        ? 'text-end'
                        : column.align === 'center'
                          ? 'text-center'
                          : 'text-start'
                    }`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index} className={index % 2 === 1 ? 'bg-gray-50' : ''}>
                  {report.columns.map((column) => {
                    const value = row[column.key] ?? null;
                    const negative =
                      column.type === 'currency' && typeof value === 'number' && value < 0;
                    return (
                      <td
                        key={column.key}
                        dir={column.align === 'end' || column.align === 'center' ? 'ltr' : undefined}
                        className={`border border-gray-300 px-1.5 py-1 ${
                          column.align === 'end'
                            ? 'text-end'
                            : column.align === 'center'
                              ? 'text-center'
                              : 'text-start'
                        } ${negative ? 'text-red-700' : ''}`}
                      >
                        {cell(value, column.type)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {report.totals && (
              <tfoot>
                <tr className="bg-gray-200 font-bold">
                  {report.columns.map((column) => {
                    const value = report.totals?.[column.key] ?? null;
                    return (
                      <td
                        key={column.key}
                        dir={column.align === 'end' ? 'ltr' : undefined}
                        className={`border border-gray-400 px-1.5 py-1 ${
                          column.align === 'end'
                            ? 'text-end'
                            : column.align === 'center'
                              ? 'text-center'
                              : 'text-start'
                        }`}
                      >
                        {value === null ? '' : cell(value, column.type)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        )}

        <footer className="mt-6 border-t border-gray-200 pt-2 text-center text-[8px] text-gray-500">
          {shop.name} · {report.title}
        </footer>
      </article>
    </div>
  );
}
