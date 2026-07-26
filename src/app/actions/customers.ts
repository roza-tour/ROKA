'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextCode } from '@/lib/numbering';
import { customerSchema, firstError, fieldErrors } from '@/lib/validation';
import { normalizePhone, fullName } from '@/lib/utils';

export interface FormState {
  ok: boolean;
  error?: string;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
}

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue; // حقول داخلية لـ Next
    obj[key] = value;
  }
  return obj;
}

/** إنشاء عميل جديد */
export async function createCustomerAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let newId: string;
  try {
    const user = await requirePermission('customers:create');
    const parsed = customerSchema.safeParse(formToObject(formData));

    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const data = parsed.data;
    const phone = normalizePhone(data.phone);

    // تحذير من التكرار (لا نمنعه — قد يشترك أفراد الأسرة برقم واحد)
    const duplicate = await db.customer.findFirst({
      where: { phone },
      select: { id: true, firstName: true, lastName: true },
    });

    const allowDuplicate = formData.get('allowDuplicate') === 'true';
    if (duplicate && !allowDuplicate) {
      return {
        ok: false,
        error: `يوجد عميل بنفس الرقم: ${fullName(duplicate.firstName, duplicate.lastName)}. أعد الإرسال للتأكيد.`,
        errors: { phone: 'رقم مكرر' },
      };
    }

    const customer = await db.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({ where: { isDefault: true } });
      return tx.customer.create({
        data: {
          code: await nextCode('CUS', tx),
          firstName: data.firstName,
          lastName: data.lastName,
          phone,
          phone2: data.phone2 ? normalizePhone(data.phone2) : null,
          email: data.email,
          address: data.address,
          city: data.city,
          taxNumber: data.taxNumber,
          notes: data.notes,
          type: data.type,
          isBlocked: data.isBlocked,
          branchId: user.branchId ?? branch?.id ?? null,
        },
      });
    });

    await audit({
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer.id,
      summary: `إنشاء عميل: ${fullName(customer.firstName, customer.lastName)}`,
      after: customer,
      user,
    });

    newId = customer.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createCustomer]', error);
    return { ok: false, error: 'تعذّر إنشاء العميل' };
  }

  revalidatePath('/customers');
  redirect(`/customers/${newId}`);
}

/** تحديث بيانات عميل */
export async function updateCustomerAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('customers:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف العميل مفقود' };

    const parsed = customerSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const before = await db.customer.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'العميل غير موجود' };

    const data = parsed.data;
    const after = await db.customer.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: normalizePhone(data.phone),
        phone2: data.phone2 ? normalizePhone(data.phone2) : null,
        email: data.email,
        address: data.address,
        city: data.city,
        taxNumber: data.taxNumber,
        notes: data.notes,
        type: data.type,
        isBlocked: data.isBlocked,
      },
    });

    await audit({
      action: 'UPDATE',
      entity: 'Customer',
      entityId: id,
      summary: `تعديل عميل: ${fullName(after.firstName, after.lastName)}`,
      before,
      after,
      user,
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { ok: true, message: 'تم تحديث بيانات العميل', id };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[updateCustomer]', error);
    return { ok: false, error: 'تعذّر تحديث العميل' };
  }
}

/** حذف عميل — يُمنع إن كانت له سجلات مرتبطة */
export async function deleteCustomerAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('customers:delete');

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { repairOrders: true, invoices: true, quotations: true } },
      },
    });
    if (!customer) return { ok: false, error: 'العميل غير موجود' };

    const linked =
      customer._count.repairOrders + customer._count.invoices + customer._count.quotations;

    if (linked > 0) {
      // أرشفة بدل الحذف للحفاظ على سلامة السجلات المالية
      await db.customer.update({ where: { id }, data: { isActive: false } });
      await audit({
        action: 'UPDATE',
        entity: 'Customer',
        entityId: id,
        summary: `أرشفة عميل (له ${linked} سجل مرتبط)`,
        user,
      });
      revalidatePath('/customers');
      return {
        ok: true,
        message: `للعميل ${linked} سجل مرتبط — تمت أرشفته بدل حذفه`,
      };
    }

    await db.customer.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Customer',
      entityId: id,
      summary: `حذف عميل: ${fullName(customer.firstName, customer.lastName)}`,
      before: customer,
      user,
    });

    revalidatePath('/customers');
    return { ok: true, message: 'تم حذف العميل' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[deleteCustomer]', error);
    return { ok: false, error: 'تعذّر حذف العميل' };
  }
}

/** إعادة تفعيل عميل مؤرشف */
export async function restoreCustomerAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('customers:update');
    await db.customer.update({ where: { id }, data: { isActive: true } });
    await audit({
      action: 'UPDATE',
      entity: 'Customer',
      entityId: id,
      summary: 'استعادة عميل مؤرشف',
      user,
    });
    revalidatePath('/customers');
    return { ok: true, message: 'تمت استعادة العميل' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّرت الاستعادة' };
  }
}

/** تعديل رصيد العميل يدوياً (دفعة على الحساب أو تسوية) */
export async function adjustCustomerBalanceAction(
  customerId: string,
  amount: number,
  note: string,
): Promise<FormState> {
  try {
    const user = await requirePermission('payments:create');
    if (!Number.isFinite(amount) || amount === 0) {
      return { ok: false, error: 'أدخل مبلغاً صالحاً' };
    }

    const customer = await db.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { balance: { increment: amount } },
      });
      await tx.payment.create({
        data: {
          customerId,
          amount: Math.abs(amount),
          method: 'CASH',
          direction: amount > 0 ? 'IN' : 'OUT',
          notes: note || 'تسوية رصيد يدوية',
          userId: user.id,
        },
      });
      return updated;
    });

    await audit({
      action: 'PAYMENT',
      entity: 'Customer',
      entityId: customerId,
      summary: `تسوية رصيد: ${amount} — ${note}`,
      after: { balance: customer.balance },
      user,
    });

    revalidatePath(`/customers/${customerId}`);
    return { ok: true, message: 'تم تعديل الرصيد' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[adjustBalance]', error);
    return { ok: false, error: 'تعذّر تعديل الرصيد' };
  }
}
