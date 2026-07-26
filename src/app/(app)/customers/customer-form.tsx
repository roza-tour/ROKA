'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save } from 'lucide-react';
import {
  createCustomerAction,
  updateCustomerAction,
  type FormState,
} from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';

export interface CustomerFormValues {
  id?: string;
  firstName?: string;
  lastName?: string | null;
  phone?: string;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  type?: string;
  isBlocked?: boolean;
}

export function CustomerForm({
  values = {},
  labels,
}: {
  values?: CustomerFormValues;
  labels: {
    personal: string;
    contact: string;
    other: string;
    firstName: string;
    lastName: string;
    phone: string;
    phone2: string;
    email: string;
    address: string;
    city: string;
    taxNumber: string;
    notes: string;
    type: string;
    individual: string;
    company: string;
    blocked: string;
    save: string;
    cancel: string;
  };
}) {
  const isEdit = Boolean(values.id);
  const action = isEdit ? updateCustomerAction : createCustomerAction;
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  const toast = useToast();

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
  }, [state, toast]);

  const err = (field: string) => state?.errors?.[field];

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={values.id} />}
      {/* عند تكرار الهاتف، إعادة الإرسال تؤكّد الإنشاء */}
      {state?.errors?.phone === 'رقم مكرر' && (
        <input type="hidden" name="allowDuplicate" value="true" />
      )}

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Card title={labels.personal}>
        <FormGrid cols={2}>
          <Field label={labels.firstName} required error={err('firstName')} htmlFor="firstName">
            <Input
              id="firstName"
              name="firstName"
              defaultValue={values.firstName ?? ''}
              required
              autoFocus
              maxLength={80}
              invalid={Boolean(err('firstName'))}
            />
          </Field>

          <Field label={labels.lastName} error={err('lastName')} htmlFor="lastName">
            <Input
              id="lastName"
              name="lastName"
              defaultValue={values.lastName ?? ''}
              maxLength={80}
            />
          </Field>

          <Field label={labels.type} htmlFor="type">
            <Select
              id="type"
              name="type"
              defaultValue={values.type ?? 'INDIVIDUAL'}
              options={[
                { value: 'INDIVIDUAL', label: labels.individual },
                { value: 'COMPANY', label: labels.company },
              ]}
            />
          </Field>

          <Field label={labels.taxNumber} error={err('taxNumber')} htmlFor="taxNumber">
            <Input
              id="taxNumber"
              name="taxNumber"
              defaultValue={values.taxNumber ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>
        </FormGrid>
      </Card>

      <Card title={labels.contact}>
        <FormGrid cols={2}>
          <Field label={labels.phone} required error={err('phone')} htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={values.phone ?? ''}
              required
              dir="ltr"
              placeholder="0555 12 34 56"
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
              invalid={Boolean(err('phone2'))}
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
              invalid={Boolean(err('email'))}
            />
          </Field>

          <Field label={labels.city} error={err('city')} htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city ?? ''} />
          </Field>

          <Field label={labels.address} error={err('address')} htmlFor="address" className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={values.address ?? ''} />
          </Field>
        </FormGrid>
      </Card>

      <Card title={labels.other}>
        <div className="space-y-4">
          <Field label={labels.notes} htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ''} rows={3} />
          </Field>

          <Checkbox
            name="isBlocked"
            defaultChecked={values.isBlocked}
            label={labels.blocked}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={values.id ? `/customers/${values.id}` : '/customers'}>
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
