'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, Store, Wallet, Wrench, Receipt, Gift, Bell, Package } from 'lucide-react';

import { saveSettingsAction } from '@/app/actions/settings';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';
import { NOTIFICATION_CHANNELS } from '@/lib/constants';

/** نصوص صفحة الإعدادات — تُبنى على الخادم */
export interface SettingsLabels {
  shop: string;
  shopName: string;
  legalName: string;
  phone: string;
  phone2: string;
  email: string;
  address: string;
  taxNumber: string;
  website: string;
  logo: string;
  finance: string;
  currency: string;
  taxEnabled: string;
  taxRate: string;
  decimals: string;
  repair: string;
  defaultWarranty: string;
  defaultTurnaround: string;
  repairTerms: string;
  invoice: string;
  invoiceTerms: string;
  invoiceFooter: string;
  loyalty: string;
  loyaltyEnabled: string;
  pointsPerUnit: string;
  unitValue: string;
  loyaltyHint: string;
  notifications: string;
  autoNotify: string;
  defaultChannel: string;
  channels: Record<string, string>;
  inventory: string;
  lowStockAlert: string;
  save: string;
  saved: string;
}

export function SettingsForm({
  settings,
  currencies,
  canEdit,
  labels,
}: {
  settings: Record<string, string>;
  currencies: { code: string; symbol: string; name: string }[];
  canEdit: boolean;
  labels: SettingsLabels;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(
    saveSettingsAction,
    null,
  );
  const toast = useToast();

  const [taxEnabled, setTaxEnabled] = useState(settings['finance.taxEnabled'] === 'true');
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(
    settings['loyalty.enabled'] === 'true',
  );
  const [autoNotify, setAutoNotify] = useState(
    settings['notifications.autoOnStatusChange'] === 'true',
  );
  const [lowStockAlert, setLowStockAlert] = useState(
    settings['inventory.lowStockAlert'] === 'true',
  );

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? labels.saved);
    else if (state?.error) toast.error(state.error);
  }, [state, toast, labels.saved]);

  const value = (key: string) => settings[key] ?? '';

  return (
    <form action={formAction} className="space-y-4">
      {/* مربعات الاختيار: نرسل علامة وجود حتى يعرف الخادم أنها في النموذج */}
      <input type="hidden" name="__present_finance.taxEnabled" value="1" />
      <input type="hidden" name="__present_loyalty.enabled" value="1" />
      <input type="hidden" name="__present_notifications.autoOnStatusChange" value="1" />
      <input type="hidden" name="__present_inventory.lowStockAlert" value="1" />

      <Card
        title={
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            {labels.shop}
          </span>
        }
      >
        <FormGrid cols={2}>
          <Field label={labels.shopName} required>
            <Input name="shop.name" defaultValue={value('shop.name')} required disabled={!canEdit} />
          </Field>
          <Field label={labels.legalName}>
            <Input name="shop.legalName" defaultValue={value('shop.legalName')} disabled={!canEdit} />
          </Field>
          <Field label={labels.phone}>
            <Input name="shop.phone" defaultValue={value('shop.phone')} dir="ltr" disabled={!canEdit} />
          </Field>
          <Field label={labels.phone2}>
            <Input name="shop.phone2" defaultValue={value('shop.phone2')} dir="ltr" disabled={!canEdit} />
          </Field>
          <Field label={labels.email}>
            <Input
              name="shop.email"
              type="email"
              defaultValue={value('shop.email')}
              dir="ltr"
              className="text-start"
              disabled={!canEdit}
            />
          </Field>
          <Field label={labels.website}>
            <Input
              name="shop.website"
              defaultValue={value('shop.website')}
              dir="ltr"
              className="text-start"
              disabled={!canEdit}
            />
          </Field>
          <Field label={labels.address} className="sm:col-span-2">
            <Input name="shop.address" defaultValue={value('shop.address')} disabled={!canEdit} />
          </Field>
          <Field label={labels.taxNumber}>
            <Input
              name="shop.taxNumber"
              defaultValue={value('shop.taxNumber')}
              dir="ltr"
              className="text-start"
              disabled={!canEdit}
            />
          </Field>
          <Field label={labels.logo} hint="رابط الشعار (يظهر في الفواتير)">
            <Input
              name="shop.logoUrl"
              defaultValue={value('shop.logoUrl')}
              dir="ltr"
              className="text-start"
              disabled={!canEdit}
            />
          </Field>
        </FormGrid>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {labels.finance}
          </span>
        }
      >
        <FormGrid cols={3}>
          <Field label={labels.currency}>
            <Select
              name="finance.currency"
              defaultValue={value('finance.currency') || 'DZD'}
              disabled={!canEdit}
              options={currencies.map((c) => ({
                value: c.code,
                label: `${c.name} (${c.symbol})`,
              }))}
            />
          </Field>

          <Field label={labels.decimals}>
            <Select
              name="finance.decimals"
              defaultValue={value('finance.decimals') || '2'}
              disabled={!canEdit}
              options={[
                { value: '0', label: '0' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
              ]}
            />
          </Field>

          <Field label={labels.taxRate}>
            <Input
              name="finance.taxRate"
              type="number"
              min={0}
              max={100}
              step="any"
              defaultValue={value('finance.taxRate') || '0'}
              disabled={!canEdit || !taxEnabled}
            />
          </Field>
        </FormGrid>

        <div className="mt-4">
          <Checkbox
            name="finance.taxEnabled"
            value="true"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
            disabled={!canEdit}
            label={labels.taxEnabled}
          />
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {labels.repair}
          </span>
        }
      >
        <FormGrid cols={2}>
          <Field label={labels.defaultWarranty}>
            <Input
              name="repair.defaultWarrantyDays"
              type="number"
              min={0}
              defaultValue={value('repair.defaultWarrantyDays') || '30'}
              disabled={!canEdit}
            />
          </Field>
          <Field label={labels.defaultTurnaround}>
            <Input
              name="repair.defaultTurnaroundDays"
              type="number"
              min={0}
              defaultValue={value('repair.defaultTurnaroundDays') || '3'}
              disabled={!canEdit}
            />
          </Field>
          <Field label={labels.repairTerms} className="sm:col-span-2">
            <Textarea
              name="repair.terms"
              defaultValue={value('repair.terms')}
              rows={4}
              disabled={!canEdit}
            />
          </Field>
        </FormGrid>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {labels.invoice}
          </span>
        }
      >
        <div className="space-y-4">
          <Field label={labels.invoiceTerms}>
            <Textarea
              name="invoice.terms"
              defaultValue={value('invoice.terms')}
              rows={3}
              disabled={!canEdit}
            />
          </Field>
          <Field label={labels.invoiceFooter}>
            <Input
              name="invoice.footer"
              defaultValue={value('invoice.footer')}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            {labels.loyalty}
          </span>
        }
      >
        <div className="space-y-4">
          <Checkbox
            name="loyalty.enabled"
            value="true"
            checked={loyaltyEnabled}
            onChange={(e) => setLoyaltyEnabled(e.target.checked)}
            disabled={!canEdit}
            label={labels.loyaltyEnabled}
          />

          {loyaltyEnabled && (
            <FormGrid cols={2}>
              <Field label={labels.pointsPerUnit} hint={labels.loyaltyHint}>
                <Input
                  name="loyalty.pointsPerUnit"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={value('loyalty.pointsPerUnit') || '1'}
                  disabled={!canEdit}
                />
              </Field>
              <Field label={labels.unitValue}>
                <Input
                  name="loyalty.unitValue"
                  type="number"
                  min={1}
                  step="any"
                  defaultValue={value('loyalty.unitValue') || '100'}
                  disabled={!canEdit}
                />
              </Field>
            </FormGrid>
          )}
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {labels.notifications}
          </span>
        }
      >
        <div className="space-y-4">
          <Checkbox
            name="notifications.autoOnStatusChange"
            value="true"
            checked={autoNotify}
            onChange={(e) => setAutoNotify(e.target.checked)}
            disabled={!canEdit}
            label={labels.autoNotify}
          />

          <Field label={labels.defaultChannel}>
            <Select
              name="notifications.defaultChannel"
              defaultValue={value('notifications.defaultChannel') || 'SMS'}
              disabled={!canEdit}
              options={NOTIFICATION_CHANNELS.filter((c) => c !== 'INTERNAL').map((c) => ({
                value: c,
                label: labels.channels[c] ?? c,
              }))}
            />
          </Field>
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {labels.inventory}
          </span>
        }
      >
        <Checkbox
          name="inventory.lowStockAlert"
          value="true"
          checked={lowStockAlert}
          onChange={(e) => setLowStockAlert(e.target.checked)}
          disabled={!canEdit}
          label={labels.lowStockAlert}
        />
      </Card>

      {canEdit && (
        <div className="sticky bottom-4 flex justify-end">
          <SubmitButton label={labels.save} />
        </div>
      )}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      loading={pending}
      icon={<Save className="h-4 w-4" />}
      className="shadow-card"
    >
      {label}
    </Button>
  );
}
