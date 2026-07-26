import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { ExpenseForm } from '../expense-form';
import { expenseFormLabels } from '../labels';

export const metadata: Metadata = { title: 'مصروف جديد' };

export default async function NewExpensePage() {
  await requirePermission('expenses:create');
  const { t } = await getI18n();

  const categories = await db.expenseCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, isRecurringDefault: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.expense.new}
        backHref="/expenses"
        breadcrumbs={[{ label: t.expense.title, href: '/expenses' }, { label: t.expense.new }]}
      />
      <ExpenseForm categories={categories} labels={expenseFormLabels(t)} />
    </div>
  );
}
