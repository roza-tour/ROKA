import type { Dictionary } from '@/i18n';
import type { ExpenseFormLabels } from './expense-form';

/** نصوص نموذج المصروف */
export function expenseFormLabels(t: Dictionary): ExpenseFormLabels {
  return {
    section: t.expense.single,
    recurringSection: t.expense.isRecurring,
    description: t.expense.description,
    amount: t.expense.amount,
    date: t.expense.date,
    category: t.expense.category,
    method: t.payment.method,
    methods: t.payment.methods as Record<string, string>,
    vendor: t.expense.vendor,
    reference: t.expense.reference,
    notes: t.customer.notes,
    isRecurring: t.expense.isRecurring,
    recurrence: t.expense.recurrence,
    recurrences: t.expense.recurrences as Record<string, string>,
    reminderDays: t.expense.reminderDays,
    reminderHint: 'التنبيه في لوحة التحكم قبل موعد الاستحقاق',
    none: t.app.none,
    save: t.actions.save,
    cancel: t.actions.cancel,
  };
}
