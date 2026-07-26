import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, AlarmClock, Printer } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, fullName, normalizeDigits, daysUntil } from '@/lib/utils';
import {
  ACTIVE_REPAIR_STATUSES,
  REPAIR_STATUSES,
  REPAIR_PRIORITIES,
  type RepairStatus,
  type RepairPriority,
} from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RepairStatusBadge } from '@/components/repair-status-badge';

export const metadata: Metadata = { title: 'أوامر الصيانة' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const PRIORITY_TONES = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'amber',
  URGENT: 'red',
} as const;

type RepairRow = {
  id: string;
  number: string;
  status: string;
  priority: string;
  receivedAt: Date;
  promisedAt: Date | null;
  finalCost: number;
  estimatedCost: number;
  depositAmount: number;
  problemDescription: string;
  customer: { id: string; firstName: string; lastName: string | null; phone: string };
  device: { brand: string; model: string; type: string };
  technician: { fullName: string } | null;
};

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('repairs:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const priority = typeof params.priority === 'string' ? params.priority : '';
  const technicianId = typeof params.technicianId === 'string' ? params.technicianId : '';
  const overdue = params.overdue === '1';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.RepairOrderWhereInput = {
    ...(status === 'active'
      ? { status: { in: ACTIVE_REPAIR_STATUSES } }
      : status
        ? { status }
        : {}),
    ...(priority ? { priority } : {}),
    ...(technicianId ? { technicianId } : {}),
    ...(overdue
      ? { status: { in: ACTIVE_REPAIR_STATUSES }, promisedAt: { lt: new Date() } }
      : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { problemDescription: { contains: q } },
            { customer: { firstName: { contains: q } } },
            { customer: { lastName: { contains: q } } },
            { customer: { phone: { contains: q } } },
            { device: { imei: { contains: q } } },
            { device: { serialNumber: { contains: q } } },
            { device: { model: { contains: q } } },
            { device: { brand: { contains: q } } },
          ],
        }
      : {}),
  };

  const [rows, total, technicians, counts] = await Promise.all([
    db.repairOrder.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        priority: true,
        receivedAt: true,
        promisedAt: true,
        finalCost: true,
        estimatedCost: true,
        depositAmount: true,
        problemDescription: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        device: { select: { brand: true, model: true, type: true } },
        technician: { select: { fullName: true } },
      },
      orderBy: [{ receivedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.repairOrder.count({ where }),
    db.user.findMany({
      where: { isActive: true, role: { in: ['TECHNICIAN', 'MANAGER', 'ADMIN'] } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    db.repairOrder.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const activeCount = ACTIVE_REPAIR_STATUSES.reduce(
    (sum, s) => sum + (countByStatus[s] ?? 0),
    0,
  );

  const columns: Column<RepairRow>[] = [
    {
      key: 'number',
      header: t.repair.number,
      render: (row) => (
        <div>
          <p className="numeric font-medium">{row.number}</p>
          <p className="numeric text-xs text-muted-foreground">
            {formatDate(row.receivedAt, locale)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t.repair.customer,
      render: (row) => (
        <div>
          <p className="text-sm">{fullName(row.customer.firstName, row.customer.lastName)}</p>
          <p className="numeric text-xs text-muted-foreground">{row.customer.phone}</p>
        </div>
      ),
    },
    {
      key: 'device',
      header: t.repair.device,
      render: (row) => (
        <div>
          <p className="text-sm">
            {row.device.brand} {row.device.model}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={row.problemDescription}>
            {row.problemDescription.slice(0, 40)}
            {row.problemDescription.length > 40 ? '…' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t.repair.status,
      align: 'center',
      render: (row) => <RepairStatusBadge status={row.status} labels={t.repair.statuses} />,
    },
    {
      key: 'priority',
      header: t.repair.priority,
      align: 'center',
      hideOnMobile: true,
      render: (row) =>
        row.priority === 'NORMAL' ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Badge tone={PRIORITY_TONES[row.priority as RepairPriority] ?? 'gray'} size="sm">
            {t.repair.priorities[row.priority as RepairPriority] ?? row.priority}
          </Badge>
        ),
    },
    {
      key: 'technician',
      header: t.repair.technician,
      hideOnMobile: true,
      render: (row) => row.technician?.fullName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'promised',
      header: t.repair.promisedAt,
      align: 'center',
      hideOnMobile: true,
      render: (row) => {
        if (!row.promisedAt) return <span className="text-muted-foreground">—</span>;
        const remaining = daysUntil(row.promisedAt);
        const isActive = (ACTIVE_REPAIR_STATUSES as string[]).includes(row.status);
        const late = isActive && remaining !== null && remaining < 0;
        return (
          <span
            className={`numeric inline-flex items-center gap-1 text-xs ${
              late ? 'font-medium text-danger' : 'text-muted-foreground'
            }`}
          >
            {late && <AlarmClock className="h-3.5 w-3.5" />}
            {formatDate(row.promisedAt, locale)}
          </span>
        );
      },
    },
    {
      key: 'cost',
      header: t.app.total,
      align: 'end',
      render: (row) => {
        const cost = row.finalCost || row.estimatedCost;
        const due = Math.max(0, cost - row.depositAmount);
        return (
          <div>
            <p className="numeric font-medium">{money(cost)}</p>
            {row.depositAmount > 0 && (
              <p className="numeric text-[11px] text-muted-foreground">
                {t.repair.remaining}: {money(due)}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  const baseUrl = `/repairs?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.repair.title}
        description={`${activeCount} جهاز في الورشة · ${countByStatus.READY ?? 0} جاهز للاستلام`}
        actions={
          can(user, 'repairs:create') && (
            <Link href="/repairs/new">
              <Button icon={<Plus className="h-4 w-4" />}>{t.repair.new}</Button>
            </Link>
          )
        }
      />

      {/* أزرار سريعة حسب الحالة */}
      <div className="mb-4 flex flex-wrap gap-2 no-print">
        <StatusChip href="/repairs" label={t.app.all} count={counts.reduce((s, c) => s + c._count._all, 0)} active={!status && !overdue} />
        <StatusChip
          href="/repairs?status=active"
          label="في الورشة"
          count={activeCount}
          active={status === 'active'}
        />
        {(['READY', 'WAITING_PARTS', 'WAITING_APPROVAL', 'DELIVERED'] as RepairStatus[]).map(
          (s) => (
            <StatusChip
              key={s}
              href={`/repairs?status=${s}`}
              label={t.repair.statuses[s]}
              count={countByStatus[s] ?? 0}
              active={status === s}
            />
          ),
        )}
        <StatusChip href="/repairs?overdue=1" label={t.repair.overdue} active={overdue} danger />
      </div>

      <SearchFilters
        placeholder="ابحث برقم العملية، اسم العميل، الهاتف، IMEI أو الموديل"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.repair.status,
            options: REPAIR_STATUSES.map((s) => ({ value: s, label: t.repair.statuses[s] })),
          },
          {
            name: 'priority',
            label: t.repair.priority,
            options: REPAIR_PRIORITIES.map((p) => ({
              value: p,
              label: t.repair.priorities[p],
            })),
          },
          {
            name: 'technicianId',
            label: t.repair.technician,
            options: technicians.map((tech) => ({ value: tech.id, label: tech.fullName })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/repairs/${r.id}`}
        empty={q ? t.app.noResults : t.app.noData}
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

function StatusChip({
  href,
  label,
  count,
  active,
  danger,
}: {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? danger
            ? 'border-transparent bg-danger text-danger-foreground'
            : 'border-transparent bg-primary text-primary-foreground'
          : 'border-border hover:bg-accent'
      }`}
    >
      {label}
      {count != null && (
        <span
          className={`numeric rounded-full px-1.5 text-xs ${
            active ? 'bg-white/20' : 'bg-muted text-muted-foreground'
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
