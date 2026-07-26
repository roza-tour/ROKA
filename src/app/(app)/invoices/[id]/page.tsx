import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Printer,
  User,
  Wrench,
  Wallet,
  ShieldCheck,
  Send,
  Ban,
  CalendarRange,
} from 'lucide-react';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatDate, formatDateTime, fullName } from '@/lib/utils';
import type { InvoiceType, PaymentMethod } from '@/lib/constants';

import { PageHeader, Card, DetailRow } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvoiceStatusBadge, StatusBadge } from '@/components/repair-status-badge';
import { InvoiceActions } from './invoice-actions';

export const metadata: Metadata = { title: 'فاتورة' };
export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('invoices:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { fullName: true } },
      repairOrder: { select: { id: true, number: true } },
      coupon: { select: { code: true } },
      items: true,
      payments: {
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
      warranties: {
        select: { id: true, number: true, itemName: true, endsAt: true, status: true },
      },
      installments: {
        include: { installments: { orderBy: { sequence: 'asc' } } },
      },
    },
  });

  if (!invoice) notFound();

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const isCancelled = invoice.status === 'CANCELLED';
  const plan = invoice.installments[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="numeric">{invoice.number}</span>
            <InvoiceStatusBadge status={invoice.status} labels={t.invoice.statuses} size="md" />
            <Badge tone="gray" size="sm">
              {t.invoice.types[invoice.type as InvoiceType] ?? invoice.type}
            </Badge>
          </span>
        }
        description={
          invoice.customer
            ? fullName(invoice.customer.firstName, invoice.customer.lastName)
            : t.invoice.walkIn
        }
        backHref="/invoices"
        breadcrumbs={[{ label: t.invoice.title, href: '/invoices' }, { label: invoice.number }]}
        actions={
          <>
            <Link href={`/invoices/${invoice.id}/print`} target="_blank">
              <Button variant="outline" icon={<Printer className="h-4 w-4" />}>
                {t.invoice.print}
              </Button>
            </Link>
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              total={invoice.total}
              dueAmount={invoice.dueAmount}
              hasCustomer={Boolean(invoice.customerId)}
              hasPlan={Boolean(plan)}
              canPay={can(user, 'payments:create')}
              canCancel={can(user, 'invoices:delete')}
              canNotify={can(user, 'notifications:create')}
              currency={finance.currency}
              decimals={finance.decimals}
              locale={locale}
              labels={{
                addPayment: t.payment.new,
                amount: t.payment.amount,
                method: t.payment.method,
                methods: t.payment.methods,
                reference: t.payment.reference,
                notes: t.payment.notes,
                submit: t.actions.submit,
                cancel: t.actions.cancel,
                due: t.invoice.due,
                cancelInvoice: t.invoice.cancelled,
                cancelReason: t.product.reason,
                cancelWarning:
                  'سيتم إرجاع المنتجات للمخزون وعكس الأثر المالي على العميل. لا يمكن التراجع.',
                notify: t.actions.send,
                channel: t.notification.channel,
                channels: t.notification.channels,
                installments: t.nav.installments,
                months: 'عدد الأشهر',
                downPayment: t.repair.deposit,
                startDate: t.app.from,
                createPlan: t.actions.create,
              }}
            />
          </>
        }
      />

      {isCancelled && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <Ban className="h-4 w-4 shrink-0" />
          <span>{t.invoice.statuses.CANCELLED}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t.invoice.customer}
              </span>
            }
            actions={
              invoice.customer && (
                <Link
                  href={`/customers/${invoice.customer.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  {t.actions.view}
                </Link>
              )
            }
          >
            {invoice.customer ? (
              <dl className="divide-y divide-border">
                <DetailRow label={t.customer.fullName}>
                  {fullName(invoice.customer.firstName, invoice.customer.lastName)}
                </DetailRow>
                <DetailRow label={t.customer.phone}>
                  <span className="numeric">{invoice.customer.phone}</span>
                </DetailRow>
                {invoice.customer.address && (
                  <DetailRow label={t.customer.address}>{invoice.customer.address}</DetailRow>
                )}
                {invoice.customer.taxNumber && (
                  <DetailRow label={t.customer.taxNumber}>
                    <span className="numeric">{invoice.customer.taxNumber}</span>
                  </DetailRow>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t.invoice.walkIn}</p>
            )}
          </Card>

          <Card title={t.app.details}>
            <dl className="divide-y divide-border">
              <DetailRow label={t.invoice.issuedAt}>
                <span className="numeric">{formatDateTime(invoice.issuedAt, locale)}</span>
              </DetailRow>
              {invoice.dueDate && (
                <DetailRow label={t.invoice.dueDate}>
                  <span className="numeric">{formatDate(invoice.dueDate, locale)}</span>
                </DetailRow>
              )}
              {invoice.user && <DetailRow label={t.audit.user}>{invoice.user.fullName}</DetailRow>}
              {invoice.repairOrder && (
                <DetailRow label={t.repair.single}>
                  <Link
                    href={`/repairs/${invoice.repairOrder.id}`}
                    className="numeric inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    {invoice.repairOrder.number}
                  </Link>
                </DetailRow>
              )}
              {invoice.coupon && (
                <DetailRow label={t.invoice.coupon}>
                  <span className="numeric">{invoice.coupon.code}</span>
                </DetailRow>
              )}
              {invoice.warrantyEndsAt && (
                <DetailRow label={t.repair.warrantyEnds}>
                  <span className="numeric">{formatDate(invoice.warrantyEndsAt, locale)}</span>
                </DetailRow>
              )}
            </dl>

            {invoice.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {invoice.notes}
              </p>
            )}
          </Card>

          {invoice.warranties.length > 0 && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t.warranty.title}
                </span>
              }
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-border">
                {invoice.warranties.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{w.itemName}</span>
                      <span className="numeric block text-xs text-muted-foreground">
                        {formatDate(w.endsAt, locale)}
                      </span>
                    </span>
                    <StatusBadge status={w.status} labels={t.warranty.statuses} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* البنود */}
          <Card title={t.invoice.items} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{t.invoice.item}</th>
                    <th className="w-20 text-center">{t.invoice.quantity}</th>
                    <th className="w-28 text-end">{t.invoice.unitPrice}</th>
                    <th className="w-24 text-end">{t.invoice.discount}</th>
                    <th className="w-28 text-end">{t.app.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="block text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="numeric text-center">{item.quantity}</td>
                      <td className="numeric text-end">{money(item.unitPrice)}</td>
                      <td className="numeric text-end">
                        {item.discount ? money(item.discount) : '—'}
                      </td>
                      <td className="numeric text-end font-medium">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border p-4">
              <dl className="ms-auto max-w-xs space-y-1.5">
                <SummaryRow label={t.app.subtotal} value={money(invoice.subtotal)} />
                {invoice.discountAmount > 0 && (
                  <SummaryRow
                    label={t.invoice.discount}
                    value={`− ${money(invoice.discountAmount)}`}
                  />
                )}
                {invoice.taxAmount > 0 && (
                  <SummaryRow
                    label={`${t.invoice.tax} (${invoice.taxRate}%)`}
                    value={money(invoice.taxAmount)}
                  />
                )}
                <div className="border-t border-border pt-1.5">
                  <SummaryRow label={t.app.total} value={money(invoice.total)} strong />
                </div>
                <SummaryRow label={t.invoice.paid} value={money(invoice.paidAmount)} />
                <SummaryRow
                  label={t.invoice.due}
                  value={money(invoice.dueAmount)}
                  tone={invoice.dueAmount > 0 ? 'danger' : 'success'}
                  strong
                />
                {can(user, 'reports:view') && (
                  <div className="border-t border-border pt-1.5">
                    <SummaryRow
                      label={t.invoice.profit}
                      value={money(invoice.profit)}
                      tone={invoice.profit >= 0 ? 'success' : 'danger'}
                    />
                  </div>
                )}
              </dl>
            </div>
          </Card>

          {/* المدفوعات */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {t.payment.title}
              </span>
            }
            bodyClassName="p-0"
          >
            {invoice.payments.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.app.noData}</p>
            ) : (
              <ul className="divide-y divide-border">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {t.payment.methods[payment.method as PaymentMethod] ?? payment.method}
                        {payment.reference && (
                          <span className="numeric ms-2 text-xs text-muted-foreground">
                            {payment.reference}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.user?.fullName ?? '—'}
                        {payment.notes ? ` · ${payment.notes}` : ''}
                      </p>
                    </div>
                    <span className="numeric shrink-0 font-semibold text-success">
                      {money(payment.amount)}
                    </span>
                    <span className="numeric hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {formatDateTime(payment.createdAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* الأقساط */}
          {plan && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  {t.nav.installments} · <span className="numeric">{plan.number}</span>
                </span>
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="w-16 text-center">#</th>
                      <th>{t.invoice.dueDate}</th>
                      <th className="text-end">{t.payment.amount}</th>
                      <th className="text-center">{t.invoice.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.installments.map((inst) => (
                      <tr key={inst.id}>
                        <td className="numeric text-center">{inst.sequence}</td>
                        <td className="numeric">{formatDate(inst.dueDate, locale)}</td>
                        <td className="numeric text-end font-medium">{money(inst.amount)}</td>
                        <td className="text-center">
                          <StatusBadge
                            status={
                              inst.status === 'PENDING' && inst.dueDate < new Date()
                                ? 'OVERDUE'
                                : inst.status
                            }
                            labels={{
                              PENDING: 'مستحق',
                              PAID: 'مسدّد',
                              OVERDUE: 'متأخر',
                              WAIVED: 'معفى',
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-medium' : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd
        className={`numeric ${strong ? 'text-base font-bold' : 'text-sm'} ${
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
