import 'server-only';

import { cache } from 'react';
import { db } from './db';
import { DEFAULT_SETTINGS } from './constants';

export type SettingsMap = Record<string, string>;

/**
 * قراءة كل الإعدادات مدمجة مع القيم الافتراضية.
 * مُخزّنة مؤقتاً على مستوى الطلب.
 */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  const rows = await db.setting.findMany();
  const map: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
});

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? fallback;
}

export async function getSettingNumber(key: string, fallback = 0): Promise<number> {
  const raw = await getSetting(key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const raw = await getSetting(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

/** حفظ مجموعة إعدادات دفعة واحدة */
export async function setSettings(values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values);
  if (!entries.length) return;
  await db.$transaction(
    entries.map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        create: { key, value, group: key.split('.')[0] ?? 'general' },
        update: { value },
      }),
    ),
  );
}

/** الإعدادات المالية المستخدمة في كل مكان لعرض المبالغ */
export interface FinanceSettings {
  currency: string;
  decimals: number;
  taxEnabled: boolean;
  taxRate: number;
}

export const getFinanceSettings = cache(async (): Promise<FinanceSettings> => {
  const settings = await getSettings();
  return {
    currency: settings['finance.currency'] || 'DZD',
    decimals: Number(settings['finance.decimals'] ?? 2) || 0,
    taxEnabled: settings['finance.taxEnabled'] === 'true',
    taxRate: Number(settings['finance.taxRate'] ?? 0) || 0,
  };
});

/** بيانات المحل المستخدمة في رؤوس الفواتير والوصولات */
export interface ShopInfo {
  name: string;
  legalName: string;
  phone: string;
  phone2: string;
  email: string;
  address: string;
  taxNumber: string;
  logoUrl: string;
  website: string;
}

export const getShopInfo = cache(async (): Promise<ShopInfo> => {
  const s = await getSettings();
  return {
    name: s['shop.name'] || 'ROKA',
    legalName: s['shop.legalName'] || '',
    phone: s['shop.phone'] || '',
    phone2: s['shop.phone2'] || '',
    email: s['shop.email'] || '',
    address: s['shop.address'] || '',
    taxNumber: s['shop.taxNumber'] || '',
    logoUrl: s['shop.logoUrl'] || '',
    website: s['shop.website'] || '',
  };
});
