import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import { randomToken } from './crypto';
import type { Role } from './constants';
import { can, canAny, type Permission } from './permissions';

export const SESSION_COOKIE = 'fixel_session';

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET مفقود أو أقصر من 32 حرفاً. راجع ملف .env');
  }
  return encoder.encode(secret);
}

function sessionMaxAge(): number {
  const raw = Number(process.env.SESSION_MAX_AGE);
  return Number.isFinite(raw) && raw > 0 ? raw : 60 * 60 * 12;
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
  permissions: string[];
  branchId: string | null;
  avatarUrl: string | null;
}

interface TokenPayload {
  sub: string;
  jti: string;
  role: string;
}

// ------------------------------------------------------------ كلمات المرور

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** تحقق من قوة كلمة المرور */
export function validatePasswordStrength(pw: string): { ok: boolean; message?: string } {
  if (pw.length < 8) return { ok: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, message: 'يجب أن تحتوي على حرف واحد على الأقل' };
  if (!/[0-9]/.test(pw)) return { ok: false, message: 'يجب أن تحتوي على رقم واحد على الأقل' };
  return { ok: true };
}

// ---------------------------------------------------------------- الجلسات

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: SessionUser;
}

/** تسجيل الدخول: يتحقق من البيانات، ينشئ جلسة، ويضع الكوكي */
export async function login(
  usernameOrEmail: string,
  password: string,
): Promise<LoginResult> {
  const identifier = usernameOrEmail.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
  });

  // رسالة موحّدة حتى لا نكشف وجود الحساب من عدمه
  const genericError = 'اسم المستخدم أو كلمة المرور غير صحيحة';

  if (!user) {
    // نُنفّذ hash وهمي لمعادلة زمن الاستجابة
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return { ok: false, error: genericError };
  }

  if (!user.isActive) {
    return { ok: false, error: 'الحساب معطّل. راجع مدير النظام' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `الحساب مقفل مؤقتاً. حاول بعد ${minutes} دقيقة` };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil:
          failed >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCK_MINUTES * 60_000)
            : null,
      },
    });
    return { ok: false, error: genericError };
  }

  // نجاح — إنشاء الجلسة
  const jti = randomToken(24);
  const expiresAt = new Date(Date.now() + sessionMaxAge() * 1000);
  const hdrs = await headers();

  await db.$transaction([
    db.session.create({
      data: {
        jti,
        userId: user.id,
        expiresAt,
        ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: hdrs.get('user-agent')?.slice(0, 400) ?? null,
      },
    }),
    db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    }),
  ]);

  const token = await new SignJWT({ role: user.role } satisfies Omit<TokenPayload, 'sub' | 'jti'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return { ok: true, user: toSessionUser(user) };
}

/** تسجيل الخروج: إبطال الجلسة وحذف الكوكي */
export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      if (payload.jti) {
        await db.session.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // رمز غير صالح — لا شيء لإبطاله
    }
  }
  store.delete(SESSION_COOKIE);
}

/** إبطال كل جلسات مستخدم (تسجيل خروج من كل الأجهزة) */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * قراءة المستخدم الحالي من الكوكي.
 * مُخزّنة مؤقتاً على مستوى الطلب (React cache) لتفادي استعلامات مكررة.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload: TokenPayload;
  try {
    const result = await jwtVerify(token, secretKey());
    payload = result.payload as unknown as TokenPayload;
  } catch {
    return null;
  }

  if (!payload.sub || !payload.jti) return null;

  const session = await db.session.findUnique({
    where: { jti: payload.jti },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    !session.user.isActive
  ) {
    return null;
  }

  return toSessionUser(session.user);
});

function toSessionUser(user: {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  permissions: string;
  branchId: string | null;
  avatarUrl: string | null;
}): SessionUser {
  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(user.permissions);
    if (Array.isArray(parsed)) permissions = parsed.filter((p) => typeof p === 'string');
  } catch {
    permissions = [];
  }
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role as Role,
    permissions,
    branchId: user.branchId,
    avatarUrl: user.avatarUrl,
  };
}

// ------------------------------------------------------------- الحُرّاس

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' = 'UNAUTHENTICATED',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** يتطلب مستخدماً مسجّل الدخول، وإلا يرمي AuthError */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('يجب تسجيل الدخول', 'UNAUTHENTICATED');
  return user;
}

/** يتطلب صلاحية محددة */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) {
    throw new AuthError('لا تملك صلاحية للقيام بهذه العملية', 'FORBIDDEN');
  }
  return user;
}

/** يتطلب أياً من الصلاحيات المذكورة */
export async function requireAnyPermission(permissions: Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAny(user, permissions)) {
    throw new AuthError('لا تملك صلاحية للقيام بهذه العملية', 'FORBIDDEN');
  }
  return user;
}

/** تنظيف الجلسات المنتهية (يُستدعى دورياً) */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
  });
  return result.count;
}
