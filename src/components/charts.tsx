'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, formatNumber } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

/**
 * غلاف موحّد لرسوم Recharts مع دعم RTL والوضع الداكن.
 * كل الرسوم تستخدم متغيّرات CSS للألوان حتى تتبع السمة تلقائياً.
 */

export const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
];

const AXIS_STYLE = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  locale,
  money = true,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  currency?: string;
  locale: Locale;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover p-2.5 text-xs shadow-card">
      {label && <p className="mb-1.5 font-medium">{label}</p>}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="numeric font-medium">
              {money
                ? formatMoney(Number(entry.value), { currency, locale })
                : formatNumber(Number(entry.value), locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- رسم المساحات

export interface SeriesConfig {
  key: string;
  label: string;
  color?: string;
}

export function RevenueAreaChart({
  data,
  series,
  currency,
  locale,
  height = 280,
  xKey = 'date',
}: {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  currency: string;
  locale: Locale;
  height?: number;
  xKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                stopOpacity={0.35}
              />
              <stop
                offset="95%"
                stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          reversed={locale === 'ar'}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={60}
          orientation={locale === 'ar' ? 'right' : 'left'}
          tickFormatter={(v: number) => formatNumber(v, 'en')}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} locale={locale} />}
          cursor={{ stroke: 'hsl(var(--border))' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------- رسم الأعمدة

export function ComparisonBarChart({
  data,
  series,
  currency,
  locale,
  height = 280,
  xKey = 'date',
  money = true,
}: {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  currency?: string;
  locale: Locale;
  height?: number;
  xKey?: string;
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          reversed={locale === 'ar'}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={56}
          orientation={locale === 'ar' ? 'right' : 'left'}
          tickFormatter={(v: number) => formatNumber(v, 'en')}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} locale={locale} money={money} />}
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------------- رسم دائري

export function DistributionPieChart({
  data,
  currency,
  locale,
  height = 260,
  money = true,
}: {
  data: { name: string; value: number; color?: string }[];
  currency?: string;
  locale: Locale;
  height?: number;
  money?: boolean;
}) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        لا توجد بيانات
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip currency={currency} locale={locale} money={money} />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------------- رسم خطي بسيط

export function TrendLineChart({
  data,
  series,
  locale,
  height = 240,
  xKey = 'date',
}: {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  locale: Locale;
  height?: number;
  xKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          reversed={locale === 'ar'}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
          orientation={locale === 'ar' ? 'right' : 'left'}
        />
        <Tooltip content={<ChartTooltip locale={locale} money={false} />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
