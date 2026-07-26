'use client';

import { useActionState, useState, useEffect, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save, User, Search, X } from 'lucide-react';

import { createQuotationAction } from '@/app/actions/quotations';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Input, Select, Field } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  DocumentBuilder,
  type BuilderState,
  type BuilderProduct,
  type BuilderService,
} from '@/components/document-builder';
import { toDateInput, addDays } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export interface QuotationCustomer {
  id: string;
  name: string;
  phone: string;
  devices: { id: string; label: string }[];
}

export function QuotationForm({
  customers,
  products,
  services,
  initialCustomerId,
  defaultTaxRate,
  taxEnabled,
  currency,
  decimals,
  locale,
  labels,
}: {
  customers: QuotationCustomer[];
  products: BuilderProduct[];
  services: BuilderService[];
  initialCustomerId?: string;
  defaultTaxRate: number;
  taxEnabled: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createQuotationAction,
    null,
  );
  const toast = useToast();

  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [deviceId, setDeviceId] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [validUntil, setValidUntil] = useState(toDateInput(addDays(new Date(), 14)));

  const [builder, setBuilder] = useState<BuilderState>({
    lines: [],
    discountType: 'FIXED',
    discountValue: 0,
    taxRate: taxEnabled ? defaultTaxRate : 0,
    notes: '',
  });

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state, toast]);

  const customer = customers.find((c) => c.id === customerId);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 40);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 40);
  }, [customers, customerSearch]);

  const payload = JSON.stringify({
    customerId,
    deviceId: deviceId || null,
    items: builder.lines
      .filter((l) => l.name.trim() && l.quantity > 0)
      .map((l) => ({
        kind: l.kind,
        productId: l.productId ?? null,
        serviceId: l.serviceId ?? null,
        name: l.name.trim(),
        description: l.description ?? null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unitCost: l.unitCost,
        discount: l.discount,
        taxRate: 0,
      })),
    discountType: builder.discountType,
    discountValue: builder.discountValue,
    taxRate: builder.taxRate,
    notes: builder.notes || null,
    validUntil: validUntil || null,
  });

  const canSubmit = Boolean(customerId) && builder.lines.length > 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Card title={labels.header}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={labels.customer} required className="sm:col-span-2">
            {customer ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{customer.name}</span>
                  <span className="numeric block text-xs text-muted-foreground">
                    {customer.phone}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId('');
                    setDeviceId('');
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
                  aria-label={labels.clear}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowPicker(true)}
                icon={<User className="h-4 w-4" />}
              >
                {labels.selectCustomer}
              </Button>
            )}
          </Field>

          <Field label={labels.validUntil}>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </Field>

          {customer && customer.devices.length > 0 && (
            <Field
              label={labels.device}
              hint={labels.deviceHint}
              className="sm:col-span-3"
            >
              <Select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder={labels.none}
                options={customer.devices.map((d) => ({ value: d.id, label: d.label }))}
              />
            </Field>
          )}
        </div>
      </Card>

      <DocumentBuilder
        state={builder}
        onChange={setBuilder}
        products={products}
        services={services}
        currency={currency}
        decimals={decimals}
        locale={locale}
        taxEnabled={taxEnabled}
        labels={labels}
      />

      <div className="flex justify-end gap-2">
        <Link href="/quotations">
          <Button type="button" variant="outline">
            {labels.cancel}
          </Button>
        </Link>
        <SubmitButton label={labels.save} disabled={!canSubmit} />
      </div>

      <Dialog
        open={showPicker}
        onClose={() => setShowPicker(false)}
        title={labels.selectCustomer}
        size="md"
      >
        <Input
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          placeholder={labels.searchCustomer}
          leading={<Search className="h-4 w-4" />}
          autoFocus
        />
        <ul className="mt-3 max-h-[50vh] divide-y divide-border overflow-y-auto">
          {filteredCustomers.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setCustomerId(c.id);
                  setDeviceId('');
                  setShowPicker(false);
                  setCustomerSearch('');
                }}
                className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="numeric block text-xs text-muted-foreground">{c.phone}</span>
                </span>
                <span className="numeric shrink-0 text-xs text-muted-foreground">
                  {c.devices.length}
                </span>
              </button>
            </li>
          ))}
          {filteredCustomers.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">{labels.noResults}</li>
          )}
        </ul>
      </Dialog>
    </form>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      disabled={disabled}
      icon={<Save className="h-4 w-4" />}
    >
      {label}
    </Button>
  );
}
