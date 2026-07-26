'use client';

import { useActionState, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, RefreshCcw } from 'lucide-react';

import {
  createExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from '@/app/actions/expenses';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Checkbox } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isRecurringDefault: boolean;
  expenseCount: number;
  yearTotal: string;
}

const PRESET_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#ef4444',
  '#f97316',
  '#64748b',
  '#14b8a6',
  '#ec4899',
  '#84cc16',
];

export function ExpenseCategoryManager({
  categories,
  canEdit,
  canDelete,
  labels,
}: {
  categories: Category[];
  canEdit: boolean;
  canDelete: boolean;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, startTransition] = useTransition();

  const [state, formAction] = useActionState<FormState | null, FormData>(
    createExpenseCategoryAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم');
      setShowForm(false);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteExpenseCategoryAction(id);
      if (result.ok) {
        toast.success(result.message ?? 'تم الحذف');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الحذف');
      }
    });
  }

  return (
    <>
      {canEdit && (
        <div className="border-b border-border p-3">
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            {labels.newCategory}
          </Button>
        </div>
      )}

      {categories.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: category.color ?? '#94a3b8' }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{category.name}</p>
                <p className="numeric text-xs text-muted-foreground">
                  {category.expenseCount} · {category.yearTotal}
                </p>
              </div>
              {category.isRecurringDefault && (
                <Badge tone="violet" size="sm">
                  <RefreshCcw className="h-3 w-3" />
                  {labels.recurringDefault}
                </Badge>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setDeleteId(category.id)}
                  disabled={pending}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  aria-label={labels.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        title={labels.newCategory}
        size="sm"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="color" value={color} />

          <Field label={labels.name} required>
            <Input name="name" required autoFocus maxLength={80} />
          </Field>

          <Field label={labels.color}>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === preset ? 'scale-110 ring-2 ring-ring ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: preset }}
                  aria-label={preset}
                />
              ))}
            </div>
          </Field>

          <Checkbox name="isRecurringDefault" label={labels.recurringDefault} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove(deleteId);
        }}
        title={labels.delete}
        message={labels.confirmDelete}
      />
    </>
  );
}
