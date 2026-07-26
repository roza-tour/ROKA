'use client';

import { useActionState, useState, useEffect, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save, User, Search, X, Ticket } from 'lucide-react';

import { createInvoiceAction, checkCouponAction } from '@/app/actions/invoices';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Input, Select, Field } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  DocumentBuilder,
  SummaryRow,
  newLineUid,
  type BuilderState,
  type BuilderLine,
  type BuilderProduct,
  type BuilderService,
} from '@/components/document-builder';
import { calculatePricing } from '@/lib/pricing';
import { formatMoney, toDateInput } from '@/lib/utils';
import { PAYMENT_METHODS, INVOICE_TYPES, type PaymentMethod } from '@/lib/constants';
import type { Locale } from '@/i18n/config';

export interface InvoiceCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

export function InvoiceBuilderForm({
  customers,
  products,
  services,
  initialLines,
  initialCustomerId,
  repairOrderId,
  repairNumber,
  quotationId,
  quotationNumber,
  defaultTaxRate,
  taxEnabled,
  defaultTerms,
  currency,
  decimals,
  locale,
  labels,
}: {
  customers: InvoiceCustomer[];
  products: BuilderProduct[];
  services: BuilderService[];
  initialLines?: BuilderLine[];
  initialCustomerId?: string;
  repairOrderId?: string;
  repairNumber?: string;
  quotationId?: string;
  quotationNumber?: string;
  defaultTaxRate: number;
  taxEnabled: boolean;
  defaultTerms: string;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createInvoiceAction,
    null,
  );
  const toast = useToast();

  const [type, setType] = useState(repairOrderId ? 'REPAIR' : 'SALE');
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [builder, setBuilder] = useState<BuilderState>({
    lines: initialLines ?? [],
    discountType: 'FIXED',
    discountValue: 0,
    taxRate: taxEnabled ? defaultTaxRate : 0,
    notes: '',
  });

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [warrantyDays, setWarrantyDays] = useState(0);
  const [dueDate, setDueDate] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state, toast]);

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  const pricing = useMemo(
    () =>
      calculatePricing({
        items: builder.lines,
        discountType: builder.discountType,
        discountValue: builder.discountValue,
        taxRate: builder.taxRate,
        couponDiscount,
      }),
    [builder, couponDiscount],
  );

  const customer = customers.find((c) => c.id === customerId);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 40);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 40);
  }, [customers, customerSearch]);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    const result = await checkCouponAction(couponCode, pricing.subtotal);
    if (result.ok && result.discount) {
      setCouponDiscount(result.discount);
      toast.success(labels.couponApplied, money(result.discount));
    } else {
      setCouponDiscount(0);
      toast.error(result.error ?? labels.couponInvalid);
    }
  }

  const payload = JSON.stringify({
    type,
    customerId: customerId || null,
    repairOrderId: repairOrderId || null,
    quotationId: quotationId || null,
    items: builder.lines
      .filter((l) => l.name.trim() && l.quantity > 0)
      .map((l) => ({
        kind: l.kind === 'CUSTOM' ? 'CUSTOM' : l.kind,
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
    couponCode: couponCode.trim() || null,
    notes: builder.notes || null,
    terms: defaultTerms || null,
    warrantyDays,
    dueDate: dueDate || null,
    payment:
      Number(paymentAmount) > 0
        ? {
            amount: Number(paymentAmount),
            method: paymentMethod,
            reference: reference || null,
          }
        : undefined,
  });

  const canSubmit = builder.lines.length > 0 && builder.lines.every((l) => l.name.trim());

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
          <Field label={labels.type}>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={Boolean(repairOrderId)}
              options={INVOICE_TYPES.filter((it) => it !== 'RETURN').map((it) => ({
                value: it,
                label: labels[`type_${it}`] ?? it,
              }))}
            />
          </Field>

          <Field label={labels.customer} className="sm:col-span-2">
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
                  onClick={() => setCustomerId('')}
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
        </div>

        {repairNumber && (
          <p className="mt-3 rounded-md bg-info/10 p-2 text-sm text-info">
            {labels.fromRepair}: <span className="numeric font-medium">{repairNumber}</span>
          </p>
        )}

        {quotationNumber && (
          <p className="mt-3 rounded-md bg-info/10 p-2 text-sm text-info">
            {labels.fromQuotation}:{' '}
            <span className="numeric font-medium">{quotationNumber}</span>
          </p>
        )}
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
        extraSummary={
          couponDiscount > 0 ? (
            <SummaryRow
              label={`${labels.coupon} ${couponCode}`}
              value={`− ${money(couponDiscount)}`}
            />
          ) : null
        }
      />

      <Card title={labels.payment}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={labels.coupon}>
            <div className="flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                dir="ltr"
                className="text-start"
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyCoupon}
                disabled={!couponCode.trim()}
                icon={<Ticket className="h-4 w-4" />}
              />
            </div>
          </Field>

          <Field label={labels.warrantyDays}>
            <Input
              type="number"
              min={0}
              value={warrantyDays}
              onChange={(e) => setWarrantyDays(Number(e.target.value) || 0)}
            />
          </Field>

          <Field label={labels.dueDate}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>

          <Field label={labels.paidAmount} hint={`${labels.total}: ${money(pricing.total)}`}>
            <Input
              type="number"
              min={0}
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0"
            />
          </Field>

          {Number(paymentAmount) > 0 && (
            <>
              <Field label={labels.method}>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  options={PAYMENT_METHODS.map((m) => ({
                    value: m,
                    label: labels[`method_${m}`] ?? m,
                  }))}
                />
              </Field>

              {(paymentMethod === 'CARD' ||
                paymentMethod === 'BANK_TRANSFER' ||
                paymentMethod === 'CHECK') && (
                <Field label={labels.reference}>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    dir="ltr"
                  />
                </Field>
              )}
            </>
          )}
        </div>

        {Number(paymentAmount) > 0 && Number(paymentAmount) < pricing.total && !customerId && (
          <p className="mt-3 rounded-md bg-warning/10 p-2 text-xs text-warning">
            {labels.creditNeedsCustomer}
          </p>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/invoices">
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
                  setShowPicker(false);
                  setCustomerSearch('');
                }}
                className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="numeric block text-xs text-muted-foreground">{c.phone}</span>
                </span>
                {c.balance < 0 && (
                  <span className="numeric shrink-0 text-xs text-danger">
                    {money(Math.abs(c.balance))}
                  </span>
                )}
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
