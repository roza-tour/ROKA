'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Checkbox } from '@/components/ui/form';

export function BarcodeSheetControls({
  productId,
  count,
  showPrice,
  labels,
}: {
  productId: string;
  count: number;
  showPrice: boolean;
  labels: { count: string; price: string; apply: string };
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(count));
  const [price, setPrice] = useState(showPrice);

  function apply() {
    const params = new URLSearchParams({
      count: String(Math.min(65, Math.max(1, Number(value) || 24))),
      price: price ? '1' : '0',
    });
    router.replace(`/inventory/${productId}/barcode?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 px-3 pb-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">{labels.count}</span>
        <Input
          type="number"
          min={1}
          max={65}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-24"
        />
      </label>

      <div className="pb-2">
        <Checkbox
          checked={price}
          onChange={(e) => setPrice(e.target.checked)}
          label={<span className="text-gray-700">{labels.price}</span>}
        />
      </div>

      <Button size="sm" onClick={apply}>
        {labels.apply}
      </Button>
    </div>
  );
}
