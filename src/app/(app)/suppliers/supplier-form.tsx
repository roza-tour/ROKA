'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save } from 'lucide-react';
import { createSupplierAction, updateSupplierAction } from '@/app/actions/inventory';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';

export interface SupplierFormValues {
  id?: string;
  name?: string;
  company?: string | null;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export function SupplierForm({
  values = {},
  labels,
}: {
  values?: SupplierFormValues;
  labels: {
    section: string;
    name: string;
    company: string;
    phone: string;
    phone2: string;
    email: string;
    address: string;
    taxNumber: string;
    notes: string;
    active: string;
    save: string;
    cancel: string;
  };
}) {
  const isEdit = Boolean(values.id);
  const [state, formAction] = useActionState<FormState | null, FormData>(
    isEdit ? updateSupplierAction : createSupplierAction,
    null,
  );
  const toast = useToast();

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
  }, [state, toast]);

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
          <Field label={labels.name} required error={err('name')} htmlFor="name">
            <Input
              id="name"
              name="name"
              defaultValue={values.name ?? ''}
              required
              autoFocus
              invalid={Boolean(err('name'))}
            />
          </Field>

          <Field label={labels.company} htmlFor="company">
            <Input id="company" name="company" defaultValue={values.company ?? ''} />
          </Field>

          <Field label={labels.phone} error={err('phone')} htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={values.phone ?? ''}
              dir="ltr"
              invalid={Boolean(err('phone'))}
            />
          </Field>

          <Field label={labels.phone2} error={err('phone2')} htmlFor="phone2">
            <Input
              id="phone2"
              name="phone2"
              type="tel"
              defaultValue={values.phone2 ?? ''}
              dir="ltr"
            />
          </Field>

          <Field label={labels.email} error={err('email')} htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          <Field label={labels.taxNumber} htmlFor="taxNumber">
            <Input
              id="taxNumber"
              name="taxNumber"
              defaultValue={values.taxNumber ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          <Field label={labels.address} htmlFor="address" className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={values.address ?? ''} />
          </Field>

          <Field label={labels.notes} htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ''} rows={2} />
          </Field>
        </FormGrid>

        <div className="mt-4">
          <Checkbox
            name="isActive"
            defaultChecked={values.isActive ?? true}
            label={labels.active}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={values.id ? `/suppliers/${values.id}` : '/suppliers'}>
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
