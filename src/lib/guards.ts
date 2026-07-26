import 'server-only';

import { forbidden, unauthorized } from 'next/navigation';
import { getCurrentUser, type SessionUser } from './auth';
import { can, canAny, type Permission } from './permissions';

/**
 * حُرّاس الصفحات.
 *
 * تختلف عن حُرّاس الإجراءات الخادمية في `lib/auth.ts`:
 * - هنا نستدعي unauthorized()/forbidden() فيُرجع Next رمز الحالة الصحيح
 *   (401/403) ويعرض صفحة مخصّصة — وهو السلوك الصحيح للصفحات.
 * - هناك نرمي AuthError ليلتقطه الإجراء ويُرجع رسالة خطأ للنموذج،
 *   لأن الإجراء يُستدعى من نموذج ولا يُفترض أن يغيّر الصفحة.
 */

/** يتطلب مستخدماً مسجّل الدخول لعرض الصفحة */
export async function pageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  return user;
}

/** يتطلب صلاحية محددة لعرض الصفحة */
export async function pagePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  if (!can(user, permission)) forbidden();
  return user;
}

/** يتطلب أياً من الصلاحيات المذكورة */
export async function pageAnyPermission(permissions: Permission[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  if (!canAny(user, permissions)) forbidden();
  return user;
}

/** يتطلب دور مدير النظام (للعمليات الخطرة كاستعادة النسخ الاحتياطي) */
export async function pageAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  if (user.role !== 'ADMIN') forbidden();
  return user;
}
