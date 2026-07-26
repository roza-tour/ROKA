import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { formatDateTime, normalizeDigits, endOfDay, safeJsonParse } from '@/lib/utils';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters, DateRangeFilter } from '@/components/ui/search-filters';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { AuditDetails } from './audit-details';

export const metadata: Metadata = { title: 'سجل العمليات' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const ACTION_TONES: Record<string, BadgeTone> = {
  CREATE: 'emerald',
  UPDATE: 'blue',
  DELETE: 'rose',
  LOGIN: 'teal',
  LOGIN_FAILED: 'red',
  LOGOUT: 'gray',
  PRINT: 'gray',
  EXPORT: 'violet',
  STATUS_CHANGE: 'amber',
  PAYMENT: 'emerald',
  REFUND: 'orange',
  STOCK_ADJUST: 'blue',
  BACKUP: 'violet',
  RESTORE: 'red',
  NOTIFY: 'teal',
};

/** رابط السجل المرتبط حسب نوعه */
const ENTITY_ROUTES: Record<string, string> = {
  Customer: '/customers',
  RepairOrder: '/repairs',
  Invoice: '/invoices',
  Product: '/inventory',
  Supplier: '/suppliers',
  PurchaseOrder: '/purchases',
  Quotation: '/quotations',
  Expense: '/expenses',
  User: '/employees',
};

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string | null;
  before: string | null;
  after: string | null;
  ip: string | null;
  userName: string | null;
  createdAt: Date;
  user: { id: string; fullName: string } | null;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('audit:view');
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const action = typeof params.action === 'string' ? params.action : '';
  const entity = typeof params.entity === 'string' ? params.entity : '';
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const from = typeof params.from === 'string' ? new Date(params.from) : null;
  const to = typeof params.to === 'string' ? endOfDay(new Date(params.to)) : null;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q } },
            { entityId: { contains: q } },
            { userName: { contains: q } },
            { ip: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, users, entities] = await Promise.all([
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        summary: true,
        before: true,
        after: true,
        ip: true,
        userName: true,
        createdAt: true,
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    db.auditLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' },
    }),
  ]);

  const columns: Column<AuditRow>[] = [
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
      key: 'user',
      header: t.audit.user,
      render: (row) =>
        row.user ? (
          <Link href={`/employees/${row.user.id}`} className="text-sm hover:text-primary">
            {row.user.fullName}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{row.userName ?? '—'}</span>
        ),
    },
    {
      key: 'action',
      header: t.audit.action,
      align: 'center',
      render: (row) => (
        <Badge tone={ACTION_TONES[row.action] ?? 'gray'} size="sm">
          {t.audit.actions[row.action as keyof typeof t.audit.actions] ?? row.action}
        </Badge>
      ),
    },
    {
      key: 'summary',
      header: t.audit.summary,
      render: (row) => {
        const route = ENTITY_ROUTES[row.entity];
        const content = (
          <>
            <span className="block text-sm">{row.summary ?? row.entity}</span>
            <span className="block text-[11px] text-muted-foreground">{row.entity}</span>
          </>
        );
        return route && row.entityId ? (
          <Link href={`${route}/${row.entityId}`} className="hover:text-primary">
            {content}
          </Link>
        ) : (
          <span>{content}</span>
        );
      },
    },
    {
      key: 'ip',
      header: t.audit.ip,
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric text-xs text-muted-foreground" dir="ltr">
          {row.ip ?? '—'}
        </span>
      ),
    },
    {
      key: 'details',
      header: '',
      align: 'center',
      render: (row) =>
        row.before || row.after ? (
          <AuditDetails
            before={safeJsonParse<Record<string, unknown>>(row.before, {})}
            after={safeJsonParse<Record<string, unknown>>(row.after, {})}
            summary={row.summary ?? row.entity}
            labels={{
              details: t.app.details,
              changes: t.audit.changes,
              field: t.audit.field,
              oldValue: t.audit.oldValue,
              newValue: t.audit.newValue,
              close: t.app.close,
              noChanges: t.app.noData,
            }}
          />
        ) : null,
    },
  ];

  const baseUrl = `/audit?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.audit.title}
        description="سجل كامل لكل العمليات الحسّاسة في النظام"
      />

      <SearchFilters
        placeholder="ابحث في وصف العملية أو المستخدم"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'action',
            label: t.audit.action,
            options: Object.entries(t.audit.actions).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: 'entity',
            label: t.audit.entity,
            options: entities.map((e) => ({ value: e.entity, label: e.entity })),
          },
          {
            name: 'userId',
            label: t.audit.user,
            options: users.map((u) => ({ value: u.id, label: u.fullName })),
          },
        ]}
      >
        <DateRangeFilter labels={{ from: t.app.from, to: t.app.to }} />
      </SearchFilters>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={t.app.noData} dense />

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
