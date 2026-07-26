'use client';

import { useActionState, useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Tags, Percent, Clock, ShieldCheck } from 'lucide-react';

import {
  saveServiceAction,
  deleteServiceAction,
  saveServiceCategoryAction,
  bulkUpdateServicePricesAction,
} from '@/app/actions/services';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/page';
import { formatMoney, round, cn } from '@/lib/utils';
import { DEVICE_TYPES } from '@/lib/constants';
import type { Locale } from '@/i18n/config';

interface Service {
  id: string;
  code: string;
  name: string;
  nameFr: string | null;
  nameEn: string | null;
  categoryId: string | null;
  categoryName: string | null;
  deviceType: string;
  description: string | null;
  price: number;
  cost: number;
  estimatedMinutes: number;
  warrantyDays: number;
  requiresParts: boolean;
  isActive: boolean;
}

export function ServiceCatalog({
  services,
  categories,
  canEdit,
  canDelete,
  currency,
  decimals,
  locale,
  deviceTypeLabels,
  labels,
}: {
  services: Service[];
  categories: { id: string; name: string; deviceType: string }[];
  canEdit: boolean;
  canDelete: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  deviceTypeLabels: Record<string, string>;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<Service | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [serviceState, serviceAction] = useActionState<FormState | null, FormData>(
    saveServiceAction,
    null,
  );
  const [categoryState, categoryAction] = useActionState<FormState | null, FormData>(
    saveServiceCategoryAction,
    null,
  );

  // نموذج التعديل بالجملة
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkMode, setBulkMode] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [bulkValue, setBulkValue] = useState('');

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  useEffect(() => {
    if (serviceState?.ok) {
      toast.success(serviceState.message ?? 'تم الحفظ');
      setShowServiceForm(false);
      setEditing(null);
      router.refresh();
    } else if (serviceState?.error) {
      toast.error(serviceState.error);
    }
  }, [serviceState, toast, router]);

  useEffect(() => {
    if (categoryState?.ok) {
      toast.success(categoryState.message ?? 'تم الحفظ');
      setShowCategoryForm(false);
      router.refresh();
    } else if (categoryState?.error) {
      toast.error(categoryState.error);
    }
  }, [categoryState, toast, router]);

  // تجميع الخدمات حسب التصنيف
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; services: Service[] }>();
    for (const service of services) {
      const key = service.categoryId ?? 'none';
      const entry = map.get(key) ?? {
        name: service.categoryName ?? labels.none,
        services: [],
      };
      entry.services.push(service);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [services, labels.none]);

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteServiceAction(id);
      if (result.ok) {
        toast.success(result.message ?? 'تم الحذف');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الحذف');
      }
    });
  }

  function applyBulk() {
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || value === 0) {
      toast.error('أدخل قيمة صالحة');
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdateServicePricesAction(
        bulkCategory || null,
        bulkMode,
        value,
      );
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        setShowBulk(false);
        setBulkValue('');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر التعديل');
      }
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap gap-2 no-print">
          <Button
            onClick={() => {
              setEditing(null);
              setShowServiceForm(true);
            }}
            icon={<Plus className="h-4 w-4" />}
          >
            {labels.newService}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCategoryForm(true)}
            icon={<Tags className="h-4 w-4" />}
          >
            {labels.newCategory}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowBulk(true)}
            icon={<Percent className="h-4 w-4" />}
          >
            {labels.bulkPrices}
          </Button>
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        grouped.map((group) => (
          <Card key={group.name} title={group.name} bodyClassName="p-0">
            <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
              {group.services.map((service) => {
                const margin =
                  service.cost > 0
                    ? round(((service.price - service.cost) / service.cost) * 100, 0)
                    : null;
                return (
                  <div
                    key={service.id}
                    className={cn(
                      'flex flex-col gap-2 bg-card p-3',
                      !service.isActive && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{service.name}</p>
                        <p className="numeric text-[11px] text-muted-foreground">
                          {service.code}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(service);
                              setShowServiceForm(true);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label={labels.edit}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(service.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                              aria-label={labels.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="numeric text-lg font-bold text-primary">
                          {money(service.price)}
                        </p>
                        {margin !== null && (
                          <p className="numeric text-[11px] text-muted-foreground">
                            {labels.cost}: {money(service.cost)} · {margin}%
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {service.deviceType !== 'ALL' && (
                          <Badge tone="blue" size="sm">
                            {deviceTypeLabels[service.deviceType] ?? service.deviceType}
                          </Badge>
                        )}
                        {service.estimatedMinutes > 0 && (
                          <Badge tone="gray" size="sm">
                            <Clock className="h-3 w-3" />
                            <span className="numeric">{service.estimatedMinutes}</span>
                          </Badge>
                        )}
                        {service.warrantyDays > 0 && (
                          <Badge tone="emerald" size="sm">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="numeric">{service.warrantyDays}</span>
                          </Badge>
                        )}
                        {!service.isActive && (
                          <Badge tone="gray" size="sm">
                            معطّلة
                          </Badge>
                        )}
                      </div>
                    </div>

                    {service.description && (
                      <p className="text-[11px] text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      {/* ------------------------------------------------- نموذج الخدمة */}
      <Dialog
        open={showServiceForm}
        onClose={() => {
          setShowServiceForm(false);
          setEditing(null);
        }}
        title={editing ? labels.edit : labels.newService}
        size="lg"
      >
        <form action={serviceAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <FormGrid cols={2}>
            <Field label={labels.name} required>
              <Input name="name" defaultValue={editing?.name ?? ''} required autoFocus />
            </Field>

            <Field label={labels.code} required>
              <Input
                name="code"
                defaultValue={editing?.code ?? ''}
                required
                dir="ltr"
                className="text-start uppercase"
              />
            </Field>

            <Field label={labels.nameFr}>
              <Input name="nameFr" defaultValue={editing?.nameFr ?? ''} dir="ltr" />
            </Field>

            <Field label={labels.nameEn}>
              <Input name="nameEn" defaultValue={editing?.nameEn ?? ''} dir="ltr" />
            </Field>

            <Field label={labels.category}>
              <Select
                name="categoryId"
                defaultValue={editing?.categoryId ?? ''}
                placeholder={labels.none}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label={labels.deviceType}>
              <Select
                name="deviceType"
                defaultValue={editing?.deviceType ?? 'ALL'}
                options={[
                  { value: 'ALL', label: labels.all },
                  ...DEVICE_TYPES.map((dt) => ({
                    value: dt,
                    label: deviceTypeLabels[dt] ?? dt,
                  })),
                ]}
              />
            </Field>

            <Field label={labels.price} required>
              <Input
                name="price"
                type="number"
                min={0}
                step="any"
                defaultValue={editing?.price ?? 0}
                required
              />
            </Field>

            <Field label={labels.cost}>
              <Input
                name="cost"
                type="number"
                min={0}
                step="any"
                defaultValue={editing?.cost ?? 0}
              />
            </Field>

            <Field label={labels.duration}>
              <Input
                name="estimatedMinutes"
                type="number"
                min={0}
                defaultValue={editing?.estimatedMinutes ?? 30}
              />
            </Field>

            <Field label={labels.warranty}>
              <Input
                name="warrantyDays"
                type="number"
                min={0}
                defaultValue={editing?.warrantyDays ?? 0}
              />
            </Field>

            <Field label={labels.description} className="sm:col-span-2">
              <Textarea name="description" defaultValue={editing?.description ?? ''} rows={2} />
            </Field>
          </FormGrid>

          <div className="flex flex-wrap gap-4">
            <Checkbox
              name="requiresParts"
              defaultChecked={editing?.requiresParts ?? false}
              label={labels.requiresParts}
            />
            <Checkbox
              name="isActive"
              defaultChecked={editing?.isActive ?? true}
              label={labels.active}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowServiceForm(false);
                setEditing(null);
              }}
            >
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>

      {/* ---------------------------------------------- نموذج التصنيف */}
      <Dialog
        open={showCategoryForm}
        onClose={() => setShowCategoryForm(false)}
        title={labels.newCategory}
        size="sm"
      >
        <form action={categoryAction} className="space-y-4">
          <Field label={labels.name} required>
            <Input name="name" required autoFocus />
          </Field>
          <Field label={labels.nameFr}>
            <Input name="nameFr" dir="ltr" />
          </Field>
          <Field label={labels.nameEn}>
            <Input name="nameEn" dir="ltr" />
          </Field>
          <Field label={labels.deviceType}>
            <Select
              name="deviceType"
              defaultValue="ALL"
              options={[
                { value: 'ALL', label: labels.all },
                ...DEVICE_TYPES.map((dt) => ({
                  value: dt,
                  label: deviceTypeLabels[dt] ?? dt,
                })),
              ]}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCategoryForm(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>

      {/* ------------------------------------------ تعديل الأسعار بالجملة */}
      <Dialog
        open={showBulk}
        onClose={() => setShowBulk(false)}
        title={labels.bulkPrices}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBulk(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button onClick={applyBulk} loading={pending}>
              {labels.apply}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={labels.category}>
            <Select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              placeholder={labels.all}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>

          <Field label={labels.mode}>
            <Select
              value={bulkMode}
              onChange={(e) => setBulkMode(e.target.value as 'PERCENT' | 'FIXED')}
              options={[
                { value: 'PERCENT', label: labels.percent },
                { value: 'FIXED', label: labels.fixed },
              ]}
            />
          </Field>

          <Field label={labels.value} hint={labels.bulkHint}>
            <Input
              type="number"
              step="any"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder={bulkMode === 'PERCENT' ? '10' : '500'}
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove(deleteId);
        }}
        title={labels.delete}
        message={labels.confirmDelete}
      />
    </div>
  );
}
