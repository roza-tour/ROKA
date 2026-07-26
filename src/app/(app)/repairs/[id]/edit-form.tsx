'use client';

import { useActionState, useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Pencil, Save, X } from 'lucide-react';
import { updateRepairOrderAction } from '@/app/actions/repairs';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { toDateInput } from '@/lib/utils';

export function RepairEditForm({
  order,
  technicians,
  labels,
}: {
  order: {
    id: string;
    technicianId: string | null;
    priority: string;
    diagnosis: string | null;
    workDone: string | null;
    internalNotes: string | null;
    faultCategory: string | null;
    estimatedCost: number;
    warrantyDays: number;
    promisedAt: Date | null;
  };
  technicians: { id: string; name: string }[];
  labels: {
    edit: string;
    diagnosis: string;
    workDone: string;
    internalNotes: string;
    faultCategory: string;
    technician: string;
    priority: string;
    priorities: Record<string, string>;
    estimatedCost: string;
    warrantyDays: string;
    promisedAt: string;
    save: string;
    cancel: string;
    unassigned: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<FormState | null, FormData>(
    updateRepairOrderAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setEditing(false);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  if (!editing) {
    return (
      <div className="space-y-4">
        {order.diagnosis && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{labels.diagnosis}</p>
            <p className="whitespace-pre-wrap text-sm">{order.diagnosis}</p>
          </div>
        )}
        {order.workDone && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{labels.workDone}</p>
            <p className="whitespace-pre-wrap text-sm">{order.workDone}</p>
          </div>
        )}
        {order.internalNotes && (
          <div className="rounded-md bg-warning/10 p-3">
            <p className="mb-1 text-xs font-medium text-warning">{labels.internalNotes}</p>
            <p className="whitespace-pre-wrap text-sm">{order.internalNotes}</p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          icon={<Pencil className="h-3.5 w-3.5" />}
        >
          {labels.edit}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={order.id} />

      <Field label={labels.diagnosis}>
        <Textarea name="diagnosis" defaultValue={order.diagnosis ?? ''} rows={3} />
      </Field>

      <Field label={labels.workDone}>
        <Textarea name="workDone" defaultValue={order.workDone ?? ''} rows={3} />
      </Field>

      <Field label={labels.internalNotes}>
        <Textarea name="internalNotes" defaultValue={order.internalNotes ?? ''} rows={2} />
      </Field>

      <FormGrid cols={3}>
        <Field label={labels.technician}>
          <Select
            name="technicianId"
            defaultValue={order.technicianId ?? ''}
            placeholder={labels.unassigned}
            options={technicians.map((tech) => ({ value: tech.id, label: tech.name }))}
          />
        </Field>

        <Field label={labels.priority}>
          <Select
            name="priority"
            defaultValue={order.priority}
            options={Object.entries(labels.priorities).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>

        <Field label={labels.faultCategory}>
          <Input name="faultCategory" defaultValue={order.faultCategory ?? ''} />
        </Field>

        <Field label={labels.estimatedCost}>
          <Input
            name="estimatedCost"
            type="number"
            min={0}
            step="any"
            defaultValue={order.estimatedCost}
          />
        </Field>

        <Field label={labels.warrantyDays}>
          <Input
            name="warrantyDays"
            type="number"
            min={0}
            defaultValue={order.warrantyDays}
          />
        </Field>

        <Field label={labels.promisedAt}>
          <Input name="promisedAt" type="date" defaultValue={toDateInput(order.promisedAt)} />
        </Field>
      </FormGrid>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing(false)}
          icon={<X className="h-4 w-4" />}
        >
          {labels.cancel}
        </Button>
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
