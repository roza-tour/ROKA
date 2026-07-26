import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Printer, Package, TrendingUp, History, Truck } from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { generateBarcodeDataUrl } from '@/lib/codes';
import { formatMoney, formatNumber, formatDateTime, round } from '@/lib/utils';
import type { ProductType, StockMovementType } from '@/lib/constants';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockAdjuster } from './stock-adjuster';

export const metadata: Metadata = { title: 'منتج' };
export const dynamic = 'force-dynamic';

const MOVEMENT_TONES: Record<string, 'emerald' | 'rose' | 'blue' | 'amber' | 'gray'> = {
  IN: 'emerald',
  RETURN_IN: 'emerald',
  OUT: 'rose',
  RETURN_OUT: 'rose',
  ADJUST: 'blue',
  TRANSFER: 'amber',
  DAMAGE: 'gray',
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('inventory:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      supplier: { select: { id: true, name: true } },
      stockMoves: {
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      },
    },
  });

  if (!product) notFound();

  const [barcodeImage, soldStats] = await Promise.all([
    product.barcode ? generateBarcodeDataUrl(product.barcode, { height: 14 }) : '',
    db.invoiceItem.aggregate({
      where: { productId: id },
      _sum: { quantity: true, total: true },
    }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const margin =
    product.costPrice > 0
      ? round(((product.sellPrice - product.costPrice) / product.costPrice) * 100, 1)
      : 0;
  const isOut = product.quantity <= 0;
  const isLow = product.minQuantity > 0 && product.quantity <= product.minQuantity && !isOut;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="numeric">{product.sku}</span>
            <Badge tone="gray" size="sm">
              {t.product.types[product.type as ProductType] ?? product.type}
            </Badge>
            {product.category && (
              <Badge tone="blue" size="sm">
                {product.category.name}
              </Badge>
            )}
            {!product.isActive && (
              <Badge tone="gray" size="sm">
                معطّل
              </Badge>
            )}
          </span>
        }
        backHref="/inventory"
        breadcrumbs={[{ label: t.product.title, href: '/inventory' }, { label: product.name }]}
        actions={
          <>
            {product.barcode && (
              <Link href={`/inventory/${id}/barcode`} target="_blank">
                <Button variant="outline" icon={<Printer className="h-4 w-4" />}>
                  {t.product.printBarcode}
                </Button>
              </Link>
            )}
            {can(user, 'inventory:update') && (
              <Link href={`/inventory/${id}/edit`}>
                <Button icon={<Pencil className="h-4 w-4" />}>{t.actions.edit}</Button>
              </Link>
            )}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.product.quantity}
          value={formatNumber(product.quantity, locale)}
          icon={Package}
          tone={isOut ? 'danger' : isLow ? 'warning' : 'primary'}
          hint={
            product.minQuantity > 0
              ? `${t.product.minQuantity}: ${formatNumber(product.minQuantity, locale)}`
              : undefined
          }
        />
        <StatCard
          label={t.product.stockValue}
          value={money(round(product.quantity * product.costPrice))}
          icon={TrendingUp}
          tone="default"
        />
        <StatCard
          label={t.product.margin}
          value={`${margin.toFixed(1)}%`}
          icon={TrendingUp}
          tone={margin >= 0 ? 'success' : 'danger'}
          hint={`${money(product.costPrice)} → ${money(product.sellPrice)}`}
        />
        <StatCard
          label="إجمالي المبيعات"
          value={money(soldStats._sum.total ?? 0)}
          icon={TrendingUp}
          tone="info"
          hint={`${formatNumber(soldStats._sum.quantity ?? 0, locale)} وحدة`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title={t.app.details}>
            <dl className="divide-y divide-border">
              <DetailRow label={t.product.sku}>
                <span className="numeric">{product.sku}</span>
              </DetailRow>
              {product.barcode && (
                <DetailRow label={t.product.barcode}>
                  <span className="numeric">{product.barcode}</span>
                </DetailRow>
              )}
              {product.brand && <DetailRow label={t.product.brand}>{product.brand}</DetailRow>}
              {product.model && <DetailRow label={t.product.model}>{product.model}</DetailRow>}
              {product.compatibleWith && (
                <DetailRow label={t.product.compatibleWith}>{product.compatibleWith}</DetailRow>
              )}
              <DetailRow label={t.product.unit}>{product.unit}</DetailRow>
              {product.location && (
                <DetailRow label={t.product.location}>{product.location}</DetailRow>
              )}
              {product.supplier && (
                <DetailRow label={t.product.supplier}>
                  <Link
                    href={`/suppliers/${product.supplier.id}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    {product.supplier.name}
                  </Link>
                </DetailRow>
              )}
              {product.warrantyDays > 0 && (
                <DetailRow label={t.product.warranty}>
                  <span className="numeric">{product.warrantyDays}</span> يوم
                </DetailRow>
              )}
              <DetailRow label={t.product.costPrice}>
                <span className="numeric">{money(product.costPrice)}</span>
              </DetailRow>
              <DetailRow label={t.product.sellPrice}>
                <span className="numeric font-semibold">{money(product.sellPrice)}</span>
              </DetailRow>
              {product.wholesalePrice > 0 && (
                <DetailRow label={t.product.wholesalePrice}>
                  <span className="numeric">{money(product.wholesalePrice)}</span>
                </DetailRow>
              )}
            </dl>

            {product.description && (
              <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {product.description}
              </p>
            )}

            {barcodeImage && (
              <div className="mt-4 flex justify-center rounded-md bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={barcodeImage} alt={product.barcode ?? ''} className="h-16" />
              </div>
            )}
          </Card>

          {can(user, 'inventory:update') && (
            <Card title={t.product.adjustStock}>
              <StockAdjuster
                productId={product.id}
                currentQuantity={product.quantity}
                labels={{
                  type: t.product.movementType,
                  types: t.product.movementTypes,
                  quantity: t.product.quantity,
                  reason: t.product.reason,
                  submit: t.actions.save,
                  current: t.product.quantity,
                }}
              />
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card
            title={
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                {t.product.stockMovements}
              </span>
            }
            bodyClassName="p-0"
          >
            {product.stockMoves.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{t.product.movementType}</th>
                      <th className="text-center">{t.product.quantity}</th>
                      <th className="text-center">{t.product.balanceAfter}</th>
                      <th>{t.product.reason}</th>
                      <th className="text-end">{t.audit.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.stockMoves.map((move) => (
                      <tr key={move.id}>
                        <td>
                          <Badge
                            tone={MOVEMENT_TONES[move.type] ?? 'gray'}
                            size="sm"
                          >
                            {t.product.movementTypes[move.type as StockMovementType] ?? move.type}
                          </Badge>
                        </td>
                        <td className="numeric text-center font-medium">
                          {formatNumber(move.quantity, locale)}
                        </td>
                        <td className="numeric text-center text-muted-foreground">
                          {formatNumber(move.balanceAfter, locale)}
                        </td>
                        <td className="text-xs">
                          {move.refNumber ? (
                            <span>
                              <span className="numeric">{move.refNumber}</span>
                              {move.reason && (
                                <span className="block text-muted-foreground">{move.reason}</span>
                              )}
                            </span>
                          ) : (
                            (move.reason ?? '—')
                          )}
                          {move.user && (
                            <span className="block text-[11px] text-muted-foreground">
                              {move.user.fullName}
                            </span>
                          )}
                        </td>
                        <td className="numeric text-end text-xs text-muted-foreground">
                          {formatDateTime(move.createdAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
