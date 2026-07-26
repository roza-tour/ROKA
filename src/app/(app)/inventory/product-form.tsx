'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save } from 'lucide-react';
import {
  createProductAction,
  updateProductAction,
} from '@/app/actions/inventory';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';
import { PRODUCT_TYPES } from '@/lib/constants';
import { formatPercent, round } from '@/lib/utils';

export interface ProductFormValues {
  id?: string;
  sku?: string;
  barcode?: string | null;
  name?: string;
  nameFr?: string | null;
  nameEn?: string | null;
  type?: string;
  categoryId?: string | null;
  brand?: string | null;
  model?: string | null;
  compatibleWith?: string | null;
  description?: string | null;
  unit?: string;
  costPrice?: number;
  sellPrice?: number;
  wholesalePrice?: number;
  taxRate?: number;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  location?: string | null;
  supplierId?: string | null;
  trackSerial?: boolean;
  warrantyDays?: number;
  isActive?: boolean;
}

/** نصوص النموذج — يبنيها الخادم عبر productFormLabels() */
export interface ProductFormLabels {
  basic: string;
  pricing: string;
  stock: string;
  name: string;
  type: string;
  types: Record<string, string>;
  category: string;
  sku: string;
  skuHint: string;
  barcode: string;
  barcodeHint: string;
  brand: string;
  model: string;
  compatibleWith: string;
  compatibleWithHint: string;
  description: string;
  costPrice: string;
  sellPrice: string;
  wholesalePrice: string;
  taxRate: string;
  profit: string;
  margin: string;
  quantity: string;
  quantityHint: string;
  quantityEditHint: string;
  minQuantity: string;
  minQuantityHint: string;
  maxQuantity: string;
  unit: string;
  location: string;
  supplier: string;
  warrantyDays: string;
  trackSerial: string;
  active: string;
  none: string;
  save: string;
  cancel: string;
}

export function ProductForm({
  values = {},
  categories,
  suppliers,
  labels,
}: {
  values?: ProductFormValues;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  labels: ProductFormLabels;
}) {
  const isEdit = Boolean(values.id);
  const [state, formAction] = useActionState<FormState | null, FormData>(
    isEdit ? updateProductAction : createProductAction,
    null,
  );
  const toast = useToast();

  const [costPrice, setCostPrice] = useState(values.costPrice ?? 0);
  const [sellPrice, setSellPrice] = useState(values.sellPrice ?? 0);

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state, toast]);

  const err = (field: string) => state?.errors?.[field];
  const margin = costPrice > 0 ? round(((sellPrice - costPrice) / costPrice) * 100, 1) : 0;
  const profit = round(sellPrice - costPrice);

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

      <Card title={labels.basic}>
        <FormGrid cols={2}>
          <Field
            label={labels.name}
            required
            error={err('name')}
            htmlFor="name"
            className="sm:col-span-2"
          >
            <Input
              id="name"
              name="name"
              defaultValue={values.name ?? ''}
              required
              autoFocus
              invalid={Boolean(err('name'))}
            />
          </Field>

          <Field label={labels.type} required htmlFor="type">
            <Select
              id="type"
              name="type"
              defaultValue={values.type ?? 'PART'}
              options={PRODUCT_TYPES.map((pt) => ({ value: pt, label: labels.types[pt] }))}
            />
          </Field>

          <Field label={labels.category} htmlFor="categoryId">
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={values.categoryId ?? ''}
              placeholder={labels.none}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>

          <Field label={labels.sku} hint={labels.skuHint} htmlFor="sku">
            <Input
              id="sku"
              name="sku"
              defaultValue={values.sku ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          <Field label={labels.barcode} hint={labels.barcodeHint} htmlFor="barcode">
            <Input
              id="barcode"
              name="barcode"
              defaultValue={values.barcode ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          <Field label={labels.brand} htmlFor="brand">
            <Input id="brand" name="brand" defaultValue={values.brand ?? ''} />
          </Field>

          <Field label={labels.model} htmlFor="model">
            <Input id="model" name="model" defaultValue={values.model ?? ''} />
          </Field>

          <Field
            label={labels.compatibleWith}
            hint={labels.compatibleWithHint}
            htmlFor="compatibleWith"
            className="sm:col-span-2"
          >
            <Input
              id="compatibleWith"
              name="compatibleWith"
              defaultValue={values.compatibleWith ?? ''}
              placeholder="iPhone 12, iPhone 12 Pro…"
            />
          </Field>

          <Field label={labels.description} htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={values.description ?? ''}
              rows={2}
            />
          </Field>
        </FormGrid>
      </Card>

      <Card title={labels.pricing}>
        <FormGrid cols={4}>
          <Field label={labels.costPrice} htmlFor="costPrice">
            <Input
              id="costPrice"
              name="costPrice"
              type="number"
              min={0}
              step="any"
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
            />
          </Field>

          <Field label={labels.sellPrice} required htmlFor="sellPrice" error={err('sellPrice')}>
            <Input
              id="sellPrice"
              name="sellPrice"
              type="number"
              min={0}
              step="any"
              value={sellPrice}
              onChange={(e) => setSellPrice(Number(e.target.value) || 0)}
              required
              invalid={Boolean(err('sellPrice'))}
            />
          </Field>

          <Field label={labels.wholesalePrice} htmlFor="wholesalePrice">
            <Input
              id="wholesalePrice"
              name="wholesalePrice"
              type="number"
              min={0}
              step="any"
              defaultValue={values.wholesalePrice ?? 0}
            />
          </Field>

          <Field label={labels.taxRate} htmlFor="taxRate">
            <Input
              id="taxRate"
              name="taxRate"
              type="number"
              min={0}
              max={100}
              step="any"
              defaultValue={values.taxRate ?? 0}
            />
          </Field>
        </FormGrid>

        {costPrice > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 rounded-md bg-muted/50 p-3 text-sm">
            <span>
              {labels.profit}:{' '}
              <span
                className={`numeric font-semibold ${profit >= 0 ? 'text-success' : 'text-danger'}`}
              >
                {profit}
              </span>
            </span>
            <span>
              {labels.margin}:{' '}
              <span
                className={`numeric font-semibold ${margin >= 0 ? 'text-success' : 'text-danger'}`}
              >
                {formatPercent(margin)}
              </span>
            </span>
          </div>
        )}
      </Card>

      <Card title={labels.stock}>
        <FormGrid cols={4}>
          <Field
            label={labels.quantity}
            hint={isEdit ? labels.quantityEditHint : labels.quantityHint}
            htmlFor="quantity"
          >
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={0}
              step="any"
              defaultValue={values.quantity ?? 0}
              disabled={isEdit}
            />
          </Field>

          <Field label={labels.minQuantity} hint={labels.minQuantityHint} htmlFor="minQuantity">
            <Input
              id="minQuantity"
              name="minQuantity"
              type="number"
              min={0}
              step="any"
              defaultValue={values.minQuantity ?? 0}
            />
          </Field>

          <Field label={labels.maxQuantity} htmlFor="maxQuantity">
            <Input
              id="maxQuantity"
              name="maxQuantity"
              type="number"
              min={0}
              step="any"
              defaultValue={values.maxQuantity ?? 0}
            />
          </Field>

          <Field label={labels.unit} htmlFor="unit">
            <Input id="unit" name="unit" defaultValue={values.unit ?? 'PCS'} />
          </Field>

          <Field label={labels.location} htmlFor="location">
            <Input
              id="location"
              name="location"
              defaultValue={values.location ?? ''}
              placeholder="رف A-3"
            />
          </Field>

          <Field label={labels.supplier} htmlFor="supplierId">
            <Select
              id="supplierId"
              name="supplierId"
              defaultValue={values.supplierId ?? ''}
              placeholder={labels.none}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>

          <Field label={labels.warrantyDays} htmlFor="warrantyDays">
            <Input
              id="warrantyDays"
              name="warrantyDays"
              type="number"
              min={0}
              defaultValue={values.warrantyDays ?? 0}
            />
          </Field>
        </FormGrid>

        <div className="mt-4 space-y-3">
          <Checkbox
            name="trackSerial"
            defaultChecked={values.trackSerial}
            label={labels.trackSerial}
          />
          <Checkbox
            name="isActive"
            defaultChecked={values.isActive ?? true}
            label={labels.active}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={values.id ? `/inventory/${values.id}` : '/inventory'}>
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
