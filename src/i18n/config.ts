export const LOCALES = ['ar', 'fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export const LOCALE_COOKIE = 'fixel_locale';

export const LOCALE_META: Record<
  Locale,
  { name: string; nativeName: string; dir: 'rtl' | 'ltr'; flag: string; intl: string }
> = {
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦', intl: 'ar' },
  fr: { name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷', intl: 'fr-FR' },
  en: { name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧', intl: 'en-US' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return LOCALE_META[locale].dir;
}
