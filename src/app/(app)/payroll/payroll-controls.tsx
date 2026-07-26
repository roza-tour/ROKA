'use client';

import { useActionState, useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Pencil, Check, Plus } from 'lucide-react';

import {
  generatePayrollAction,
  updatePayrollAction,
  markPayrollPaidAction,
} from '@/app/actions/employees';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea, Select, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { round } from '@/lib/utils';

/** اختيار الفترة وإنشاء كشف الرواتب */
export function PayrollControls({
  period,
  periods,
  canGenerate,
  labels,
}: {
  period: string;
  periods: string[];
  canGenerate: boolean;
  labels: { period: string; generate: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function selectPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function generate() {
    startTransition(async () => {
      const result = await generatePayrollAction(period);
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الإنشاء');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={period}
        onChange={(e) => selectPeriod(e.target.value)}
        className="h-10 w-40"
        options={periods.map((p) => ({ value: p, label: p }))}
        aria-label={labels.period}
      />
      {canGenerate && (
        <Button onClick={generate} loading={pending} icon={<Plus className="h-4 w-4" />}>
          {labels.generate}
        </Button>
      )}
    </div>
  );
}

interface PayrollRecord {
  id: string;
  userId: string;
  period: string;
  baseSalary: number;
  bonuses: number;
  commissions: number;
  deductions: number;
  advances: number;
  notes: string | null;
  status: string;
}

/** تعديل راتب موظف أو تسجيله كمدفوع */
export function PayrollRowActions({
  payroll,
  employeeName,
  labels,
}: {
  payroll: PayrollRecord;
  employeeName: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<'edit' | 'pay' | null>(null);
  const [pending, startTransition] = useTransition();

  const [state, formAction] = useActionState<FormState | null, FormData>(
    updatePayrollAction,
    null,
  );

  const [amounts, setAmounts] = useState({
    baseSalary: payroll.baseSalary,
    bonuses: payroll.bonuses,
    commissions: payroll.commissions,
    deductions: payroll.deductions,
    advances: payroll.advances,
  });

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setDialog(null);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  const net = round(
    amounts.baseSalary +
      amounts.bonuses +
      amounts.commissions -
      amounts.deductions -
      amounts.advances,
  );

  const isPaid = payroll.status === 'PAID';

  function pay() {
    startTransition(async () => {
      const result = await markPayrollPaidAction(payroll.id);
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        setDialog(null);
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّرت العملية');
      }
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        {!isPaid && (
          <>
            <button
              type="button"
              onClick={() => setDialog('edit')}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={labels.edit}
              title={labels.edit}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDialog('pay')}
              className="rounded p-1.5 text-muted-foreground hover:bg-success/10 hover:text-success"
              aria-label={labels.markPaid}
              title={labels.markPaid}
            >
              <Check className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <Dialog
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
        title={`${labels.edit} — ${employeeName}`}
        size="md"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={payroll.id} />
          <input type="hidden" name="userId" value={payroll.userId} />
          <input type="hidden" name="period" value={payroll.period} />

          <FormGrid cols={2}>
            {(
              [
                ['baseSalary', labels.baseSalary],
                ['bonuses', labels.bonuses],
                ['commissions', labels.commissions],
                ['deductions', labels.deductions],
                ['advances', labels.advances],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  name={key}
                  type="number"
                  min={0}
                  step="any"
                  value={amounts[key]}
                  onChange={(e) =>
                    setAmounts({ ...amounts, [key]: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            ))}

            <Field label={labels.notes} className="sm:col-span-2">
              <Textarea name="notes" defaultValue={payroll.notes ?? ''} rows={2} />
            </Field>
          </FormGrid>

          <div className="rounded-md bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">{labels.netAmount}</p>
            <p className="numeric text-2xl font-bold">{net}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'pay'}
        onClose={() => setDialog(null)}
        title={labels.markPaid}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button variant="success" onClick={pay} loading={pending}>
              {labels.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {employeeName} — {labels.netAmount}: <span className="numeric font-bold">{net}</span>
        </p>
        <p className="mt-2 rounded-md bg-info/10 p-2 text-xs text-info">{labels.payWarning}</p>
      </Dialog>
    </>
  );
}
