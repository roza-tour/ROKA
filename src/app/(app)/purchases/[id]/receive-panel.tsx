'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PackageCheck } from 'lucide-react';
import { receivePurchaseAction } from '@/app/actions/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

interface Item {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  total: number;
}

export function ReceiveGoodsPanel({
  purchaseId,
  items,
  canReceive,
  currency,
  decimals,
  locale,
  labels,
}: {
  purchaseId: string;
  items: Item[];
  canReceive: boolean;
  currency: string;
  decimals: number;
  locale: Locale;
  labels: {
    product: string;
    ordered: string;
    received: string;
    toReceive: string;
    unitCost: string;
    total: string;
    receive: string;
    receiveAll: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  function fillAll() {
    const next: Record<string, string> = {};
    for (const item of items) {
      const remaining = item.quantity - item.receivedQuantity;
      if (remaining > 0) next[item.id] = String(remaining);
    }
    setQuantities(next);
  }

  function submit() {
    const received = Object.entries(quantities)
      .map(([itemId, value]) => ({ itemId, quantity: Number(value) || 0 }))
      .filter((entry) => entry.quantity > 0);

    if (!received.length) {
      toast.error('أدخل الكميات المستلمة');
      return;
    }

    startTransition(async () => {
      const result = await receivePurchaseAction(purchaseId, received);
      if (result.ok) {
        toast.success(result.message ?? 'تم الاستلام');
        setQuantities({});
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الاستلام');
      }
    });
  }

  const hasPending = items.some((i) => i.receivedQuantity < i.quantity);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>{labels.product}</th>
              <th className="w-20 text-center">{labels.ordered}</th>
              <th className="w-20 text-center">{labels.received}</th>
              {canReceive && hasPending && (
                <th className="w-28 text-center">{labels.toReceive}</th>
              )}
              <th className="w-28 text-end">{labels.unitCost}</th>
              <th className="w-28 text-end">{labels.total}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const remaining = item.quantity - item.receivedQuantity;
              const complete = remaining <= 0;
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={`/inventory/${item.productId}`} className="hover:text-primary">
                      <span className="block font-medium">{item.name}</span>
                      <span className="numeric block text-xs text-muted-foreground">
                        {item.sku}
                      </span>
                    </Link>
                  </td>
                  <td className="numeric text-center">{item.quantity}</td>
                  <td className="text-center">
                    <span
                      className={`numeric ${complete ? 'text-success' : 'text-muted-foreground'}`}
                    >
                      {item.receivedQuantity}
                    </span>
                    {complete && (
                      <Badge tone="emerald" size="sm" className="ms-1">
                        ✓
                      </Badge>
                    )}
                  </td>
                  {canReceive && hasPending && (
                    <td>
                      {complete ? (
                        <span className="block text-center text-muted-foreground">—</span>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          step="any"
                          value={quantities[item.id] ?? ''}
                          onChange={(e) =>
                            setQuantities({ ...quantities, [item.id]: e.target.value })
                          }
                          placeholder={String(remaining)}
                          className="h-8 text-center"
                        />
                      )}
                    </td>
                  )}
                  <td className="numeric text-end">{money(item.unitCost)}</td>
                  <td className="numeric text-end font-medium">{money(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canReceive && hasPending && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
          <Button variant="outline" size="sm" onClick={fillAll} disabled={pending}>
            {labels.receiveAll}
          </Button>
          <Button
            onClick={submit}
            loading={pending}
            icon={<PackageCheck className="h-4 w-4" />}
          >
            {labels.receive}
          </Button>
        </div>
      )}
    </>
  );
}
