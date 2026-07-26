import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/page';
import { ExpenseForm } from '../expense-form';
import { expenseFormLabels } from '../labels';

export const metadata: Metadata = { title: 'تعديل مصروف' };

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('expenses:update');
  const { t } = await getI18n();
  const { id } = await params;

  const [expense, categories] = await Promise.all([
    db.expense.findUnique({ where: { id } }),
    db.expenseCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isRecurringDefault: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!expense) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.actions.edit}
        description={
          <span className="numeric">
            {expense.number} · {expense.description}
          </span>
        }
        backHref="/expenses"
        breadcrumbs={[
          { label: t.expense.title, href: '/expenses' },
          { label: expense.number },
        ]}
      />
      <ExpenseForm values={expense} categories={categories} labels={expenseFormLabels(t)} />
    </div>
  );
}
