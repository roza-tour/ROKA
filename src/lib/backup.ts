import 'server-only';

import { db } from './db';

/**
 * النسخ الاحتياطي والاستعادة.
 *
 * النسخة عبارة عن ملف JSON يحتوي كل الجداول بترتيب يحترم المفاتيح الأجنبية.
 * هذا التنسيق يعمل مع أي قاعدة بيانات (SQLite/PostgreSQL) وقابل للفحص يدوياً،
 * بخلاف نسخ ملف قاعدة البيانات الخام.
 */

export const BACKUP_VERSION = 1;

/** ترتيب الجداول عند التصدير — الاستعادة تتم بنفس الترتيب، والحذف بعكسه */
const TABLE_ORDER = [
  'branch',
  'setting',
  'counter',
  'user',
  'customer',
  'device',
  'serviceCategory',
  'service',
  'productCategory',
  'supplier',
  'product',
  'productStock',
  'coupon',
  'expenseCategory',
  'repairOrder',
  'repairItem',
  'repairStatusEvent',
  'quotation',
  'quotationItem',
  'invoice',
  'invoiceItem',
  'purchaseOrder',
  'purchaseItem',
  'payment',
  'installmentPlan',
  'installment',
  'warranty',
  'stockMovement',
  'expense',
  'attendance',
  'payroll',
  'loyaltyTransaction',
  'notificationTemplate',
  'notificationLog',
  'appointment',
  'auditLog',
] as const;

type TableName = (typeof TABLE_ORDER)[number];

export interface BackupFile {
  version: number;
  createdAt: string;
  appName: string;
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
}

/** إنشاء نسخة احتياطية كاملة */
export async function createBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of TABLE_ORDER) {
    // الوصول الديناميكي للنماذج — Prisma يوفّرها جميعاً على العميل
    const model = db[table] as unknown as { findMany: () => Promise<unknown[]> };
    const rows = await model.findMany();
    data[table] = rows;
    counts[table] = rows.length;
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appName: 'ROKA ERP',
    counts,
    data,
  };
}

export interface RestoreResult {
  ok: boolean;
  restored: Record<string, number>;
  errors: string[];
}

/**
 * استعادة نسخة احتياطية.
 * ⚠️ يمسح كل البيانات الحالية أولاً. العملية كلها داخل معاملة واحدة —
 * أي فشل يعيد قاعدة البيانات إلى حالتها السابقة.
 */
export async function restoreBackup(backup: BackupFile): Promise<RestoreResult> {
  const errors: string[] = [];
  const restored: Record<string, number> = {};

  if (backup.version !== BACKUP_VERSION) {
    return {
      ok: false,
      restored: {},
      errors: [
        `إصدار النسخة (${backup.version}) لا يطابق الإصدار المدعوم (${BACKUP_VERSION})`,
      ],
    };
  }

  if (!backup.data || typeof backup.data !== 'object') {
    return { ok: false, restored: {}, errors: ['ملف النسخة الاحتياطية تالف'] };
  }

  await db.$transaction(
    async (tx) => {
      // الحذف بعكس ترتيب الإنشاء لاحترام المفاتيح الأجنبية
      for (const table of [...TABLE_ORDER].reverse()) {
        const model = tx[table] as unknown as {
          deleteMany: () => Promise<{ count: number }>;
        };
        await model.deleteMany();
      }

      for (const table of TABLE_ORDER) {
        const rows = backup.data[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          restored[table] = 0;
          continue;
        }

        const model = tx[table] as unknown as {
          create: (args: { data: unknown }) => Promise<unknown>;
        };

        let count = 0;
        for (const row of rows) {
          try {
            await model.create({ data: reviveDates(row) });
            count++;
          } catch (error) {
            errors.push(
              `${table}: ${error instanceof Error ? error.message.slice(0, 160) : 'خطأ'}`,
            );
            // نتوقف عند أول فشل — المعاملة ستُلغى بالكامل
            throw error;
          }
        }
        restored[table] = count;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { ok: errors.length === 0, restored, errors };
}

/** يحوّل النصوص بصيغة ISO إلى كائنات Date قبل الإدراج */
function reviveDates(row: unknown): unknown {
  if (row === null || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)
    ) {
      out[key] = new Date(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** إحصائيات سريعة لعرضها قبل الاستعادة */
export function summarizeBackup(backup: BackupFile): {
  createdAt: string;
  totalRows: number;
  tables: { name: string; count: number }[];
} {
  const tables = Object.entries(backup.counts ?? {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    createdAt: backup.createdAt,
    totalRows: tables.reduce((sum, table) => sum + table.count, 0),
    tables,
  };
}
