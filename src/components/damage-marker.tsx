'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviceType } from '@/lib/constants';

export interface DamageMark {
  x: number; // نسبة مئوية 0-100
  y: number;
  type: string;
  note?: string;
}

const MARK_TYPES = [
  { key: 'scratch', label: 'خدش', color: '#f59e0b' },
  { key: 'crack', label: 'كسر', color: '#ef4444' },
  { key: 'dent', label: 'انبعاج', color: '#8b5cf6' },
  { key: 'missing', label: 'جزء ناقص', color: '#6b7280' },
  { key: 'water', label: 'أثر ماء', color: '#06b6d4' },
];

/** مخططات مبسّطة لكل نوع جهاز (SVG داخلي — لا صور خارجية) */
function DeviceOutline({ type }: { type: DeviceType }) {
  const stroke = 'currentColor';
  const common = { fill: 'none', stroke, strokeWidth: 2 };

  if (type === 'LAPTOP') {
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full text-muted-foreground/40">
        <rect x="30" y="10" width="140" height="90" rx="4" {...common} />
        <rect x="38" y="18" width="124" height="74" rx="2" {...common} strokeWidth={1} />
        <path d="M10 110 h180 l-10 18 H20 Z" {...common} />
        <line x1="85" y1="119" x2="115" y2="119" {...common} />
      </svg>
    );
  }

  if (type === 'DESKTOP') {
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full text-muted-foreground/40">
        <rect x="20" y="15" width="110" height="80" rx="4" {...common} />
        <path d="M60 95 v20 h30 v-20" {...common} />
        <line x1="45" y1="118" x2="105" y2="118" {...common} />
        <rect x="145" y="20" width="40" height="100" rx="4" {...common} />
        <circle cx="165" cy="35" r="4" {...common} strokeWidth={1.5} />
      </svg>
    );
  }

  if (type === 'CONSOLE') {
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full text-muted-foreground/40">
        <rect x="25" y="35" width="150" height="70" rx="10" {...common} />
        <line x1="25" y1="60" x2="175" y2="60" {...common} strokeWidth={1} />
        <circle cx="45" cy="85" r="6" {...common} strokeWidth={1.5} />
        <circle cx="155" cy="85" r="6" {...common} strokeWidth={1.5} />
        <rect x="80" y="78" width="40" height="14" rx="3" {...common} strokeWidth={1.5} />
      </svg>
    );
  }

  if (type === 'TABLET') {
    return (
      <svg viewBox="0 0 120 160" className="h-full w-full text-muted-foreground/40">
        <rect x="15" y="10" width="90" height="140" rx="8" {...common} />
        <rect x="22" y="20" width="76" height="120" rx="3" {...common} strokeWidth={1} />
        <circle cx="60" cy="145" r="4" {...common} strokeWidth={1.5} />
      </svg>
    );
  }

  if (type === 'WATCH') {
    return (
      <svg viewBox="0 0 120 160" className="h-full w-full text-muted-foreground/40">
        <rect x="35" y="45" width="50" height="65" rx="12" {...common} />
        <path d="M45 45 v-30 h30 v30" {...common} />
        <path d="M45 110 v30 h30 v-30" {...common} />
        <circle cx="88" cy="70" r="4" {...common} strokeWidth={1.5} />
      </svg>
    );
  }

  // PHONE والافتراضي
  return (
    <svg viewBox="0 0 100 180" className="h-full w-full text-muted-foreground/40">
      <rect x="15" y="8" width="70" height="164" rx="12" {...common} />
      <rect x="20" y="20" width="60" height="140" rx="4" {...common} strokeWidth={1} />
      <circle cx="50" cy="166" r="4" {...common} strokeWidth={1.5} />
      <line x1="42" y1="14" x2="58" y2="14" {...common} strokeWidth={2.5} />
      <rect x="26" y="26" width="14" height="14" rx="7" {...common} strokeWidth={1} />
    </svg>
  );
}

/**
 * تحديد مواضع الأضرار على مخطط الجهاز.
 * انقر على المخطط لإضافة علامة بالنوع المحدد؛ انقر على علامة لحذفها.
 */
export function DamageMarker({
  deviceType,
  marks,
  onChange,
  label,
  hint,
  readOnly = false,
}: {
  deviceType: DeviceType;
  marks: DamageMark[];
  onChange: (marks: DamageMark[]) => void;
  label: string;
  hint?: string;
  readOnly?: boolean;
}) {
  const [activeType, setActiveType] = useState(MARK_TYPES[0].key);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onChange([...marks, { x: Math.round(x), y: Math.round(y), type: activeType }]);
  }

  function removeMark(index: number) {
    if (readOnly) return;
    onChange(marks.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {marks.length > 0 && !readOnly && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            مسح الكل
          </button>
        )}
      </div>

      {!readOnly && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {MARK_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => setActiveType(type.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                activeType === type.key
                  ? 'border-transparent bg-foreground text-background'
                  : 'border-border hover:bg-accent',
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: type.color }}
                aria-hidden
              />
              {type.label}
            </button>
          ))}
        </div>
      )}

      <div
        onClick={handleClick}
        className={cn(
          'relative mx-auto aspect-[3/4] max-h-[320px] w-full max-w-[240px] rounded-lg border border-border bg-muted/20',
          !readOnly && 'cursor-crosshair',
        )}
      >
        <DeviceOutline type={deviceType} />

        {marks.map((mark, index) => {
          const type = MARK_TYPES.find((m) => m.key === mark.type) ?? MARK_TYPES[0];
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeMark(index);
              }}
              title={`${type.label}${mark.note ? ` — ${mark.note}` : ''}`}
              className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow ring-2 ring-white transition-transform hover:scale-125"
              style={{
                left: `${mark.x}%`,
                top: `${mark.y}%`,
                backgroundColor: type.color,
              }}
            >
              {readOnly ? index + 1 : <X className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {hint && !readOnly && (
        <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p>
      )}

      {marks.length > 0 && (
        <ul className="mt-3 space-y-1">
          {marks.map((mark, index) => {
            const type = MARK_TYPES.find((m) => m.key === mark.type) ?? MARK_TYPES[0];
            return (
              <li key={index} className="flex items-center gap-2 text-xs">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: type.color }}
                >
                  {index + 1}
                </span>
                <span>{type.label}</span>
                {mark.note && <span className="text-muted-foreground">— {mark.note}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
