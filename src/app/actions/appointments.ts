'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/numbering';
import { appointmentSchema, firstError, fieldErrors } from '@/lib/validation';
import { normalizePhone } from '@/lib/utils';
import type { FormState } from './customers';
import type { AppointmentStatus } from '@/lib/constants';

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue;
    obj[key] = value;
  }
  return obj;
}

export async function saveAppointmentAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('appointments:create');
    const id = String(formData.get('id') ?? '');

    const parsed = appointmentSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const payload = {
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: normalizePhone(data.customerPhone),
      deviceType: data.deviceType,
      description: data.description,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      assignedToId: data.assignedToId,
      status: data.status,
      notes: data.notes,
    };

    if (id) {
      await db.appointment.update({ where: { id }, data: payload });
    } else {
      await db.$transaction(async (tx) => {
        await tx.appointment.create({
          data: { number: await nextNumber('APT', tx), ...payload },
        });
      });
    }

    await audit({
      action: id ? 'UPDATE' : 'CREATE',
      entity: 'Appointment',
      entityId: id || undefined,
      summary: `${id ? 'تعديل' : 'حجز'} موعد: ${data.customerName}`,
      user,
    });

    revalidatePath('/appointments');
    return { ok: true, message: id ? 'تم تحديث الموعد' : 'تم حجز الموعد' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[saveAppointment]', error);
    return { ok: false, error: 'تعذّر حفظ الموعد' };
  }
}

export async function changeAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
): Promise<FormState> {
  try {
    const user = await requirePermission('appointments:update');
    const appointment = await db.appointment.update({
      where: { id },
      data: { status },
    });

    await audit({
      action: 'STATUS_CHANGE',
      entity: 'Appointment',
      entityId: id,
      summary: `موعد ${appointment.number}: ${status}`,
      user,
    });

    revalidatePath('/appointments');
    return { ok: true, message: 'تم تحديث حالة الموعد' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تحديث الحالة' };
  }
}

export async function deleteAppointmentAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('appointments:delete');
    const appointment = await db.appointment.findUnique({ where: { id } });
    if (!appointment) return { ok: false, error: 'الموعد غير موجود' };

    await db.appointment.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Appointment',
      entityId: id,
      summary: `حذف موعد ${appointment.number}`,
      user,
    });

    revalidatePath('/appointments');
    return { ok: true, message: 'تم حذف الموعد' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حذف الموعد' };
  }
}
