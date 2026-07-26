import 'server-only';

import { db } from './db';
import { getSettings, getShopInfo } from './settings';
import type { NotificationChannel } from './constants';

/**
 * طبقة الإشعارات.
 *
 * كل رسالة تُكتب أولاً في NotificationLog بحالة PENDING ثم تُرسل.
 * هذا يضمن عدم ضياع أي إشعار وإمكانية إعادة المحاولة، ويوفّر سجلاً كاملاً.
 *
 * المزوّدون قابلون للاستبدال عبر متغيّرات البيئة. الوضع الافتراضي "log"
 * يكتب في الطرفية فقط — مناسب للتطوير ولمن لم يشترك بعد في خدمة إرسال.
 */

export interface NotificationVars {
  customerName?: string;
  deviceName?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  trackingUrl?: string;
  estimatedCost?: string;
  amountDue?: string;
  total?: string;
  warrantyEnd?: string;
  itemName?: string;
  appointmentTime?: string;
  shopName?: string;
  shopPhone?: string;
  [key: string]: string | undefined;
}

export interface QueueOptions {
  key: string;
  channel: NotificationChannel;
  to: string;
  vars: NotificationVars;
  customerId?: string | null;
  refType?: string;
  refId?: string;
  locale?: string;
  /** الإرسال فوراً بدل الانتظار في القائمة */
  sendNow?: boolean;
  /**
   * أرفق نسخة PDF من المستند المشار إليه في refType/refId.
   * البريد يستقبلها كمرفق فعلي، وواتساب كرابط موقّع قصير العمر.
   */
  attachPdf?: boolean;
}

/** استبدال المتغيّرات {{name}} في نص القالب */
export function renderTemplate(template: string, vars: NotificationVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

/**
 * إضافة إشعار إلى قائمة الإرسال.
 * لا يرمي استثناءً — فشل الإشعار يجب ألا يُفشل العملية التجارية.
 */
export async function queueNotification(options: QueueOptions): Promise<string | null> {
  try {
    if (!options.to) return null;

    const settings = await getSettings();
    const shop = await getShopInfo();
    const locale = options.locale ?? settings['ui.defaultLocale'] ?? 'ar';

    const template = await db.notificationTemplate.findFirst({
      where: {
        key: options.key,
        channel: options.channel,
        OR: [{ locale }, { locale: 'ar' }],
        isActive: true,
      },
      orderBy: { locale: locale === 'ar' ? 'asc' : 'desc' },
    });

    if (!template) {
      console.warn(`[notifications] لا يوجد قالب: ${options.key}/${options.channel}/${locale}`);
      return null;
    }

    const vars: NotificationVars = {
      shopName: shop.name,
      shopPhone: shop.phone,
      ...options.vars,
    };

    const log = await db.notificationLog.create({
      data: {
        channel: options.channel,
        toAddress: options.to,
        subject: template.subject ? renderTemplate(template.subject, vars) : null,
        body: renderTemplate(template.body, vars),
        customerId: options.customerId ?? null,
        templateKey: options.key,
        refType: options.refType ?? null,
        refId: options.refId ?? null,
        attachPdf: options.attachPdf === true,
        status: 'PENDING',
      },
    });

    if (options.sendNow !== false) {
      // الإرسال في الخلفية — لا ننتظره حتى لا يبطئ الاستجابة
      void deliverNotification(log.id).catch((error) =>
        console.error('[notifications] فشل الإرسال:', error),
      );
    }

    return log.id;
  } catch (error) {
    console.error('[notifications] فشل إضافة الإشعار للقائمة:', error);
    return null;
  }
}

/** إرسال إشعار محدد من القائمة */
export async function deliverNotification(logId: string): Promise<boolean> {
  const log = await db.notificationLog.findUnique({ where: { id: logId } });
  if (!log || log.status === 'SENT') return false;

  try {
    const attachment = log.attachPdf ? await resolveAttachment(log.refType, log.refId) : null;

    const provider = await sendViaProvider(
      log.channel as NotificationChannel,
      log.toAddress,
      log.body,
      log.subject,
      attachment,
    );

    await db.notificationLog.update({
      where: { id: logId },
      data: {
        status: 'SENT',
        provider,
        sentAt: new Date(),
        attempts: { increment: 1 },
        error: null,
      },
    });
    return true;
  } catch (error) {
    await db.notificationLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        error: error instanceof Error ? error.message.slice(0, 500) : 'خطأ غير معروف',
      },
    });
    return false;
  }
}

/** معالجة كل الإشعارات المعلّقة (يُستدعى من مهمة مجدولة أو يدوياً) */
export async function processNotificationQueue(limit = 50): Promise<{
  sent: number;
  failed: number;
}> {
  const pending = await db.notificationLog.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const item of pending) {
    const ok = await deliverNotification(item.id);
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

// ------------------------------------------------------------------ المرفقات

export interface PdfAttachment {
  /** محتوى الملف — يستخدمه البريد كمرفق فعلي */
  buffer: Buffer;
  /** رابط عام موقّع قصير العمر — يستخدمه واتساب والرسائل القصيرة */
  url: string;
  /** اسم الملف بدون امتداد (رقم المستند) */
  filename: string;
}

/**
 * يولّد مرفق PDF من المستند المشار إليه في سجل الإشعار.
 * يُرجع null بهدوء عند الفشل — الإشعار يجب أن يصل حتى لو تعذّر توليد الملف.
 */
async function resolveAttachment(
  refType: string | null,
  refId: string | null,
): Promise<PdfAttachment | null> {
  if (!refType || !refId) return null;
  try {
    // استيراد كسول: مكتبة PDF ثقيلة ولا داعي لتحميلها مع كل إشعار
    const { generatePdf, kindForEntity, signedPdfUrl } = await import('./pdf');
    const kind = kindForEntity(refType);
    if (!kind) return null;

    const result = await generatePdf(kind, refId);
    if (!result) return null;

    return {
      buffer: result.buffer,
      url: signedPdfUrl(kind, refId, { download: true }),
      filename: result.filename,
    };
  } catch (error) {
    console.error('[notifications] تعذّر توليد مرفق PDF:', error);
    return null;
  }
}

// ------------------------------------------------------------------ المزوّدون

async function sendViaProvider(
  channel: NotificationChannel,
  to: string,
  body: string,
  subject: string | null,
  attachment: PdfAttachment | null,
): Promise<string> {
  switch (channel) {
    case 'SMS':
      // الرسائل القصيرة لا تحمل مرفقات — نضيف الرابط إلى نص الرسالة
      return sendSms(to, attachment ? `${body}\n${attachment.url}` : body);
    case 'WHATSAPP':
      return sendWhatsApp(to, body, attachment);
    case 'EMAIL':
      return sendEmail(to, subject ?? 'ROKA', body, attachment);
    case 'INTERNAL':
      return 'internal';
    default:
      throw new Error(`قناة غير مدعومة: ${channel}`);
  }
}

async function sendSms(to: string, body: string): Promise<string> {
  const provider = process.env.SMS_PROVIDER ?? 'log';

  if (provider === 'log') {
    console.log(`\n📱 [SMS → ${to}]\n${body}\n`);
    return 'log';
  }

  if (provider === 'http') {
    const url = requireEnv('SMS_API_URL');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMS_API_KEY
          ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ to, message: body, sender: process.env.SMS_SENDER }),
    });
    if (!response.ok) {
      throw new Error(`مزوّد SMS أعاد ${response.status}: ${await response.text()}`);
    }
    return 'http';
  }

  if (provider === 'twilio') {
    const sid = requireEnv('SMS_API_KEY'); // AccountSID:AuthToken
    const [accountSid, authToken] = sid.split(':');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: process.env.SMS_SENDER ?? '',
          Body: body,
        }),
      },
    );
    if (!response.ok) throw new Error(`Twilio: ${await response.text()}`);
    return 'twilio';
  }

  throw new Error(`مزوّد SMS غير معروف: ${provider}`);
}

async function sendWhatsApp(
  to: string,
  body: string,
  attachment: PdfAttachment | null,
): Promise<string> {
  const provider = process.env.WHATSAPP_PROVIDER ?? 'log';

  if (provider === 'log') {
    console.log(
      `\n💬 [WhatsApp → ${to}]\n${body}${attachment ? `\n📎 ${attachment.filename} → ${attachment.url}` : ''}\n`,
    );
    return 'log';
  }

  if (provider === 'meta') {
    const phoneId = requireEnv('WHATSAPP_PHONE_ID');
    const token = requireEnv('WHATSAPP_TOKEN');
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // واتساب لا يقبل رفع ملف مباشرةً في هذا النداء — يجلبه من رابط عام.
      // لذلك نرسل رابطاً موقّعاً قصير العمر بدل فتح المستند للجميع.
      body: JSON.stringify(
        attachment
          ? {
              messaging_product: 'whatsapp',
              to: to.replace(/\D/g, ''),
              type: 'document',
              document: {
                link: attachment.url,
                filename: `${attachment.filename}.pdf`,
                caption: body.slice(0, 1024),
              },
            }
          : {
              messaging_product: 'whatsapp',
              to: to.replace(/\D/g, ''),
              type: 'text',
              text: { body },
            },
      ),
    });
    if (!response.ok) throw new Error(`WhatsApp: ${await response.text()}`);
    return 'meta';
  }

  if (provider === 'http') {
    const url = requireEnv('WHATSAPP_API_URL');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WHATSAPP_TOKEN
          ? { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        to,
        message: body,
        ...(attachment ? { documentUrl: attachment.url, filename: `${attachment.filename}.pdf` } : {}),
      }),
    });
    if (!response.ok) throw new Error(`WhatsApp HTTP: ${await response.text()}`);
    return 'http';
  }

  throw new Error(`مزوّد WhatsApp غير معروف: ${provider}`);
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  attachment: PdfAttachment | null,
): Promise<string> {
  const provider = process.env.EMAIL_PROVIDER ?? 'log';

  if (provider === 'log') {
    console.log(
      `\n📧 [Email → ${to}] ${subject}\n${body}${attachment ? `\n📎 مرفق: ${attachment.filename}.pdf (${attachment.buffer.length} بايت)` : ''}\n`,
    );
    return 'log';
  }

  if (provider === 'smtp') {
    // nodemailer تبعية اختيارية — تُثبّت عند الحاجة: npm i nodemailer
    // المُعرّف متغيّر حتى لا يحاول المُجمّع حلّه وقت البناء
    const specifier = 'nodemailer';
    const mod = (await import(specifier).catch(() => null)) as {
      default: NodemailerLike;
    } | null;
    if (!mod) {
      throw new Error('حزمة nodemailer غير مثبّتة. نفّذ: npm i nodemailer');
    }
    const transporter = mod.default.createTransport({
      host: requireEnv('SMTP_HOST'),
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'ROKA <no-reply@roka.local>',
      to,
      subject,
      text: body,
      ...(attachment
        ? {
            attachments: [
              {
                filename: `${attachment.filename}.pdf`,
                content: attachment.buffer,
                contentType: 'application/pdf',
              },
            ],
          }
        : {}),
    });
    return 'smtp';
  }

  throw new Error(`مزوّد البريد غير معروف: ${provider}`);
}

/** الحد الأدنى من واجهة nodemailer التي نستخدمها (تبعية اختيارية) */
interface NodemailerLike {
  createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string | undefined };
  }): {
    sendMail(message: {
      from: string;
      to: string;
      subject: string;
      text: string;
      attachments?: { filename: string; content: Buffer; contentType: string }[];
    }): Promise<unknown>;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`متغيّر البيئة ${name} غير معرّف`);
  return value;
}
