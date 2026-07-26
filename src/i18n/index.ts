import { cookies } from 'next/headers';
import { cache } from 'react';
import { ar, type Dictionary } from './dictionaries/ar';
import { fr } from './dictionaries/fr';
import { en } from './dictionaries/en';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';

const DICTIONARIES: Record<Locale, Dictionary> = { ar, fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** اللغة الحالية من الكوكي (على الخادم) */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** اللغة + القاموس معاً (الاستدعاء الشائع في المكوّنات الخادمية) */
export const getI18n = cache(async (): Promise<{ locale: Locale; t: Dictionary }> => {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
});

export type { Dictionary };
export * from './config';
