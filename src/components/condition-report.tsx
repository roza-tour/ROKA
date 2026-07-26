'use client';

import { CONDITION_CHECKS, PHYSICAL_FLAGS, type ConditionValue, type DeviceType } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

const VALUES: { value: ConditionValue; label: string; className: string }[] = [
  { value: 'OK', label: 'سليم', className: 'bg-success text-success-foreground' },
  { value: 'FAULTY', label: 'معطّل', className: 'bg-danger text-danger-foreground' },
  { value: 'MISSING', label: 'مفقود', className: 'bg-slate-600 text-white' },
  { value: 'UNTESTED', label: 'لم يُفحص', className: 'bg-muted-foreground text-white' },
];

function checkLabel(
  check: { label: string; labelFr: string; labelEn: string },
  locale: Locale,
): string {
  return locale === 'fr' ? check.labelFr : locale === 'en' ? check.labelEn : check.label;
}

/** يعيد قائمة الفحوص المناسبة لنوع الجهاز */
export function checksForDevice(deviceType: DeviceType) {
  return CONDITION_CHECKS.filter(
    (c) => c.devices === 'ALL' || (c.devices as DeviceType[]).includes(deviceType),
  );
}

/**
 * تقرير حالة الجهاز — مكوّنات الفحص + العلامات الفيزيائية.
 * القيم تُخزَّن كخريطة { key: "OK" | "FAULTY" | ... } وعلامات منطقية.
 */
export function ConditionReport({
  deviceType,
  values,
  onChange,
  locale,
  labels,
  readOnly = false,
}: {
  deviceType: DeviceType;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  locale: Locale;
  labels: { components: string; physical: string; setAll: string };
  readOnly?: boolean;
}) {
  const checks = checksForDevice(deviceType);

  function set(key: string, value: string) {
    if (readOnly) return;
    onChange({ ...values, [key]: value });
  }

  function setAll(value: ConditionValue) {
    if (readOnly) return;
    const next = { ...values };
    for (const check of checks) next[check.key] = value;
    onChange(next);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{labels.components}</h3>
          {!readOnly && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{labels.setAll}</span>
              {VALUES.slice(0, 2).map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setAll(v.value)}
                  className={cn('rounded px-2 py-0.5 font-medium', v.className)}
                >
                  {v.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAll('UNTESTED')}
                className="rounded border border-border px-2 py-0.5"
              >
                لم يُفحص
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => {
            const current = values[check.key] ?? 'UNTESTED';
            return (
              <div
                key={check.key}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="truncate text-sm">{checkLabel(check, locale)}</span>
                <div className="flex shrink-0 gap-0.5 rounded bg-muted p-0.5">
                  {VALUES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => set(check.key, v.value)}
                      disabled={readOnly}
                      title={v.label}
                      aria-label={`${checkLabel(check, locale)}: ${v.label}`}
                      aria-pressed={current === v.value}
                      className={cn(
                        'h-6 w-6 rounded text-[10px] font-bold transition-colors disabled:cursor-default',
                        current === v.value
                          ? v.className
                          : 'text-muted-foreground hover:bg-background',
                      )}
                    >
                      {v.value === 'OK'
                        ? '✓'
                        : v.value === 'FAULTY'
                          ? '✕'
                          : v.value === 'MISSING'
                            ? '−'
                            : '?'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">{labels.physical}</h3>
        <div className="flex flex-wrap gap-2">
          {PHYSICAL_FLAGS.map((flag) => {
            const active = values[flag.key] === 'YES';
            return (
              <button
                key={flag.key}
                type="button"
                onClick={() => set(flag.key, active ? 'NO' : 'YES')}
                disabled={readOnly}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-default',
                  active
                    ? 'border-transparent bg-warning text-warning-foreground'
                    : 'border-border hover:bg-accent',
                )}
              >
                {checkLabel(flag, locale)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** عرض التقرير للقراءة فقط (في صفحة التفاصيل والطباعة) */
export function ConditionReportView({
  deviceType,
  values,
  locale,
  labels,
}: {
  deviceType: DeviceType;
  values: Record<string, string>;
  locale: Locale;
  labels: Record<string, string>;
}) {
  const checks = checksForDevice(deviceType).filter(
    (c) => values[c.key] && values[c.key] !== 'UNTESTED',
  );
  const flags = PHYSICAL_FLAGS.filter((f) => values[f.key] === 'YES');

  if (!checks.length && !flags.length) {
    return <p className="text-sm text-muted-foreground">لم يُسجَّل تقرير حالة</p>;
  }

  const TONES: Record<string, string> = {
    OK: 'text-success',
    FAULTY: 'text-danger',
    MISSING: 'text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      {checks.length > 0 && (
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => {
            const value = values[check.key];
            return (
              <li
                key={check.key}
                className="flex items-center justify-between gap-2 border-b border-border/50 py-1 text-sm"
              >
                <span className="text-muted-foreground">{checkLabel(check, locale)}</span>
                <span className={cn('font-medium', TONES[value] ?? '')}>
                  {labels[value] ?? value}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((flag) => (
            <span
              key={flag.key}
              className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning"
            >
              {checkLabel(flag, locale)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
