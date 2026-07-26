'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, Percent, Package, Wrench, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Select, Field, Textarea } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { Dialog } from '@/components/ui/dialog';
import { calculatePricing, lineTotal } from '@/lib/pricing';
import { cn, formatMoney, round } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

/**
 * محرّر بنود مشترك للفواتير وعروض الأسعار.
 * يدير البنود والخصومات والضريبة ويُصدِّر الحالة إلى المكوّن الأب.
 */

export interface BuilderProduct {
  id: string;
  sku: string;
  name: string;
  sellPrice: number;
  costPrice: number;
  quantity: number;
}

export interface BuilderService {
  id: string;
  code: string;
  name: string;
  price: number;
  cost: number;
  categoryName: string | null;
}

export interface BuilderLine {
  uid: string;
  kind: 'PRODUCT' | 'SERVICE' | 'CUSTOM';
  productId?: string | null;
  serviceId?: string | null;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  available?: number;
}

export interface BuilderState {
  lines: BuilderLine[];
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  taxRate: number;
  notes: string;
}

let counter = 0;
export const newLineUid = () => `dl-${++counter}`;

export function DocumentBuilder({
  state,
  onChange,
  products,
  services,
  currency,
  decimals,
  locale,
  taxEnabled,
  labels,
  extraSummary,
}: {
  state: BuilderState;
  onChange: (state: BuilderState) => void;
  products: BuilderProduct[];
  services: BuilderService[];
  currency: string;
  decimals: number;
  locale: Locale;
  taxEnabled: boolean;
  labels: Record<string, string>;
  /** صفوف إضافية في ملخص المجاميع (مثل خصم الكوبون) */
  extraSummary?: React.ReactNode;
}) {
  const [picker, setPicker] = useState<'PRODUCT' | 'SERVICE' | null>(null);
  const [search, setSearch] = useState('');

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  const pricing = useMemo(
    () =>
      calculatePricing({
        items: state.lines,
        discountType: state.discountType,
        discountValue: state.discountValue,
        taxRate: state.taxRate,
      }),
    [state],
  );

  function patch(update: Partial<BuilderState>) {
    onChange({ ...state, ...update });
  }

  function addLine(line: BuilderLine) {
    patch({ lines: [...state.lines, line] });
    setPicker(null);
    setSearch('');
  }

  function updateLine(uid: string, update: Partial<BuilderLine>) {
    patch({
      lines: state.lines.map((l) => (l.uid === uid ? { ...l, ...update } : l)),
    });
  }

  function removeLine(uid: string) {
    patch({ lines: state.lines.filter((l) => l.uid !== uid) });
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 60);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, search]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services.slice(0, 80);
    return services
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.categoryName ?? '').toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [services, search]);

  return (
    <>
      <Card
        title={labels.items}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPicker('SERVICE')}
              icon={<Wrench className="h-3.5 w-3.5" />}
            >
              {labels.addService}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPicker('PRODUCT')}
              icon={<Package className="h-3.5 w-3.5" />}
            >
              {labels.addProduct}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                addLine({
                  uid: newLineUid(),
                  kind: 'CUSTOM',
                  name: '',
                  quantity: 1,
                  unitPrice: 0,
                  unitCost: 0,
                  discount: 0,
                })
              }
              icon={<FileText className="h-3.5 w-3.5" />}
            >
              {labels.addCustom}
            </Button>
          </div>
        }
        bodyClassName={state.lines.length ? 'p-0' : undefined}
      >
        {state.lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{labels.noItems}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{labels.item}</th>
                  <th className="w-24 text-center">{labels.quantity}</th>
                  <th className="w-32 text-end">{labels.unitPrice}</th>
                  <th className="w-28 text-end">{labels.discount}</th>
                  <th className="w-32 text-end">{labels.total}</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {state.lines.map((line) => (
                  <tr key={line.uid}>
                    <td>
                      {line.kind === 'CUSTOM' ? (
                        <Input
                          value={line.name}
                          onChange={(e) => updateLine(line.uid, { name: e.target.value })}
                          placeholder={labels.itemName}
                          className="h-8"
                        />
                      ) : (
                        <span className="text-sm">
                          {line.name}
                          <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {line.kind === 'SERVICE' ? labels.service : labels.product}
                          </span>
                          {line.available !== undefined && line.quantity > line.available && (
                            <span className="ms-2 text-[10px] text-danger">
                              {labels.insufficientStock}
                            </span>
                          )}
                        </span>
                      )}
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
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.uid, { unitPrice: Number(e.target.value) || 0 })
                        }
                        className="h-8 text-end"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.discount}
                        onChange={(e) =>
                          updateLine(line.uid, { discount: Number(e.target.value) || 0 })
                        }
                        className="h-8 text-end"
                      />
                    </td>
                    <td className="numeric text-end font-medium">{money(lineTotal(line))}</td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.uid)}
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
          <div className="space-y-4">
            <Field label={labels.discount}>
              <div className="flex gap-2">
                <Select
                  value={state.discountType}
                  onChange={(e) =>
                    patch({ discountType: e.target.value as 'FIXED' | 'PERCENT' })
                  }
                  options={[
                    { value: 'FIXED', label: labels.fixed },
                    { value: 'PERCENT', label: labels.percent },
                  ]}
                  className="w-32"
                />
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={state.discountValue}
                  onChange={(e) => patch({ discountValue: Number(e.target.value) || 0 })}
                  trailing={
                    state.discountType === 'PERCENT' ? <Percent className="h-4 w-4" /> : undefined
                  }
                />
              </div>
            </Field>

            {taxEnabled && (
              <Field label={labels.taxRate}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={state.taxRate}
                  onChange={(e) => patch({ taxRate: Number(e.target.value) || 0 })}
                  trailing={<Percent className="h-4 w-4" />}
                />
              </Field>
            )}

            <Field label={labels.notes}>
              <Textarea
                value={state.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={3}
              />
            </Field>
          </div>

          <dl className="space-y-2 self-start rounded-md bg-muted/40 p-4">
            <SummaryRow label={labels.subtotal} value={money(pricing.subtotal)} />
            {pricing.discountAmount > 0 && (
              <SummaryRow
                label={labels.discount}
                value={`− ${money(pricing.discountAmount)}`}
              />
            )}
            {extraSummary}
            {pricing.taxAmount > 0 && (
              <SummaryRow
                label={`${labels.tax} (${state.taxRate}%)`}
                value={money(pricing.taxAmount)}
              />
            )}
            <div className="border-t border-border pt-2">
              <SummaryRow label={labels.total} value={money(pricing.total)} strong />
            </div>
            {pricing.costTotal > 0 && (
              <SummaryRow
                label={labels.profit}
                value={money(pricing.profit)}
                tone={pricing.profit >= 0 ? 'success' : 'danger'}
              />
            )}
          </dl>
        </div>
      </Card>

      {/* ------------------------------------------------------- الاختيار */}
      <Dialog
        open={picker !== null}
        onClose={() => {
          setPicker(null);
          setSearch('');
        }}
        title={picker === 'PRODUCT' ? labels.addProduct : labels.addService}
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
          {picker === 'PRODUCT' ? (
            filteredProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {labels.noResults}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      disabled={product.quantity <= 0}
                      onClick={() =>
                        addLine({
                          uid: newLineUid(),
                          kind: 'PRODUCT',
                          productId: product.id,
                          name: product.name,
                          quantity: 1,
                          unitPrice: product.sellPrice,
                          unitCost: product.costPrice,
                          discount: 0,
                          available: product.quantity,
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{product.name}</span>
                        <span className="numeric block text-[11px] text-muted-foreground">
                          {product.sku}
                        </span>
                      </span>
                      <span className="shrink-0 text-end">
                        <span className="numeric block text-sm font-semibold text-primary">
                          {money(product.sellPrice)}
                        </span>
                        <span
                          className={cn(
                            'numeric block text-[11px]',
                            product.quantity <= 0 ? 'text-danger' : 'text-muted-foreground',
                          )}
                        >
                          {labels.stock}: {product.quantity}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : filteredServices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{labels.noResults}</p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredServices.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() =>
                      addLine({
                        uid: newLineUid(),
                        kind: 'SERVICE',
                        serviceId: service.id,
                        name: service.name,
                        quantity: 1,
                        unitPrice: service.price,
                        unitCost: service.cost,
                        discount: 0,
                      })
                    }
                    className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-start transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{service.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        <span className="numeric">{service.code}</span>
                        {service.categoryName ? ` · ${service.categoryName}` : ''}
                      </span>
                    </span>
                    <span className="numeric shrink-0 text-sm font-semibold text-primary">
                      {money(service.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}

export function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-semibold' : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd
        className={cn(
          'numeric',
          strong ? 'text-lg font-bold' : 'text-sm font-medium',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
