import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Wrench, Receipt, Clock, ShieldCheck, KeyRound } from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { PERIODS } from '@/lib/analytics';
import {
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  formatRelative,
  initials,
  safeJsonParse,
} from '@/lib/utils';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import type { Role, AttendanceStatus } from '@/lib/constants';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/repair-status-badge';
import { EmployeeAdminActions } from './admin-actions';

export const metadata: Metadata = { title: 'ملف الموظف' };
export const dynamic = 'force-dynamic';

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('employees:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;
  const search = await searchParams;

  const month = PERIODS.month();

  const [employee, repairsThisMonth, salesThisMonth, attendance, activity] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: { branch: { select: { name: true } } },
    }),
    db.repairOrder.count({
      where: {
        technicianId: id,
        completedAt: { gte: month.from, lte: month.to },
      },
    }),
    db.invoice.aggregate({
      where: {
        userId: id,
        issuedAt: { gte: month.from, lte: month.to },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      _sum: { total: true, profit: true },
      _count: true,
    }),
    db.attendance.findMany({
      where: { userId: id, date: { gte: month.from } },
      orderBy: { date: 'desc' },
      take: 31,
    }),
    can(user, 'audit:view')
      ? db.auditLog.findMany({
          where: { userId: id },
          select: {
            id: true,
            action: true,
            entity: true,
            summary: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        })
      : [],
  ]);

  if (!employee) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const extraPermissions = safeJsonParse<string[]>(employee.permissions, []);
  const rolePermissions = ROLE_PERMISSIONS[employee.role as Role] ?? [];
  const totalMinutes = attendance.reduce((sum, record) => sum + record.minutes, 0);
  const generatedPassword = typeof search.password === 'string' ? search.password : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {employee.fullName}
            <Badge tone="blue" size="sm">
              {t.roles[employee.role as Role] ?? employee.role}
            </Badge>
            {!employee.isActive && (
              <Badge tone="gray" size="sm">
                معطّل
              </Badge>
            )}
          </span>
        }
        description={
          <span className="numeric">
            {employee.username}
            {employee.jobTitle ? ` · ${employee.jobTitle}` : ''}
          </span>
        }
        backHref="/employees"
        breadcrumbs={[
          { label: t.employee.title, href: '/employees' },
          { label: employee.fullName },
        ]}
        actions={
          <>
            {can(user, 'employees:update') && (
              <>
                <EmployeeAdminActions
                  employeeId={employee.id}
                  labels={{
                    resetPassword: t.employee.resetPassword,
                    forceLogout: t.employee.forceLogout,
                    confirm: t.actions.submit,
                    cancel: t.actions.cancel,
                    resetWarning:
                      'سيتم إنشاء كلمة مرور مؤقتة وإنهاء كل جلسات هذا المستخدم.',
                    logoutWarning: 'سيُطلب من المستخدم تسجيل الدخول مجدداً على كل الأجهزة.',
                    newPassword: t.auth.newPassword,
                  }}
                />
                <Link href={`/employees/${employee.id}/edit`}>
                  <Button icon={<Pencil className="h-4 w-4" />}>{t.actions.edit}</Button>
                </Link>
              </>
            )}
          </>
        }
      />

      {generatedPassword && (
        <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/10 p-4">
          <KeyRound className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">كلمة المرور المؤقتة</p>
            <p className="numeric font-mono text-lg font-bold" dir="ltr">
              {generatedPassword}
            </p>
            <p className="text-xs text-muted-foreground">
              سلّمها للموظف — سيُطلب منه تغييرها عند أول دخول. لن تظهر مرة أخرى.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.employee.repairsCompleted}
          value={formatNumber(repairsThisMonth, locale)}
          icon={Wrench}
          tone="primary"
          hint={t.app.thisMonth}
        />
        <StatCard
          label={t.employee.salesMade}
          value={money(salesThisMonth._sum.total ?? 0)}
          icon={Receipt}
          tone="success"
          hint={`${salesThisMonth._count} فاتورة`}
        />
        <StatCard
          label={t.attendance.hours}
          value={`${Math.floor(totalMinutes / 60)}س`}
          icon={Clock}
          tone="info"
          hint={`${attendance.length} يوم حضور`}
        />
        {can(user, 'payroll:view') && (
          <StatCard
            label={t.employee.baseSalary}
            value={money(employee.baseSalary)}
            icon={ShieldCheck}
            tone="default"
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title={t.app.details}>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials(employee.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{employee.fullName}</p>
                <p className="numeric text-sm text-muted-foreground">{employee.username}</p>
              </div>
            </div>

            <dl className="divide-y divide-border">
              {employee.email && (
                <DetailRow label={t.employee.email}>
                  <span dir="ltr">{employee.email}</span>
                </DetailRow>
              )}
              {employee.phone && (
                <DetailRow label={t.employee.phone}>
                  <span className="numeric">{employee.phone}</span>
                </DetailRow>
              )}
              {employee.jobTitle && (
                <DetailRow label={t.employee.jobTitle}>{employee.jobTitle}</DetailRow>
              )}
              {employee.hireDate && (
                <DetailRow label={t.employee.hireDate}>
                  <span className="numeric">{formatDate(employee.hireDate, locale)}</span>
                </DetailRow>
              )}
              {employee.nationalId && (
                <DetailRow label={t.employee.nationalId}>
                  <span className="numeric">{employee.nationalId}</span>
                </DetailRow>
              )}
              {employee.branch && (
                <DetailRow label={t.employee.branch}>{employee.branch.name}</DetailRow>
              )}
              <DetailRow label={t.auth.login}>
                <span className="text-sm">
                  {employee.lastLoginAt ? formatRelative(employee.lastLoginAt, locale) : '—'}
                </span>
              </DetailRow>
            </dl>

            {employee.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {employee.notes}
              </p>
            )}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {t.employee.permissions}
              </span>
            }
          >
            {employee.role === 'ADMIN' ? (
              <p className="text-sm text-muted-foreground">مدير النظام — كل الصلاحيات</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    من الدور ({rolePermissions.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {rolePermissions.slice(0, 30).map((permission) => (
                      <Badge key={permission} tone="blue" size="sm">
                        {permission}
                      </Badge>
                    ))}
                    {rolePermissions.length > 30 && (
                      <Badge tone="gray" size="sm">
                        +{rolePermissions.length - 30}
                      </Badge>
                    )}
                  </div>
                </div>

                {extraPermissions.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t.employee.customPermissions} ({extraPermissions.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {extraPermissions.map((permission) => (
                        <Badge key={permission} tone="emerald" size="sm">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t.attendance.title} — {t.app.thisMonth}
              </span>
            }
            bodyClassName="p-0"
          >
            {attendance.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{t.attendance.date}</th>
                      <th className="text-center">{t.attendance.checkIn}</th>
                      <th className="text-center">{t.attendance.checkOut}</th>
                      <th className="text-center">{t.attendance.hours}</th>
                      <th className="text-center">{t.attendance.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.id}>
                        <td className="numeric">{formatDate(record.date, locale)}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {activity.length > 0 && (
            <Card title={t.employee.activity} bodyClassName="p-0">
              <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-5 py-2.5">
                    <Badge tone="gray" size="sm">
                      {t.audit.actions[entry.action as keyof typeof t.audit.actions] ??
                        entry.action}
                    </Badge>
                    <span className="min-w-0 flex-1 text-sm">
                      {entry.summary ?? entry.entity}
                    </span>
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
