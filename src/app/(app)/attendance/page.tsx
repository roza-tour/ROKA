import type { Metadata } from 'next';
import { Clock, Users, CalendarCheck } from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import {
  formatDate,
  formatNumber,
  startOfDay,
  startOfMonth,
  endOfMonth,
  initials,
} from '@/lib/utils';
import type { AttendanceStatus } from '@/lib/constants';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/repair-status-badge';
import { PunchCard } from './punch-card';
import { AttendanceEditor } from './attendance-editor';

export const metadata: Metadata = { title: 'الحضور والانصراف' };
export const dynamic = 'force-dynamic';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('attendance:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const monthParam = typeof params.month === 'string' ? params.month : null;
  const base = monthParam ? new Date(`${monthParam}-01`) : new Date();
  const from = startOfMonth(Number.isNaN(base.getTime()) ? new Date() : base);
  const to = endOfMonth(from);
  const today = startOfDay();

  const canManage = can(user, 'attendance:update');

  const [employees, records, myToday, presentToday] = await Promise.all([
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, jobTitle: true },
      orderBy: { fullName: 'asc' },
    }),
    db.attendance.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(canManage ? {} : { userId: user?.id }),
      },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: [{ date: 'desc' }],
    }),
    user
      ? db.attendance.findUnique({
          where: { userId_date: { userId: user.id, date: today } },
        })
      : null,
    db.attendance.count({ where: { date: today, status: 'PRESENT' } }),
  ]);

  // تجميع السجلات حسب الموظف لملخص الشهر
  const summaryByUser = new Map<
    string,
    { name: string; days: number; minutes: number; late: number; absent: number }
  >();
  for (const record of records) {
    const entry = summaryByUser.get(record.user.id) ?? {
      name: record.user.fullName,
      days: 0,
      minutes: 0,
      late: 0,
      absent: 0,
    };
    if (record.status === 'PRESENT' || record.status === 'LATE') entry.days += 1;
    if (record.status === 'LATE') entry.late += 1;
    if (record.status === 'ABSENT') entry.absent += 1;
    entry.minutes += record.minutes;
    summaryByUser.set(record.user.id, entry);
  }

  const monthValue = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.attendance.title}
        description={formatDate(from, locale, { year: 'numeric', month: 'long' })}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <PunchCard
          hasCheckedIn={Boolean(myToday?.checkIn)}
          hasCheckedOut={Boolean(myToday?.checkOut)}
          checkInTime={
            myToday?.checkIn
              ? formatDate(myToday.checkIn, locale, { hour: '2-digit', minute: '2-digit' })
              : null
          }
          checkOutTime={
            myToday?.checkOut
              ? formatDate(myToday.checkOut, locale, { hour: '2-digit', minute: '2-digit' })
              : null
          }
          minutes={myToday?.minutes ?? 0}
          labels={{
            title: t.attendance.title,
            checkIn: t.attendance.checkIn,
            checkOut: t.attendance.checkOut,
            done: t.app.confirm,
            hours: t.attendance.hours,
          }}
        />

        <StatCard
          label="الحاضرون اليوم"
          value={formatNumber(presentToday, locale)}
          icon={Users}
          tone="success"
          hint={`من ${employees.length} موظف`}
        />

        <StatCard
          label={t.attendance.monthlySummary}
          value={formatNumber(records.length, locale)}
          icon={CalendarCheck}
          tone="primary"
          hint="سجل حضور"
        />
      </section>

      {/* ملخص الشهر لكل موظف */}
      {canManage && summaryByUser.size > 0 && (
        <Card title={t.attendance.monthlySummary} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t.employee.single}</th>
                  <th className="text-center">أيام الحضور</th>
                  <th className="text-center">{t.attendance.hours}</th>
                  <th className="text-center">{t.attendance.statuses.LATE}</th>
                  <th className="text-center">{t.attendance.statuses.ABSENT}</th>
                </tr>
              </thead>
              <tbody>
                {[...summaryByUser.entries()].map(([userId, summary]) => (
                  <tr key={userId}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {initials(summary.name)}
                        </span>
                        {summary.name}
                      </span>
                    </td>
                    <td className="numeric text-center font-medium">{summary.days}</td>
                    <td className="numeric text-center">
                      {Math.floor(summary.minutes / 60)}:
                      {String(summary.minutes % 60).padStart(2, '0')}
                    </td>
                    <td className="numeric text-center text-warning">{summary.late || '—'}</td>
                    <td className="numeric text-center text-danger">{summary.absent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* السجلات */}
      <Card
        title={t.attendance.title}
        actions={
          canManage && (
            <AttendanceEditor
              employees={employees.map((e) => ({ id: e.id, name: e.fullName }))}
              currentMonth={monthValue}
              labels={{
                add: t.actions.add,
                employee: t.employee.single,
                date: t.attendance.date,
                checkIn: t.attendance.checkIn,
                checkOut: t.attendance.checkOut,
                status: t.attendance.status,
                statuses: t.attendance.statuses as Record<string, string>,
                notes: t.customer.notes,
                save: t.actions.save,
                cancel: t.actions.cancel,
              }}
            />
          )
        }
        bodyClassName="p-0"
      >
        {records.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t.app.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t.attendance.date}</th>
                  {canManage && <th>{t.employee.single}</th>}
                  <th className="text-center">{t.attendance.checkIn}</th>
                  <th className="text-center">{t.attendance.checkOut}</th>
                  <th className="text-center">{t.attendance.hours}</th>
                  <th className="text-center">{t.attendance.status}</th>
                  <th>{t.customer.notes}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="numeric">{formatDate(record.date, locale)}</td>
                    {canManage && <td>{record.user.fullName}</td>}
                    <td className="numeric text-center">
                      {record.checkIn
                        ? formatDate(record.checkIn, locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="numeric text-center">
                      {record.checkOut
                        ? formatDate(record.checkOut, locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="numeric text-center">
                      {record.minutes
                        ? `${Math.floor(record.minutes / 60)}:${String(record.minutes % 60).padStart(2, '0')}`
                        : '—'}
                    </td>
                    <td className="text-center">
                      <StatusBadge
                        status={record.status}
                        labels={t.attendance.statuses as Record<string, string>}
                      />
                    </td>
                    <td className="text-xs text-muted-foreground">{record.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
