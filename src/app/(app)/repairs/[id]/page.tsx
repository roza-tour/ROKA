import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Printer,
  Receipt,
  Phone,
  User,
  Smartphone,
  Package,
  ClipboardCheck,
  History,
  QrCode,
  Copy,
  Eye,
  Wrench,
} from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { generateQrDataUrl, trackingUrl } from '@/lib/codes';
import {
  formatMoney,
  formatDate,
  formatDateTime,
  fullName,
  safeJsonParse,
  daysUntil,
  round,
} from '@/lib/utils';
import {
  ACCESSORY_ITEMS,
  ACTIVE_REPAIR_STATUSES,
  type DeviceType,
  type RepairPriority,
} from '@/lib/constants';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RepairStatusBadge } from '@/components/repair-status-badge';
import { ConditionReportView } from '@/components/condition-report';
import { DamageMarkerView } from './damage-view';
import { StatusChanger } from './status-changer';
import { RepairItemsEditor } from './items-editor';
import { RepairEditForm } from './edit-form';
import { CopyButton } from '@/components/copy-button';
import type { DamageMark } from '@/components/damage-marker';

export const metadata: Metadata = { title: 'أمر صيانة' };
export const dynamic = 'force-dynamic';

const PRIORITY_TONES = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'amber',
  URGENT: 'red',
} as const;

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('repairs:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;

  const order = await db.repairOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      device: true,
      technician: { select: { id: true, fullName: true } },
      receivedBy: { select: { fullName: true } },
      items: { orderBy: { createdAt: 'asc' } },
      history: {
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        select: { id: true, number: true, total: true, status: true, dueAmount: true },
      },
    },
  });

  if (!order) notFound();

  const [technicians, services, products, qrDataUrl] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { in: ['TECHNICIAN', 'MANAGER', 'ADMIN'] } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    can(user, 'repairs:update')
      ? db.service.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true, price: true, cost: true },
          orderBy: { name: 'asc' },
        })
      : [],
    can(user, 'repairs:update')
      ? db.product.findMany({
          where: { isActive: true, type: { in: ['PART', 'ACCESSORY', 'CONSUMABLE'] } },
          select: { id: true, sku: true, name: true, sellPrice: true, costPrice: true, quantity: true },
          orderBy: { name: 'asc' },
          take: 800,
        })
      : [],
    generateQrDataUrl(trackingUrl(order.trackingToken), { size: 160 }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const accessories = safeJsonParse<Record<string, boolean | string>>(order.accessories, {});
  const conditionReport = safeJsonParse<Record<string, string>>(order.conditionReport, {});
  const damageMarks = safeJsonParse<DamageMark[]>(order.damageMarks, []);
  const photos = safeJsonParse<string[]>(order.photos, []);
  const passcode = order.device.passcodeEnc ? decrypt(order.device.passcodeEnc) : '';

  const receivedAccessories = ACCESSORY_ITEMS.filter((a) => accessories[a.key] === true);
  const customAccessory =
    typeof accessories.custom === 'string' ? accessories.custom : '';

  const dueAmount = round(order.finalCost - order.depositAmount);
  const isActive = (ACTIVE_REPAIR_STATUSES as string[]).includes(order.status);
  const overdueDays = order.promisedAt ? daysUntil(order.promisedAt) : null;
  const isOverdue = isActive && overdueDays !== null && overdueDays < 0;

  const customerName = fullName(order.customer.firstName, order.customer.lastName);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="numeric">{order.number}</span>
            <RepairStatusBadge status={order.status} labels={t.repair.statuses} size="md" />
            {order.priority !== 'NORMAL' && (
              <Badge tone={PRIORITY_TONES[order.priority as RepairPriority] ?? 'gray'}>
                {t.repair.priorities[order.priority as RepairPriority]}
              </Badge>
            )}
            {isOverdue && (
              <Badge tone="red" dot>
                {t.repair.overdue} ({Math.abs(overdueDays!)} يوم)
              </Badge>
            )}
          </span>
        }
        description={`${order.device.brand} ${order.device.model} · ${customerName}`}
        backHref="/repairs"
        breadcrumbs={[{ label: t.repair.title, href: '/repairs' }, { label: order.number }]}
        actions={
          <>
            <Link href={`/repairs/${order.id}/receipt`} target="_blank">
              <Button variant="outline" icon={<Printer className="h-4 w-4" />}>
                {t.repair.printReceipt}
              </Button>
            </Link>
            {can(user, 'invoices:create') && order.invoices.length === 0 && (
              <Link href={`/invoices/new?repairId=${order.id}`}>
                <Button icon={<Receipt className="h-4 w-4" />}>{t.repair.createInvoice}</Button>
              </Link>
            )}
            {order.invoices.length > 0 && (
              <Link href={`/invoices/${order.invoices[0].id}`}>
                <Button variant="outline" icon={<Receipt className="h-4 w-4" />}>
                  {order.invoices[0].number}
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------ العمود الجانبي */}
        <div className="space-y-6">
          {/* تغيير الحالة */}
          {can(user, 'repairs:update') && (
            <Card title={t.repair.changeStatus}>
              <StatusChanger
                repairId={order.id}
                currentStatus={order.status}
                customerPhone={order.customer.phone}
                customerEmail={order.customer.email}
                labels={{
                  statuses: t.repair.statuses,
                  note: t.repair.statusNote,
                  notify: t.repair.notifyCustomer,
                  channel: t.notification.channel,
                  channels: t.notification.channels,
                  confirm: t.actions.submit,
                  cancel: t.actions.cancel,
                  noTransitions: 'لا توجد حالات تالية متاحة',
                }}
              />
            </Card>
          )}

          {/* العميل */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t.repair.customer}
              </span>
            }
            actions={
              <Link
                href={`/customers/${order.customer.id}`}
                className="text-xs text-primary hover:underline"
              >
                {t.actions.view}
              </Link>
            }
          >
            <dl className="divide-y divide-border">
              <DetailRow label={t.customer.fullName}>{customerName}</DetailRow>
              <DetailRow label={t.customer.phone}>
                <a href={`tel:${order.customer.phone}`} className="numeric inline-flex items-center gap-1.5 hover:text-primary">
                  <Phone className="h-3.5 w-3.5" />
                  {order.customer.phone}
                </a>
              </DetailRow>
              {order.customer.email && (
                <DetailRow label={t.customer.email}>
                  <span dir="ltr">{order.customer.email}</span>
                </DetailRow>
              )}
              <DetailRow label={t.customer.code}>
                <span className="numeric">{order.customer.code}</span>
              </DetailRow>
            </dl>
          </Card>

          {/* الجهاز */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                {t.repair.device}
              </span>
            }
          >
            <dl className="divide-y divide-border">
              <DetailRow label={t.device.type}>
                {t.device.types[order.device.type as DeviceType] ?? order.device.type}
              </DetailRow>
              <DetailRow label={t.device.brand}>{order.device.brand}</DetailRow>
              <DetailRow label={t.device.model}>{order.device.model}</DetailRow>
              {order.device.color && (
                <DetailRow label={t.device.color}>{order.device.color}</DetailRow>
              )}
              {order.device.imei && (
                <DetailRow label={t.device.imei}>
                  <span className="numeric">{order.device.imei}</span>
                </DetailRow>
              )}
              {order.device.serialNumber && (
                <DetailRow label={t.device.serialNumber}>
                  <span className="numeric">{order.device.serialNumber}</span>
                </DetailRow>
              )}
              {passcode && can(user, 'repairs:update') && (
                <DetailRow label={t.device.passcode}>
                  <span className="numeric rounded bg-warning/15 px-2 py-0.5 font-mono text-warning">
                    {passcode}
                  </span>
                </DetailRow>
              )}
            </dl>
          </Card>

          {/* التتبع */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                {t.repair.tracking}
              </span>
            }
          >
            <div className="flex flex-col items-center gap-3">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR"
                  className="h-36 w-36 rounded-md border border-border bg-white p-1"
                />
              )}
              <p className="text-center text-xs text-muted-foreground">
                {t.repair.trackingHint}
              </p>
              <CopyButton
                value={trackingUrl(order.trackingToken)}
                label={t.repair.trackingLink}
                copiedLabel={t.app.copied}
              />
              <Link
                href={`/track/${order.trackingToken}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                {t.actions.view}
              </Link>
            </div>
          </Card>

          {/* الملحقات */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t.repair.accessories}
              </span>
            }
          >
            {receivedAccessories.length === 0 && !customAccessory ? (
              <p className="text-sm text-muted-foreground">{t.app.none}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {receivedAccessories.map((a) => (
                  <Badge key={a.key} tone="blue" size="sm">
                    {locale === 'fr' ? a.labelFr : locale === 'en' ? a.labelEn : a.label}
                  </Badge>
                ))}
                {customAccessory && (
                  <Badge tone="violet" size="sm">
                    {customAccessory}
                  </Badge>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* --------------------------------------------------- العمود الرئيسي */}
        <div className="space-y-6 lg:col-span-2">
          {/* الملخص المالي */}
          <Card title={t.app.summary}>
            <div className="grid gap-4 sm:grid-cols-4">
              <SummaryTile label={t.repair.estimatedCost} value={money(order.estimatedCost)} />
              <SummaryTile label={t.repair.finalCost} value={money(order.finalCost)} strong />
              <SummaryTile label={t.repair.deposit} value={money(order.depositAmount)} />
              <SummaryTile
                label={t.repair.remaining}
                value={money(Math.max(0, dueAmount))}
                tone={dueAmount > 0 ? 'danger' : 'success'}
                strong
              />
            </div>

            <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
              <DetailRow label={t.repair.receivedAt}>
                <span className="numeric">{formatDateTime(order.receivedAt, locale)}</span>
              </DetailRow>
              <DetailRow label={t.repair.promisedAt}>
                <span className={`numeric ${isOverdue ? 'text-danger' : ''}`}>
                  {order.promisedAt ? formatDate(order.promisedAt, locale) : '—'}
                </span>
              </DetailRow>
              <DetailRow label={t.repair.receivedBy}>
                {order.receivedBy?.fullName ?? '—'}
              </DetailRow>
              <DetailRow label={t.repair.technician}>
                {order.technician?.fullName ?? '—'}
              </DetailRow>
              {order.completedAt && (
                <DetailRow label={t.repair.completedAt}>
                  <span className="numeric">{formatDate(order.completedAt, locale)}</span>
                </DetailRow>
              )}
              {order.deliveredAt && (
                <DetailRow label={t.repair.deliveredAt}>
                  <span className="numeric">{formatDate(order.deliveredAt, locale)}</span>
                </DetailRow>
              )}
              <DetailRow label={t.repair.warrantyDays}>
                <span className="numeric">{order.warrantyDays}</span>
              </DetailRow>
              {order.warrantyEndsAt && (
                <DetailRow label={t.repair.warrantyEnds}>
                  <span className="numeric">{formatDate(order.warrantyEndsAt, locale)}</span>
                </DetailRow>
              )}
            </dl>
          </Card>

          {/* العطل والتشخيص */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                {t.repair.problem}
              </span>
            }
          >
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t.repair.problem}
                </p>
                <p className="whitespace-pre-wrap text-sm">{order.problemDescription}</p>
                {order.faultCategory && (
                  <Badge tone="amber" size="sm" className="mt-2">
                    {order.faultCategory}
                  </Badge>
                )}
              </div>

              {can(user, 'repairs:update') ? (
                <RepairEditForm
                  order={{
                    id: order.id,
                    technicianId: order.technicianId,
                    priority: order.priority,
                    diagnosis: order.diagnosis,
                    workDone: order.workDone,
                    internalNotes: order.internalNotes,
                    faultCategory: order.faultCategory,
                    estimatedCost: order.estimatedCost,
                    warrantyDays: order.warrantyDays,
                    promisedAt: order.promisedAt,
                  }}
                  technicians={technicians.map((tech) => ({ id: tech.id, name: tech.fullName }))}
                  labels={{
                    edit: t.actions.edit,
                    diagnosis: t.repair.diagnosis,
                    workDone: t.repair.workDone,
                    internalNotes: t.repair.internalNotes,
                    faultCategory: t.repair.faultCategory,
                    technician: t.repair.technician,
                    priority: t.repair.priority,
                    priorities: t.repair.priorities,
                    estimatedCost: t.repair.estimatedCost,
                    warrantyDays: t.repair.warrantyDays,
                    promisedAt: t.repair.promisedAt,
                    save: t.actions.save,
                    cancel: t.actions.cancel,
                    unassigned: t.app.none,
                  }}
                />
              ) : (
                <>
                  {order.diagnosis && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {t.repair.diagnosis}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{order.diagnosis}</p>
                    </div>
                  )}
                  {order.workDone && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {t.repair.workDone}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{order.workDone}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* البنود */}
          <Card
            title={t.repair.servicesAndParts}
            bodyClassName={order.items.length ? 'p-0' : undefined}
          >
            <RepairItemsEditor
              repairId={order.id}
              items={order.items.map((item) => ({
                id: item.id,
                kind: item.kind,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                total: item.total,
              }))}
              services={services}
              products={products}
              canEdit={
                can(user, 'repairs:update') &&
                !['DELIVERED', 'CANCELLED'].includes(order.status)
              }
              currency={finance.currency}
              decimals={finance.decimals}
              locale={locale}
              labels={{
                addService: t.repair.addService,
                addPart: t.repair.addPart,
                item: t.invoice.item,
                quantity: t.invoice.quantity,
                unitPrice: t.invoice.unitPrice,
                discount: t.invoice.discount,
                total: t.app.total,
                remove: t.actions.delete,
                empty: t.app.noData,
                search: t.app.searchPlaceholder,
                stock: t.product.quantity,
                service: t.service.single,
                part: 'قطعة',
                noResults: t.app.noResults,
              }}
            />
          </Card>

          {/* تقرير الحالة */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                {t.repair.conditionReport}
              </span>
            }
          >
            <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
              <ConditionReportView
                deviceType={order.device.type as DeviceType}
                values={conditionReport}
                locale={locale}
                labels={t.repair.conditions}
              />
              {damageMarks.length > 0 && (
                <DamageMarkerView
                  deviceType={order.device.type as DeviceType}
                  marks={damageMarks}
                  label={t.repair.damageMarks}
                />
              )}
            </div>

            {photos.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t.repair.photos}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="aspect-square w-full rounded-md border border-border object-cover transition-opacity hover:opacity-80"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(order.customerSignature || order.employeeSignature) && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {order.customerSignature && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t.repair.customerSignature}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.customerSignature}
                      alt={t.repair.customerSignature}
                      className="h-24 w-full rounded-md border border-border bg-white object-contain"
                    />
                  </div>
                )}
                {order.employeeSignature && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t.repair.employeeSignature}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.employeeSignature}
                      alt={t.repair.employeeSignature}
                      className="h-24 w-full rounded-md border border-border bg-white object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* السجل */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                {t.track.timeline}
              </span>
            }
            bodyClassName="p-0"
          >
            <ol className="divide-y divide-border">
              {order.history.map((event) => (
                <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {t.repair.statuses[event.status as keyof typeof t.repair.statuses] ??
                        event.status}
                    </p>
                    {event.note && (
                      <p className="text-xs text-muted-foreground">{event.note}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {event.user?.fullName ?? '—'}
                      {event.notifiedAt && ' · تم إشعار العميل'}
                    </p>
                  </div>
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt, locale)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
  strong?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`numeric mt-1 ${strong ? 'text-lg font-bold' : 'text-base font-medium'} ${
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
