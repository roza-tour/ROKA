import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Phone, Users } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber, formatDate, fullName, normalizeDigits } from '@/lib/utils';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'العملاء' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type CustomerRow = {
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  city: string | null;
  type: string;
  visitsCount: number;
  totalPurchases: number;
  totalRepairs: number;
  balance: number;
  loyaltyPoints: number;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: Date;
  _count: { repairOrders: number; invoices: number };
};

export default async function CustomersPage({ searchParams }: PageProps) {
  await pagePermission('customers:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const type = typeof params.type === 'string' ? params.type : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.CustomerWhereInput = {
    ...(status === 'archived'
      ? { isActive: false }
      : status === 'blocked'
        ? { isBlocked: true }
        : status === 'debtors'
          ? { balance: { lt: 0 } }
          : { isActive: true }),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { phone: { contains: q } },
            { phone2: { contains: q } },
            { code: { contains: q } },
            { email: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, stats] = await Promise.all([
    db.customer.findMany({
      where,
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        type: true,
        visitsCount: true,
        totalPurchases: true,
        totalRepairs: true,
        balance: true,
        loyaltyPoints: true,
        isActive: true,
        isBlocked: true,
        createdAt: true,
        _count: { select: { repairOrders: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
    db.customer.aggregate({
      where: { isActive: true },
      _count: true,
      _sum: { balance: true },
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: t.customer.fullName,
      render: (row) => (
        <div>
          <p className="font-medium">{fullName(row.firstName, row.lastName)}</p>
          <p className="numeric text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: t.customer.phone,
      render: (row) => (
        <a
          href={`tel:${row.phone}`}
          className="numeric inline-flex items-center gap-1.5 hover:text-primary"
        >
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          {row.phone}
        </a>
      ),
    },
    {
      key: 'city',
      header: t.customer.city,
      hideOnMobile: true,
      render: (row) => row.city ?? '—',
    },
    {
      key: 'visits',
      header: t.customer.visitsCount,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric">{formatNumber(row.visitsCount, locale)}</span>
      ),
    },
    {
      key: 'repairs',
      header: t.nav.repairs,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric">{formatNumber(row._count.repairOrders, locale)}</span>
      ),
    },
    {
      key: 'spent',
      header: t.customer.totalPurchases,
      align: 'end',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric">{money(row.totalPurchases + row.totalRepairs)}</span>
      ),
    },
    {
      key: 'balance',
      header: t.customer.balance,
      align: 'end',
      render: (row) =>
        row.balance === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={`numeric font-medium ${row.balance > 0 ? 'text-success' : 'text-danger'}`}
          >
            {money(Math.abs(row.balance))}
            <span className="ms-1 text-xs font-normal">
              {row.balance > 0 ? t.customer.credit : t.customer.debit}
            </span>
          </span>
        ),
    },
    {
      key: 'status',
      header: t.app.summary,
      align: 'center',
      render: (row) => (
        <div className="flex flex-wrap justify-center gap-1">
          {row.isBlocked && (
            <Badge tone="red" size="sm">
              {t.customer.blocked}
            </Badge>
          )}
          {!row.isActive && (
            <Badge tone="gray" size="sm">
              مؤرشف
            </Badge>
          )}
          {row.type === 'COMPANY' && (
            <Badge tone="violet" size="sm">
              {t.customer.company}
            </Badge>
          )}
          {row.loyaltyPoints > 0 && (
            <Badge tone="amber" size="sm">
              <span className="numeric">{row.loyaltyPoints}</span> نقطة
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created',
      header: t.app.from,
      align: 'end',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {formatDate(row.createdAt, locale)}
        </span>
      ),
    },
  ];

  const baseUrl = `/customers?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.customer.title}
        description={`${formatNumber(stats._count, locale)} عميل نشط · إجمالي الأرصدة ${money(stats._sum.balance ?? 0)}`}
        actions={
          can(user, 'customers:create') && (
            <Link href="/customers/new">
              <Button icon={<Plus className="h-4 w-4" />}>{t.customer.new}</Button>
            </Link>
          )
        }
      />

      <SearchFilters
        placeholder={t.customer.searchHint}
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.invoice.status,
            options: [
              { value: 'debtors', label: 'عليهم ديون' },
              { value: 'blocked', label: t.customer.blocked },
              { value: 'archived', label: 'مؤرشف' },
            ],
          },
          {
            name: 'type',
            label: t.customer.type,
            options: [
              { value: 'INDIVIDUAL', label: t.customer.individual },
              { value: 'COMPANY', label: t.customer.company },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/customers/${r.id}`}
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
