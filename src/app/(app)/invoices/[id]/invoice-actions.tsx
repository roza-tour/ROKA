'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Ban, Send, CalendarRange } from 'lucide-react';

import {
  addPaymentAction,
  cancelInvoiceAction,
  sendInvoiceNotificationAction,
  createInstallmentPlanAction,
} from '@/app/actions/invoices';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatMoney, toDateInput, round } from '@/lib/utils';
import {
  PAYMENT_METHODS,
  NOTIFICATION_CHANNELS,
  type PaymentMethod,
  type NotificationChannel,
} from '@/lib/constants';
import type { Locale } from '@/i18n/config';

type ActiveDialog = 'payment' | 'cancel' | 'notify' | 'installments' | null;

export function InvoiceActions({
  invoiceId,
  status,
  total,
  dueAmount,
  hasCustomer,
  hasPlan,
  canPay,
  canCancel,
  canNotify,
  currency,
  decimals,
  locale,
  labels,
}: {
  invoiceId: string;
  status: string;
  total: number;
  dueAmount: number;
  hasCustomer: boolean;
  hasPlan: boolean;
  canPay: boolean;
  canCancel: boolean;
  canNotify: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: {
    addPayment: string;
    amount: string;
    method: string;
    methods: Record<string, string>;
    reference: string;
    notes: string;
    submit: string;
    cancel: string;
    due: string;
    cancelInvoice: string;
    cancelReason: string;
    cancelWarning: string;
    notify: string;
    channel: string;
    channels: Record<string, string>;
    installments: string;
    months: string;
    downPayment: string;
    startDate: string;
    createPlan: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<ActiveDialog>(null);

  // نموذج الدفع
  const [amount, setAmount] = useState(String(dueAmount));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // إلغاء
  const [cancelReason, setCancelReason] = useState('');

  // إشعار
  const [channel, setChannel] = useState<NotificationChannel>('SMS');

  // أقساط
  const [months, setMonths] = useState('3');
  const [downPayment, setDownPayment] = useState('0');
  const [startDate, setStartDate] = useState(toDateInput(new Date()));

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });
  const isClosed = status === 'CANCELLED';

  function close() {
    setDialog(null);
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        close();
        router.refresh();
      } else {
        toast.error(result.error ?? 'حدث خطأ');
      }
    });
  }

  return (
    <>
      {canPay && !isClosed && dueAmount > 0 && (
        <Button
          onClick={() => {
            setAmount(String(dueAmount));
            setDialog('payment');
          }}
          icon={<Wallet className="h-4 w-4" />}
        >
          {labels.addPayment}
        </Button>
      )}

      {canNotify && !isClosed && hasCustomer && (
        <Button
          variant="outline"
          onClick={() => setDialog('notify')}
          icon={<Send className="h-4 w-4" />}
        >
          {labels.notify}
        </Button>
      )}

      {canPay && !isClosed && !hasPlan && hasCustomer && dueAmount > 0 && (
        <Button
          variant="outline"
          onClick={() => setDialog('installments')}
          icon={<CalendarRange className="h-4 w-4" />}
        >
          {labels.installments}
        </Button>
      )}

      {canCancel && !isClosed && (
        <Button
          variant="ghost"
          onClick={() => setDialog('cancel')}
          icon={<Ban className="h-4 w-4" />}
        >
          {labels.cancelInvoice}
        </Button>
      )}

      {/* ------------------------------------------------------ دفعة */}
      <Dialog
        open={dialog === 'payment'}
        onClose={close}
        title={labels.addPayment}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(() =>
                  addPaymentAction(
                    invoiceId,
                    Number(amount) || 0,
                    method,
                    reference || undefined,
                    notes || undefined,
                  ),
                )
              }
            >
              {labels.submit}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">{labels.due}</p>
            <p className="numeric text-2xl font-bold text-danger">{money(dueAmount)}</p>
          </div>

          <Field label={labels.amount}>
            <Input
              type="number"
              min={0}
              max={dueAmount}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label={labels.method}>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: labels.methods[m] ?? m }))}
            />
          </Field>

          {(method === 'CARD' || method === 'BANK_TRANSFER' || method === 'CHECK') && (
            <Field label={labels.reference}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />
            </Field>
          )}

          <Field label={labels.notes}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
      </Dialog>

      {/* ------------------------------------------------------ إلغاء */}
      <Dialog
        open={dialog === 'cancel'}
        onClose={close}
        title={labels.cancelInvoice}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={!cancelReason.trim()}
              onClick={() => run(() => cancelInvoiceAction(invoiceId, cancelReason.trim()))}
            >
              {labels.submit}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {labels.cancelWarning}
          </p>
          <Field label={labels.cancelReason} required>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              autoFocus
            />
          </Field>
        </div>
      </Dialog>

      {/* ------------------------------------------------------ إشعار */}
      <Dialog
        open={dialog === 'notify'}
        onClose={close}
        title={labels.notify}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() => run(() => sendInvoiceNotificationAction(invoiceId, channel))}
            >
              {labels.submit}
            </Button>
          </>
        }
      >
        <Field label={labels.channel}>
          <Select
            value={channel}
            onChange={(e) => setChannel(e.target.value as NotificationChannel)}
            options={NOTIFICATION_CHANNELS.filter((c) => c !== 'INTERNAL').map((c) => ({
              value: c,
              label: labels.channels[c] ?? c,
            }))}
          />
        </Field>
      </Dialog>

      {/* ---------------------------------------------------- الأقساط */}
      <Dialog
        open={dialog === 'installments'}
        onClose={close}
        title={labels.installments}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(() =>
                  createInstallmentPlanAction(
                    invoiceId,
                    Number(months) || 1,
                    Number(downPayment) || 0,
                    new Date(startDate),
                  ),
                )
              }
            >
              {labels.createPlan}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={labels.downPayment}>
            <Input
              type="number"
              min={0}
              max={total}
              step="any"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
            />
          </Field>

          <Field label={labels.months}>
            <Input
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </Field>

          <Field label={labels.startDate}>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          {Number(months) > 0 && (
            <p className="rounded-md bg-muted/50 p-3 text-center text-sm">
              القسط الشهري:{' '}
              <span className="numeric font-bold">
                {money(round((total - (Number(downPayment) || 0)) / (Number(months) || 1)))}
              </span>
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
