'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PackageX,
  AlarmClock,
  Receipt,
  ShieldAlert,
  RefreshCcw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { cn, formatMoney, formatDate } from '@/lib/utils';
import type { DashboardAlerts } from '@/lib/analytics';
import type { Locale } from '@/i18n/config';

interface AlertGroup {
  key: string;
  icon: React.ElementType;
  tone: 'danger' | 'warning' | 'info';
  title: string;
  items: { id: string; href: string; primary: string; secondary?: string }[];
}

export function AlertsPanel({
  alerts,
  locale,
  currency,
  decimals,
  labels,
}: {
  alerts: DashboardAlerts;
  locale: Locale;
  currency: string;
  decimals: number;
  labels: {
    lowStock: string;
    overdueRepairs: string;
    unpaidInvoices: string;
    warranties: string;
    expenses: string;
    empty: string;
  };
}) {
  const money = (v: number) => formatMoney(v, { currency, decimals, locale });

  const groups: AlertGroup[] = ([
    {
      key: 'overdue',
      icon: AlarmClock,
      tone: 'danger',
      title: labels.overdueRepairs,
      items: alerts.overdueRepairs.map((r) => ({
        id: r.id,
        href: `/repairs/${r.id}`,
        primary: `${r.number} — ${r.customerName}`,
        secondary: r.promisedAt ? formatDate(r.promisedAt, locale) : undefined,
      })),
    },
    {
      key: 'stock',
      icon: PackageX,
      tone: 'warning',
      title: labels.lowStock,
      items: alerts.lowStock.map((p) => ({
        id: p.id,
        href: `/inventory/${p.id}`,
        primary: p.name,
        secondary: `${p.quantity} / ${p.minQuantity}`,
      })),
    },
    {
      key: 'invoices',
      icon: Receipt,
      tone: 'warning',
      title: labels.unpaidInvoices,
      items: alerts.unpaidInvoices.map((i) => ({
        id: i.id,
        href: `/invoices/${i.id}`,
        primary: i.number,
        secondary: money(i.dueAmount),
      })),
    },
    {
      key: 'warranty',
      icon: ShieldAlert,
      tone: 'info',
      title: labels.warranties,
      items: alerts.expiringWarranties.map((w) => ({
        id: w.id,
        href: `/warranty/${w.id}`,
        primary: w.itemName,
        secondary: formatDate(w.endsAt, locale),
      })),
    },
    {
      key: 'expenses',
      icon: RefreshCcw,
      tone: 'info',
      title: labels.expenses,
      items: alerts.dueRecurringExpenses.map((e) => ({
        id: e.id,
        href: `/expenses/${e.id}`,
        primary: e.description,
        secondary: `${money(e.amount)}${e.nextDueDate ? ` · ${formatDate(e.nextDueDate, locale)}` : ''}`,
      })),
    },
  ] satisfies AlertGroup[]).filter((g) => g.items.length > 0);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!groups.length) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </div>
    );
  }

  const TONE_STYLES = {
    danger: 'text-danger bg-danger/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10',
  } as const;

  return (
    <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
      {groups.map((group) => {
        const Icon = group.icon;
        const isCollapsed = collapsed[group.key];
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
              }
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start transition-colors hover:bg-accent/50"
              aria-expanded={!isCollapsed}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                  TONE_STYLES[group.tone],
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 truncate text-sm font-medium">{group.title}</span>
              <span className="numeric rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                {group.items.length}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  isCollapsed && '-rotate-90 rtl:rotate-90',
                )}
                aria-hidden
              />
            </button>

            {!isCollapsed && (
              <ul className="pb-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 px-4 py-1.5 ps-14 text-xs transition-colors hover:bg-accent/50"
                    >
                      <span className="truncate">{item.primary}</span>
                      {item.secondary && (
                        <span className="numeric shrink-0 text-muted-foreground">
                          {item.secondary}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
