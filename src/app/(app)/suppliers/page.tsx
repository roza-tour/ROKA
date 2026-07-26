import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Phone, Mail } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber, normalizeDigits } from '@/lib/utils';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'الموردون' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  balance: number;
  isActive: boolean;
  _count: { products: number; purchases: number };
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('suppliers:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.SupplierWhereInput = {
    isActive: true,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { phone: { contains: q } },
            { code: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, totals] = await Promise.all([
    db.supplier.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        company: true,
        phone: true,
        email: true,
        balance: true,
        isActive: true,
        _count: { select: { products: true, purchases: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.supplier.count({ where }),
    db.supplier.aggregate({ where: { isActive: true }, _sum: { balance: true } }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name',
      header: t.supplier.name,
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="numeric text-xs text-muted-foreground">
            {row.code}
            {row.company ? ` · ${row.company}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: t.supplier.phone,
      render: (row) => (
        <div className="space-y-0.5 text-sm">
          {row.phone && (
            <a
              href={`tel:${row.phone}`}
              className="numeric flex items-center gap-1.5 hover:text-primary"
            >
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {row.phone}
            </a>
          )}
          {row.email && (
            <a
              href={`mailto:${row.email}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
              dir="ltr"
            >
              <Mail className="h-3.5 w-3.5" />
              {row.email}
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'products',
      header: t.supplier.products,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric">{formatNumber(row._count.products, locale)}</span>
      ),
    },
    {
      key: 'purchases',
      header: t.supplier.purchases,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric">{formatNumber(row._count.purchases, locale)}</span>
      ),
    },
    {
      key: 'balance',
      header: t.supplier.balance,
      align: 'end',
      render: (row) =>
        row.balance === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="numeric font-medium text-danger">{money(row.balance)}</span>
        ),
    },
  ];

  const baseUrl = `/suppliers?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.supplier.title}
        description={`إجمالي المستحقات: ${money(totals._sum.balance ?? 0)}`}
        actions={
          can(user, 'suppliers:create') && (
            <Link href="/suppliers/new">
              <Button icon={<Plus className="h-4 w-4" />}>{t.supplier.new}</Button>
            </Link>
          )
        }
      />

      <SearchFilters
        placeholder="ابحث بالاسم أو الشركة أو الهاتف"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/suppliers/${r.id}`}
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
