'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';

import { payInstallmentAction } from '@/app/actions/invoices';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/constants';

export function PayInstallmentButton({
  installmentId,
  amount,
  labels,
}: {
  installmentId: string;
  amount: string;
  labels: {
    pay: string;
    method: string;
    methods: Record<string, string>;
    confirm: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await payInstallmentAction(installmentId, method);
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر التسديد');
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        icon={<Wallet className="h-3.5 w-3.5" />}
      >
        {labels.pay}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.pay}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button onClick={submit} loading={pending}>
              {labels.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="numeric rounded-md bg-primary/10 p-3 text-center text-2xl font-bold text-primary">
            {amount}
          </p>
          <Field label={labels.method}>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              options={PAYMENT_METHODS.filter((m) => m !== 'CREDIT').map((m) => ({
                value: m,
                label: labels.methods[m] ?? m,
              }))}
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
