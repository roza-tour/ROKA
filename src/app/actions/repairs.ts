'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/numbering';
import { encrypt } from '@/lib/crypto';
import { randomToken } from '@/lib/crypto';
import { repairOrderSchema, firstError, fieldErrors } from '@/lib/validation';
import { getSettings, getShopInfo, getFinanceSettings } from '@/lib/settings';
import { consumeStock, returnStock, InsufficientStockError } from '@/lib/inventory';
import { queueNotification } from '@/lib/notifications';
import {
  REPAIR_STATUS_FLOW,
  REPAIR_STATUS_NOTIFICATION,
  type RepairStatus,
  type NotificationChannel,
} from '@/lib/constants';
import { addDays, formatMoney, formatDate, round, normalizePhone } from '@/lib/utils';
import type { FormState } from './customers';

export type { FormState };

/** ينشئ أمر صيانة كاملاً: جهاز (إن لزم) + بنود + سجل حالة + إشعار */
export async function createRepairOrderAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;

  try {
    const user = await requirePermission('repairs:create');

    // البيانات المعقّدة (الملحقات، تقرير الحالة، البنود) تصل كـ JSON
    const payloadRaw = formData.get('payload');
    if (typeof payloadRaw !== 'string') {
      return { ok: false, error: 'بيانات النموذج مفقودة' };
    }

    const parsed = repairOrderSchema.safeParse(JSON.parse(payloadRaw));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const input = parsed.data;

    if (!input.deviceId && !input.device) {
      return { ok: false, error: 'اختر جهازاً موجوداً أو أدخل بيانات جهاز جديد' };
    }

    const settings = await getSettings();
    const defaultWarranty = Number(settings['repair.defaultWarrantyDays'] ?? 30);
    const defaultTurnaround = Number(settings['repair.defaultTurnaroundDays'] ?? 3);

    const order = await db.$transaction(async (tx) => {
      // 1) الجهاز
      let deviceId = input.deviceId;
      if (!deviceId && input.device) {
        const d = input.device;
        const device = await tx.device.create({
          data: {
            customerId: input.customerId,
            type: d.type,
            brand: d.brand,
            model: d.model,
            color: d.color,
            serialNumber: d.serialNumber,
            imei: d.imei,
            imei2: d.imei2,
            passcodeEnc: d.passcode ? encrypt(d.passcode) : null,
            purchaseDate: d.purchaseDate ?? null,
            notes: d.notes,
          },
        });
        deviceId = device.id;
      }

      // 2) حساب التكاليف من البنود
      const items = input.items.map((item) => ({
        ...item,
        total: round(item.quantity * item.unitPrice - item.discount),
      }));
      const partsCost = round(
        items
          .filter((i) => i.kind === 'PART')
          .reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
      );
      const laborCost = round(
        items.filter((i) => i.kind !== 'PART').reduce((sum, i) => sum + i.total, 0),
      );
      const itemsTotal = round(items.reduce((sum, i) => sum + i.total, 0));

      const branch = user.branchId
        ? null
        : await tx.branch.findFirst({ where: { isDefault: true }, select: { id: true } });

      // 3) أمر الصيانة
      const created = await tx.repairOrder.create({
        data: {
          number: await nextNumber('RO', tx),
          customerId: input.customerId,
          deviceId: deviceId!,
          branchId: user.branchId ?? branch?.id ?? null,
          receivedById: user.id,
          technicianId: input.technicianId || null,
          status: 'RECEIVED',
          priority: input.priority,
          problemDescription: input.problemDescription,
          faultCategory: input.faultCategory,
          internalNotes: input.internalNotes,
          accessories: JSON.stringify(input.accessories),
          conditionReport: JSON.stringify(input.conditionReport),
          damageMarks: JSON.stringify(input.damageMarks),
          photos: JSON.stringify(input.photos),
          customerSignature: input.customerSignature || null,
          employeeSignature: input.employeeSignature || null,
          estimatedCost: input.estimatedCost || itemsTotal,
          finalCost: itemsTotal,
          partsCost,
          laborCost,
          depositAmount: input.depositAmount,
          promisedAt: input.promisedAt ?? addDays(new Date(), defaultTurnaround),
          warrantyDays: input.warrantyDays || defaultWarranty,
          warrantyTerms: settings['repair.terms'] ?? null,
          trackingToken: randomToken(12),
          items: {
            create: items.map((item) => ({
              kind: item.kind,
              serviceId: item.serviceId || null,
              productId: item.productId || null,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              discount: item.discount,
              total: item.total,
              notes: item.notes ?? null,
            })),
          },
          history: {
            create: {
              status: 'RECEIVED',
              note: 'تم استلام الجهاز',
              userId: user.id,
            },
          },
        },
        include: { customer: true, device: true },
      });

      // 4) خصم قطع الغيار المستخدمة من المخزون
      const parts = items
        .filter((i) => i.kind === 'PART' && i.productId)
        .map((i) => ({ productId: i.productId as string, quantity: i.quantity }));
      if (parts.length) {
        await consumeStock(tx, parts, {
          refType: 'RepairOrder',
          refId: created.id,
          refNumber: created.number,
          userId: user.id,
          branchId: created.branchId,
          reason: `قطع مستخدمة في ${created.number}`,
        });
      }

      // 5) تحديث إحصائيات العميل
      await tx.customer.update({
        where: { id: input.customerId },
        data: { visitsCount: { increment: 1 } },
      });

      return created;
    });

    await audit({
      action: 'CREATE',
      entity: 'RepairOrder',
      entityId: order.id,
      summary: `استقبال جهاز: ${order.number} — ${order.device.brand} ${order.device.model}`,
      after: { number: order.number, status: order.status, customerId: order.customerId },
      user,
    });

    // 6) إشعار العميل بالاستلام
    if (settings['notifications.autoOnStatusChange'] === 'true') {
      await notifyRepairStatus(order.id, 'RECEIVED');
    }

    createdId = order.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof InsufficientStockError) return { ok: false, error: error.message };
    console.error('[createRepairOrder]', error);
    return { ok: false, error: 'تعذّر إنشاء أمر الصيانة' };
  }

  revalidatePath('/repairs');
  revalidatePath('/dashboard');
  redirect(`/repairs/${createdId}?created=1`);
}

/** تحديث بيانات أمر صيانة (تشخيص، فني، ملاحظات، مواعيد) */
export async function updateRepairOrderAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('repairs:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف الأمر مفقود' };

    const before = await db.repairOrder.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'أمر الصيانة غير موجود' };

    const promisedRaw = formData.get('promisedAt');
    const after = await db.repairOrder.update({
      where: { id },
      data: {
        technicianId: (formData.get('technicianId') as string) || null,
        priority: (formData.get('priority') as string) || before.priority,
        diagnosis: (formData.get('diagnosis') as string) || null,
        workDone: (formData.get('workDone') as string) || null,
        internalNotes: (formData.get('internalNotes') as string) || null,
        faultCategory: (formData.get('faultCategory') as string) || null,
        estimatedCost: Number(formData.get('estimatedCost') ?? before.estimatedCost) || 0,
        warrantyDays: Number(formData.get('warrantyDays') ?? before.warrantyDays) || 0,
        promisedAt: promisedRaw ? new Date(String(promisedRaw)) : before.promisedAt,
        diagnosedAt: formData.get('diagnosis') && !before.diagnosedAt ? new Date() : before.diagnosedAt,
      },
    });

    await audit({
      action: 'UPDATE',
      entity: 'RepairOrder',
      entityId: id,
      summary: `تعديل أمر الصيانة ${after.number}`,
      before,
      after,
      user,
    });

    revalidatePath(`/repairs/${id}`);
    return { ok: true, message: 'تم تحديث أمر الصيانة' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[updateRepairOrder]', error);
    return { ok: false, error: 'تعذّر تحديث أمر الصيانة' };
  }
}

/** تغيير حالة الجهاز مع تسجيل السجل وإشعار العميل */
export async function changeRepairStatusAction(
  repairOrderId: string,
  status: RepairStatus,
  note?: string,
  notify = true,
  channel?: NotificationChannel,
): Promise<FormState> {
  try {
    const user = await requirePermission('repairs:update');

    const order = await db.repairOrder.findUnique({
      where: { id: repairOrderId },
      include: { items: true },
    });
    if (!order) return { ok: false, error: 'أمر الصيانة غير موجود' };

    if (order.status === status) {
      return { ok: false, error: 'الجهاز في هذه الحالة بالفعل' };
    }

    const allowed = REPAIR_STATUS_FLOW[order.status as RepairStatus] ?? [];
    if (!allowed.includes(status)) {
      return {
        ok: false,
        error: 'لا يمكن الانتقال من الحالة الحالية إلى الحالة المطلوبة مباشرة',
      };
    }

    const now = new Date();
    const settings = await getSettings();

    await db.$transaction(async (tx) => {
      const data: Record<string, unknown> = { status };

      if (status === 'READY' && !order.completedAt) data.completedAt = now;
      if (status === 'DELIVERED') {
        data.deliveredAt = now;
        if (!order.completedAt) data.completedAt = now;
        if (order.warrantyDays > 0) {
          data.warrantyEndsAt = addDays(now, order.warrantyDays);
        }
      }
      if (status === 'WAITING_APPROVAL' && !order.diagnosedAt) data.diagnosedAt = now;
      if (status === 'REPAIRING' && !order.approvedAt) data.approvedAt = now;

      await tx.repairOrder.update({ where: { id: repairOrderId }, data });

      await tx.repairStatusEvent.create({
        data: {
          repairOrderId,
          status,
          note: note || null,
          userId: user.id,
        },
      });

      // عند الإلغاء: إرجاع قطع الغيار للمخزون
      if (status === 'CANCELLED') {
        const parts = order.items
          .filter((i) => i.kind === 'PART' && i.productId)
          .map((i) => ({ productId: i.productId as string, quantity: i.quantity }));
        if (parts.length) {
          await returnStock(tx, parts, {
            refType: 'RepairOrder',
            refId: order.id,
            refNumber: order.number,
            userId: user.id,
            branchId: order.branchId,
            reason: `إلغاء ${order.number} — إرجاع القطع`,
          });
        }
      }

      // عند التسليم: إنشاء سجل ضمان
      if (status === 'DELIVERED' && order.warrantyDays > 0) {
        const device = await tx.device.findUnique({
          where: { id: order.deviceId },
          select: { brand: true, model: true, serialNumber: true, imei: true },
        });
        await tx.warranty.create({
          data: {
            number: await nextNumber('WR', tx),
            customerId: order.customerId,
            repairOrderId: order.id,
            itemName: `صيانة ${device?.brand ?? ''} ${device?.model ?? ''}`.trim(),
            serial: device?.serialNumber ?? device?.imei ?? null,
            days: order.warrantyDays,
            startsAt: now,
            endsAt: addDays(now, order.warrantyDays),
            terms: order.warrantyTerms,
            status: 'ACTIVE',
          },
        });

        // تحديث إجمالي الصيانة لدى العميل
        await tx.customer.update({
          where: { id: order.customerId },
          data: { totalRepairs: { increment: order.finalCost } },
        });
      }
    });

    await audit({
      action: 'STATUS_CHANGE',
      entity: 'RepairOrder',
      entityId: repairOrderId,
      summary: `${order.number}: ${order.status} → ${status}${note ? ` (${note})` : ''}`,
      before: { status: order.status },
      after: { status },
      user,
    });

    if (notify && settings['notifications.autoOnStatusChange'] === 'true') {
      await notifyRepairStatus(repairOrderId, status, channel);
    }

    revalidatePath(`/repairs/${repairOrderId}`);
    revalidatePath('/repairs');
    revalidatePath('/dashboard');
    return { ok: true, message: 'تم تغيير حالة الجهاز' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[changeRepairStatus]', error);
    return { ok: false, error: 'تعذّر تغيير الحالة' };
  }
}

/** إضافة خدمة أو قطعة إلى أمر صيانة قائم */
export async function addRepairItemAction(
  repairOrderId: string,
  item: {
    kind: 'SERVICE' | 'PART' | 'CUSTOM';
    serviceId?: string | null;
    productId?: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    discount?: number;
  },
): Promise<FormState> {
  try {
    const user = await requirePermission('repairs:update');

    const order = await db.repairOrder.findUnique({
      where: { id: repairOrderId },
      select: { id: true, number: true, branchId: true, status: true },
    });
    if (!order) return { ok: false, error: 'أمر الصيانة غير موجود' };
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      return { ok: false, error: 'لا يمكن تعديل أمر مغلق' };
    }

    const total = round(item.quantity * item.unitPrice - (item.discount ?? 0));

    await db.$transaction(async (tx) => {
      await tx.repairItem.create({
        data: {
          repairOrderId,
          kind: item.kind,
          serviceId: item.serviceId || null,
          productId: item.productId || null,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost ?? 0,
          discount: item.discount ?? 0,
          total,
        },
      });

      if (item.kind === 'PART' && item.productId) {
        await consumeStock(
          tx,
          [{ productId: item.productId, quantity: item.quantity }],
          {
            refType: 'RepairOrder',
            refId: order.id,
            refNumber: order.number,
            userId: user.id,
            branchId: order.branchId,
            reason: `قطعة مضافة إلى ${order.number}`,
          },
        );
      }

      await recalculateRepairTotals(tx, repairOrderId);
    });

    await audit({
      action: 'UPDATE',
      entity: 'RepairOrder',
      entityId: repairOrderId,
      summary: `إضافة بند إلى ${order.number}: ${item.name}`,
      user,
    });

    revalidatePath(`/repairs/${repairOrderId}`);
    return { ok: true, message: 'تمت إضافة البند' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof InsufficientStockError) return { ok: false, error: error.message };
    console.error('[addRepairItem]', error);
    return { ok: false, error: 'تعذّرت إضافة البند' };
  }
}

/** حذف بند من أمر صيانة (يعيد القطعة للمخزون) */
export async function removeRepairItemAction(itemId: string): Promise<FormState> {
  try {
    const user = await requirePermission('repairs:update');

    const item = await db.repairItem.findUnique({
      where: { id: itemId },
      include: { repairOrder: { select: { id: true, number: true, branchId: true, status: true } } },
    });
    if (!item) return { ok: false, error: 'البند غير موجود' };
    if (['DELIVERED', 'CANCELLED'].includes(item.repairOrder.status)) {
      return { ok: false, error: 'لا يمكن تعديل أمر مغلق' };
    }

    await db.$transaction(async (tx) => {
      if (item.kind === 'PART' && item.productId) {
        await returnStock(
          tx,
          [{ productId: item.productId, quantity: item.quantity }],
          {
            refType: 'RepairOrder',
            refId: item.repairOrder.id,
            refNumber: item.repairOrder.number,
            userId: user.id,
            branchId: item.repairOrder.branchId,
            reason: `حذف بند من ${item.repairOrder.number}`,
          },
        );
      }
      await tx.repairItem.delete({ where: { id: itemId } });
      await recalculateRepairTotals(tx, item.repairOrderId);
    });

    await audit({
      action: 'UPDATE',
      entity: 'RepairOrder',
      entityId: item.repairOrderId,
      summary: `حذف بند من ${item.repairOrder.number}: ${item.name}`,
      user,
    });

    revalidatePath(`/repairs/${item.repairOrderId}`);
    return { ok: true, message: 'تم حذف البند' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[removeRepairItem]', error);
    return { ok: false, error: 'تعذّر حذف البند' };
  }
}

/** إعادة حساب مجاميع أمر الصيانة من بنوده */
async function recalculateRepairTotals(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  repairOrderId: string,
): Promise<void> {
  const items = await tx.repairItem.findMany({ where: { repairOrderId } });
  const partsCost = round(
    items.filter((i) => i.kind === 'PART').reduce((s, i) => s + i.quantity * i.unitCost, 0),
  );
  const laborCost = round(
    items.filter((i) => i.kind !== 'PART').reduce((s, i) => s + i.total, 0),
  );
  const finalCost = round(items.reduce((s, i) => s + i.total, 0));

  await tx.repairOrder.update({
    where: { id: repairOrderId },
    data: { partsCost, laborCost, finalCost },
  });
}

/** إرسال إشعار حالة إلى العميل */
export async function notifyRepairStatus(
  repairOrderId: string,
  status: RepairStatus,
  channel?: NotificationChannel,
): Promise<void> {
  const key = REPAIR_STATUS_NOTIFICATION[status];
  if (!key) return;

  const [order, settings, shop, finance] = await Promise.all([
    db.repairOrder.findUnique({
      where: { id: repairOrderId },
      include: { customer: true, device: true },
    }),
    getSettings(),
    getShopInfo(),
    getFinanceSettings(),
  ]);
  if (!order) return;

  const selected =
    channel ?? ((settings['notifications.defaultChannel'] as NotificationChannel) || 'SMS');

  const to =
    selected === 'EMAIL'
      ? (order.customer.email ?? '')
      : normalizePhone(order.customer.phone);
  if (!to) return;

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale: 'ar' });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const amountDue = round(order.finalCost - order.depositAmount);

  await queueNotification({
    key,
    channel: selected,
    to,
    customerId: order.customerId,
    refType: 'RepairOrder',
    refId: order.id,
    vars: {
      customerName: order.customer.firstName,
      deviceName: `${order.device.brand} ${order.device.model}`,
      orderNumber: order.number,
      trackingUrl: `${baseUrl}/track/${order.trackingToken}`,
      estimatedCost: money(order.estimatedCost),
      amountDue: money(Math.max(0, amountDue)),
      warrantyEnd: order.warrantyEndsAt
        ? formatDate(order.warrantyEndsAt, 'ar')
        : `${order.warrantyDays} يوم`,
      shopName: shop.name,
      shopPhone: shop.phone,
    },
  });

  await db.repairStatusEvent.updateMany({
    where: { repairOrderId, status, notifiedAt: null },
    data: { notifiedAt: new Date() },
  });
}

/** إرسال إشعار يدوياً من واجهة أمر الصيانة */
export async function sendRepairNotificationAction(
  repairOrderId: string,
  channel: NotificationChannel,
): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:create');
    const order = await db.repairOrder.findUnique({
      where: { id: repairOrderId },
      select: { status: true, number: true },
    });
    if (!order) return { ok: false, error: 'أمر الصيانة غير موجود' };

    await notifyRepairStatus(repairOrderId, order.status as RepairStatus, channel);
    await audit({
      action: 'NOTIFY',
      entity: 'RepairOrder',
      entityId: repairOrderId,
      summary: `إرسال إشعار ${channel} لأمر ${order.number}`,
      user,
    });

    revalidatePath(`/repairs/${repairOrderId}`);
    return { ok: true, message: 'تم إرسال الإشعار' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر إرسال الإشعار' };
  }
}
