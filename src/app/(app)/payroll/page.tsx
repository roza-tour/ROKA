import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { Banknote, Wallet, Users } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber, formatDate, initials, round } from '@/lib/utils';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/repair-status-badge';
import { PayrollControls, PayrollRowActions } from './payroll-controls';

export const metadata: Metadata = { title: 'الرواتب' };
export const dynamic = 'force-dynamic';

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('payroll:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const period =
    typeof params.period === 'string' && /^\d{4}-\d{2}$/.test(params.period)
      ? params.period
      : currentPeriod();

  const canManage = can(user, 'payroll:update');

  const [records, periods] = await Promise.all([
    db.payroll.findMany({
      where: { period },
      include: { user: { select: { id: true, fullName: true, jobTitle: true, role: true } } },
      orderBy: { user: { fullName: 'asc' } },
    }),
    db.payroll.findMany({
      distinct: ['period'],
      select: { period: true },
      orderBy: { period: 'desc' },
      take: 24,
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const totalNet = round(records.reduce((sum, r) => sum + r.netAmount, 0));
  const totalPaid = round(
    records.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + r.netAmount, 0),
  );
  const pendingCount = records.filter((r) => r.status === 'PENDING').length;

  const periodOptions = [
    ...new Set([currentPeriod(), ...periods.map((p) => p.period)]),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.payroll.title}
        description={period}
        actions={
          <PayrollControls
            period={period}
            periods={periodOptions}
            canGenerate={can(user, 'payroll:create')}
            labels={{
              period: t.payroll.period,
              generate: t.payroll.generate,
            }}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.payroll.netAmount}
          value={money(totalNet)}
          icon={Banknote}
          tone="primary"
          hint={`${formatNumber(records.length, locale)} موظف`}
        />
        <StatCard
          label={t.payroll.statuses.PAID}
          value={money(totalPaid)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label={t.payroll.statuses.PENDING}
          value={money(round(totalNet - totalPaid))}
          icon={Users}
          tone={pendingCount > 0 ? 'warning' : 'default'}
          hint={`${pendingCount} سجل`}
        />
      </section>

      <Card title={`${t.payroll.title} — ${period}`} bodyClassName="p-0">
        {records.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {t.app.noData} — {t.payroll.generate}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t.employee.single}</th>
                  <th className="text-end">{t.payroll.baseSalary}</th>
                  <th className="text-end">{t.payroll.bonuses}</th>
                  <th className="text-end">{t.payroll.commissions}</th>
                  <th className="text-end">{t.payroll.deductions}</th>
                  <th className="text-end">{t.payroll.advances}</th>
                  <th className="text-end">{t.payroll.netAmount}</th>
                  <th className="text-center">{t.invoice.status}</th>
                  {canManage && <th className="w-32" />}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {initials(record.user.fullName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {record.user.fullName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {record.user.jobTitle ?? '—'}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="numeric text-end">{money(record.baseSalary)}</td>
                    <td className="numeric text-end text-success">
                      {record.bonuses ? money(record.bonuses) : '—'}
                    </td>
                    <td className="numeric text-end text-success">
                      {record.commissions ? money(record.commissions) : '—'}
                    </td>
                    <td className="numeric text-end text-danger">
                      {record.deductions ? money(record.deductions) : '—'}
                    </td>
                    <td className="numeric text-end text-danger">
                      {record.advances ? money(record.advances) : '—'}
                    </td>
                    <td className="numeric text-end font-bold">{money(record.netAmount)}</td>
                    <td className="text-center">
                      <StatusBadge
                        status={record.status}
                        labels={t.payroll.statuses as Record<string, string>}
                      />
                      {record.paidAt && (
                        <span className="numeric mt-0.5 block text-[11px] text-muted-foreground">
                          {formatDate(record.paidAt, locale)}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <PayrollRowActions
                          payroll={{
                            id: record.id,
                            userId: record.userId,
                            period: record.period,
                            baseSalary: record.baseSalary,
                            bonuses: record.bonuses,
                            commissions: record.commissions,
                            deductions: record.deductions,
                            advances: record.advances,
                            notes: record.notes,
                            status: record.status,
                          }}
                          employeeName={record.user.fullName}
                          labels={{
                            edit: t.actions.edit,
                            markPaid: t.payroll.markPaid,
                            baseSalary: t.payroll.baseSalary,
                            bonuses: t.payroll.bonuses,
                            commissions: t.payroll.commissions,
                            deductions: t.payroll.deductions,
                            advances: t.payroll.advances,
                            notes: t.customer.notes,
                            netAmount: t.payroll.netAmount,
                            save: t.actions.save,
                            cancel: t.actions.cancel,
                            confirm: t.actions.submit,
                            payWarning:
                              'سيُسجَّل الراتب كمصروف في قسم المصروفات ويؤثر على صافي الربح.',
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 font-semibold">
                <tr>
                  <td>{t.app.total}</td>
                  <td className="numeric text-end">
                    {money(round(records.reduce((s, r) => s + r.baseSalary, 0)))}
                  </td>
                  <td className="numeric text-end">
                    {money(round(records.reduce((s, r) => s + r.bonuses, 0)))}
                  </td>
                  <td className="numeric text-end">
                    {money(round(records.reduce((s, r) => s + r.commissions, 0)))}
                  </td>
                  <td className="numeric text-end">
                    {money(round(records.reduce((s, r) => s + r.deductions, 0)))}
                  </td>
                  <td className="numeric text-end">
                    {money(round(records.reduce((s, r) => s + r.advances, 0)))}
                  </td>
                  <td className="numeric text-end text-base">{money(totalNet)}</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
