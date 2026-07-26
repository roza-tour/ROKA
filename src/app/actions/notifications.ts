'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  deliverNotification,
  processNotificationQueue,
  queueNotification,
} from '@/lib/notifications';
import { notificationTemplateSchema, firstError } from '@/lib/validation';
import { getShopInfo } from '@/lib/settings';
import { addDays, formatDate, normalizePhone } from '@/lib/utils';
import type { FormState } from './customers';
import type { NotificationChannel } from '@/lib/constants';

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue;
    obj[key] = value;
  }
  return obj;
}

/** إعادة إرسال إشعار فاشل */
export async function resendNotificationAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:create');
    await db.notificationLog.update({
      where: { id },
      data: { status: 'PENDING', error: null },
    });
    const sent = await deliverNotification(id);

    await audit({
      action: 'NOTIFY',
      entity: 'NotificationLog',
      entityId: id,
      summary: sent ? 'إعادة إرسال إشعار — نجحت' : 'إعادة إرسال إشعار — فشلت',
      user,
    });

    revalidatePath('/notifications');
    return sent
      ? { ok: true, message: 'تم إرسال الإشعار' }
      : { ok: false, error: 'فشل الإرسال — راجع إعدادات المزوّد' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّرت إعادة الإرسال' };
  }
}

/** معالجة كل الإشعارات المعلّقة */
export async function processQueueAction(): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:create');
    const result = await processNotificationQueue(100);

    await audit({
      action: 'NOTIFY',
      entity: 'NotificationLog',
      summary: `معالجة القائمة: ${result.sent} نجحت، ${result.failed} فشلت`,
      user,
    });

    revalidatePath('/notifications');
    return {
      ok: true,
      message: `تمت المعالجة: ${result.sent} مُرسل، ${result.failed} فاشل`,
    };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّرت المعالجة' };
  }
}

/** حفظ قالب إشعار */
export async function saveTemplateAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:update');
    const parsed = notificationTemplateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

    const data = parsed.data;
    await db.notificationTemplate.upsert({
      where: {
        key_channel_locale: {
          key: data.key,
          channel: data.channel,
          locale: data.locale,
        },
      },
      create: data,
      update: {
        subject: data.subject,
        body: data.body,
        isActive: data.isActive,
      },
    });

    await audit({
      action: 'UPDATE',
      entity: 'NotificationTemplate',
      summary: `تعديل قالب ${data.key} / ${data.channel} / ${data.locale}`,
      user,
    });

    revalidatePath('/notifications/templates');
    return { ok: true, message: 'تم حفظ القالب' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حفظ القالب' };
  }
}

/** إرسال رسالة تجريبية للتحقق من إعدادات المزوّد */
export async function sendTestNotificationAction(
  channel: NotificationChannel,
  to: string,
): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:create');
    if (!to.trim()) return { ok: false, error: 'أدخل رقم الهاتف أو البريد' };

    const shop = await getShopInfo();
    const log = await db.notificationLog.create({
      data: {
        channel,
        toAddress: channel === 'EMAIL' ? to.trim() : normalizePhone(to),
        subject: `${shop.name} — رسالة تجريبية`,
        body: `رسالة تجريبية من نظام ${shop.name}. إذا وصلتك هذه الرسالة فإعدادات الإرسال تعمل بشكل صحيح.`,
        templateKey: 'test',
        status: 'PENDING',
      },
    });

    const sent = await deliverNotification(log.id);

    await audit({
      action: 'NOTIFY',
      entity: 'NotificationLog',
      entityId: log.id,
      summary: `رسالة تجريبية عبر ${channel} إلى ${to}`,
      user,
    });

    revalidatePath('/notifications');
    return sent
      ? { ok: true, message: 'تم الإرسال — تحقق من وصول الرسالة' }
      : { ok: false, error: 'فشل الإرسال — راجع إعدادات المزوّد في ملف .env' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر الإرسال' };
  }
}

/**
 * إرسال تنبيهات الضمانات التي تنتهي خلال المدة المحددة.
 * يُستدعى يدوياً من واجهة الإشعارات أو من مهمة مجدولة.
 */
export async function sendWarrantyRemindersAction(daysAhead = 7): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:create');

    const warranties = await db.warranty.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { gte: new Date(), lte: addDays(new Date(), daysAhead) },
        reminderSentAt: null,
      },
      include: { customer: { select: { id: true, firstName: true, phone: true } } },
      take: 100,
    });

    if (!warranties.length) {
      return { ok: true, message: 'لا توجد ضمانات تحتاج تنبيهاً' };
    }

    const shop = await getShopInfo();
    let sent = 0;

    for (const warranty of warranties) {
      const to = normalizePhone(warranty.customer.phone);
      if (!to) continue;

      await queueNotification({
        key: 'warranty.expiring',
        channel: 'SMS',
        to,
        customerId: warranty.customer.id,
        refType: 'Warranty',
        refId: warranty.id,
        vars: {
          customerName: warranty.customer.firstName,
          itemName: warranty.itemName,
          warrantyEnd: formatDate(warranty.endsAt, 'ar'),
          shopName: shop.name,
          shopPhone: shop.phone,
        },
      });

      await db.warranty.update({
        where: { id: warranty.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    }

    await audit({
      action: 'NOTIFY',
      entity: 'Warranty',
      summary: `إرسال ${sent} تنبيه ضمان`,
      user,
    });

    revalidatePath('/notifications');
    revalidatePath('/warranty');
    return { ok: true, message: `تم إرسال ${sent} تنبيه` };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[sendWarrantyReminders]', error);
    return { ok: false, error: 'تعذّر إرسال التنبيهات' };
  }
}

/** تحديث حالة الضمانات المنتهية (صيانة دورية للبيانات) */
export async function refreshWarrantyStatusesAction(): Promise<FormState> {
  try {
    const user = await requirePermission('warranty:update');
    const result = await db.warranty.updateMany({
      where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      await audit({
        action: 'UPDATE',
        entity: 'Warranty',
        summary: `تحديث ${result.count} ضمان إلى «منتهي»`,
        user,
      });
    }

    revalidatePath('/warranty');
    return { ok: true, message: `تم تحديث ${result.count} ضمان` };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر التحديث' };
  }
}
