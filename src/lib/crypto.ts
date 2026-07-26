import crypto from 'node:crypto';

/**
 * تشفير البيانات الحساسة (كلمات مرور الأجهزة، مفاتيح المزودين) باستخدام
 * AES-256-GCM. المفتاح يأتي من ENCRYPTION_KEY (64 حرف hex = 32 بايت).
 */

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY غير معرّف. ولّد مفتاحاً بـ: openssl rand -hex 32',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  // احتياطياً: اشتقاق مفتاح ثابت من نص عادي
  return crypto.createHash('sha256').update(raw).digest();
}

/** تشفير نص. يُرجع سلسلة بصيغة enc:v1:<iv>:<tag>:<ciphertext> */
export function encrypt(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** فك التشفير. يُرجع نصاً فارغاً عند الفشل بدلاً من رمي استثناء. */
export function decrypt(payload: string | null | undefined): string {
  if (!payload) return '';
  if (!payload.startsWith(PREFIX)) return payload; // بيانات قديمة غير مشفّرة
  try {
    const [, , ivB64, tagB64, dataB64] = payload.split(':');
    const decipher = crypto.createDecipheriv(
      ALGO,
      getKey(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}

/** توليد رمز عشوائي آمن (للتتبع، الجلسات، ...) */
export function randomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** توليد رمز رقمي قصير (للتحقق) */
export function randomDigits(length = 6): string {
  let out = '';
  while (out.length < length) {
    out += crypto.randomInt(0, 10).toString();
  }
  return out;
}

/** مقارنة نصوص بزمن ثابت لمنع هجمات التوقيت */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
