'use client';

import { useActionState, useState, useMemo, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save, Plus, Trash2, Search } from 'lucide-react';

import { createPurchaseOrderAction } from '@/app/actions/inventory';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatMoney, round } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  costPrice: number;
  quantity: number;
}

interface Line {
  uid: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

let counter = 0;

export function PurchaseForm({
  suppliers,
  products,
  preselectedSupplierId,
  currency,
  decimals,
  locale,
  labels,
}: {
  suppliers: { id: string; name: string }[];
  products: ProductOption[];
  preselectedSupplierId?: string;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createPurchaseOrderAction,
    null,
  );
  const toast = useToast();

  const [supplierId, setSupplierId] = useState(preselectedSupplierId ?? '');
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state, toast]);

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  const subtotal = round(lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0));
  const total = round(subtotal - discount + tax + shipping);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const chosen = new Set(lines.map((l) => l.productId));
    const list = products.filter((p) => !chosen.has(p.id));
    if (!q) return list.slice(0, 60);
    return list
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, search, lines]);

  function addProduct(product: ProductOption) {
    setLines((prev) => [
      ...prev,
      {
        uid: `line-${++counter}`,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitCost: product.costPrice,
      },
    ]);
    setShowPicker(false);
    setSearch('');
  }

  function updateLine(uid: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  const payload = JSON.stringify({
    supplierId,
    notes,
    discount,
    tax,
    shipping,
    items: lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitCost: l.unitCost,
      })),
  });

  const canSubmit = Boolean(supplierId) && lines.length > 0;

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

      <Card title={labels.supplier}>
        <Field label={labels.supplier} required>
          <Select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder={labels.selectSupplier}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            required
          />
        </Field>
      </Card>

      <Card
        title={labels.items}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(true)}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            {labels.addProduct}
          </Button>
        }
        bodyClassName={lines.length ? 'p-0' : undefined}
      >
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{labels.noItems}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{labels.product}</th>
                  <th className="w-24 text-center">{labels.quantity}</th>
                  <th className="w-32 text-end">{labels.unitCost}</th>
                  <th className="w-32 text-end">{labels.total}</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.uid}>
                    <td>
                      <span className="block text-sm font-medium">{line.name}</span>
                      <span className="numeric block text-xs text-muted-foreground">
                        {line.sku}
                      </span>
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0.01}
                        step="any"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.uid, { quantity: Number(e.target.value) || 0 })
                        }
                        className="h-8 text-center"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.unitCost}
                        onChange={(e) =>
                          updateLine(line.uid, { unitCost: Number(e.target.value) || 0 })
                        }
                        className="h-8 text-end"
                      />
                    </td>
                    <td className="numeric text-end font-medium">
                      {money(round(line.quantity * line.unitCost))}
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => setLines(lines.filter((l) => l.uid !== line.uid))}
                        className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label={labels.remove}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={labels.totals}>
        <div className="grid gap-6 lg:grid-cols-2">
          <FormGrid cols={1}>
            <Field label={labels.discount}>
              <Input
                type="number"
                min={0}
                step="any"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label={labels.tax}>
              <Input
                type="number"
                min={0}
                step="any"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label={labels.shipping}>
              <Input
                type="number"
                min={0}
                step="any"
                value={shipping}
                onChange={(e) => setShipping(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label={labels.notes}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>
          </FormGrid>

          <dl className="space-y-2 self-start rounded-md bg-muted/40 p-4">
            <SummaryRow label={labels.subtotal} value={money(subtotal)} />
            {discount > 0 && (
              <SummaryRow label={labels.discount} value={`- ${money(discount)}`} />
            )}
            {tax > 0 && <SummaryRow label={labels.tax} value={money(tax)} />}
            {shipping > 0 && <SummaryRow label={labels.shipping} value={money(shipping)} />}
            <div className="border-t border-border pt-2">
              <SummaryRow label={labels.total} value={money(total)} strong />
            </div>
          </dl>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/purchases">
          <Button type="button" variant="outline">
            {labels.cancel}
          </Button>
        </Link>
        <SubmitButton label={labels.save} disabled={!canSubmit} />
      </div>

      <Dialog
        open={showPicker}
        onClose={() => setShowPicker(false)}
        title={labels.addProduct}
        size="lg"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.search}
          leading={<Search className="h-4 w-4" />}
          autoFocus
        />
        <div className="mt-3 max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{product.name}</span>
                      <span className="numeric block text-[11px] text-muted-foreground">
                        {product.sku} · {labels.stock}: {product.quantity}
                      </span>
                    </span>
                    <span className="numeric shrink-0 text-sm text-muted-foreground">
                      {money(product.costPrice)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </form>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-semibold' : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd className={`numeric ${strong ? 'text-lg font-bold' : 'text-sm font-medium'}`}>
        {value}
      </dd>
    </div>
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
