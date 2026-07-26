'use client';

import { useActionState, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { upsertAttendanceAction } from '@/app/actions/employees';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { ATTENDANCE_STATUSES } from '@/lib/constants';
import { toDateInput } from '@/lib/utils';

/** إضافة/تعديل سجل حضور يدوياً (للمدير) */
export function AttendanceEditor({
  employees,
  currentMonth,
  labels,
}: {
  employees: { id: string; name: string }[];
  currentMonth: string;
  labels: {
    add: string;
    employee: string;
    date: string;
    checkIn: string;
    checkOut: string;
    status: string;
    statuses: Record<string, string>;
    notes: string;
    save: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState | null, FormData>(
    upsertAttendanceAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setOpen(false);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>
        {labels.add}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={labels.add} size="md">
        <form action={formAction} className="space-y-4">
          <FormGrid cols={2}>
            <Field label={labels.employee} required className="sm:col-span-2">
              <Select
                name="userId"
                required
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
              />
            </Field>

            <Field label={labels.date} required>
              <Input name="date" type="date" defaultValue={toDateInput(new Date())} required />
            </Field>

            <Field label={labels.status}>
              <Select
                name="status"
                defaultValue="PRESENT"
                options={ATTENDANCE_STATUSES.map((s) => ({
                  value: s,
                  label: labels.statuses[s] ?? s,
                }))}
              />
            </Field>

            <Field label={labels.checkIn}>
              <Input name="checkIn" type="time" />
            </Field>

            <Field label={labels.checkOut}>
              <Input name="checkOut" type="time" />
            </Field>

            <Field label={labels.notes} className="sm:col-span-2">
              <Textarea name="notes" rows={2} />
            </Field>
          </FormGrid>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
