import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import { getI18n, type Dictionary, type Locale } from '@/i18n';
import { getFinanceSettings, getShopInfo, getSettings, type ShopInfo } from '@/lib/settings';
import { db } from '@/lib/db';
import { generateQrDataUrl, generateBarcodeDataUrl, trackingUrl } from '@/lib/codes';
import {
  formatMoney,
  formatDate,
  formatDateTime,
  fullName,
  safeJsonParse,
  round,
} from '@/lib/utils';
import { ACCESSORY_ITEMS, CONDITION_CHECKS, PHYSICAL_FLAGS, type DeviceType } from '@/lib/constants';
import { PrintTrigger } from '@/components/print-trigger';
import type { DamageMark } from '@/components/damage-marker';

export const metadata: Metadata = { title: 'وصل استلام' };
export const dynamic = 'force-dynamic';

const MARK_COLORS: Record<string, string> = {
  scratch: '#f59e0b',
  crack: '#ef4444',
  dent: '#8b5cf6',
  missing: '#6b7280',
  water: '#06b6d4',
};

const MARK_LABELS: Record<string, string> = {
  scratch: 'خدش',
  crack: 'كسر',
  dent: 'انبعاج',
  missing: 'جزء ناقص',
  water: 'أثر ماء',
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pagePermission('repairs:view');
  const { locale, t } = await getI18n();
  const [finance, shop, settings] = await Promise.all([
    getFinanceSettings(),
    getShopInfo(),
    getSettings(),
  ]);
  const { id } = await params;

  const order = await db.repairOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      device: true,
      receivedBy: { select: { fullName: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!order) notFound();

  const [qr, barcode] = await Promise.all([
    generateQrDataUrl(trackingUrl(order.trackingToken), { size: 150 }),
    generateBarcodeDataUrl(order.number, { height: 10, scale: 2 }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  const accessories = safeJsonParse<Record<string, boolean | string>>(order.accessories, {});
  const conditionReport = safeJsonParse<Record<string, string>>(order.conditionReport, {});
  const damageMarks = safeJsonParse<DamageMark[]>(order.damageMarks, []);

  const receivedAccessories = ACCESSORY_ITEMS.filter((a) => accessories[a.key] === true).map(
    (a) => a.label,
  );
  if (typeof accessories.custom === 'string' && accessories.custom) {
    receivedAccessories.push(accessories.custom);
  }

  const deviceType = order.device.type as DeviceType;
  const reportedChecks = CONDITION_CHECKS.filter(
    (c) =>
      (c.devices === 'ALL' || (c.devices as DeviceType[]).includes(deviceType)) &&
      conditionReport[c.key] &&
      conditionReport[c.key] !== 'UNTESTED',
  );
  const physicalFlags = PHYSICAL_FLAGS.filter((f) => conditionReport[f.key] === 'YES');

  const terms = order.warrantyTerms || settings['repair.terms'] || '';
  const dueAmount = round(order.finalCost - order.depositAmount);

  const data = {
    order,
    shop,
    qr,
    barcode,
    money,
    locale,
    t,
    receivedAccessories,
    reportedChecks,
    physicalFlags,
    conditionReport,
    damageMarks,
    terms,
    dueAmount,
  };

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black">
      <PrintTrigger label={t.repair.printReceipt} backLabel={t.app.back} />

      {/* نسخة الزبون */}
      <ReceiptCopy {...data} copyLabel={t.repair.customerCopy} />
      {/* نسخة المحل */}
      <ReceiptCopy {...data} copyLabel={t.repair.shopCopy} />
    </div>
  );
}

/** شكل أمر الصيانة مع علاقاته كما تُحمَّل في هذه الصفحة */
type ReceiptOrder = Prisma.RepairOrderGetPayload<{
  include: {
    customer: true;
    device: true;
    receivedBy: { select: { fullName: true } };
    items: true;
  };
}>;

interface CopyProps {
  order: ReceiptOrder;
  shop: ShopInfo;
  qr: string;
  barcode: string;
  money: (v: number) => string;
  locale: Locale;
  t: Dictionary;
  receivedAccessories: string[];
  reportedChecks: typeof CONDITION_CHECKS;
  physicalFlags: typeof PHYSICAL_FLAGS;
  conditionReport: Record<string, string>;
  damageMarks: DamageMark[];
  terms: string;
  dueAmount: number;
  copyLabel: string;
}

function ReceiptCopy({
  order,
  shop,
  qr,
  barcode,
  money,
  locale,
  t,
  receivedAccessories,
  reportedChecks,
  physicalFlags,
  conditionReport,
  damageMarks,
  terms,
  dueAmount,
  copyLabel,
}: CopyProps) {
  return (
    <article className="print-page mb-8 border border-gray-300 p-5 text-[11px] leading-relaxed print:mb-0 print:border-0 print:p-2">
      {/* الترويسة */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{shop.name}</h1>
          {shop.legalName && <p className="text-[10px] text-gray-600">{shop.legalName}</p>}
          <div className="mt-1 space-y-0.5 text-[10px] text-gray-700">
            {shop.address && <p>{shop.address}</p>}
            {(shop.phone || shop.phone2) && (
              <p dir="ltr" className="text-start">
                {[shop.phone, shop.phone2].filter(Boolean).join(' · ')}
              </p>
            )}
            {shop.email && <p dir="ltr" className="text-start">{shop.email}</p>}
            {shop.taxNumber && <p>الرقم الضريبي: {shop.taxNumber}</p>}
          </div>
        </div>

        <div className="shrink-0 text-center">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR" className="mx-auto h-[70px] w-[70px]" />
          )}
          <p className="mt-0.5 text-[8px] text-gray-600">{t.repair.trackingHint}</p>
        </div>
      </header>

      {/* العنوان ورقم العملية */}
      <div className="my-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">{t.repair.receipt}</h2>
          <span className="mt-0.5 inline-block rounded border border-gray-400 px-2 py-0.5 text-[9px] font-medium">
            {copyLabel}
          </span>
        </div>
        <div className="text-center">
          {barcode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={barcode} alt={order.number} className="h-[42px]" />
          )}
        </div>
        <div className="text-end">
          <p className="text-[10px] text-gray-600">{t.repair.number}</p>
          <p className="font-mono text-base font-bold" dir="ltr">
            {order.number}
          </p>
        </div>
      </div>

      {/* العميل والجهاز */}
      <div className="grid grid-cols-2 gap-3">
        <section className="rounded border border-gray-300 p-2.5">
          <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
            {t.repair.customer}
          </h3>
          <Row label={t.customer.fullName}>
            {fullName(order.customer.firstName, order.customer.lastName)}
          </Row>
          <Row label={t.customer.phone}>
            <span dir="ltr">{order.customer.phone}</span>
          </Row>
          {order.customer.phone2 && (
            <Row label={t.customer.phone2}>
              <span dir="ltr">{order.customer.phone2}</span>
            </Row>
          )}
          {order.customer.address && (
            <Row label={t.customer.address}>{order.customer.address}</Row>
          )}
          <Row label={t.customer.code}>
            <span dir="ltr">{order.customer.code}</span>
          </Row>
        </section>

        <section className="rounded border border-gray-300 p-2.5">
          <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
            {t.repair.device}
          </h3>
          <Row label={t.device.type}>
            {t.device.types[order.device.type as DeviceType] ?? order.device.type}
          </Row>
          <Row label={t.device.brand}>
            {order.device.brand} {order.device.model}
          </Row>
          {order.device.color && <Row label={t.device.color}>{order.device.color}</Row>}
          {order.device.imei && (
            <Row label="IMEI">
              <span dir="ltr" className="font-mono">
                {order.device.imei}
              </span>
            </Row>
          )}
          {order.device.serialNumber && (
            <Row label={t.device.serialNumber}>
              <span dir="ltr" className="font-mono">
                {order.device.serialNumber}
              </span>
            </Row>
          )}
        </section>
      </div>

      {/* العطل */}
      <section className="mt-3 rounded border border-gray-300 p-2.5">
        <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
          {t.repair.problem}
        </h3>
        <p className="whitespace-pre-wrap">{order.problemDescription}</p>
      </section>

      {/* الملحقات + الحالة */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <section className="rounded border border-gray-300 p-2.5">
          <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
            {t.repair.accessories}
          </h3>
          {receivedAccessories.length === 0 ? (
            <p className="text-gray-500">{t.app.none}</p>
          ) : (
            <p>{receivedAccessories.join(' · ')}</p>
          )}
        </section>

        <section className="rounded border border-gray-300 p-2.5">
          <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
            {t.app.details}
          </h3>
          <Row label={t.repair.receivedAt}>
            <span dir="ltr">{formatDateTime(order.receivedAt, locale)}</span>
          </Row>
          <Row label={t.repair.promisedAt}>
            <span dir="ltr">
              {order.promisedAt ? formatDate(order.promisedAt, locale) : '—'}
            </span>
          </Row>
          <Row label={t.repair.receivedBy}>{order.receivedBy?.fullName ?? '—'}</Row>
          <Row label={t.repair.warrantyDays}>
            <span dir="ltr">{order.warrantyDays}</span> يوم
          </Row>
        </section>
      </div>

      {/* تقرير الحالة */}
      {(reportedChecks.length > 0 || physicalFlags.length > 0 || damageMarks.length > 0) && (
        <section className="mt-3 rounded border border-gray-300 p-2.5 print-avoid-break">
          <h3 className="mb-1.5 border-b border-gray-200 pb-1 text-[11px] font-bold">
            {t.repair.conditionReport}
          </h3>

          {reportedChecks.length > 0 && (
            <div className="grid grid-cols-4 gap-x-3 gap-y-0.5">
              {reportedChecks.map((check) => {
                const value = conditionReport[check.key];
                return (
                  <div key={check.key} className="flex justify-between gap-1 border-b border-dotted border-gray-200 py-0.5">
                    <span className="text-gray-600">{check.label}</span>
                    <span
                      className={
                        value === 'OK'
                          ? 'font-medium text-green-700'
                          : value === 'FAULTY'
                            ? 'font-medium text-red-700'
                            : 'text-gray-500'
                      }
                    >
                      {t.repair.conditions[value as keyof typeof t.repair.conditions] ?? value}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {physicalFlags.length > 0 && (
            <p className="mt-2">
              <span className="font-medium">علامات: </span>
              {physicalFlags.map((f) => f.label).join(' · ')}
            </p>
          )}

          {damageMarks.length > 0 && (
            <p className="mt-1">
              <span className="font-medium">{t.repair.damageMarks}: </span>
              {damageMarks.map((mark, i) => (
                <span key={i} className="me-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: MARK_COLORS[mark.type] ?? '#6b7280' }}
                  />{' '}
                  {MARK_LABELS[mark.type] ?? mark.type}
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {/* البنود والتكلفة */}
      <section className="mt-3 print-avoid-break">
        {order.items.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-start text-[10px]">
                  {t.invoice.item}
                </th>
                <th className="w-12 border border-gray-300 px-1 py-1 text-center text-[10px]">
                  {t.invoice.quantity}
                </th>
                <th className="w-24 border border-gray-300 px-2 py-1 text-end text-[10px]">
                  {t.invoice.unitPrice}
                </th>
                <th className="w-24 border border-gray-300 px-2 py-1 text-end text-[10px]">
                  {t.app.total}
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-300 px-2 py-1">{item.name}</td>
                  <td className="border border-gray-300 px-1 py-1 text-center" dir="ltr">
                    {item.quantity}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-end" dir="ltr">
                    {money(item.unitPrice)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-end font-medium" dir="ltr">
                    {money(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-2 ms-auto w-64 space-y-0.5">
          <Row label={t.repair.estimatedCost} bold>
            <span dir="ltr">{money(order.estimatedCost)}</span>
          </Row>
          {order.depositAmount > 0 && (
            <>
              <Row label={t.repair.deposit}>
                <span dir="ltr">{money(order.depositAmount)}</span>
              </Row>
              <Row label={t.repair.remaining} bold>
                <span dir="ltr">{money(Math.max(0, dueAmount))}</span>
              </Row>
            </>
          )}
        </div>
      </section>

      {/* الشروط */}
      {terms && (
        <section className="mt-3 rounded border border-gray-300 bg-gray-50 p-2.5 print-avoid-break">
          <h3 className="mb-1 text-[10px] font-bold">{t.repair.warrantyTerms}</h3>
          <p className="whitespace-pre-wrap text-[9px] leading-relaxed text-gray-700">{terms}</p>
        </section>
      )}

      {/* التواقيع */}
      <footer className="mt-4 grid grid-cols-2 gap-6 print-avoid-break">
        <SignatureBlock
          label={t.repair.customerSignature}
          image={order.customerSignature}
          name={fullName(order.customer.firstName, order.customer.lastName)}
        />
        <SignatureBlock
          label={t.repair.employeeSignature}
          image={order.employeeSignature}
          name={order.receivedBy?.fullName ?? ''}
        />
      </footer>

      <p className="mt-3 border-t border-gray-200 pt-2 text-center text-[8px] text-gray-500">
        {trackingUrl(order.trackingToken)}
      </p>
    </article>
  );
}

function Row({
  label,
  children,
  bold,
}: {
  label: string;
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 py-0.5 ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

function SignatureBlock({
  label,
  image,
  name,
}: {
  label: string;
  image: string | null;
  name: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium">{label}</p>
      <div className="h-16 border-b border-gray-400">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={label} className="h-full object-contain" />
        )}
      </div>
      <p className="mt-0.5 text-[9px] text-gray-600">{name}</p>
    </div>
  );
}
