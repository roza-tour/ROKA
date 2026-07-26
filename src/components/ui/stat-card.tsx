import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<StatTone, { icon: string; value: string }> = {
  default: { icon: 'bg-muted text-muted-foreground', value: 'text-foreground' },
  primary: { icon: 'bg-primary/10 text-primary', value: 'text-foreground' },
  success: { icon: 'bg-success/10 text-success', value: 'text-success' },
  warning: { icon: 'bg-warning/10 text-warning', value: 'text-warning' },
  danger: { icon: 'bg-danger/10 text-danger', value: 'text-danger' },
  info: { icon: 'bg-info/10 text-info', value: 'text-info' },
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  tone?: StatTone;
  /** نسبة التغيّر مقارنة بالفترة السابقة */
  change?: number | null;
  changeLabel?: string;
  /** true إذا كان الارتفاع أمراً سيئاً (مثل المصروفات) */
  invertChange?: boolean;
  hint?: string;
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  change,
  changeLabel,
  invertChange = false,
  hint,
  href,
  className,
}: StatCardProps) {
  const positive = change != null && change > 0;
  const negative = change != null && change < 0;
  const good = invertChange ? negative : positive;
  const bad = invertChange ? positive : negative;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              TONES[tone].icon,
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
        )}
      </div>

      <p className={cn('mt-2 numeric text-2xl font-bold tracking-tight', TONES[tone].value)}>
        {value}
      </p>

      {(change != null || hint) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {change != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
                good && 'bg-success/10 text-success',
                bad && 'bg-danger/10 text-danger',
                !good && !bad && 'bg-muted text-muted-foreground',
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : negative ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span className="numeric">{Math.abs(change).toFixed(1)}%</span>
            </span>
          )}
          {(changeLabel || hint) && (
            <span className="truncate text-muted-foreground">{hint ?? changeLabel}</span>
          )}
        </div>
      )}
    </>
  );

  const classes = cn(
    'card p-4 transition-shadow',
    href && 'hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(classes, 'block')}>
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}
