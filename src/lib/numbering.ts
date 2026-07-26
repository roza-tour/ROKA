import 'server-only';

import { db } from './db';
import type { Prisma } from '@prisma/client';

/**
 * توليد أرقام مستندات متسلسلة وآمنة من التعارض.
 * يستخدم جدول Counter مع تحديث ذرّي داخل معاملة.
 *
 * الصيغة: PREFIX-YYYY-000123
 */

export type DocumentPrefix = 'RO' | 'INV' | 'QT' | 'PO' | 'EXP' | 'WR' | 'APT' | 'CUS' | 'SUP' | 'INS';

const PAD_LENGTH = 6;

/**
 * توليد الرقم التالي. يجب استدعاؤها داخل معاملة (tx) عند إنشاء المستند
 * لضمان عدم فقدان أرقام أو تكرارها.
 */
export async function nextNumber(
  prefix: DocumentPrefix,
  client: Prisma.TransactionClient | typeof db = db,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getFullYear();
  const key = `${prefix}-${year}`;

  // upsert ذرّي: increment يضمن عدم التعارض بين الطلبات المتزامنة
  const counter = await client.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `${prefix}-${year}-${String(counter.value).padStart(PAD_LENGTH, '0')}`;
}

/** رمز عميل/مورد قصير بدون سنة: CUS-000123 */
export async function nextCode(
  prefix: 'CUS' | 'SUP',
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  const counter = await client.counter.upsert({
    where: { key: prefix },
    create: { key: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(PAD_LENGTH, '0')}`;
}

/** توليد SKU تلقائي للمنتجات */
export async function nextSku(
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  const counter = await client.counter.upsert({
    where: { key: 'SKU' },
    create: { key: 'SKU', value: 1 },
    update: { value: { increment: 1 } },
  });
  return `P${String(counter.value).padStart(6, '0')}`;
}

/**
 * توليد باركود EAN-13 صالح من رقم تسلسلي داخلي.
 * يستخدم بادئة 200 المخصّصة للاستخدام الداخلي في المتاجر.
 */
export async function nextBarcode(
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  const counter = await client.counter.upsert({
    where: { key: 'BARCODE' },
    create: { key: 'BARCODE', value: 1 },
    update: { value: { increment: 1 } },
  });

  const body = `200${String(counter.value).padStart(9, '0')}`; // 12 رقماً
  return body + ean13CheckDigit(body);
}

/** حساب رقم التحقق لـ EAN-13 */
export function ean13CheckDigit(body12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(body12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

/** التحقق من صحة باركود EAN-13 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === code[12];
}
