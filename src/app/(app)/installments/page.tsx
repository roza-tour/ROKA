import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarRange, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, fullName, round, daysUntil } from '@/lib/utils';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/repair-status-badge';
import { Badge } from '@/components/ui/badge';
import { PayInstallmentButton } from './pay-button';

export const metadata: Metadata = { title: 'الأقساط والديون' };
export const dynamic = 'force-dynamic';

const INSTALLMENT_LABELS: Record<string, string> = {
  PENDING: 'مستحق',
  PAID: 'مسدّد',
  OVERDUE: 'متأخر',
  WAIVED: 'معفى',
};

export default async function InstallmentsPage() {
  await pagePermission('invoices:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const now = new Date();

  const [plans, overdueCount, debtors] = await Promise.all([
    db.installmentPlan.findMany({
      where: { status: 'ACTIVE' },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        invoice: { select: { id: true, number: true } },
        installments: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.installment.count({
      where: { status: 'PENDING', dueDate: { lt: now } },
    }),
    db.customer.findMany({
      where: { balance: { lt: 0 }, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true, balance: true },
      orderBy: { balance: 'asc' },
      take: 20,
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const totalOutstanding = round(
    plans.reduce(
      (sum, plan) =>
        sum +
        plan.installments
          .filter((i) => i.status !== 'PAID')
          .reduce((s, i) => s + i.amount, 0),
      0,
    ),
  );
  const totalDebt = round(debtors.reduce((sum, c) => sum + Math.abs(c.balance), 0));
  const canPay = can(user, 'payments:create');

  return (
    <div className="space-y-6">
      <PageHeader title={t.nav.installments} />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="أقساط مستحقة"
          value={money(totalOutstanding)}
          icon={CalendarRange}
          tone="primary"
          hint={`${plans.length} خطة نشطة`}
        />
        <StatCard
          label="أقساط متأخرة"
          value={String(overdueCount)}
          icon={AlertTriangle}
          tone={overdueCount > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="إجمالي ديون العملاء"
          value={money(totalDebt)}
          icon={CheckCircle2}
          tone={totalDebt > 0 ? 'warning' : 'success'}
          hint={`${debtors.length} عميل`}
        />
      </section>

      {/* خطط الأقساط */}
      {plans.length === 0 ? (
        <Card title={t.nav.installments}>
          <p className="py-8 text-center text-sm text-muted-foreground">{t.app.noData}</p>
        </Card>
      ) : (
        plans.map((plan) => {
          const paid = round(
            plan.installments.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0),
          );
          const remaining = round(plan.totalAmount - plan.downPayment - paid);

          return (
            <Card
              key={plan.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="numeric">{plan.number}</span>
                  <Link
                    href={`/customers/${plan.customer.id}`}
                    className="text-sm font-normal text-muted-foreground hover:text-primary"
                  >
                    {fullName(plan.customer.firstName, plan.customer.lastName)}
                  </Link>
                  {plan.invoice && (
                    <Link
                      href={`/invoices/${plan.invoice.id}`}
                      className="numeric text-xs font-normal text-primary hover:underline"
                    >
                      {plan.invoice.number}
                    </Link>
                  )}
                </span>
              }
              description={
                <span className="numeric">
                  {money(plan.totalAmount)} · {t.invoice.paid}: {money(paid + plan.downPayment)} ·{' '}
                  {t.invoice.due}: {money(remaining)}
                </span>
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="w-14 text-center">#</th>
                      <th>{t.invoice.dueDate}</th>
                      <th className="text-end">{t.payment.amount}</th>
                      <th className="text-center">{t.invoice.status}</th>
                      {canPay && <th className="w-24" />}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.installments.map((installment) => {
                      const isOverdue =
                        installment.status === 'PENDING' && installment.dueDate < now;
                      const remainingDays = daysUntil(installment.dueDate);
                      return (
                        <tr key={installment.id}>
                          <td className="numeric text-center">{installment.sequence}</td>
                          <td>
                            <span className="numeric text-sm">
                              {formatDate(installment.dueDate, locale)}
                            </span>
                            {installment.status === 'PENDING' &&
                              remainingDays !== null &&
                              remainingDays >= 0 &&
                              remainingDays <= 7 && (
                                <Badge tone="amber" size="sm" className="ms-2">
                                  خلال {remainingDays} يوم
                                </Badge>
                              )}
                          </td>
                          <td className="numeric text-end font-medium">
                            {money(installment.amount)}
                          </td>
                          <td className="text-center">
                            <StatusBadge
                              status={isOverdue ? 'OVERDUE' : installment.status}
                              labels={INSTALLMENT_LABELS}
                            />
                            {installment.paidAt && (
                              <span className="numeric mt-0.5 block text-[11px] text-muted-foreground">
                                {formatDate(installment.paidAt, locale)}
                              </span>
                            )}
                          </td>
                          {canPay && (
                            <td className="text-center">
                              {installment.status !== 'PAID' && (
                                <PayInstallmentButton
                                  installmentId={installment.id}
                                  amount={money(installment.amount)}
                                  labels={{
                                    pay: t.actions.pay,
                                    method: t.payment.method,
                                    methods: t.payment.methods as Record<string, string>,
                                    confirm: t.actions.submit,
                                    cancel: t.actions.cancel,
                                  }}
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}

      {/* العملاء المدينون */}
      {debtors.length > 0 && (
        <Card title="العملاء المدينون" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {debtors.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {fullName(customer.firstName, customer.lastName)}
                    </p>
                    <p className="numeric text-xs text-muted-foreground">{customer.phone}</p>
                  </div>
                  <span className="numeric font-semibold text-danger">
                    {money(Math.abs(customer.balance))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
