'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/numbering';
import { quotationSchema, firstError, fieldErrors } from '@/lib/validation';
import { getSettings } from '@/lib/settings';
import { calculatePricing, lineTotal } from '@/lib/pricing';
import { addDays } from '@/lib/utils';
import type { FormState } from './customers';
import type { QuotationStatus } from '@/lib/constants';

export async function createQuotationAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  try {
    const user = await requirePermission('quotations:create');

    const payloadRaw = formData.get('payload');
    if (typeof payloadRaw !== 'string') return { ok: false, error: 'بيانات النموذج مفقودة' };

    const parsed = quotationSchema.safeParse(JSON.parse(payloadRaw));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const input = parsed.data;

    const settings = await getSettings();
    const pricing = calculatePricing({
      items: input.items,
      discountType: input.discountType,
      discountValue: input.discountValue,
      taxRate: input.taxRate,
    });

    const quotation = await db.$transaction(async (tx) =>
      tx.quotation.create({
        data: {
          number: await nextNumber('QT', tx),
          customerId: input.customerId,
          deviceId: input.deviceId || null,
          userId: user.id,
          status: 'DRAFT',
          subtotal: pricing.subtotal,
          discountType: input.discountType,
          discountValue: input.discountValue,
          discountAmount: pricing.discountAmount,
          taxRate: input.taxRate,
          taxAmount: pricing.taxAmount,
          total: pricing.total,
          notes: input.notes,
          terms: input.terms ?? settings['invoice.terms'] ?? null,
          validUntil: input.validUntil ?? addDays(new Date(), 14),
          items: {
            create: input.items.map((item) => ({
              kind: item.kind === 'REPAIR' ? 'CUSTOM' : item.kind,
              productId: item.productId || null,
              serviceId: item.serviceId || null,
              name: item.name,
              description: item.description ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              discount: item.discount,
              total: lineTotal(item),
            })),
          },
        },
      }),
    );

    await audit({
      action: 'CREATE',
      entity: 'Quotation',
      entityId: quotation.id,
      summary: `عرض سعر ${quotation.number} بقيمة ${quotation.total}`,
      user,
    });

    createdId = quotation.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createQuotation]', error);
    return { ok: false, error: 'تعذّر إنشاء عرض السعر' };
  }

  revalidatePath('/quotations');
  redirect(`/quotations/${createdId}`);
}

/** تغيير حالة عرض السعر */
export async function changeQuotationStatusAction(
  quotationId: string,
  status: QuotationStatus,
): Promise<FormState> {
  try {
    const user = await requirePermission('quotations:update');

    const quotation = await db.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return { ok: false, error: 'عرض السعر غير موجود' };
    if (quotation.status === 'CONVERTED') {
      return { ok: false, error: 'العرض محوّل مسبقاً ولا يمكن تعديل حالته' };
    }

    await db.quotation.update({ where: { id: quotationId }, data: { status } });

    await audit({
      action: 'STATUS_CHANGE',
      entity: 'Quotation',
      entityId: quotationId,
      summary: `${quotation.number}: ${quotation.status} → ${status}`,
      user,
    });

    revalidatePath('/quotations');
    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true, message: 'تم تحديث حالة العرض' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تحديث الحالة' };
  }
}

/**
 * تحويل عرض السعر إلى أمر صيانة.
 * التحويل إلى فاتورة يتم عبر صفحة /invoices/new?quotationId= لأنه يحتاج
 * خطوة دفع؛ أما أمر الصيانة فيُنشأ مباشرة هنا.
 */
export async function convertQuotationToRepairAction(
  quotationId: string,
): Promise<FormState> {
  let repairId: string;
  try {
    const user = await requirePermission('repairs:create');

    const quotation = await db.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true, device: true, customer: true },
    });
    if (!quotation) return { ok: false, error: 'عرض السعر غير موجود' };
    if (quotation.status === 'CONVERTED') return { ok: false, error: 'العرض محوّل مسبقاً' };
    if (!quotation.deviceId) {
      return {
        ok: false,
        error: 'العرض غير مرتبط بجهاز — استقبل الجهاز أولاً من صفحة الصيانة',
      };
    }

    const settings = await getSettings();
    const turnaround = Number(settings['repair.defaultTurnaroundDays'] ?? 3);
    const warrantyDays = Number(settings['repair.defaultWarrantyDays'] ?? 30);

    const { randomToken } = await import('@/lib/crypto');

    const repair = await db.$transaction(async (tx) => {
      const created = await tx.repairOrder.create({
        data: {
          number: await nextNumber('RO', tx),
          customerId: quotation.customerId,
          deviceId: quotation.deviceId!,
          receivedById: user.id,
          branchId: user.branchId,
          status: 'RECEIVED',
          problemDescription: quotation.notes ?? `محوّل من عرض السعر ${quotation.number}`,
          estimatedCost: quotation.total,
          finalCost: quotation.total,
          promisedAt: addDays(new Date(), turnaround),
          warrantyDays,
          warrantyTerms: settings['repair.terms'] ?? null,
          trackingToken: randomToken(12),
          items: {
            create: quotation.items.map((item) => ({
              kind: item.kind === 'PRODUCT' ? 'PART' : item.kind === 'SERVICE' ? 'SERVICE' : 'CUSTOM',
              serviceId: item.serviceId,
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              discount: item.discount,
              total: item.total,
            })),
          },
          history: {
            create: {
              status: 'RECEIVED',
              note: `محوّل من عرض السعر ${quotation.number}`,
              userId: user.id,
            },
          },
        },
      });

      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'CONVERTED',
          convertedRepairId: created.id,
          convertedAt: new Date(),
        },
      });

      await tx.customer.update({
        where: { id: quotation.customerId },
        data: { visitsCount: { increment: 1 } },
      });

      return created;
    });

    await audit({
      action: 'UPDATE',
      entity: 'Quotation',
      entityId: quotationId,
      summary: `تحويل ${quotation.number} إلى أمر صيانة ${repair.number}`,
      user,
    });

    repairId = repair.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[convertQuotationToRepair]', error);
    return { ok: false, error: 'تعذّر التحويل إلى أمر صيانة' };
  }

  revalidatePath('/quotations');
  revalidatePath('/repairs');
  redirect(`/repairs/${repairId}`);
}

/** تعليم عرض السعر كمحوّل بعد إنشاء فاتورة منه */
export async function markQuotationConvertedAction(
  quotationId: string,
  invoiceId: string,
): Promise<FormState> {
  try {
    const user = await requirePermission('quotations:update');
    await db.quotation.update({
      where: { id: quotationId },
      data: { status: 'CONVERTED', convertedInvoiceId: invoiceId, convertedAt: new Date() },
    });
    await audit({
      action: 'UPDATE',
      entity: 'Quotation',
      entityId: quotationId,
      summary: 'تحويل عرض السعر إلى فاتورة',
      user,
    });
    revalidatePath('/quotations');
    return { ok: true };
  } catch {
    return { ok: false, error: 'تعذّر تحديث حالة العرض' };
  }
}

export async function deleteQuotationAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('quotations:delete');
    const quotation = await db.quotation.findUnique({ where: { id } });
    if (!quotation) return { ok: false, error: 'عرض السعر غير موجود' };
    if (quotation.status === 'CONVERTED') {
      return { ok: false, error: 'لا يمكن حذف عرض محوّل' };
    }

    await db.quotation.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Quotation',
      entityId: id,
      summary: `حذف عرض السعر ${quotation.number}`,
      user,
    });

    revalidatePath('/quotations');
    return { ok: true, message: 'تم حذف عرض السعر' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حذف عرض السعر' };
  }
}
