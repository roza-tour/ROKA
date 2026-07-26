import 'server-only';

import type { Prisma } from '@prisma/client';

import { PdfBuilder, COLORS } from './doc';
import { drawText } from './text';
import { drawShopHeader, signatureBlock, summaryRows } from './shared';
import { getFinanceSettings, getShopInfo, getSettings } from '../settings';
import { generateQrDataUrl, generateBarcodeDataUrl, trackingUrl } from '../codes';
import { formatMoney, formatDate, formatDateTime, fullName, safeJsonParse, round } from '../utils';
import {
  ACCESSORY_ITEMS,
  CONDITION_CHECKS,
  PHYSICAL_FLAGS,
  type ConditionValue,
  type DeviceType,
} from '../constants';
import { getDictionary, getDirection, type Dictionary, type Locale } from '@/i18n';

export type ReceiptOrderForPdf = Prisma.RepairOrderGetPayload<{
  include: {
    customer: true;
    device: true;
    receivedBy: { select: { fullName: true } };
    items: true;
  };
}>;

/** التسمية حسب اللغة من ثوابت الفحص */
function localized(
  item: { label: string; labelFr: string; labelEn: string },
  locale: Locale,
): string {
  if (locale === 'fr') return item.labelFr;
  if (locale === 'en') return item.labelEn;
  return item.label;
}

/**
 * إيصال استلام جهاز — نسختان في ملف واحد: نسخة العميل ونسخة المحل.
 * كل نسخة في صفحة مستقلة حتى تُطبع وتُوقّع بشكل منفصل.
 */
export async function buildReceiptPdf(
  order: ReceiptOrderForPdf,
  locale: Locale = 'ar',
): Promise<Buffer> {
  const t = getDictionary(locale);
  const baseDir = getDirection(locale);
  const [finance, shop, settings] = await Promise.all([
    getFinanceSettings(),
    getShopInfo(),
    getSettings(),
  ]);

  const money = (value: number) =>
    formatMoney(value, { currency: finance.currency, decimals: finance.decimals, locale });

  const [qr, barcode] = await Promise.all([
    generateQrDataUrl(trackingUrl(order.trackingToken), { size: 180 }),
    generateBarcodeDataUrl(order.number, { height: 8, scale: 2 }),
  ]);

  const accessories = safeJsonParse<Record<string, boolean | string>>(order.accessories, {});
  const conditionReport = safeJsonParse<Record<string, string>>(order.conditionReport, {});

  const receivedAccessories = ACCESSORY_ITEMS.filter((item) => accessories[item.key] === true).map(
    (item) => localized(item, locale),
  );
  if (typeof accessories.custom === 'string' && accessories.custom) {
    receivedAccessories.push(accessories.custom);
  }

  const deviceType = order.device.type as DeviceType;
  const reportedChecks = CONDITION_CHECKS.filter(
    (check) =>
      (check.devices === 'ALL' || check.devices.includes(deviceType)) &&
      conditionReport[check.key] &&
      conditionReport[check.key] !== 'UNTESTED',
  );
  const physicalFlags = PHYSICAL_FLAGS.filter((flag) => conditionReport[flag.key] === 'YES');

  const terms = order.warrantyTerms || settings['repair.terms'] || '';
  const dueAmount = round(order.finalCost - order.depositAmount);

  const builder = new PdfBuilder({
    baseDir,
    title: `${t.repair.receipt} ${order.number}`,
    footerNote: shop.name,
  });

  const copies = [t.repair.customerCopy, t.repair.shopCopy];
  copies.forEach((copyLabel, index) => {
    if (index > 0) builder.newPage();
    drawCopy(builder, {
      order,
      shop,
      t,
      locale,
      money,
      qr,
      barcode,
      copyLabel,
      receivedAccessories,
      reportedChecks: reportedChecks.map((check) => ({
        label: localized(check, locale),
        state: conditionReport[check.key] as ConditionValue,
      })),
      physicalFlags: physicalFlags.map((flag) => localized(flag, locale)),
      terms,
      dueAmount,
    });
  });

  return builder.finalize();
}

interface CopyData {
  order: ReceiptOrderForPdf;
  shop: Awaited<ReturnType<typeof getShopInfo>>;
  t: Dictionary;
  locale: Locale;
  money: (value: number) => string;
  qr: string;
  barcode: string;
  copyLabel: string;
  receivedAccessories: string[];
  reportedChecks: { label: string; state: ConditionValue }[];
  physicalFlags: string[];
  terms: string;
  dueAmount: number;
}

const STATE_COLOR: Record<ConditionValue, string> = {
  OK: COLORS.success,
  FAULTY: COLORS.danger,
  MISSING: COLORS.danger,
  UNTESTED: COLORS.muted,
};

function drawCopy(builder: PdfBuilder, data: CopyData): void {
  const { order, shop, t, locale, money, qr, barcode, copyLabel } = data;
  const { margin, contentWidth, baseDir } = builder;

  let y = drawShopHeader(builder, shop, {
    documentTitle: t.repair.receipt,
    documentNumber: order.number,
    subtitle: formatDateTime(order.receivedAt, locale),
    barcode,
    taxLabel: t.customer.taxNumber,
  });

  // شارة نوع النسخة
  const badgeWidth = builder.widthOf(copyLabel) + 18;
  const badgeX = baseDir === 'rtl' ? margin + contentWidth - badgeWidth : margin;
  builder.rect(badgeX, y - 4, badgeWidth, 15, { fill: COLORS.fill, radius: 7 });
  builder.font('bold', 8, COLORS.ink);
  builder.text(copyLabel, badgeX, y, badgeWidth, { align: 'center' });
  y += 18;

  // ------------------------------------------------- العميل + الجهاز جنباً لجنب
  const gap = 10;
  const boxWidth = (contentWidth - gap) / 2;
  const leftX = margin;
  const rightX = margin + boxWidth + gap;
  const firstX = baseDir === 'rtl' ? rightX : leftX;
  const secondX = baseDir === 'rtl' ? leftX : rightX;

  const customerRows: [string, string, boolean][] = [
    [t.customer.fullName, fullName(order.customer.firstName, order.customer.lastName), false],
    [t.customer.phone, order.customer.phone, true],
  ];
  if (order.customer.phone2) customerRows.push([t.customer.phone2, order.customer.phone2, true]);
  if (order.receivedBy) customerRows.push([t.repair.receivedBy, order.receivedBy.fullName, false]);
  if (order.promisedAt) {
    customerRows.push([t.repair.promisedAt, formatDate(order.promisedAt, locale), true]);
  }

  const deviceRows: [string, string, boolean][] = [
    [t.device.type, t.device.types[deviceType(order)] ?? order.device.type, false],
    [
      t.device.model,
      [order.device.brand, order.device.model].filter(Boolean).join(' '),
      false,
    ],
  ];
  if (order.device.color) deviceRows.push([t.device.color, order.device.color, false]);
  if (order.device.imei) deviceRows.push([t.device.imei, order.device.imei, true]);
  if (order.device.serialNumber) {
    deviceRows.push([t.device.serialNumber, order.device.serialNumber, true]);
  }

  const rowsCount = Math.max(customerRows.length, deviceRows.length);
  const boxHeight = 20 + rowsCount * 12 + 6;

  for (const [boxX, title, rows] of [
    [firstX, t.repair.customer, customerRows],
    [secondX, t.device.single, deviceRows],
  ] as const) {
    builder.rect(boxX, y, boxWidth, boxHeight, { stroke: COLORS.line, radius: 3 });
    builder.font('bold', 8.5, COLORS.ink);
    builder.text(title, boxX + 8, y + 6, boxWidth - 16, { align: 'start' });
    let rowY = y + 20;
    for (const [label, value, ltr] of rows) {
      rowY = builder.labelValue(label, value, boxX + 8, rowY, boxWidth - 16, { ltrValue: ltr });
    }
  }
  y += boxHeight + 10;

  // ------------------------------------------------------------- العطل المعلن
  if (order.problemDescription) {
    builder.font('body', 8);
    const height = builder.measureParagraph(order.problemDescription, contentWidth - 16) + 22;
    builder.rect(margin, y, contentWidth, height, { stroke: COLORS.line, radius: 3 });
    builder.font('bold', 8, COLORS.ink);
    builder.text(t.repair.problem, margin + 8, y + 6, contentWidth - 16, { align: 'start' });
    builder.font('body', 8, COLORS.body);
    builder.paragraph(order.problemDescription, margin + 8, y + 18, contentWidth - 16, {
      align: 'start',
    });
    y += height + 10;
  }

  // ---------------------------------------------------------- تقرير حالة الجهاز
  if (data.reportedChecks.length > 0 || data.physicalFlags.length > 0) {
    y = builder.sectionTitle(t.repair.conditionReport, y);

    const perRow = 4;
    const cellWidth = contentWidth / perRow;
    builder.font('body', 7.5);

    data.reportedChecks.forEach((check, index) => {
      const column = index % perRow;
      const row = Math.floor(index / perRow);
      // في RTL نملأ الأعمدة من اليمين
      const cellX =
        baseDir === 'rtl'
          ? margin + contentWidth - (column + 1) * cellWidth
          : margin + column * cellWidth;
      const cellY = y + row * 12;

      const inner = cellWidth - 4;
      const labelWidth = inner * 0.6;
      const stateWidth = inner * 0.4;

      builder.font('body', 7.5, COLORS.muted);
      builder.text(
        check.label,
        builder.regionStart(cellX + 2, inner, labelWidth),
        cellY,
        labelWidth,
        { align: 'start', ellipsis: true },
      );

      builder.font('bold', 7.5, STATE_COLOR[check.state] ?? COLORS.body);
      builder.text(
        t.repair.conditions[check.state] ?? check.state,
        builder.regionEnd(cellX + 2, inner, stateWidth),
        cellY,
        stateWidth,
        { align: 'end', ellipsis: true },
      );
    });

    y += Math.ceil(data.reportedChecks.length / perRow) * 12 + 4;

    if (data.physicalFlags.length > 0) {
      builder.font('bold', 7.5, COLORS.danger);
      builder.text(
        `${t.repair.physicalFlags}: ${data.physicalFlags.join(' · ')}`,
        margin,
        y,
        contentWidth,
        { align: 'start' },
      );
      y += 14;
    }
  }

  // -------------------------------------------------------------- الملحقات
  if (data.receivedAccessories.length > 0) {
    builder.font('body', 8);
    const text = data.receivedAccessories.join(' · ');
    const height = builder.measureParagraph(text, contentWidth - 16) + 20;
    builder.rect(margin, y, contentWidth, height, { fill: '#fafafa', stroke: COLORS.hairline, radius: 3 });
    builder.font('bold', 7.5, COLORS.ink);
    builder.text(t.repair.accessories, margin + 8, y + 5, contentWidth - 16, { align: 'start' });
    builder.font('body', 8, COLORS.body);
    builder.paragraph(text, margin + 8, y + 16, contentWidth - 16, { align: 'start' });
    y += height + 10;
  }

  // ------------------------------------------------------ التكلفة + رمز التتبع
  const costRows: [string, string][] = [
    [t.repair.estimatedCost, money(order.estimatedCost)],
    [t.repair.finalCost, money(order.finalCost)],
  ];
  if (order.depositAmount > 0) {
    costRows.push([t.repair.deposit, money(order.depositAmount)]);
    costRows.push([t.invoice.due, money(data.dueAmount)]);
  }

  const costWidth = 190;
  // التكاليف في جهة نهاية القراءة، ورمز التتبّع في جهة البداية
  const costX = builder.regionEnd(margin, contentWidth, costWidth);
  const asideWidth = contentWidth - costWidth - 14;
  const asideX = builder.regionStart(margin, contentWidth, asideWidth);

  summaryRows(
    builder,
    costRows.map(([label, value], index) => ({
      label,
      value,
      strong: index === costRows.length - 1 && order.depositAmount > 0,
    })),
    costX,
    y,
    costWidth,
    15,
  );

  if (qr) {
    const qrSize = 64;
    const qrX = builder.regionStart(asideX, asideWidth, qrSize);
    builder.image(qr, qrX, y, { width: qrSize, height: qrSize });
    builder.font('body', 6.5, COLORS.faint);
    const hintWidth = asideWidth - qrSize - 6;
    builder.paragraph(
      t.repair.trackHint,
      builder.regionEnd(asideX, asideWidth, hintWidth),
      y + 24,
      hintWidth,
      { align: 'start', maxLines: 3 },
    );
  }

  y += Math.max(costRows.length * 15, 68) + 10;

  // --------------------------------------------------------------- الشروط
  if (data.terms) {
    builder.font('body', 7);
    const height = builder.measureParagraph(data.terms, contentWidth - 16) + 20;
    builder.rect(margin, y, contentWidth, height, {
      fill: '#fafafa',
      stroke: COLORS.hairline,
      radius: 3,
    });
    builder.font('bold', 7.5, COLORS.ink);
    builder.text(t.repair.warrantyTerms, margin + 8, y + 5, contentWidth - 16, { align: 'start' });
    builder.font('body', 7, COLORS.muted);
    builder.paragraph(data.terms, margin + 8, y + 16, contentWidth - 16, { align: 'start' });
    y += height + 8;
  }

  // -------------------------------------------------------------- التواقيع
  signatureBlock(builder, Math.min(y + 6, builder.bottomLimit - 70), [
    {
      title: t.pdf.customerSignature,
      caption: fullName(order.customer.firstName, order.customer.lastName),
      image: order.customerSignature,
    },
    {
      title: t.pdf.employeeSignature,
      caption: order.receivedBy?.fullName ?? shop.name,
      image: order.employeeSignature,
    },
  ]);
}

function deviceType(order: ReceiptOrderForPdf): DeviceType {
  return order.device.type as DeviceType;
}
