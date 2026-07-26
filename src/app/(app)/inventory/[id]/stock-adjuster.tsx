'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { adjustStockAction } from '@/app/actions/inventory';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from '@/lib/constants';

/** الحركات التي يمكن للمستخدم إجراؤها يدوياً */
const MANUAL_TYPES: StockMovementType[] = ['IN', 'OUT', 'ADJUST', 'DAMAGE', 'RETURN_IN'];

export function StockAdjuster({
  productId,
  currentQuantity,
  labels,
}: {
  productId: string;
  currentQuantity: number;
  labels: {
    type: string;
    types: Record<string, string>;
    quantity: string;
    reason: string;
    submit: string;
    current: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<StockMovementType>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('أدخل كمية صالحة');
      return;
    }

    startTransition(async () => {
      const result = await adjustStockAction(productId, type, value, reason);
      if (result.ok) {
        toast.success(result.message ?? 'تم التعديل');
        setQuantity('');
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر التعديل');
      }
    });
  }

  const projected =
    type === 'ADJUST'
      ? Number(quantity) || 0
      : type === 'IN' || type === 'RETURN_IN'
        ? currentQuantity + (Number(quantity) || 0)
        : currentQuantity - (Number(quantity) || 0);

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={labels.type}>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as StockMovementType)}
          options={MANUAL_TYPES.map((mt) => ({ value: mt, label: labels.types[mt] ?? mt }))}
        />
      </Field>

      <Field
        label={labels.quantity}
        hint={
          type === 'ADJUST'
            ? 'الرصيد النهائي بعد الجرد'
            : `${labels.current}: ${currentQuantity}`
        }
      >
        <Input
          type="number"
          min={0}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </Field>

      <Field label={labels.reason}>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب التعديل"
        />
      </Field>

      {quantity && (
        <p className="rounded-md bg-muted/50 p-2 text-sm">
          الرصيد بعد التعديل:{' '}
          <span
            className={`numeric font-semibold ${projected < 0 ? 'text-danger' : 'text-foreground'}`}
          >
            {projected}
          </span>
        </p>
      )}

      <Button
        type="submit"
        loading={pending}
        className="w-full"
        icon={<Save className="h-4 w-4" />}
      >
        {labels.submit}
      </Button>
    </form>
  );
}
