import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { getI18n } from '@/i18n';
import { getFinanceSettings, getShopInfo } from '@/lib/settings';
import { buildReport, REPORT_KEYS, type ReportKey } from '@/lib/reports';
import { reportLabels } from '@/lib/report-labels';
import { PERIODS } from '@/lib/analytics';
import { toCsv, toExcel, downloadHeaders, CONTENT_TYPES, type ExportColumn } from '@/lib/export';
import { startOfDay, endOfDay, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ReportRow = Record<string, string | number | Date | null>;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!can(user, 'reports:export')) {
    return NextResponse.json({ error: 'لا تملك صلاحية التصدير' }, { status: 403 });
  }

  const url = new URL(request.url);
  const reportKey = url.searchParams.get('report') ?? 'profit-loss';
  const format = url.searchParams.get('format') ?? 'csv';
  const preset = url.searchParams.get('preset') ?? 'month';

  if (!(REPORT_KEYS as readonly string[]).includes(reportKey)) {
    return NextResponse.json({ error: 'تقرير غير معروف' }, { status: 400 });
  }
  if (format !== 'csv' && format !== 'xlsx') {
    return NextResponse.json({ error: 'صيغة تصدير غير مدعومة' }, { status: 400 });
  }

  // الفترة
  let period = PERIODS.month();
  if (preset === 'today') period = PERIODS.today();
  else if (preset === 'year') period = PERIODS.year();
  else if (preset === 'week') period = PERIODS.days(7);
  else if (preset === 'custom') {
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (from && !Number.isNaN(from.getTime())) {
      period = {
        from: startOfDay(from),
        to: to && !Number.isNaN(to.getTime()) ? endOfDay(to) : endOfDay(),
      };
    }
  }

  try {
    const { locale, t } = await getI18n();
    const [finance, shop] = await Promise.all([getFinanceSettings(), getShopInfo()]);
    const report = await buildReport(reportKey as ReportKey, period, reportLabels(t));

    // إضافة صف المجاميع إلى البيانات المصدَّرة
    const rows: ReportRow[] = [...report.rows];
    if (report.totals) rows.push(report.totals as ReportRow);

    const columns: ExportColumn<ReportRow>[] = report.columns.map((column) => ({
      key: column.key,
      header: column.header,
      type: column.type,
      value: (row) => row[column.key] ?? '',
      width: column.type === 'currency' ? 16 : column.key.length > 8 ? 22 : 14,
    }));

    const periodText = `${formatDate(period.from, locale)} — ${formatDate(period.to, locale)}`;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${shop.name}-${reportKey}-${stamp}.${format}`;

    await audit({
      action: 'EXPORT',
      entity: 'Report',
      entityId: reportKey,
      summary: `تصدير تقرير ${report.title} (${format}) للفترة ${periodText}`,
      user,
    });

    if (format === 'csv') {
      return new NextResponse(toCsv(rows, columns), {
        headers: downloadHeaders(filename, CONTENT_TYPES.csv),
      });
    }

    const buffer = await toExcel(rows, columns, {
      sheetName: report.title.slice(0, 30),
      title: `${shop.name} — ${report.title}`,
      subtitle: periodText,
      currency: finance.currency,
      rtl: locale === 'ar',
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: downloadHeaders(filename, CONTENT_TYPES.xlsx),
    });
  } catch (error) {
    console.error('[reports/export]', error);
    return NextResponse.json({ error: 'تعذّر إنشاء ملف التصدير' }, { status: 500 });
  }
}
