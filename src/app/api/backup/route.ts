import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { createBackup, restoreBackup, type BackupFile } from '@/lib/backup';
import { getShopInfo } from '@/lib/settings';
import { downloadHeaders, CONTENT_TYPES } from '@/lib/export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/** تحميل نسخة احتياطية */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!can(user, 'backup:create')) {
    return NextResponse.json({ error: 'لا تملك صلاحية النسخ الاحتياطي' }, { status: 403 });
  }

  try {
    const [backup, shop] = await Promise.all([createBackup(), getShopInfo()]);
    const json = JSON.stringify(backup);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `roka-backup-${stamp}.json`;

    await db.backupLog.create({
      data: {
        filename,
        sizeBytes: Buffer.byteLength(json),
        type: 'MANUAL',
        status: 'SUCCESS',
        createdBy: user.fullName,
      },
    });

    await audit({
      action: 'BACKUP',
      entity: 'Backup',
      summary: `إنشاء نسخة احتياطية: ${filename}`,
      user,
    });

    return new NextResponse(json, {
      headers: downloadHeaders(filename, CONTENT_TYPES.json),
    });
  } catch (error) {
    console.error('[backup]', error);
    await db.backupLog
      .create({
        data: {
          filename: 'failed',
          type: 'MANUAL',
          status: 'FAILED',
          error: error instanceof Error ? error.message.slice(0, 400) : 'خطأ غير معروف',
          createdBy: user.fullName,
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: 'تعذّر إنشاء النسخة الاحتياطية' }, { status: 500 });
  }
}

/** استعادة نسخة احتياطية */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الاستعادة عملية بالغة الخطورة — مقصورة على مدير النظام
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'الاستعادة مقصورة على مدير النظام' },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم اختيار ملف' }, { status: 400 });
    }
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف أكبر من الحد المسموح' }, { status: 400 });
    }

    let backup: BackupFile;
    try {
      backup = JSON.parse(await file.text()) as BackupFile;
    } catch {
      return NextResponse.json({ error: 'الملف ليس بصيغة JSON صالحة' }, { status: 400 });
    }

    const result = await restoreBackup(backup);

    await audit({
      action: 'RESTORE',
      entity: 'Backup',
      summary: `استعادة نسخة احتياطية من ${backup.createdAt} — ${Object.values(result.restored).reduce((a, b) => a + b, 0)} سجل`,
      user,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[restore]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `تعذّرت الاستعادة: ${error.message.slice(0, 200)}`
            : 'تعذّرت الاستعادة',
      },
      { status: 500 },
    );
  }
}
