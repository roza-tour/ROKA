import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Wrench,
  CheckCircle2,
  Circle,
  Phone,
  MapPin,
  Mail,
  Smartphone,
  Clock,
} from 'lucide-react';

import { getI18n } from '@/i18n';
import { getShopInfo, getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatDate, formatDateTime, formatMoney, round } from '@/lib/utils';
import { REPAIR_STATUSES, type RepairStatus, type DeviceType } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ThemeScript } from '@/components/theme-script';

export const metadata: Metadata = {
  title: 'تتبع حالة الجهاز',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/** المراحل المعروضة للعميل بالترتيب */
const TIMELINE: RepairStatus[] = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'WAITING_PARTS',
  'REPAIRING',
  'READY',
  'DELIVERED',
];

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { locale, t } = await getI18n();
  const [shop, finance] = await Promise.all([getShopInfo(), getFinanceSettings()]);

  const order = await db.repairOrder.findUnique({
    where: { trackingToken: token },
    select: {
      number: true,
      status: true,
      receivedAt: true,
      promisedAt: true,
      completedAt: true,
      deliveredAt: true,
      estimatedCost: true,
      finalCost: true,
      depositAmount: true,
      warrantyEndsAt: true,
      problemDescription: true,
      customer: { select: { firstName: true } },
      device: { select: { type: true, brand: true, model: true, color: true } },
      history: {
        select: { status: true, createdAt: true, note: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!order) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  // آخر وقت لكل حالة من السجل
  const reachedAt = new Map<string, Date>();
  for (const event of order.history) {
    if (!reachedAt.has(event.status)) reachedAt.set(event.status, event.createdAt);
  }

  const isCancelled = order.status === 'CANCELLED' || order.status === 'UNREPAIRABLE';
  const currentIndex = TIMELINE.indexOf(order.status as RepairStatus);
  const dueAmount = round(order.finalCost - order.depositAmount);

  // نعرض المراحل التي حدثت فعلاً + المراحل المتبقية في المسار الطبيعي
  const visibleStages = TIMELINE.filter(
    (status, index) =>
      reachedAt.has(status) ||
      index <= Math.max(currentIndex, 0) ||
      ['REPAIRING', 'READY', 'DELIVERED'].includes(status),
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <ThemeScript />

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* الترويسة */}
        <header className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Wrench className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.track.subtitle}</p>
        </header>

        {/* بطاقة الأمر */}
        <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground">{t.repair.number}</p>
              <p className="numeric text-xl font-bold">{order.number}</p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t.track.currentStatus}</p>
              <p
                className={cn(
                  'text-lg font-bold',
                  order.status === 'READY'
                    ? 'text-success'
                    : isCancelled
                      ? 'text-danger'
                      : 'text-primary',
                )}
              >
                {t.repair.statuses[order.status as RepairStatus] ?? order.status}
              </p>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Detail label={t.track.device} icon={Smartphone}>
              {order.device.brand} {order.device.model}
              {order.device.color ? ` · ${order.device.color}` : ''}
            </Detail>
            <Detail label={t.device.type}>
              {t.device.types[order.device.type as DeviceType] ?? order.device.type}
            </Detail>
            <Detail label={t.track.receivedOn} icon={Clock}>
              <span className="numeric">{formatDate(order.receivedAt, locale)}</span>
            </Detail>
            <Detail label={t.track.expectedOn}>
              <span className="numeric">
                {order.promisedAt ? formatDate(order.promisedAt, locale) : '—'}
              </span>
            </Detail>
          </dl>

          {order.status === 'READY' && dueAmount > 0 && (
            <div className="mt-4 rounded-lg bg-success/10 p-3 text-center">
              <p className="text-sm font-medium text-success">
                جهازك جاهز للاستلام
              </p>
              <p className="numeric mt-1 text-lg font-bold text-success">
                {money(Math.max(0, dueAmount))}
              </p>
              <p className="text-xs text-muted-foreground">{t.repair.remaining}</p>
            </div>
          )}

          {order.status === 'WAITING_APPROVAL' && order.estimatedCost > 0 && (
            <div className="mt-4 rounded-lg bg-warning/10 p-3 text-center">
              <p className="text-sm font-medium text-warning">
                بانتظار موافقتك على الإصلاح
              </p>
              <p className="numeric mt-1 text-lg font-bold">{money(order.estimatedCost)}</p>
              <p className="text-xs text-muted-foreground">{t.track.estimatedCost}</p>
            </div>
          )}

          {order.status === 'DELIVERED' && order.warrantyEndsAt && (
            <div className="mt-4 rounded-lg bg-info/10 p-3 text-center text-sm">
              <span className="text-muted-foreground">{t.repair.warrantyEnds}: </span>
              <span className="numeric font-medium">
                {formatDate(order.warrantyEndsAt, locale)}
              </span>
            </div>
          )}
        </div>

        {/* المراحل */}
        <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold">{t.track.timeline}</h2>

          {isCancelled ? (
            <p className="rounded-lg bg-danger/10 p-4 text-center text-sm text-danger">
              {t.repair.statuses[order.status as RepairStatus]}
            </p>
          ) : (
            <ol className="relative space-y-0">
              {visibleStages.map((status, index) => {
                const reached = reachedAt.get(status);
                const isCurrent = order.status === status;
                const isDone = Boolean(reached) && !isCurrent;
                const isLast = index === visibleStages.length - 1;

                return (
                  <li key={status} className="relative flex gap-3 pb-6 last:pb-0">
                    {!isLast && (
                      <span
                        className={cn(
                          'absolute top-6 h-full w-0.5 start-[11px]',
                          reached ? 'bg-primary' : 'bg-border',
                        )}
                        aria-hidden
                      />
                    )}

                    <span className="relative z-10 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                      ) : isCurrent ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                        </span>
                      ) : (
                        <Circle className="h-6 w-6 text-border" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <p
                        className={cn(
                          'text-sm',
                          isCurrent
                            ? 'font-bold text-primary'
                            : reached
                              ? 'font-medium'
                              : 'text-muted-foreground',
                        )}
                      >
                        {t.repair.statuses[status]}
                      </p>
                      {reached && (
                        <p className="numeric mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(reached, locale)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* بيانات التواصل */}
        <div className="rounded-xl border border-border bg-card p-5 text-center shadow-soft">
          <p className="mb-3 text-sm font-medium">{t.track.contactShop}</p>
          <div className="flex flex-col items-center gap-2 text-sm">
            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="numeric inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Phone className="h-4 w-4" />
                {shop.phone}
              </a>
            )}
            {shop.email && (
              <a
                href={`mailto:${shop.email}`}
                className="inline-flex items-center gap-2 text-primary hover:underline"
                dir="ltr"
              >
                <Mail className="h-4 w-4" />
                {shop.email}
              </a>
            )}
            {shop.address && (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {shop.address}
              </span>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {shop.name}
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}
