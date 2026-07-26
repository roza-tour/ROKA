import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber, formatDateTime, normalizeDigits, endOfDay } from '@/lib/utils';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters, DateRangeFilter } from '@/components/ui/search-filters';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'حركة المخزون' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const MOVEMENT_TONES: Record<string, 'emerald' | 'rose' | 'blue' | 'amber' | 'gray'> = {
  IN: 'emerald',
  RETURN_IN: 'emerald',
  OUT: 'rose',
  RETURN_OUT: 'rose',
  ADJUST: 'blue',
  TRANSFER: 'amber',
  DAMAGE: 'gray',
};

type MovementRow = {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  refNumber: string | null;
  createdAt: Date;
  product: { id: string; name: string; sku: string };
  user: { fullName: string } | null;
};

/** رابط المستند المرجعي حسب نوعه */
function refHref(refType: string | null, refId: string | null): string | null {
  if (!refType || !refId) return null;
  const map: Record<string, string> = {
    Invoice: '/invoices',
    RepairOrder: '/repairs',
    PurchaseOrder: '/purchases',
  };
  const base = map[refType];
  return base ? `${base}/${refId}` : null;
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('inventory:view');
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const type = typeof params.type === 'string' ? params.type : '';
  const from = typeof params.from === 'string' ? new Date(params.from) : null;
  const to = typeof params.to === 'string' ? endOfDay(new Date(params.to)) : null;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.StockMovementWhereInput = {
    ...(type ? { type } : {}),
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
            { product: { name: { contains: q } } },
            { product: { sku: { contains: q } } },
            { refNumber: { contains: q } },
            { reason: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      select: {
        id: true,
        type: true,
        quantity: true,
        balanceAfter: true,
        unitCost: true,
        reason: true,
        refType: true,
        refId: true,
        refNumber: true,
        createdAt: true,
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.stockMovement.count({ where }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<MovementRow>[] = [
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
      key: 'product',
      header: t.product.single,
      render: (row) => (
        <Link href={`/inventory/${row.product.id}`} className="block hover:text-primary">
          <p className="font-medium">{row.product.name}</p>
          <p className="numeric text-xs text-muted-foreground">{row.product.sku}</p>
        </Link>
      ),
    },
    {
      key: 'type',
      header: t.product.movementType,
      align: 'center',
      render: (row) => (
        <Badge tone={MOVEMENT_TONES[row.type] ?? 'gray'} size="sm">
          {t.product.movementTypes[row.type as StockMovementType] ?? row.type}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      header: t.product.quantity,
      align: 'center',
      render: (row) => (
        <span className="numeric font-semibold">{formatNumber(row.quantity, locale)}</span>
      ),
    },
    {
      key: 'balance',
      header: t.product.balanceAfter,
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric text-muted-foreground">
          {formatNumber(row.balanceAfter, locale)}
        </span>
      ),
    },
    {
      key: 'cost',
      header: t.product.costPrice,
      align: 'end',
      hideOnMobile: true,
      render: (row) => <span className="numeric">{money(row.unitCost)}</span>,
    },
    {
      key: 'ref',
      header: t.product.reference,
      render: (row) => {
        const href = refHref(row.refType, row.refId);
        const content = (
          <>
            {row.refNumber && <span className="numeric block">{row.refNumber}</span>}
            {row.reason && (
              <span className="block text-xs text-muted-foreground">{row.reason}</span>
            )}
            {row.user && (
              <span className="block text-[11px] text-muted-foreground">{row.user.fullName}</span>
            )}
          </>
        );
        return href ? (
          <Link href={href} className="hover:text-primary">
            {content}
          </Link>
        ) : (
          <span>{content}</span>
        );
      },
    },
  ];

  const baseUrl = `/inventory/movements?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.product.stockMovements}
        backHref="/inventory"
        breadcrumbs={[
          { label: t.product.title, href: '/inventory' },
          { label: t.product.stockMovements },
        ]}
      />

      <SearchFilters
        placeholder="ابحث بالمنتج أو رقم المستند"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'type',
            label: t.product.movementType,
            options: STOCK_MOVEMENT_TYPES.map((mt) => ({
              value: mt,
              label: t.product.movementTypes[mt],
            })),
          },
        ]}
      >
        <DateRangeFilter labels={{ from: t.app.from, to: t.app.to }} />
      </SearchFilters>

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
