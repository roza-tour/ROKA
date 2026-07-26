'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const PRESETS = ['today', 'week', 'month', 'year', 'custom'] as const;
type Preset = (typeof PRESETS)[number];

/** اختيار فترة التقرير — الحالة في الرابط ليمكن مشاركة التقرير */
export function ReportPeriodPicker({
  labels,
}: {
  labels: Record<Preset | 'from' | 'to' | 'apply', string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (searchParams.get('preset') as Preset) ?? 'month';
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  function select(preset: Preset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', preset);
    if (preset !== 'custom') {
      params.delete('from');
      params.delete('to');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function applyCustom() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', 'custom');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-3 no-print">
      <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => select(preset)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              current === preset
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labels[preset]}
          </button>
        ))}
      </div>

      {current === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {labels.from}
            </span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-auto"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {labels.to}
            </span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-auto"
            />
          </label>
          <Button size="sm" onClick={applyCustom} disabled={!from}>
            {labels.apply}
          </Button>
        </div>
      )}
    </div>
  );
}
