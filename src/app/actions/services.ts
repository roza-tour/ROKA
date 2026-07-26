'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { serviceSchema, serviceCategorySchema, firstError, fieldErrors } from '@/lib/validation';
import { round } from '@/lib/utils';
import type { FormState } from './customers';

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue;
    obj[key] = value;
  }
  return obj;
}

export async function saveServiceAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('services:create');
    const id = String(formData.get('id') ?? '');

    const parsed = serviceSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const conflict = await db.service.findFirst({
      where: { code: data.code, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (conflict) return { ok: false, error: 'رمز الخدمة مستخدم مسبقاً' };

    if (id) {
      const before = await db.service.findUnique({ where: { id } });
      const after = await db.service.update({ where: { id }, data });
      await audit({
        action: 'UPDATE',
        entity: 'Service',
        entityId: id,
        summary: `تعديل خدمة: ${after.name} (${after.code})`,
        before,
        after,
        user,
      });
    } else {
      const created = await db.service.create({ data });
      await audit({
        action: 'CREATE',
        entity: 'Service',
        entityId: created.id,
        summary: `إنشاء خدمة: ${created.name} (${created.code})`,
        after: created,
        user,
      });
    }

    revalidatePath('/services');
    return { ok: true, message: id ? 'تم تحديث الخدمة' : 'تم إنشاء الخدمة' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[saveService]', error);
    return { ok: false, error: 'تعذّر حفظ الخدمة' };
  }
}

export async function deleteServiceAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('services:delete');

    const service = await db.service.findUnique({
      where: { id },
      include: { _count: { select: { invoiceItems: true, repairItems: true } } },
    });
    if (!service) return { ok: false, error: 'الخدمة غير موجودة' };

    const used = service._count.invoiceItems + service._count.repairItems;
    if (used > 0) {
      await db.service.update({ where: { id }, data: { isActive: false } });
      await audit({
        action: 'UPDATE',
        entity: 'Service',
        entityId: id,
        summary: `تعطيل خدمة مستخدمة في ${used} عملية: ${service.name}`,
        user,
      });
      revalidatePath('/services');
      return { ok: true, message: `الخدمة مستخدمة في ${used} عملية — تم تعطيلها بدل حذفها` };
    }

    await db.service.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Service',
      entityId: id,
      summary: `حذف خدمة: ${service.name}`,
      before: service,
      user,
    });

    revalidatePath('/services');
    return { ok: true, message: 'تم حذف الخدمة' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حذف الخدمة' };
  }
}

/** تعديل أسعار الخدمات بالجملة */
export async function bulkUpdateServicePricesAction(
  categoryId: string | null,
  mode: 'PERCENT' | 'FIXED',
  value: number,
): Promise<FormState> {
  try {
    const user = await requirePermission('services:update');
    if (!Number.isFinite(value) || value === 0) {
      return { ok: false, error: 'أدخل قيمة تغيير صالحة' };
    }

    const services = await db.service.findMany({
      where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
      select: { id: true, price: true },
    });
    if (!services.length) return { ok: false, error: 'لا توجد خدمات مطابقة' };

    await db.$transaction(
      services.map((service) => {
        const next =
          mode === 'PERCENT'
            ? round(service.price * (1 + value / 100))
            : round(service.price + value);
        return db.service.update({
          where: { id: service.id },
          data: { price: Math.max(0, next) },
        });
      }),
    );

    await audit({
      action: 'UPDATE',
      entity: 'Service',
      summary: `تعديل أسعار ${services.length} خدمة بالجملة (${mode === 'PERCENT' ? `${value}%` : value})`,
      user,
    });

    revalidatePath('/services');
    return { ok: true, message: `تم تعديل أسعار ${services.length} خدمة` };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تعديل الأسعار' };
  }
}

export async function saveServiceCategoryAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('services:create');
    const id = String(formData.get('id') ?? '');

    const parsed = serviceCategorySchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    if (id) {
      await db.serviceCategory.update({ where: { id }, data: parsed.data });
    } else {
      await db.serviceCategory.create({ data: parsed.data });
    }

    await audit({
      action: id ? 'UPDATE' : 'CREATE',
      entity: 'ServiceCategory',
      entityId: id || undefined,
      summary: `${id ? 'تعديل' : 'إنشاء'} تصنيف خدمات: ${parsed.data.name}`,
      user,
    });

    revalidatePath('/services');
    return { ok: true, message: 'تم حفظ التصنيف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حفظ التصنيف' };
  }
}
