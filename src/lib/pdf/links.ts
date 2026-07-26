import 'server-only';

import crypto from 'node:crypto';

import { appUrl, PDF_KINDS, type PdfKind } from './kinds';

/**
 * روابط عامة موقّعة لملفات PDF.
 *
 * لماذا؟ إرسال الفاتورة عبر واتساب يتطلّب رابطاً **يستطيع خادم Meta جلبه**،
 * وهو لا يملك جلسة في نظامنا. بدل فتح المستندات للجميع، نوقّع رابطاً
 * قصير العمر بـ HMAC-SHA256 باستخدام AUTH_SECRET:
 *
 *   /api/pdf/public/invoice/<id>?exp=<unix>&sig=<hex>
 *
 * الرابط:
 *   - لا يكشف شيئاً عن مستندات أخرى (التوقيع مرتبط بالنوع والمعرّف معاً).
 *   - ينتهي تلقائياً (7 أيام افتراضياً) فلا يبقى صالحاً للأبد.
 *   - لا يحتاج تخزيناً في قاعدة البيانات (عديم الحالة).
 */

/** مدة صلاحية الرابط الافتراضية — أسبوع، يكفي لوصول الرسالة وفتحها */
export const DEFAULT_LINK_TTL = 7 * 24 * 60 * 60;

function secret(): Buffer {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error('AUTH_SECRET مفقود أو أقصر من 32 حرفاً — لا يمكن توقيع روابط PDF');
  }
  // مفتاح مشتق حتى لا نعيد استخدام مفتاح الجلسات حرفياً لغرض مختلف
  return crypto.createHmac('sha256', value).update('pdf-link-v1').digest();
}

function sign(kind: PdfKind, id: string, exp: number): string {
  return crypto.createHmac('sha256', secret()).update(`${kind}:${id}:${exp}`).digest('hex');
}

/** رابط عام موقّع لمستند — صالح حتى انتهاء المدة */
export function signedPdfUrl(
  kind: PdfKind,
  id: string,
  options: { ttl?: number; download?: boolean } = {},
): string {
  const exp = Math.floor(Date.now() / 1000) + (options.ttl ?? DEFAULT_LINK_TTL);
  const query = new URLSearchParams({ exp: String(exp), sig: sign(kind, id, exp) });
  if (options.download) query.set('dl', '1');
  return `${appUrl()}/api/pdf/public/${kind}/${id}?${query.toString()}`;
}

export type LinkCheck =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' };

/** يتحقق من توقيع الرابط ومدّته — مقارنة ثابتة الزمن ضد هجمات التوقيت */
export function verifyPdfLink(
  kind: string,
  id: string,
  exp: string | null,
  sig: string | null,
): LinkCheck {
  if (!exp || !sig) return { ok: false, reason: 'invalid' };
  if (!(PDF_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: 'invalid' };

  const expiry = Number(exp);
  if (!Number.isFinite(expiry)) return { ok: false, reason: 'invalid' };

  const expected = Buffer.from(sign(kind as PdfKind, id, expiry), 'hex');
  const received = Buffer.from(sig, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { ok: false, reason: 'invalid' };
  }

  // فحص الانتهاء بعد التحقق من التوقيع حتى لا نسرّب صلاحية توقيع مزوّر
  if (expiry * 1000 < Date.now()) return { ok: false, reason: 'expired' };

  return { ok: true };
}
