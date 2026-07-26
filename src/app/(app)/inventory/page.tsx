import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, AlertTriangle, PackageX, Boxes, TrendingUp, ScanBarcode } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { getStockSummary } from '@/lib/analytics';
import { formatMoney, formatNumber, normalizeDigits, round } from '@/lib/utils';
import { PRODUCT_TYPES, type ProductType } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Pagination, type Column } from '@/components/ui/data-table';
import { SearchFilters } from '@/components/ui/search-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'المخزون' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  type: string;
  brand: string | null;
  quantity: number;
  minQuantity: number;
  costPrice: number;
  sellPrice: number;
  location: string | null;
  isActive: boolean;
  category: { name: string } | null;
  supplier: { name: string } | null;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('inventory:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? normalizeDigits(params.q.trim()) : '';
  const type = typeof params.type === 'string' ? params.type : '';
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : '';
  const supplierId = typeof params.supplierId === 'string' ? params.supplierId : '';
  const stock = typeof params.stock === 'string' ? params.stock : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(stock === 'inactive' ? { isActive: false } : { isActive: true }),
    ...(type ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(stock === 'out' ? { quantity: { lte: 0 } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { barcode: { contains: q } },
            { brand: { contains: q } },
            { model: { contains: q } },
            { compatibleWith: { contains: q } },
          ],
        }
      : {}),
  };

  // «مخزون منخفض» يحتاج مقارنة بين عمودين — يتعذّر تمثيلها في Prisma where
  const lowStockIds =
    stock === 'low'
      ? (
          await db.$queryRaw<{ id: string }[]>`
            SELECT id FROM Product
            WHERE isActive = 1 AND minQuantity > 0 AND quantity <= minQuantity
          `
        ).map((r) => r.id)
      : null;

  const finalWhere: Prisma.ProductWhereInput = lowStockIds
    ? { ...where, id: { in: lowStockIds } }
    : where;

  const [rows, total, summary, categories, suppliers] = await Promise.all([
    db.product.findMany({
      where: finalWhere,
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        type: true,
        brand: true,
        quantity: true,
        minQuantity: true,
        costPrice: true,
        sellPrice: true,
        location: true,
        isActive: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where: finalWhere }),
    getStockSummary(),
    db.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: t.product.name,
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="numeric text-xs text-muted-foreground">
            {row.sku}
            {row.brand ? ` · ${row.brand}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t.product.type,
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm">
          {t.product.types[row.type as ProductType] ?? row.type}
          {row.category && (
            <span className="block text-xs text-muted-foreground">{row.category.name}</span>
          )}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t.product.quantity,
      align: 'center',
      render: (row) => {
        const isOut = row.quantity <= 0;
        const isLow = row.minQuantity > 0 && row.quantity <= row.minQuantity && !isOut;
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={`numeric font-semibold ${
                isOut ? 'text-danger' : isLow ? 'text-warning' : ''
              }`}
            >
              {formatNumber(row.quantity, locale)}
            </span>
            {isOut ? (
              <Badge tone="red" size="sm">
                {t.product.outOfStock}
              </Badge>
            ) : isLow ? (
              <Badge tone="amber" size="sm">
                {t.product.lowStock}
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'cost',
      header: t.product.costPrice,
      align: 'end',
      hideOnMobile: true,
      render: (row) => <span className="numeric">{money(row.costPrice)}</span>,
    },
    {
      key: 'price',
      header: t.product.sellPrice,
      align: 'end',
      render: (row) => (
        <div>
          <p className="numeric font-medium">{money(row.sellPrice)}</p>
          {row.costPrice > 0 && (
            <p className="numeric text-[11px] text-muted-foreground">
              {round(((row.sellPrice - row.costPrice) / row.costPrice) * 100, 0)}%
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      header: t.product.stockValue,
      align: 'end',
      hideOnMobile: true,
      render: (row) => (
        <span className="numeric">{money(round(row.quantity * row.costPrice))}</span>
      ),
    },
    {
      key: 'location',
      header: t.product.location,
      hideOnMobile: true,
      render: (row) => row.location ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  const baseUrl = `/inventory?${new URLSearchParams(
    Object.entries(params)
      .filter(([k, v]) => k !== 'page' && typeof v === 'string')
      .map(([k, v]) => [k, v as string]),
  ).toString()}`;

  return (
    <div>
      <PageHeader
        title={t.product.title}
        actions={
          <>
            {can(user, 'inventory:view') && (
              <Link href="/inventory/movements">
                <Button variant="outline" icon={<ScanBarcode className="h-4 w-4" />}>
                  {t.product.stockMovements}
                </Button>
              </Link>
            )}
            {can(user, 'inventory:create') && (
              <Link href="/inventory/new">
                <Button icon={<Plus className="h-4 w-4" />}>{t.product.new}</Button>
              </Link>
            )}
          </>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.product.stockValue}
          value={money(summary.totalValue)}
          icon={Boxes}
          tone="primary"
          hint={`${formatNumber(summary.itemCount, locale)} صنف`}
        />
        <StatCard
          label="القيمة البيعية"
          value={money(summary.retailValue)}
          icon={TrendingUp}
          tone="success"
          hint={`ربح متوقع ${money(summary.retailValue - summary.totalValue)}`}
        />
        <StatCard
          label={t.product.lowStock}
          value={formatNumber(summary.lowStockCount, locale)}
          icon={AlertTriangle}
          tone={summary.lowStockCount > 0 ? 'warning' : 'default'}
          href="/inventory?stock=low"
        />
        <StatCard
          label={t.product.outOfStock}
          value={formatNumber(summary.outOfStockCount, locale)}
          icon={PackageX}
          tone={summary.outOfStockCount > 0 ? 'danger' : 'default'}
          href="/inventory?stock=out"
        />
      </section>

      <SearchFilters
        placeholder="ابحث بالاسم، SKU، الباركود، الماركة أو الموديل المتوافق"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'type',
            label: t.product.type,
            options: PRODUCT_TYPES.map((pt) => ({ value: pt, label: t.product.types[pt] })),
          },
          {
            name: 'categoryId',
            label: t.product.category,
            options: categories.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: 'supplierId',
            label: t.product.supplier,
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
          },
          {
            name: 'stock',
            label: t.product.quantity,
            options: [
              { value: 'low', label: t.product.lowStock },
              { value: 'out', label: t.product.outOfStock },
              { value: 'inactive', label: 'معطّل' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/inventory/${r.id}`}
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
