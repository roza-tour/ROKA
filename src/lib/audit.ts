import 'server-only';

import { headers } from 'next/headers';
import { db } from './db';
import type { SessionUser } from './auth';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PRINT'
  | 'EXPORT'
  | 'STATUS_CHANGE'
  | 'PAYMENT'
  | 'REFUND'
  | 'STOCK_ADJUST'
  | 'BACKUP'
  | 'RESTORE'
  | 'NOTIFY';

interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  user?: SessionUser | null;
}

/** الحقول التي لا تُسجَّل أبداً في سجل التدقيق */
const REDACTED_FIELDS = new Set([
  'passwordHash',
  'password',
  'passcodeEnc',
  'passcode',
  'customerSignature',
  'employeeSignature',
  'token',
  'secret',
  'apiKey',
]);

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_FIELDS.has(k)) {
        out[k] = '***';
      } else if (typeof v === 'string' && v.startsWith('data:image')) {
        out[k] = `[image ${v.length} bytes]`;
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return value;
}

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const json = JSON.stringify(sanitize(value));
    // حد أقصى لحجم السجل لتفادي تضخم قاعدة البيانات
    return json.length > 20_000 ? json.slice(0, 20_000) + '…' : json;
  } catch {
    return null;
  }
}

/**
 * تسجيل عملية في سجل التدقيق.
 * لا يرمي استثناءً أبداً — فشل التسجيل يجب ألا يُفشل العملية الأصلية.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const hdrs = await headers();
      ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      userAgent = hdrs.get('user-agent')?.slice(0, 400) ?? null;
    } catch {
      // خارج سياق الطلب (مثلاً وظيفة مجدولة)
    }

    await db.auditLog.create({
      data: {
        userId: input.user?.id ?? null,
        userName: input.user?.fullName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        before: serialize(input.before),
        after: serialize(input.after),
        ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error('[audit] فشل تسجيل العملية:', error);
  }
}

/** حساب الفروق بين حالتين لعرضها في سجل التدقيق */
export function diff<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { field: string; from: unknown; to: unknown }[] {
  if (!before || !after) return [];
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (REDACTED_FIELDS.has(key)) continue;
    const a = before[key];
    const b = after[key];
    const aVal = a instanceof Date ? a.getTime() : a;
    const bVal = b instanceof Date ? b.getTime() : b;
    if (JSON.stringify(aVal) !== JSON.stringify(bVal)) {
      changes.push({ field: key, from: a, to: b });
    }
  }
  return changes;
}
