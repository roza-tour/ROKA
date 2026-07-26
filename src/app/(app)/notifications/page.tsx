import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { formatDateTime, formatNumber, truncate } from '@/lib/utils';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/repair-status-badge';
import { Badge } from '@/components/ui/badge';
import { NotificationActions, ResendButton } from './notification-actions';

export const metadata: Metadata = { title: 'الإشعارات' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

const CHANNEL_TONES: Record<string, 'blue' | 'emerald' | 'violet' | 'gray'> = {
  SMS: 'blue',
  WHATSAPP: 'emerald',
  EMAIL: 'violet',
  INTERNAL: 'gray',
};

type NotificationRow = {
  id: string;
  channel: string;
  toAddress: string;
  subject: string | null;
  body: string;
  status: string;
  provider: string | null;
  error: string | null;
  attempts: number;
  sentAt: Date | null;
  createdAt: Date;
  templateKey: string | null;
  customer: { id: string; firstName: string; lastName: string | null } | null;
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('notifications:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const channel = typeof params.channel === 'string' ? params.channel : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.NotificationLogWhereInput = {
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { toAddress: { contains: q } },
            { body: { contains: q } },
            { subject: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, counts] = await Promise.all([
    db.notificationLog.findMany({
      where,
      select: {
        id: true,
        channel: true,
        toAddress: true,
        subject: true,
        body: true,
        status: true,
        provider: true,
        error: true,
        attempts: true,
        sentAt: true,
        createdAt: true,
        templateKey: true,
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.notificationLog.count({ where }),
    db.notificationLog.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const canSend = can(user, 'notifications:create');

  const columns: Column<NotificationRow>[] = [
    {
      key: 'date',
      header: t.audit.date,
      render: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {formatDateTime(row.createdAt, locale)}
        </span>
      ),
    },
    {
      key: 'channel',
      header: t.notification.channel,
      align: 'center',
      render: (row) => (
        <Badge tone={CHANNEL_TONES[row.channel] ?? 'gray'} size="sm">
          {t.notification.channels[row.channel as NotificationChannel] ?? row.channel}
        </Badge>
      ),
    },
    {
      key: 'recipient',
      header: t.notification.recipient,
      render: (row) => (
        <div>
          <p className="numeric text-sm" dir="ltr">
            {row.toAddress}
          </p>
          {row.customer && (
            <Link
              href={`/customers/${row.customer.id}`}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {[row.customer.firstName, row.customer.lastName].filter(Boolean).join(' ')}
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'body',
      header: t.notification.body,
      render: (row) => (
        <div className="max-w-md">
          {row.subject && <p className="text-xs font-medium">{row.subject}</p>}
          <p className="text-xs text-muted-foreground" title={row.body}>
            {truncate(row.body, 90)}
          </p>
          {row.error && (
            <p className="mt-0.5 text-[11px] text-danger" title={row.error}>
              {truncate(row.error, 60)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t.notification.status,
      align: 'center',
      render: (row) => (
        <div className="flex flex-col items-center gap-0.5">
          <StatusBadge
            status={row.status}
            labels={t.notification.statuses as Record<string, string>}
          />
          {row.attempts > 1 && (
            <span className="numeric text-[11px] text-muted-foreground">
              {row.attempts} محاولات
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'center',
      render: (row) =>
        canSend && row.status === 'FAILED' ? (
          <ResendButton id={row.id} label={t.notification.resend} />
        ) : null,
    },
  ];

  const baseUrl = `/notifications?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.notification.title}
        actions={
          <>
            <Link href="/notifications/templates">
              <Button variant="outline" icon={<FileText className="h-4 w-4" />}>
                {t.notification.templates}
              </Button>
            </Link>
            {canSend && (
              <NotificationActions
                labels={{
                  processQueue: t.notification.processQueue,
                  testSend: t.notification.testSend,
                  channel: t.notification.channel,
                  channels: t.notification.channels as Record<string, string>,
                  recipient: t.notification.recipient,
                  send: t.actions.send,
                  cancel: t.actions.cancel,
                  warrantyReminders: t.dashboard.warrantyExpiringAlert,
                }}
              />
            )}
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.notification.statuses.SENT}
          value={formatNumber(countByStatus.SENT ?? 0, locale)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label={t.notification.statuses.PENDING}
          value={formatNumber(countByStatus.PENDING ?? 0, locale)}
          icon={Clock}
          tone={(countByStatus.PENDING ?? 0) > 0 ? 'warning' : 'default'}
          href="/notifications?status=PENDING"
        />
        <StatCard
          label={t.notification.statuses.FAILED}
          value={formatNumber(countByStatus.FAILED ?? 0, locale)}
          icon={XCircle}
          tone={(countByStatus.FAILED ?? 0) > 0 ? 'danger' : 'default'}
          href="/notifications?status=FAILED"
        />
        <StatCard
          label={t.app.total}
          value={formatNumber(total, locale)}
          icon={Bell}
          tone="primary"
        />
      </section>

      <SearchFilters
        placeholder="ابحث بالمستلم أو نص الرسالة"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'channel',
            label: t.notification.channel,
            options: NOTIFICATION_CHANNELS.map((c) => ({
              value: c,
              label: t.notification.channels[c],
            })),
          },
          {
            name: 'status',
            label: t.notification.status,
            options: Object.entries(t.notification.statuses).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={t.app.noData}
        dense
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        baseUrl={baseUrl}
        labels={{
          page: t.app.page,
          of: t.app.of,
          previous: t.app.previous,
          next: t.app.next,
        }}
      />
    </div>
  );
}
