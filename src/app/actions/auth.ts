'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  login as doLogin,
  logout as doLogout,
  getCurrentUser,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  revokeAllSessions,
} from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';

export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

const loginSchema = z.object({
  username: z.string().trim().min(1, 'أدخل اسم المستخدم'),
  password: z.string().min(1, 'أدخل كلمة المرور'),
});

/**
 * وجهة آمنة بعد الدخول: نقبل المسارات الداخلية فقط.
 * هذا يمنع إعادة التوجيه المفتوح (open redirect) إلى موقع خارجي.
 */
function safeRedirect(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/dashboard';
  if (next.startsWith('//') || next.includes('\\')) return '/dashboard';
  return next;
}

export async function loginAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
  }

  const result = await doLogin(parsed.data.username, parsed.data.password);

  if (!result.ok) {
    await audit({
      action: 'LOGIN_FAILED',
      entity: 'User',
      summary: `محاولة دخول فاشلة: ${parsed.data.username}`,
    });
    return { ok: false, error: result.error };
  }

  await audit({
    action: 'LOGIN',
    entity: 'User',
    entityId: result.user!.id,
    summary: `تسجيل دخول: ${result.user!.fullName}`,
    user: result.user,
  });

  // العودة إلى الصفحة التي حاول المستخدم فتحها قبل تسجيل الدخول
  redirect(safeRedirect(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await audit({
      action: 'LOGOUT',
      entity: 'User',
      entityId: user.id,
      summary: `تسجيل خروج: ${user.fullName}`,
      user,
    });
  }
  await doLogout();
  redirect('/login');
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'أدخل كلمة المرور الحالية'),
    newPassword: z.string().min(8, 'كلمة المرور الجديدة قصيرة جداً'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

export async function changePasswordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
  }

  const strength = validatePasswordStrength(parsed.data.newPassword);
  if (!strength.ok) return { ok: false, error: strength.message };

  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record) return { ok: false, error: 'المستخدم غير موجود' };

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) return { ok: false, error: 'كلمة المرور الحالية غير صحيحة' };

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePw: false,
    },
  });

  // إبطال الجلسات الأخرى بعد تغيير كلمة المرور
  await revokeAllSessions(user.id);

  await audit({
    action: 'UPDATE',
    entity: 'User',
    entityId: user.id,
    summary: 'تغيير كلمة المرور',
    user,
  });

  return { ok: true, message: 'تم تغيير كلمة المرور بنجاح. سجّل الدخول مجدداً.' };
}

/** تغيير لغة الواجهة */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

/** تغيير السمة (فاتح/داكن/النظام) */
export async function setThemeAction(theme: string): Promise<void> {
  if (!['light', 'dark', 'system'].includes(theme)) return;
  const store = await cookies();
  store.set('roka_theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
