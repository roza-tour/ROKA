import type { Metadata } from 'next';
import { DatabaseBackup, History } from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { formatDateTime, formatNumber } from '@/lib/utils';

import { PageHeader, Card } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { BackupPanel } from './backup-panel';

export const metadata: Metadata = { title: 'النسخ الاحتياطي' };
export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function BackupPage() {
  await requirePermission('settings:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();

  const [logs, counts] = await Promise.all([
    db.backupLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    Promise.all([
      db.customer.count(),
      db.repairOrder.count(),
      db.invoice.count(),
      db.product.count(),
      db.expense.count(),
    ]),
  ]);

  const [customers, repairs, invoices, products, expenses] = counts;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t.backup.title}
        backHref="/settings"
        breadcrumbs={[{ label: t.settings.title, href: '/settings' }, { label: t.backup.title }]}
      />

      <Card title="محتوى قاعدة البيانات">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            [t.customer.title, customers],
            [t.repair.title, repairs],
            [t.invoice.title, invoices],
            [t.product.title, products],
            [t.expense.title, expenses],
          ].map(([label, count]) => (
            <div key={String(label)} className="text-center">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="numeric mt-1 text-xl font-bold">
                {formatNumber(count as number, locale)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <BackupPanel
        canBackup={can(user, 'backup:create')}
        canRestore={isAdmin}
        labels={{
          create: t.backup.create,
          createHint:
            'تُنزَّل نسخة JSON تحتوي كل بيانات النظام. احفظها في مكان آمن خارج الخادم.',
          restore: t.backup.restore,
          restoreHint: t.backup.warning,
          selectFile: t.backup.selectFile,
          confirm: t.actions.submit,
          cancel: t.actions.cancel,
          restoreWarning: t.backup.warning,
          logoutNotice:
            'ملاحظة: بعد الاستعادة تُنهى كل الجلسات النشطة — ستحتاج أنت وبقية الموظفين إلى تسجيل الدخول من جديد.',
          adminOnly: 'الاستعادة مقصورة على مدير النظام',
          restored: t.backup.restored,
        }}
      />

      <Card
        title={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            سجل النسخ الاحتياطي
          </span>
        }
        bodyClassName="p-0"
      >
        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t.app.noData}</p>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                <DatabaseBackup className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="numeric truncate text-sm">{log.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.createdBy ?? '—'}
                    {log.sizeBytes > 0 && ` · ${formatBytes(log.sizeBytes)}`}
                  </p>
                </div>
                <Badge tone={log.status === 'SUCCESS' ? 'emerald' : 'rose'} size="sm">
                  {log.status === 'SUCCESS' ? 'ناجحة' : 'فاشلة'}
                </Badge>
                <span className="numeric shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
