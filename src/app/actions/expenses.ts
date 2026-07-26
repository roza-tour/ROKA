'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/numbering';
import {
  expenseSchema,
  expenseCategorySchema,
  firstError,
  fieldErrors,
} from '@/lib/validation';
import { nextDueFrom } from '@/lib/recurrence';
import type { FormState } from './customers';
import type { Recurrence } from '@/lib/constants';

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue;
    obj[key] = value;
  }
  return obj;
}


export async function createExpenseAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('expenses:create');
    const parsed = expenseSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const expense = await db.$transaction(async (tx) =>
      tx.expense.create({
        data: {
          number: await nextNumber('EXP', tx),
          categoryId: data.categoryId,
          description: data.description,
          amount: data.amount,
          date: data.date,
          paymentMethod: data.paymentMethod,
          vendor: data.vendor,
          reference: data.reference,
          receiptUrl: data.receiptUrl,
          notes: data.notes,
          isRecurring: data.isRecurring,
          recurrence: data.isRecurring ? (data.recurrence ?? 'MONTHLY') : null,
          nextDueDate: data.isRecurring
            ? nextDueFrom(data.date, (data.recurrence ?? 'MONTHLY') as Recurrence)
            : null,
          reminderDays: data.reminderDays,
          userId: user.id,
          branchId: user.branchId,
        },
      }),
    );

    await audit({
      action: 'CREATE',
      entity: 'Expense',
      entityId: expense.id,
      summary: `مصروف ${expense.number}: ${expense.description} — ${expense.amount}`,
      after: expense,
      user,
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'تم تسجيل المصروف', id: expense.id };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createExpense]', error);
    return { ok: false, error: 'تعذّر تسجيل المصروف' };
  }
}

export async function updateExpenseAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('expenses:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف المصروف مفقود' };

    const parsed = expenseSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const before = await db.expense.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'المصروف غير موجود' };

    const data = parsed.data;
    const after = await db.expense.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        description: data.description,
        amount: data.amount,
        date: data.date,
        paymentMethod: data.paymentMethod,
        vendor: data.vendor,
        reference: data.reference,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        isRecurring: data.isRecurring,
        recurrence: data.isRecurring ? (data.recurrence ?? 'MONTHLY') : null,
        nextDueDate: data.isRecurring
          ? (before.nextDueDate ??
            nextDueFrom(data.date, (data.recurrence ?? 'MONTHLY') as Recurrence))
          : null,
        reminderDays: data.reminderDays,
      },
    });

    await audit({
      action: 'UPDATE',
      entity: 'Expense',
      entityId: id,
      summary: `تعديل مصروف ${after.number}`,
      before,
      after,
      user,
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${id}`);
    return { ok: true, message: 'تم تحديث المصروف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تحديث المصروف' };
  }
}

export async function deleteExpenseAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('expenses:delete');
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) return { ok: false, error: 'المصروف غير موجود' };

    await db.expense.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Expense',
      entityId: id,
      summary: `حذف مصروف ${expense.number}: ${expense.description}`,
      before: expense,
      user,
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'تم حذف المصروف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حذف المصروف' };
  }
}

/**
 * تسجيل دفعة مصروف دوري مستحق: ينشئ سجلاً جديداً بتاريخ اليوم
 * ويحرّك تاريخ الاستحقاق التالي للأصل.
 */
export async function payRecurringExpenseAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('expenses:create');

    const template = await db.expense.findUnique({ where: { id } });
    if (!template) return { ok: false, error: 'المصروف غير موجود' };
    if (!template.isRecurring) return { ok: false, error: 'هذا المصروف غير دوري' };

    const recurrence = (template.recurrence ?? 'MONTHLY') as Recurrence;
    const dueDate = template.nextDueDate ?? new Date();

    await db.$transaction(async (tx) => {
      await tx.expense.create({
        data: {
          number: await nextNumber('EXP', tx),
          categoryId: template.categoryId,
          description: template.description,
          amount: template.amount,
          date: dueDate,
          paymentMethod: template.paymentMethod,
          vendor: template.vendor,
          notes: `دفعة دورية من ${template.number}`,
          isRecurring: false,
          userId: user.id,
          branchId: template.branchId,
        },
      });

      await tx.expense.update({
        where: { id },
        data: {
          nextDueDate: nextDueFrom(dueDate, recurrence),
          reminderSentAt: null,
        },
      });
    });

    await audit({
      action: 'CREATE',
      entity: 'Expense',
      entityId: id,
      summary: `تسجيل دفعة دورية لـ ${template.description}`,
      user,
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'تم تسجيل الدفعة الدورية' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[payRecurringExpense]', error);
    return { ok: false, error: 'تعذّر تسجيل الدفعة' };
  }
}

// ------------------------------------------------------------- التصنيفات

export async function createExpenseCategoryAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('expenses:create');
    const parsed = expenseCategorySchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const existing = await db.expenseCategory.findUnique({
      where: { name: parsed.data.name },
    });
    if (existing) return { ok: false, error: 'التصنيف موجود مسبقاً' };

    const category = await db.expenseCategory.create({ data: parsed.data });

    await audit({
      action: 'CREATE',
      entity: 'ExpenseCategory',
      entityId: category.id,
      summary: `تصنيف مصروفات جديد: ${category.name}`,
      user,
    });

    revalidatePath('/expenses/categories');
    return { ok: true, message: 'تم إنشاء التصنيف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر إنشاء التصنيف' };
  }
}

export async function deleteExpenseCategoryAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('expenses:delete');
    const count = await db.expense.count({ where: { categoryId: id } });
    if (count > 0) {
      await db.expenseCategory.update({ where: { id }, data: { isActive: false } });
      revalidatePath('/expenses/categories');
      return { ok: true, message: `التصنيف مستخدم في ${count} مصروف — تم تعطيله` };
    }

    await db.expenseCategory.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'ExpenseCategory',
      entityId: id,
      summary: 'حذف تصنيف مصروفات',
      user,
    });

    revalidatePath('/expenses/categories');
    return { ok: true, message: 'تم حذف التصنيف' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حذف التصنيف' };
  }
}
