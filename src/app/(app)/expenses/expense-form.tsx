'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save } from 'lucide-react';

import { createExpenseAction, updateExpenseAction } from '@/app/actions/expenses';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';
import { PAYMENT_METHODS, RECURRENCES } from '@/lib/constants';
import { toDateInput } from '@/lib/utils';

export interface ExpenseFormValues {
  id?: string;
  categoryId?: string | null;
  description?: string;
  amount?: number;
  date?: Date | string;
  paymentMethod?: string;
  vendor?: string | null;
  reference?: string | null;
  notes?: string | null;
  isRecurring?: boolean;
  recurrence?: string | null;
  reminderDays?: number;
}

/** نصوص النموذج — يبنيها الخادم عبر expenseFormLabels() */
export interface ExpenseFormLabels {
  section: string;
  recurringSection: string;
  description: string;
  amount: string;
  date: string;
  category: string;
  method: string;
  methods: Record<string, string>;
  vendor: string;
  reference: string;
  notes: string;
  isRecurring: string;
  recurrence: string;
  recurrences: Record<string, string>;
  reminderDays: string;
  reminderHint: string;
  none: string;
  save: string;
  cancel: string;
}

export function ExpenseForm({
  values = {},
  categories,
  labels,
}: {
  values?: ExpenseFormValues;
  categories: { id: string; name: string; isRecurringDefault: boolean }[];
  labels: ExpenseFormLabels;
}) {
  const isEdit = Boolean(values.id);
  const router = useRouter();
  const [state, formAction] = useActionState<FormState | null, FormData>(
    isEdit ? updateExpenseAction : createExpenseAction,
    null,
  );
  const toast = useToast();
  const [isRecurring, setIsRecurring] = useState(values.isRecurring ?? false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      router.push('/expenses');
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  const err = (field: string) => state?.errors?.[field];

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={values.id} />}

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Card title={labels.section}>
        <FormGrid cols={2}>
          <Field
            label={labels.description}
            required
            error={err('description')}
            htmlFor="description"
            className="sm:col-span-2"
          >
            <Input
              id="description"
              name="description"
              defaultValue={values.description ?? ''}
              required
              autoFocus
              invalid={Boolean(err('description'))}
            />
          </Field>

          <Field label={labels.amount} required error={err('amount')} htmlFor="amount">
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="any"
              defaultValue={values.amount ?? ''}
              required
              invalid={Boolean(err('amount'))}
            />
          </Field>

          <Field label={labels.date} required htmlFor="date">
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={toDateInput(values.date ?? new Date())}
              required
            />
          </Field>

          <Field label={labels.category} htmlFor="categoryId">
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={values.categoryId ?? ''}
              placeholder={labels.none}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(e) => {
                const category = categories.find((c) => c.id === e.target.value);
                if (category?.isRecurringDefault && !isEdit) setIsRecurring(true);
              }}
            />
          </Field>

          <Field label={labels.method} htmlFor="paymentMethod">
            <Select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={values.paymentMethod ?? 'CASH'}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: labels.methods[m] }))}
            />
          </Field>

          <Field label={labels.vendor} htmlFor="vendor">
            <Input id="vendor" name="vendor" defaultValue={values.vendor ?? ''} />
          </Field>

          <Field label={labels.reference} htmlFor="reference">
            <Input
              id="reference"
              name="reference"
              defaultValue={values.reference ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          <Field label={labels.notes} htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ''} rows={2} />
          </Field>
        </FormGrid>
      </Card>

      <Card title={labels.recurringSection}>
        <div className="space-y-4">
          <Checkbox
            name="isRecurring"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            label={labels.isRecurring}
          />

          {isRecurring && (
            <FormGrid cols={2}>
              <Field label={labels.recurrence} htmlFor="recurrence">
                <Select
                  id="recurrence"
                  name="recurrence"
                  defaultValue={values.recurrence ?? 'MONTHLY'}
                  options={RECURRENCES.map((r) => ({ value: r, label: labels.recurrences[r] }))}
                />
              </Field>

              <Field
                label={labels.reminderDays}
                hint={labels.reminderHint}
                htmlFor="reminderDays"
              >
                <Input
                  id="reminderDays"
                  name="reminderDays"
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={values.reminderDays ?? 3}
                />
              </Field>
            </FormGrid>
          )}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/expenses">
          <Button type="button" variant="outline">
            {labels.cancel}
          </Button>
        </Link>
        <SubmitButton label={labels.save} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} icon={<Save className="h-4 w-4" />}>
      {label}
    </Button>
  );
}
