'use client';

import { useActionState, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react';

import { saveCouponAction, deleteCouponAction } from '@/app/actions/settings';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatDate, toDateInput } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  minAmount: number;
  maxDiscount: number;
  usageLimit: number;
  usedCount: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  invoiceCount: number;
}

export function CouponManager({
  coupons,
  canEdit,
  canDelete,
  currency,
  decimals,
  locale,
  labels,
}: {
  coupons: Coupon[];
  canEdit: boolean;
  canDelete: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [type, setType] = useState<'PERCENT' | 'FIXED'>('PERCENT');

  const [state, formAction] = useActionState<FormState | null, FormData>(
    saveCouponAction,
    null,
  );

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setOpen(false);
      setEditing(null);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCouponAction(id);
      if (result.ok) {
        toast.success(result.message ?? 'تم الحذف');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الحذف');
      }
    });
  }

  function openForm(coupon: Coupon | null) {
    setEditing(coupon);
    setType((coupon?.type as 'PERCENT' | 'FIXED') ?? 'PERCENT');
    setOpen(true);
  }

  const now = new Date();

  return (
    <>
      {canEdit && (
        <div className="border-b border-border p-3">
          <Button size="sm" onClick={() => openForm(null)} icon={<Plus className="h-4 w-4" />}>
            {labels.add}
          </Button>
        </div>
      )}

      {coupons.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {coupons.map((coupon) => {
            const expired = coupon.endsAt ? new Date(coupon.endsAt) < now : false;
            const exhausted =
              coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit;

            return (
              <li key={coupon.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Ticket className="h-[18px] w-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="numeric font-mono text-sm font-bold" dir="ltr">
                      {coupon.code}
                    </span>
                    <Badge tone="emerald" size="sm">
                      {coupon.type === 'PERCENT'
                        ? `${coupon.value}%`
                        : money(coupon.value)}
                    </Badge>
                    {!coupon.isActive && (
                      <Badge tone="gray" size="sm">
                        معطّل
                      </Badge>
                    )}
                    {expired && (
                      <Badge tone="rose" size="sm">
                        منتهي
                      </Badge>
                    )}
                    {exhausted && (
                      <Badge tone="amber" size="sm">
                        مستنفد
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {coupon.description ?? '—'}
                    <span className="numeric">
                      {' · '}
                      {labels.usedCount}: {coupon.usedCount}
                      {coupon.usageLimit > 0 ? `/${coupon.usageLimit}` : ''}
                      {coupon.endsAt
                        ? ` · ${labels.endsAt}: ${formatDate(coupon.endsAt, locale)}`
                        : ''}
                    </span>
                  </p>
                </div>

                {canEdit && (
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => openForm(coupon)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={labels.edit}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteId(coupon.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label={labels.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? labels.edit : labels.add}
        size="md"
      >
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <FormGrid cols={2}>
            <Field label={labels.code} required>
              <Input
                name="code"
                defaultValue={editing?.code ?? ''}
                required
                autoFocus
                dir="ltr"
                className="text-start font-mono uppercase"
              />
            </Field>

            <Field label={labels.type}>
              <Select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as 'PERCENT' | 'FIXED')}
                options={[
                  { value: 'PERCENT', label: labels.percent },
                  { value: 'FIXED', label: labels.fixed },
                ]}
              />
            </Field>

            <Field label={labels.value} required>
              <Input
                name="value"
                type="number"
                min={0}
                max={type === 'PERCENT' ? 100 : undefined}
                step="any"
                defaultValue={editing?.value ?? ''}
                required
              />
            </Field>

            <Field label={labels.maxDiscount} hint={labels.unlimited}>
              <Input
                name="maxDiscount"
                type="number"
                min={0}
                step="any"
                defaultValue={editing?.maxDiscount ?? 0}
              />
            </Field>

            <Field label={labels.minAmount}>
              <Input
                name="minAmount"
                type="number"
                min={0}
                step="any"
                defaultValue={editing?.minAmount ?? 0}
              />
            </Field>

            <Field label={labels.usageLimit} hint={labels.unlimited}>
              <Input
                name="usageLimit"
                type="number"
                min={0}
                defaultValue={editing?.usageLimit ?? 0}
              />
            </Field>

            <Field label={labels.startsAt}>
              <Input
                name="startsAt"
                type="date"
                defaultValue={toDateInput(editing?.startsAt ?? new Date())}
              />
            </Field>

            <Field label={labels.endsAt}>
              <Input name="endsAt" type="date" defaultValue={toDateInput(editing?.endsAt)} />
            </Field>

            <Field label={labels.description} className="sm:col-span-2">
              <Input name="description" defaultValue={editing?.description ?? ''} />
            </Field>
          </FormGrid>

          <Checkbox
            name="isActive"
            defaultChecked={editing?.isActive ?? true}
            label={labels.active}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
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
