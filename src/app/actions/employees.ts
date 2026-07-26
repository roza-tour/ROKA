'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission, AuthError, hashPassword, validatePasswordStrength, revokeAllSessions, getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  employeeSchema,
  attendanceSchema,
  payrollSchema,
  firstError,
  fieldErrors,
} from '@/lib/validation';
import { randomDigits } from '@/lib/crypto';
import { startOfDay, round } from '@/lib/utils';
import type { FormState } from './customers';
import type { AttendanceStatus } from '@/lib/constants';

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$') || key === 'permissions') continue;
    obj[key] = value;
  }
  obj.permissions = formData.getAll('permissions').map(String);
  return obj;
}

// ------------------------------------------------------------------ الموظفون

export async function createEmployeeAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  let generatedPassword: string | null = null;

  try {
    const user = await requirePermission('employees:create');
    const parsed = employeeSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const conflict = await db.user.findFirst({
      where: {
        OR: [{ username: data.username }, ...(data.email ? [{ email: data.email }] : [])],
      },
      select: { username: true, email: true },
    });
    if (conflict) {
      return {
        ok: false,
        error:
          conflict.username === data.username
            ? 'اسم المستخدم مستخدم مسبقاً'
            : 'البريد الإلكتروني مستخدم مسبقاً',
      };
    }

    // كلمة مرور مؤقتة إن لم تُحدَّد
    let password = data.password?.trim() ?? '';
    if (!password) {
      password = `Roka@${randomDigits(6)}`;
      generatedPassword = password;
    } else {
      const strength = validatePasswordStrength(password);
      if (!strength.ok) return { ok: false, error: strength.message };
    }

    const employee = await db.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: await hashPassword(password),
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        permissions: JSON.stringify(data.permissions),
        jobTitle: data.jobTitle,
        baseSalary: data.baseSalary,
        hireDate: data.hireDate ?? new Date(),
        nationalId: data.nationalId,
        notes: data.notes,
        branchId: data.branchId,
        isActive: data.isActive,
        mustChangePw: true,
      },
    });

    await audit({
      action: 'CREATE',
      entity: 'User',
      entityId: employee.id,
      summary: `إنشاء موظف: ${employee.fullName} (${employee.username}) بدور ${employee.role}`,
      after: { username: employee.username, role: employee.role, fullName: employee.fullName },
      user,
    });

    createdId = employee.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createEmployee]', error);
    return { ok: false, error: 'تعذّر إنشاء الموظف' };
  }

  revalidatePath('/employees');
  if (generatedPassword) {
    redirect(`/employees/${createdId}?password=${encodeURIComponent(generatedPassword)}`);
  }
  redirect(`/employees/${createdId}`);
}

export async function updateEmployeeAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('employees:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف الموظف مفقود' };

    const parsed = employeeSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const before = await db.user.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'الموظف غير موجود' };

    const data = parsed.data;

    // حماية: آخر مدير نظام نشط لا يُعطَّل ولا يُخفَّض دوره
    if (before.role === 'ADMIN' && (data.role !== 'ADMIN' || !data.isActive)) {
      const activeAdmins = await db.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      });
      if (activeAdmins === 0) {
        return { ok: false, error: 'لا يمكن تعطيل آخر مدير نظام أو تغيير دوره' };
      }
    }

    const conflict = await db.user.findFirst({
      where: {
        id: { not: id },
        OR: [{ username: data.username }, ...(data.email ? [{ email: data.email }] : [])],
      },
      select: { username: true },
    });
    if (conflict) {
      return {
        ok: false,
        error:
          conflict.username === data.username
            ? 'اسم المستخدم مستخدم مسبقاً'
            : 'البريد الإلكتروني مستخدم مسبقاً',
      };
    }

    const after = await db.user.update({
      where: { id },
      data: {
        username: data.username,
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        permissions: JSON.stringify(data.permissions),
        jobTitle: data.jobTitle,
        baseSalary: data.baseSalary,
        hireDate: data.hireDate ?? before.hireDate,
        nationalId: data.nationalId,
        notes: data.notes,
        branchId: data.branchId,
        isActive: data.isActive,
      },
    });

    // تعطيل الحساب يُنهي كل جلساته فوراً
    if (before.isActive && !after.isActive) {
      await revokeAllSessions(id);
    }

    await audit({
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      summary: `تعديل موظف: ${after.fullName}`,
      before,
      after,
      user,
    });

    revalidatePath('/employees');
    revalidatePath(`/employees/${id}`);
    return { ok: true, message: 'تم تحديث بيانات الموظف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[updateEmployee]', error);
    return { ok: false, error: 'تعذّر تحديث الموظف' };
  }
}

/** إعادة تعيين كلمة مرور موظف — يُرجع كلمة مؤقتة */
export async function resetEmployeePasswordAction(
  id: string,
): Promise<FormState & { password?: string }> {
  try {
    const user = await requirePermission('employees:update');

    const employee = await db.user.findUnique({ where: { id }, select: { fullName: true } });
    if (!employee) return { ok: false, error: 'الموظف غير موجود' };

    const password = `Roka@${randomDigits(6)}`;
    await db.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(password), mustChangePw: true, failedLogins: 0, lockedUntil: null },
    });
    await revokeAllSessions(id);

    await audit({
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      summary: `إعادة تعيين كلمة مرور: ${employee.fullName}`,
      user,
    });

    revalidatePath(`/employees/${id}`);
    return { ok: true, message: 'تم إنشاء كلمة مرور مؤقتة', password };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّرت إعادة التعيين' };
  }
}

/** إنهاء كل جلسات موظف */
export async function forceLogoutAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('employees:update');
    await revokeAllSessions(id);
    await audit({
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      summary: 'إنهاء كل جلسات المستخدم',
      user,
    });
    revalidatePath(`/employees/${id}`);
    return { ok: true, message: 'تم إنهاء كل الجلسات' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر إنهاء الجلسات' };
  }
}

// ------------------------------------------------------------------ الحضور

/** تسجيل حضور/انصراف المستخدم الحالي */
export async function punchAction(): Promise<FormState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };

    const today = startOfDay();
    const now = new Date();

    const existing = await db.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    if (!existing) {
      await db.attendance.create({
        data: { userId: user.id, date: today, checkIn: now, status: 'PRESENT' },
      });
      await audit({
        action: 'CREATE',
        entity: 'Attendance',
        entityId: user.id,
        summary: 'تسجيل حضور',
        user,
      });
      revalidatePath('/attendance');
      return { ok: true, message: 'تم تسجيل الحضور' };
    }

    if (!existing.checkOut) {
      const minutes = existing.checkIn
        ? Math.max(0, Math.round((now.getTime() - existing.checkIn.getTime()) / 60000))
        : 0;
      await db.attendance.update({
        where: { id: existing.id },
        data: { checkOut: now, minutes },
      });
      await audit({
        action: 'UPDATE',
        entity: 'Attendance',
        entityId: existing.id,
        summary: `تسجيل انصراف (${Math.floor(minutes / 60)}س ${minutes % 60}د)`,
        user,
      });
      revalidatePath('/attendance');
      return { ok: true, message: 'تم تسجيل الانصراف' };
    }

    return { ok: false, error: 'سُجّل الحضور والانصراف لهذا اليوم مسبقاً' };
  } catch (error) {
    console.error('[punch]', error);
    return { ok: false, error: 'تعذّر تسجيل الحضور' };
  }
}

/** تعديل سجل حضور يدوياً (للمدير) */
export async function upsertAttendanceAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('attendance:update');
    const parsed = attendanceSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;
    const date = startOfDay(data.date);

    // الوقت يصل كنص HH:mm ويُدمج مع التاريخ
    const toDateTime = (time: string | null): Date | null => {
      if (!time) return null;
      const [hours, minutes] = time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
    };

    const checkIn = toDateTime(data.checkIn);
    const checkOut = toDateTime(data.checkOut);
    const minutes =
      checkIn && checkOut
        ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000))
        : 0;

    await db.attendance.upsert({
      where: { userId_date: { userId: data.userId, date } },
      create: {
        userId: data.userId,
        date,
        checkIn,
        checkOut,
        minutes,
        status: data.status,
        notes: data.notes,
      },
      update: { checkIn, checkOut, minutes, status: data.status, notes: data.notes },
    });

    await audit({
      action: 'UPDATE',
      entity: 'Attendance',
      entityId: data.userId,
      summary: `تعديل سجل حضور ليوم ${date.toISOString().slice(0, 10)}`,
      user,
    });

    revalidatePath('/attendance');
    return { ok: true, message: 'تم حفظ سجل الحضور' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[upsertAttendance]', error);
    return { ok: false, error: 'تعذّر حفظ سجل الحضور' };
  }
}

// ------------------------------------------------------------------ الرواتب

/** إنشاء كشف رواتب لفترة (YYYY-MM) لكل الموظفين النشطين */
export async function generatePayrollAction(period: string): Promise<FormState> {
  try {
    const user = await requirePermission('payroll:create');
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return { ok: false, error: 'صيغة الفترة يجب أن تكون YYYY-MM' };
    }

    const employees = await db.user.findMany({
      where: { isActive: true },
      select: { id: true, baseSalary: true },
    });

    let created = 0;
    for (const employee of employees) {
      const existing = await db.payroll.findUnique({
        where: { userId_period: { userId: employee.id, period } },
      });
      if (existing) continue;

      await db.payroll.create({
        data: {
          userId: employee.id,
          period,
          baseSalary: employee.baseSalary,
          netAmount: employee.baseSalary,
          status: 'PENDING',
        },
      });
      created++;
    }

    await audit({
      action: 'CREATE',
      entity: 'Payroll',
      summary: `إنشاء كشف رواتب ${period}: ${created} موظف`,
      user,
    });

    revalidatePath('/payroll');
    return {
      ok: true,
      message: created > 0 ? `تم إنشاء ${created} سجل راتب` : 'كشف الفترة موجود مسبقاً',
    };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[generatePayroll]', error);
    return { ok: false, error: 'تعذّر إنشاء كشف الرواتب' };
  }
}

export async function updatePayrollAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('payroll:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف السجل مفقود' };

    const parsed = payrollSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const netAmount = round(
      data.baseSalary + data.bonuses + data.commissions - data.deductions - data.advances,
    );

    const payroll = await db.payroll.update({
      where: { id },
      data: {
        baseSalary: data.baseSalary,
        bonuses: data.bonuses,
        commissions: data.commissions,
        deductions: data.deductions,
        advances: data.advances,
        netAmount,
        notes: data.notes,
      },
    });

    await audit({
      action: 'UPDATE',
      entity: 'Payroll',
      entityId: id,
      summary: `تعديل راتب ${payroll.period}: الصافي ${netAmount}`,
      user,
    });

    revalidatePath('/payroll');
    return { ok: true, message: 'تم تحديث الراتب' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تحديث الراتب' };
  }
}

/** تسجيل راتب كمدفوع + تسجيله كمصروف */
export async function markPayrollPaidAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('payroll:update');

    const payroll = await db.payroll.findUnique({
      where: { id },
      include: { user: { select: { fullName: true } } },
    });
    if (!payroll) return { ok: false, error: 'السجل غير موجود' };
    if (payroll.status === 'PAID') return { ok: false, error: 'الراتب مدفوع مسبقاً' };

    const { nextNumber } = await import('@/lib/numbering');

    await db.$transaction(async (tx) => {
      await tx.payroll.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      // تسجيل الراتب كمصروف حتى ينعكس في الأرباح والخسائر
      const category = await tx.expenseCategory.findFirst({
        where: { name: { contains: 'رواتب' } },
        select: { id: true },
      });

      await tx.expense.create({
        data: {
          number: await nextNumber('EXP', tx),
          categoryId: category?.id ?? null,
          description: `راتب ${payroll.user.fullName} — ${payroll.period}`,
          amount: payroll.netAmount,
          date: new Date(),
          paymentMethod: 'CASH',
          vendor: payroll.user.fullName,
          reference: payroll.period,
          userId: user.id,
        },
      });
    });

    await audit({
      action: 'PAYMENT',
      entity: 'Payroll',
      entityId: id,
      summary: `صرف راتب ${payroll.user.fullName} — ${payroll.period}: ${payroll.netAmount}`,
      user,
    });

    revalidatePath('/payroll');
    revalidatePath('/expenses');
    return { ok: true, message: 'تم صرف الراتب وتسجيله كمصروف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[markPayrollPaid]', error);
    return { ok: false, error: 'تعذّر صرف الراتب' };
  }
}
