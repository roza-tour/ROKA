import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Phone, Mail } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, formatRelative, initials } from '@/lib/utils';
import { ROLES, type Role } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'الموظفون' };
export const dynamic = 'force-dynamic';

const ROLE_TONES: Record<Role, 'violet' | 'blue' | 'emerald' | 'amber' | 'teal' | 'slate' | 'gray'> =
  {
    ADMIN: 'violet',
    MANAGER: 'blue',
    TECHNICIAN: 'emerald',
    CASHIER: 'amber',
    RECEPTIONIST: 'teal',
    ACCOUNTANT: 'slate',
    VIEWER: 'gray',
  };

type EmployeeRow = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  jobTitle: string | null;
  baseSalary: number;
  hireDate: Date | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  _count: { repairsAssigned: number; invoices: number };
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('employees:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const role = typeof params.role === 'string' ? params.role : '';
  const showInactive = params.status === 'inactive';

  const where: Prisma.UserWhereInput = {
    isActive: !showInactive,
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { username: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { jobTitle: { contains: q } },
          ],
        }
      : {}),
  };

  const rows = await db.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      jobTitle: true,
      baseSalary: true,
      hireDate: true,
      lastLoginAt: true,
      isActive: true,
      _count: { select: { repairsAssigned: true, invoices: true } },
    },
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: t.employee.fullName,
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(row.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.fullName}</p>
            <p className="numeric truncate text-xs text-muted-foreground">
              {row.username}
              {row.jobTitle ? ` · ${row.jobTitle}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t.employee.role,
      align: 'center',
      render: (row) => (
        <Badge tone={ROLE_TONES[row.role as Role] ?? 'gray'} size="sm">
          {t.roles[row.role as Role] ?? row.role}
        </Badge>
      ),
    },
    {
      key: 'contact',
      header: t.employee.phone,
      hideOnMobile: true,
      render: (row) => (
        <div className="space-y-0.5 text-xs">
          {row.phone && (
            <a
              href={`tel:${row.phone}`}
              className="numeric flex items-center gap-1.5 hover:text-primary"
            >
              <Phone className="h-3 w-3 text-muted-foreground" />
              {row.phone}
            </a>
          )}
          {row.email && (
            <a
              href={`mailto:${row.email}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"
              dir="ltr"
            >
              <Mail className="h-3 w-3" />
              {row.email}
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'performance',
      header: t.employee.performance,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <div className="text-xs">
          <p className="numeric">
            {row._count.repairsAssigned} {t.nav.repairs}
          </p>
          <p className="numeric text-muted-foreground">
            {row._count.invoices} {t.invoice.title}
          </p>
        </div>
      ),
    },
    {
      key: 'salary',
      header: t.employee.baseSalary,
      align: 'end',
      hideOnMobile: true,
      render: (row) =>
        can(user, 'payroll:view') ? (
          <span className="numeric">{money(row.baseSalary)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'lastLogin',
      header: t.auth.login,
      align: 'end',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastLoginAt ? formatRelative(row.lastLoginAt, locale) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.employee.active,
      align: 'center',
      render: (row) =>
        row.isActive ? (
          <Badge tone="emerald" size="sm" dot>
            {t.employee.active}
          </Badge>
        ) : (
          <Badge tone="gray" size="sm">
            معطّل
          </Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t.employee.title}
        description={`${rows.length} موظف`}
        actions={
          can(user, 'employees:create') && (
            <Link href="/employees/new">
              <Button icon={<Plus className="h-4 w-4" />}>{t.employee.new}</Button>
            </Link>
          )
        }
      />

      <SearchFilters
        placeholder="ابحث بالاسم أو اسم المستخدم أو الهاتف"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'role',
            label: t.employee.role,
            options: ROLES.map((r) => ({ value: r, label: t.roles[r] })),
          },
          {
            name: 'status',
            label: t.employee.active,
            options: [{ value: 'inactive', label: 'معطّل' }],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/employees/${r.id}`}
        empty={q ? t.app.noResults : t.app.noData}
      />
    </div>
  );
}
