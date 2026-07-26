import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/utils';
import { PERIODS } from '@/lib/analytics';
import { PageHeader, Card } from '@/components/ui/page';
import { ExpenseCategoryManager } from './category-manager';

export const metadata: Metadata = { title: 'تصنيفات المصروفات' };
export const dynamic = 'force-dynamic';

export default async function ExpenseCategoriesPage() {
  await requirePermission('expenses:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();

  const period = PERIODS.year();

  const categories = await db.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { expenses: true } },
    },
  });

  // إجمالي السنة لكل تصنيف
  const totals = await db.expense.groupBy({
    by: ['categoryId'],
    where: { date: { gte: period.from, lte: period.to } },
    _sum: { amount: true },
  });
  const totalsMap = new Map(totals.map((row) => [row.categoryId, row._sum.amount ?? 0]));

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.expense.categories}
        backHref="/expenses"
        breadcrumbs={[
          { label: t.expense.title, href: '/expenses' },
          { label: t.expense.categories },
        ]}
      />

      <Card title={t.expense.categories} bodyClassName="p-0">
        <ExpenseCategoryManager
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            isRecurringDefault: c.isRecurringDefault,
            expenseCount: c._count.expenses,
            yearTotal: money(totalsMap.get(c.id) ?? 0),
          }))}
          canEdit={can(user, 'expenses:create')}
          canDelete={can(user, 'expenses:delete')}
          labels={{
            name: t.expense.category,
            color: 'اللون',
            recurringDefault: t.expense.isRecurring,
            count: t.report.count,
            yearTotal: t.expense.yearlyTotal,
            add: t.actions.add,
            delete: t.actions.delete,
            cancel: t.actions.cancel,
            save: t.actions.save,
            newCategory: t.service.newCategory,
            confirmDelete: t.app.confirmDelete,
            empty: t.app.noData,
          }}
        />
      </Card>
    </div>
  );
}
