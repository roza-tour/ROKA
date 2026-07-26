'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { setSettings, getSettings } from '@/lib/settings';
import { branchSchema, firstError } from '@/lib/validation';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import type { FormState } from './customers';

/** المفاتيح المسموح بتعديلها من واجهة الإعدادات */
const ALLOWED_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

export async function saveSettingsAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('settings:update');

    const before = await getSettings();
    const values: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('$')) continue;
      // نقبل فقط المفاتيح المعروفة — لا نسمح بحقن مفاتيح عشوائية
      if (!ALLOWED_KEYS.has(key)) continue;
      values[key] = String(value);
    }

    // مربعات الاختيار غير المحددة لا تُرسَل — نضبطها صراحةً
    for (const key of ALLOWED_KEYS) {
      if (
        DEFAULT_SETTINGS[key] === 'true' ||
        DEFAULT_SETTINGS[key] === 'false' ||
        key.endsWith('Enabled')
      ) {
        if (formData.has(`__present_${key}`) && !(key in values)) {
          values[key] = 'false';
        }
      }
    }

    if (!Object.keys(values).length) {
      return { ok: false, error: 'لا توجد تغييرات للحفظ' };
    }

    await setSettings(values);

    // سجّل الحقول التي تغيّرت فقط
    const changed = Object.entries(values).filter(([key, value]) => before[key] !== value);
    if (changed.length) {
      await audit({
        action: 'UPDATE',
        entity: 'Setting',
        summary: `تعديل ${changed.length} إعداد: ${changed.map(([k]) => k).join('، ')}`,
        before: Object.fromEntries(changed.map(([key]) => [key, before[key]])),
        after: Object.fromEntries(changed),
        user,
      });
    }

    revalidatePath('/', 'layout');
    return { ok: true, message: 'تم حفظ الإعدادات' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[saveSettings]', error);
    return { ok: false, error: 'تعذّر حفظ الإعدادات' };
  }
}

export async function saveBranchAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('settings:update');
    const id = String(formData.get('id') ?? '');

    const obj: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('$') || key === 'id') continue;
      obj[key] = value;
    }

    const parsed = branchSchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

    const conflict = await db.branch.findFirst({
      where: { code: parsed.data.code, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (conflict) return { ok: false, error: 'رمز الفرع مستخدم مسبقاً' };

    if (id) {
      await db.branch.update({ where: { id }, data: parsed.data });
    } else {
      await db.branch.create({ data: parsed.data });
    }

    await audit({
      action: id ? 'UPDATE' : 'CREATE',
      entity: 'Branch',
      entityId: id || undefined,
      summary: `${id ? 'تعديل' : 'إنشاء'} فرع: ${parsed.data.name}`,
      user,
    });

    revalidatePath('/settings/branches');
    return { ok: true, message: 'تم حفظ الفرع' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حفظ الفرع' };
  }
}

// ------------------------------------------------------------ الكوبونات

export async function saveCouponAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('invoices:create');
    const { couponSchema } = await import('@/lib/validation');

    const obj: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('$') || key === 'id') continue;
      obj[key] = value;
    }

    const parsed = couponSchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

    const id = String(formData.get('id') ?? '');
    const data = {
      ...parsed.data,
      startsAt: parsed.data.startsAt ?? new Date(),
      endsAt: parsed.data.endsAt ?? null,
    };

    const conflict = await db.coupon.findFirst({
      where: { code: data.code, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (conflict) return { ok: false, error: 'رمز الكوبون مستخدم مسبقاً' };

    if (id) {
      await db.coupon.update({ where: { id }, data });
    } else {
      await db.coupon.create({ data });
    }

    await audit({
      action: id ? 'UPDATE' : 'CREATE',
      entity: 'Coupon',
      entityId: id || undefined,
      summary: `${id ? 'تعديل' : 'إنشاء'} كوبون: ${data.code}`,
      user,
    });

    revalidatePath('/settings/coupons');
    return { ok: true, message: 'تم حفظ الكوبون' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حفظ الكوبون' };
  }
}

export async function deleteCouponAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('invoices:delete');
    const coupon = await db.coupon.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });
    if (!coupon) return { ok: false, error: 'الكوبون غير موجود' };

    if (coupon._count.invoices > 0) {
      await db.coupon.update({ where: { id }, data: { isActive: false } });
      revalidatePath('/settings/coupons');
      return { ok: true, message: 'الكوبون مستخدم في فواتير — تم تعطيله بدل حذفه' };
    }

    await db.coupon.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Coupon',
      entityId: id,
      summary: `حذف كوبون: ${coupon.code}`,
      user,
    });

    revalidatePath('/settings/coupons');
    return { ok: true, message: 'تم حذف الكوبون' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر حذف الكوبون' };
  }
}
