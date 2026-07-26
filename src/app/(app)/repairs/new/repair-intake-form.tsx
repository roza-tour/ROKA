'use client';

import { useActionState, useState, useMemo, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  AlertCircle,
  Save,
  Search,
  UserPlus,
  Plus,
  Trash2,
  Smartphone,
  ClipboardList,
  Package,
  PenLine,
  Camera,
  X,
} from 'lucide-react';

import { createRepairOrderAction } from '@/app/actions/repairs';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { SignaturePad } from '@/components/signature-pad';
import { DamageMarker, type DamageMark } from '@/components/damage-marker';
import { ConditionReport } from '@/components/condition-report';
import {
  ACCESSORY_ITEMS,
  DEVICE_TYPES,
  REPAIR_PRIORITIES,
  type DeviceType,
} from '@/lib/constants';
import { cn, formatMoney, round, toDateInput, addDays } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

// ------------------------------------------------------------------ الأنواع

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  phone: string;
  devices: DeviceOption[];
}

export interface DeviceOption {
  id: string;
  type: string;
  brand: string;
  model: string;
  color: string | null;
  imei: string | null;
  serialNumber: string | null;
}

export interface ServiceOption {
  id: string;
  code: string;
  name: string;
  price: number;
  cost: number;
  deviceType: string;
  categoryName: string | null;
  warrantyDays: number;
}

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  sellPrice: number;
  costPrice: number;
  quantity: number;
}

export interface TechnicianOption {
  id: string;
  name: string;
}

interface LineItem {
  uid: string;
  kind: 'SERVICE' | 'PART' | 'CUSTOM';
  serviceId?: string | null;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  warrantyDays?: number;
}

export interface IntakeLabels {
  [key: string]: string;
}

let uidCounter = 0;
const nextUid = () => `item-${++uidCounter}`;

// ------------------------------------------------------------------ المكوّن

export function RepairIntakeForm({
  customers,
  services,
  products,
  technicians,
  defaults,
  locale,
  currency,
  decimals,
  t,
  preselectedCustomerId,
}: {
  customers: CustomerOption[];
  services: ServiceOption[];
  products: ProductOption[];
  technicians: TechnicianOption[];
  defaults: { warrantyDays: number; turnaroundDays: number };
  locale: Locale;
  currency: string;
  decimals: number;
  t: IntakeLabels;
  preselectedCustomerId?: string;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createRepairOrderAction,
    null,
  );
  const toast = useToast();

  // ------------------------------------------------------------- الحالة
  const [customerId, setCustomerId] = useState(preselectedCustomerId ?? '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(!preselectedCustomerId);

  const [deviceId, setDeviceId] = useState('');
  const [newDevice, setNewDevice] = useState({
    type: 'PHONE' as DeviceType,
    brand: '',
    model: '',
    color: '',
    serialNumber: '',
    imei: '',
    imei2: '',
    passcode: '',
    notes: '',
  });

  const [priority, setPriority] = useState('NORMAL');
  const [technicianId, setTechnicianId] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [faultCategory, setFaultCategory] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [accessories, setAccessories] = useState<Record<string, boolean | string>>({});
  const [customAccessory, setCustomAccessory] = useState('');
  const [conditionReport, setConditionReport] = useState<Record<string, string>>({});
  const [damageMarks, setDamageMarks] = useState<DamageMark[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState<string | null>(null);

  const [items, setItems] = useState<LineItem[]>([]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const [estimatedCost, setEstimatedCost] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [warrantyDays, setWarrantyDays] = useState(defaults.warrantyDays);
  const [promisedAt, setPromisedAt] = useState(
    toDateInput(addDays(new Date(), defaults.turnaroundDays)),
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state, toast]);

  // -------------------------------------------------------------- مشتقات
  const customer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId],
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 30);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.code.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [customers, customerSearch]);

  const selectedDevice = customer?.devices.find((d) => d.id === deviceId);
  const effectiveDeviceType = (selectedDevice?.type ?? newDevice.type) as DeviceType;

  const itemsTotal = round(
    items.reduce((sum, i) => sum + i.quantity * i.unitPrice - i.discount, 0),
  );

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  // بند خدمة يحمل ضماناً أطول ⇒ نقترحه كضمان للأمر كله
  useEffect(() => {
    const maxWarranty = items.reduce((max, i) => Math.max(max, i.warrantyDays ?? 0), 0);
    if (maxWarranty > 0) setWarrantyDays(maxWarranty);
  }, [items]);

  useEffect(() => {
    if (itemsTotal > 0) setEstimatedCost(itemsTotal);
  }, [itemsTotal]);

  // ------------------------------------------------------------ الإجراءات
  function addService(service: ServiceOption) {
    setItems((prev) => [
      ...prev,
      {
        uid: nextUid(),
        kind: 'SERVICE',
        serviceId: service.id,
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        unitCost: service.cost,
        discount: 0,
        warrantyDays: service.warrantyDays,
      },
    ]);
    setShowServicePicker(false);
    setPickerSearch('');
  }

  function addPart(product: ProductOption) {
    setItems((prev) => [
      ...prev,
      {
        uid: nextUid(),
        kind: 'PART',
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.sellPrice,
        unitCost: product.costPrice,
        discount: 0,
      },
    ]);
    setShowPartPicker(false);
    setPickerSearch('');
  }

  function addCustomItem() {
    setItems((prev) => [
      ...prev,
      {
        uid: nextUid(),
        kind: 'CUSTOM',
        name: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        discount: 0,
      },
    ]);
  }

  function updateItem(uid: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  function removeItem(uid: string) {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const form = new FormData();
    for (const file of files.slice(0, 6)) form.append('files', file);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: form });
      const data = (await response.json()) as { urls?: string[]; error?: string };
      if (!response.ok || !data.urls) {
        toast.error(data.error ?? 'تعذّر رفع الصور');
        return;
      }
      setPhotos((prev) => [...prev, ...data.urls!].slice(0, 12));
    } catch {
      toast.error('تعذّر رفع الصور');
    } finally {
      event.target.value = '';
    }
  }

  /** يبني حمولة JSON التي يتوقعها الإجراء الخادمي */
  function buildPayload(): string {
    const custom = customAccessory.trim();
    return JSON.stringify({
      customerId,
      deviceId: deviceId || undefined,
      device: deviceId
        ? undefined
        : {
            type: newDevice.type,
            brand: newDevice.brand.trim(),
            model: newDevice.model.trim(),
            color: newDevice.color.trim(),
            serialNumber: newDevice.serialNumber.trim(),
            imei: newDevice.imei.trim(),
            imei2: newDevice.imei2.trim(),
            passcode: newDevice.passcode.trim(),
            notes: newDevice.notes.trim(),
          },
      technicianId: technicianId || null,
      priority,
      problemDescription: problemDescription.trim(),
      faultCategory: faultCategory.trim(),
      internalNotes: internalNotes.trim(),
      accessories: custom ? { ...accessories, custom } : accessories,
      conditionReport,
      damageMarks,
      photos,
      customerSignature,
      employeeSignature,
      estimatedCost,
      depositAmount,
      promisedAt: promisedAt || null,
      warrantyDays,
      items: items
        .filter((i) => i.name.trim() && i.quantity > 0)
        .map((i) => ({
          kind: i.kind,
          serviceId: i.serviceId ?? null,
          productId: i.productId ?? null,
          name: i.name.trim(),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          unitCost: i.unitCost,
          discount: i.discount,
        })),
    });
  }

  const canSubmit =
    Boolean(customerId) &&
    problemDescription.trim().length >= 3 &&
    (Boolean(deviceId) || (newDevice.brand.trim() && newDevice.model.trim()));

  // ------------------------------------------------------------- العرض
  return (
    <form action={formAction} className="space-y-4 pb-24">
      <input type="hidden" name="payload" value={buildPayload()} />

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      {/* ---------------------------------------------------------- العميل */}
      <Card title={t.customerSection}>
        {customer && !showCustomerPicker ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="font-medium">{customer.name}</p>
              <p className="numeric text-sm text-muted-foreground">
                {customer.phone} · {customer.code}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomerPicker(true)}
            >
              {t.change}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder={t.searchCustomer}
                leading={<Search className="h-4 w-4" />}
                autoFocus
              />
              <Link href="/customers/new" target="_blank">
                <Button type="button" variant="outline" icon={<UserPlus className="h-4 w-4" />}>
                  {t.newCustomer}
                </Button>
              </Link>
            </div>

            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {filteredCustomers.length === 0 ? (
                <li className="p-4 text-center text-sm text-muted-foreground">{t.noResults}</li>
              ) : (
                filteredCustomers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setDeviceId('');
                        setShowCustomerPicker(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition-colors hover:bg-accent"
                    >
                      <span>
                        <span className="block text-sm font-medium">{c.name}</span>
                        <span className="numeric block text-xs text-muted-foreground">
                          {c.phone}
                        </span>
                      </span>
                      <span className="numeric shrink-0 text-xs text-muted-foreground">
                        {c.devices.length} جهاز
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </Card>

      {/* ---------------------------------------------------------- الجهاز */}
      {customerId && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              {t.deviceSection}
            </span>
          }
        >
          {customer && customer.devices.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-muted-foreground">{t.existingDevice}</p>
              <div className="flex flex-wrap gap-2">
                {customer.devices.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDeviceId(deviceId === d.id ? '' : d.id)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-start text-sm transition-colors',
                      deviceId === d.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    <span className="block font-medium">
                      {d.brand} {d.model}
                    </span>
                    <span className="numeric block text-xs text-muted-foreground">
                      {d.imei ?? d.serialNumber ?? d.color ?? ''}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDeviceId('')}
                  className={cn(
                    'rounded-md border border-dashed px-3 py-2 text-sm transition-colors',
                    !deviceId ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                  )}
                >
                  <Plus className="inline h-4 w-4" /> {t.newDevice}
                </button>
              </div>
            </div>
          )}

          {!deviceId && (
            <FormGrid cols={3}>
              <Field label={t.deviceType} required>
                <Select
                  value={newDevice.type}
                  onChange={(e) =>
                    setNewDevice({ ...newDevice, type: e.target.value as DeviceType })
                  }
                  options={DEVICE_TYPES.map((type) => ({
                    value: type,
                    label: t[`deviceType_${type}`] ?? type,
                  }))}
                />
              </Field>

              <Field label={t.brand} required>
                <Input
                  value={newDevice.brand}
                  onChange={(e) => setNewDevice({ ...newDevice, brand: e.target.value })}
                  placeholder="Samsung, Apple, HP…"
                  list="brand-suggestions"
                  required
                />
                <datalist id="brand-suggestions">
                  {['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Infinix', 'Tecno', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Sony', 'Microsoft', 'Nintendo'].map(
                    (b) => (
                      <option key={b} value={b} />
                    ),
                  )}
                </datalist>
              </Field>

              <Field label={t.model} required>
                <Input
                  value={newDevice.model}
                  onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                  required
                />
              </Field>

              <Field label={t.color}>
                <Input
                  value={newDevice.color}
                  onChange={(e) => setNewDevice({ ...newDevice, color: e.target.value })}
                />
              </Field>

              <Field label={t.serialNumber}>
                <Input
                  value={newDevice.serialNumber}
                  onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })}
                  dir="ltr"
                  className="text-start"
                />
              </Field>

              {(newDevice.type === 'PHONE' || newDevice.type === 'TABLET') && (
                <Field label={t.imei}>
                  <Input
                    value={newDevice.imei}
                    onChange={(e) => setNewDevice({ ...newDevice, imei: e.target.value })}
                    dir="ltr"
                    className="text-start"
                    maxLength={17}
                  />
                </Field>
              )}

              <Field label={t.passcode} hint={t.passcodeHint} className="sm:col-span-2">
                <Input
                  value={newDevice.passcode}
                  onChange={(e) => setNewDevice({ ...newDevice, passcode: e.target.value })}
                  dir="ltr"
                  className="text-start"
                  autoComplete="off"
                />
              </Field>
            </FormGrid>
          )}
        </Card>
      )}

      {/* --------------------------------------------------------- العطل */}
      {customerId && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {t.problemSection}
            </span>
          }
        >
          <div className="space-y-4">
            <Field label={t.problem} required>
              <Textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                rows={3}
                required
                placeholder={t.problemPlaceholder}
              />
            </Field>

            <FormGrid cols={3}>
              <Field label={t.faultCategory} hint={t.faultCategoryHint}>
                <Input
                  value={faultCategory}
                  onChange={(e) => setFaultCategory(e.target.value)}
                  list="fault-categories"
                />
                <datalist id="fault-categories">
                  {['شاشة مكسورة', 'لا يشحن', 'لا يعمل', 'بطارية ضعيفة', 'مشكلة برمجية', 'دخول ماء', 'صوت', 'كاميرا', 'شبكة', 'حرارة مرتفعة', 'أخرى'].map(
                    (f) => (
                      <option key={f} value={f} />
                    ),
                  )}
                </datalist>
              </Field>

              <Field label={t.priority}>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  options={REPAIR_PRIORITIES.map((p) => ({
                    value: p,
                    label: t[`priority_${p}`] ?? p,
                  }))}
                />
              </Field>

              <Field label={t.technician}>
                <Select
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  placeholder={t.unassigned}
                  options={technicians.map((tech) => ({ value: tech.id, label: tech.name }))}
                />
              </Field>
            </FormGrid>

            <Field label={t.internalNotes} hint={t.internalNotesHint}>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
              />
            </Field>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- الملحقات */}
      {customerId && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t.accessoriesSection}
            </span>
          }
          description={t.accessoriesHint}
        >
          <div className="flex flex-wrap gap-2">
            {ACCESSORY_ITEMS.map((item) => {
              const active = accessories[item.key] === true;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setAccessories({ ...accessories, [item.key]: !active })
                  }
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {locale === 'fr' ? item.labelFr : locale === 'en' ? item.labelEn : item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Field label={t.otherAccessories}>
              <Input
                value={customAccessory}
                onChange={(e) => setCustomAccessory(e.target.value)}
                placeholder={t.otherAccessoriesPlaceholder}
              />
            </Field>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------- تقرير الحالة */}
      {customerId && (
        <Card title={t.conditionSection} description={t.conditionHint}>
          <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
            <ConditionReport
              deviceType={effectiveDeviceType}
              values={conditionReport}
              onChange={setConditionReport}
              locale={locale}
              labels={{
                components: t.components,
                physical: t.physicalMarks,
                setAll: t.setAll,
              }}
            />

            <div>
              <DamageMarker
                deviceType={effectiveDeviceType}
                marks={damageMarks}
                onChange={setDamageMarks}
                label={t.damageMarks}
                hint={t.damageMarksHint}
              />
            </div>
          </div>

          {/* الصور */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Camera className="h-4 w-4 text-muted-foreground" />
                {t.photos}
              </span>
              <label className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-xs transition-colors hover:bg-accent">
                <Plus className="inline h-3.5 w-3.5" /> {t.addPhoto}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {photos.map((url) => (
                  <div key={url} className="group relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((p) => p !== url))}
                      className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shadow"
                      aria-label="حذف الصورة"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ---------------------------------------------- الخدمات وقطع الغيار */}
      {customerId && (
        <Card
          title={t.itemsSection}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowServicePicker(true)}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                {t.addService}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPartPicker(true)}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                {t.addPart}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={addCustomItem}>
                {t.addCustom}
              </Button>
            </div>
          }
          bodyClassName={items.length ? 'p-0' : undefined}
        >
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.noItems}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{t.item}</th>
                      <th className="w-24 text-center">{t.quantity}</th>
                      <th className="w-32 text-end">{t.unitPrice}</th>
                      <th className="w-28 text-end">{t.discount}</th>
                      <th className="w-32 text-end">{t.total}</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.uid}>
                        <td>
                          {item.kind === 'CUSTOM' ? (
                            <Input
                              value={item.name}
                              onChange={(e) => updateItem(item.uid, { name: e.target.value })}
                              placeholder={t.itemName}
                              className="h-8"
                            />
                          ) : (
                            <span className="text-sm">
                              {item.name}
                              <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {item.kind === 'SERVICE' ? t.service : t.part}
                              </span>
                            </span>
                          )}
                        </td>
                        <td>
                          <Input
                            type="number"
                            min={0.01}
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.uid, { quantity: Number(e.target.value) || 0 })
                            }
                            className="h-8 text-center"
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(item.uid, { unitPrice: Number(e.target.value) || 0 })
                            }
                            className="h-8 text-end"
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={item.discount}
                            onChange={(e) =>
                              updateItem(item.uid, { discount: Number(e.target.value) || 0 })
                            }
                            className="h-8 text-end"
                          />
                        </td>
                        <td className="numeric text-end font-medium">
                          {money(round(item.quantity * item.unitPrice - item.discount))}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.uid)}
                            className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                            aria-label={t.remove}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40">
                    <tr>
                      <td colSpan={4} className="text-end font-medium">
                        {t.total}
                      </td>
                      <td className="numeric text-end text-base font-bold">
                        {money(itemsTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* --------------------------------------------- التكلفة والمواعيد */}
      {customerId && (
        <Card title={t.costSection}>
          <FormGrid cols={4}>
            <Field label={t.estimatedCost}>
              <Input
                type="number"
                min={0}
                step="any"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value) || 0)}
              />
            </Field>

            <Field label={t.deposit}>
              <Input
                type="number"
                min={0}
                step="any"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
              />
            </Field>

            <Field label={t.promisedAt}>
              <Input
                type="date"
                value={promisedAt}
                onChange={(e) => setPromisedAt(e.target.value)}
              />
            </Field>

            <Field label={t.warrantyDays}>
              <Input
                type="number"
                min={0}
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value) || 0)}
              />
            </Field>
          </FormGrid>

          {depositAmount > 0 && estimatedCost > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t.remaining}:{' '}
              <span className="numeric font-medium text-foreground">
                {money(Math.max(0, round(estimatedCost - depositAmount)))}
              </span>
            </p>
          )}
        </Card>
      )}

      {/* -------------------------------------------------------- التواقيع */}
      {customerId && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              {t.signaturesSection}
            </span>
          }
          description={t.signaturesHint}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SignaturePad
              label={t.customerSignature}
              hint={t.signHere}
              value={customerSignature}
              onChange={setCustomerSignature}
              clearLabel={t.clearSignature}
            />
            <SignaturePad
              label={t.employeeSignature}
              hint={t.signHere}
              value={employeeSignature}
              onChange={setEmployeeSignature}
              clearLabel={t.clearSignature}
            />
          </div>
        </Card>
      )}

      {/* ------------------------------------------------ شريط الحفظ الثابت */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 backdrop-blur no-print lg:ps-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">{t.total}: </span>
            <span className="numeric font-bold">{money(estimatedCost || itemsTotal)}</span>
          </div>
          <div className="flex gap-2">
            <Link href="/repairs">
              <Button type="button" variant="outline">
                {t.cancel}
              </Button>
            </Link>
            <SubmitButton label={t.save} disabled={!canSubmit} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ نوافذ الاختيار */}
      <ServicePickerDialog
        open={showServicePicker}
        onClose={() => setShowServicePicker(false)}
        services={services}
        deviceType={effectiveDeviceType}
        search={pickerSearch}
        onSearch={setPickerSearch}
        onSelect={addService}
        money={money}
        labels={{ title: t.addService, search: t.searchService, empty: t.noResults }}
      />

      <PartPickerDialog
        open={showPartPicker}
        onClose={() => setShowPartPicker(false)}
        products={products}
        search={pickerSearch}
        onSearch={setPickerSearch}
        onSelect={addPart}
        money={money}
        labels={{
          title: t.addPart,
          search: t.searchPart,
          empty: t.noResults,
          stock: t.stock,
        }}
      />
    </form>
  );
}

// ------------------------------------------------------------------ فرعيات

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

function ServicePickerDialog({
  open,
  onClose,
  services,
  deviceType,
  search,
  onSearch,
  onSelect,
  money,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  services: ServiceOption[];
  deviceType: DeviceType;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (s: ServiceOption) => void;
  money: (v: number) => string;
  labels: { title: string; search: string; empty: string };
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services
      .filter((s) => s.deviceType === 'ALL' || s.deviceType === deviceType || q)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.categoryName ?? '').toLowerCase().includes(q),
      );
  }, [services, deviceType, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceOption[]>();
    for (const s of filtered) {
      const key = s.categoryName ?? '—';
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <Dialog open={open} onClose={onClose} title={labels.title} size="lg">
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={labels.search}
        leading={<Search className="h-4 w-4" />}
        autoFocus
      />
      <div className="mt-3 max-h-[55vh] space-y-4 overflow-y-auto">
        {grouped.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          grouped.map(([category, list]) => (
            <div key={category}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {list.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => onSelect(service)}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-start transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{service.name}</span>
                      <span className="numeric block text-[11px] text-muted-foreground">
                        {service.code}
                      </span>
                    </span>
                    <span className="numeric shrink-0 text-sm font-semibold text-primary">
                      {money(service.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}

function PartPickerDialog({
  open,
  onClose,
  products,
  search,
  onSearch,
  onSelect,
  money,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductOption[];
  search: string;
  onSearch: (v: string) => void;
  onSelect: (p: ProductOption) => void;
  money: (v: number) => string;
  labels: { title: string; search: string; empty: string; stock: string };
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [products, search]);

  return (
    <Dialog open={open} onClose={onClose} title={labels.title} size="lg">
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={labels.search}
        leading={<Search className="h-4 w-4" />}
        autoFocus
      />
      <div className="mt-3 max-h-[55vh] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  disabled={product.quantity <= 0}
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
        )}
      </div>
    </Dialog>
  );
}
