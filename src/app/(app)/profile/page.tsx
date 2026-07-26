import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound, Clock, Wrench, Receipt, Monitor } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { PERIODS } from '@/lib/analytics';
import {
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  formatRelative,
  initials,
} from '@/lib/utils';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import type { Role } from '@/lib/constants';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'الملف الشخصي' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const month = PERIODS.month();

  const [profile, repairs, sales, attendance, sessions] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      include: { branch: { select: { name: true } } },
    }),
    db.repairOrder.count({
      where: { technicianId: user.id, completedAt: { gte: month.from, lte: month.to } },
    }),
    db.invoice.aggregate({
      where: {
        userId: user.id,
        issuedAt: { gte: month.from, lte: month.to },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.attendance.findMany({
      where: { userId: user.id, date: { gte: month.from } },
      orderBy: { date: 'desc' },
      take: 10,
    }),
    db.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  if (!profile) redirect('/login');

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const totalMinutes = attendance.reduce((sum, record) => sum + record.minutes, 0);
  const permissions = ROLE_PERMISSIONS[profile.role as Role] ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t.nav.profile}
        actions={
          <Link href="/profile/password">
            <Button icon={<KeyRound className="h-4 w-4" />}>{t.auth.changePassword}</Button>
          </Link>
        }
      />

      {profile.mustChangePw && (
        <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <KeyRound className="h-5 w-5 shrink-0" />
          <span>
            كلمة المرور الحالية مؤقتة —{' '}
            <Link href="/profile/password" className="font-medium underline">
              غيّرها الآن
            </Link>
          </span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.employee.repairsCompleted}
          value={formatNumber(repairs, locale)}
          icon={Wrench}
          tone="primary"
          hint={t.app.thisMonth}
        />
        <StatCard
          label={t.employee.salesMade}
          value={money(sales._sum.total ?? 0)}
          icon={Receipt}
          tone="success"
          hint={`${sales._count} فاتورة`}
        />
        <StatCard
          label={t.attendance.hours}
          value={`${Math.floor(totalMinutes / 60)}س`}
          icon={Clock}
          tone="info"
          hint={`${attendance.length} يوم`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.app.details}>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {initials(profile.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{profile.fullName}</p>
              <p className="numeric text-sm text-muted-foreground">{profile.username}</p>
              <Badge tone="blue" size="sm" className="mt-1">
                {t.roles[profile.role as Role] ?? profile.role}
              </Badge>
            </div>
          </div>

          <dl className="divide-y divide-border">
            {profile.email && (
              <DetailRow label={t.employee.email}>
                <span dir="ltr">{profile.email}</span>
              </DetailRow>
            )}
            {profile.phone && (
              <DetailRow label={t.employee.phone}>
                <span className="numeric">{profile.phone}</span>
              </DetailRow>
            )}
            {profile.jobTitle && (
              <DetailRow label={t.employee.jobTitle}>{profile.jobTitle}</DetailRow>
            )}
            {profile.branch && (
              <DetailRow label={t.employee.branch}>{profile.branch.name}</DetailRow>
            )}
            {profile.hireDate && (
              <DetailRow label={t.employee.hireDate}>
                <span className="numeric">{formatDate(profile.hireDate, locale)}</span>
              </DetailRow>
            )}
            <DetailRow label={t.auth.login}>
              <span className="text-sm">
                {profile.lastLoginAt ? formatRelative(profile.lastLoginAt, locale) : '—'}
              </span>
            </DetailRow>
          </dl>
        </Card>

        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                الجلسات النشطة
              </span>
            }
            bodyClassName="p-0"
          >
            {sessions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((session) => (
                  <li key={session.id} className="px-5 py-3">
                    <p className="truncate text-xs" title={session.userAgent ?? ''}>
                      {session.userAgent?.slice(0, 60) ?? 'جهاز غير معروف'}
                    </p>
                    <p className="numeric text-[11px] text-muted-foreground" dir="ltr">
                      {session.ip ?? '—'} · {formatDateTime(session.createdAt, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t.employee.permissions}>
            {profile.role === 'ADMIN' ? (
              <p className="text-sm text-muted-foreground">مدير النظام — كل الصلاحيات</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {permissions.slice(0, 40).map((permission) => (
                  <Badge key={permission} tone="blue" size="sm">
                    {permission}
                  </Badge>
                ))}
                {permissions.length > 40 && (
                  <Badge tone="gray" size="sm">
                    +{permissions.length - 40}
                  </Badge>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
