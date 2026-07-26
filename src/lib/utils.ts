import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Locale } from '@/i18n/config';
import { LOCALE_META } from '@/i18n/config';

/** دمج أصناف Tailwind بأمان */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ------------------------------------------------------------ الأرقام والعملة

export interface MoneyOptions {
  currency?: string;
  decimals?: number;
  locale?: Locale;
  showSymbol?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  DZD: 'د.ج',
  MAD: 'د.م',
  TND: 'د.ت',
  EGP: 'ج.م',
  SAR: 'ر.س',
  AED: 'د.إ',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

/** تنسيق مبلغ مالي */
export function formatMoney(
  value: number | null | undefined,
  options: MoneyOptions = {},
): string {
  const {
    currency = 'DZD',
    decimals = 2,
    locale = 'ar',
    showSymbol = true,
  } = options;

  const amount = Number.isFinite(value as number) ? (value as number) : 0;
  // نستخدم الأرقام اللاتينية دائماً في السياق المالي لسهولة القراءة
  const formatted = new Intl.NumberFormat(
    locale === 'ar' ? 'ar-DZ-u-nu-latn' : LOCALE_META[locale].intl,
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
  ).format(amount);

  if (!showSymbol) return formatted;
  return `${formatted} ${currencySymbol(currency)}`;
}

/** تنسيق رقم عادي */
export function formatNumber(
  value: number | null | undefined,
  locale: Locale = 'ar',
  decimals = 0,
): string {
  const amount = Number.isFinite(value as number) ? (value as number) : 0;
  return new Intl.NumberFormat(
    locale === 'ar' ? 'ar-DZ-u-nu-latn' : LOCALE_META[locale].intl,
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
  ).format(amount);
}

/** تنسيق نسبة مئوية */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  const amount = Number.isFinite(value as number) ? (value as number) : 0;
  return `${amount.toFixed(decimals)}%`;
}

/** تقريب لمنازل عشرية محددة (يتفادى أخطاء الفاصلة العائمة) */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** حساب نسبة التغيّر بين فترتين */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? 100 : null;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

// ------------------------------------------------------------------ التواريخ

export function formatDate(
  value: Date | string | null | undefined,
  locale: Locale = 'ar',
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' },
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const intlLocale = locale === 'ar' ? 'ar-DZ-u-nu-latn-ca-gregory' : LOCALE_META[locale].intl;
  return new Intl.DateTimeFormat(intlLocale, options).format(date);
}

export function formatDateTime(
  value: Date | string | null | undefined,
  locale: Locale = 'ar',
): string {
  return formatDate(value, locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value: Date | string | null | undefined, locale: Locale = 'ar'): string {
  return formatDate(value, locale, { hour: '2-digit', minute: '2-digit' });
}

/** «منذ ٣ أيام» */
export function formatRelative(
  value: Date | string | null | undefined,
  locale: Locale = 'ar',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(
    locale === 'ar' ? 'ar' : LOCALE_META[locale].intl,
    { numeric: 'auto' },
  );

  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(diffMin, 'minute');
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), 'hour');
  if (abs < 60 * 24 * 30) return rtf.format(Math.round(diffMin / (60 * 24)), 'day');
  if (abs < 60 * 24 * 365) return rtf.format(Math.round(diffMin / (60 * 24 * 30)), 'month');
  return rtf.format(Math.round(diffMin / (60 * 24 * 365)), 'year');
}

/** بداية اليوم */
export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** نهاية اليوم */
export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfYear(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfYear(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** عدد الأيام المتبقية حتى تاريخ (سالب = مضى) */
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const target = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((startOfDay(target).getTime() - startOfDay().getTime()) / 86_400_000);
}

/** صيغة YYYY-MM-DD لحقول input[type=date] */
export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** صيغة YYYY-MM-DDTHH:mm لحقول input[type=datetime-local] */
export function toDateTimeInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// -------------------------------------------------------------------- نصوص

/** اسم العميل الكامل */
export function fullName(first: string, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/** الأحرف الأولى للأفاتار */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** قصّ نص طويل */
export function truncate(text: string, max = 60): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/** تحويل الأرقام العربية الهندية إلى لاتينية (لحقول البحث والباركود) */
export function normalizeDigits(input: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const i = arabicIndic.indexOf(ch);
    return String(i >= 0 ? i : easternArabic.indexOf(ch));
  });
}

/** تطبيع رقم الهاتف للمقارنة والتخزين */
export function normalizePhone(phone: string): string {
  return normalizeDigits(phone).replace(/[\s\-().]/g, '');
}

/** تحقق مبسّط من رقم الهاتف (دولي أو محلي) */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+?[0-9]{7,15}$/.test(normalized);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** تحويل نص إلى slug */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** تحليل JSON بأمان مع قيمة افتراضية */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------ مساعدات

/** تجميع مصفوفة حسب مفتاح */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/** مجموع حسب دالة */
export function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((total, item) => total + (fn(item) || 0), 0);
}

/** تأخير التنفيذ (debounce) */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 300,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** تقسيم مصفوفة إلى دفعات */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
