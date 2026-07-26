import { round } from './utils';

/**
 * حسابات الفواتير وعروض الأسعار — منطق واحد يُستخدم على الخادم والعميل
 * حتى لا تختلف الأرقام المعروضة عن المحفوظة.
 *
 * ترتيب الحساب:
 *   1. مجموع البنود بعد خصومات البنود      → subtotal
 *   2. خصم الفاتورة (نسبة أو مبلغ)          → discountAmount
 *   3. الضريبة على (subtotal − discount)     → taxAmount
 *   4. الإجمالي                              → total
 */

export interface PricedItem {
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discount?: number;
}

export interface PricingInput {
  items: PricedItem[];
  discountType?: 'FIXED' | 'PERCENT';
  discountValue?: number;
  taxRate?: number;
  /** خصم إضافي من كوبون (يُطبَّق قبل الضريبة) */
  couponDiscount?: number;
}

export interface PricingResult {
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
  costTotal: number;
  profit: number;
}

/** مجموع بند واحد بعد خصمه */
export function lineTotal(item: PricedItem): number {
  return round(Math.max(0, item.quantity * item.unitPrice - (item.discount ?? 0)));
}

export function calculatePricing(input: PricingInput): PricingResult {
  const items = input.items ?? [];

  const subtotal = round(items.reduce((sum, item) => sum + lineTotal(item), 0));
  const costTotal = round(
    items.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0),
  );

  const discountValue = input.discountValue ?? 0;
  const invoiceDiscount =
    input.discountType === 'PERCENT'
      ? round((subtotal * discountValue) / 100)
      : round(discountValue);

  const discountAmount = round(
    Math.min(subtotal, Math.max(0, invoiceDiscount + (input.couponDiscount ?? 0))),
  );

  const taxableBase = round(subtotal - discountAmount);
  const taxAmount = round((taxableBase * (input.taxRate ?? 0)) / 100);
  const total = round(taxableBase + taxAmount);

  return {
    subtotal,
    discountAmount,
    taxableBase,
    taxAmount,
    total,
    costTotal,
    profit: round(taxableBase - costTotal),
  };
}

// ------------------------------------------------------------------ الكوبونات

export interface CouponLike {
  type: string;
  value: number;
  minAmount: number;
  maxDiscount: number;
  usageLimit: number;
  usedCount: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
}

export type CouponCheck =
  | { valid: true; discount: number }
  | { valid: false; reason: string };

/** التحقق من صلاحية كوبون وحساب قيمة خصمه */
export function evaluateCoupon(coupon: CouponLike, subtotal: number): CouponCheck {
  const now = new Date();

  if (!coupon.isActive) return { valid: false, reason: 'الكوبون غير مفعّل' };
  if (coupon.startsAt > now) return { valid: false, reason: 'الكوبون لم يبدأ بعد' };
  if (coupon.endsAt && coupon.endsAt < now) return { valid: false, reason: 'انتهت صلاحية الكوبون' };
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, reason: 'تم استنفاد عدد مرات استخدام الكوبون' };
  }
  if (coupon.minAmount > 0 && subtotal < coupon.minAmount) {
    return { valid: false, reason: `الحد الأدنى للفاتورة ${coupon.minAmount}` };
  }

  let discount =
    coupon.type === 'PERCENT' ? round((subtotal * coupon.value) / 100) : round(coupon.value);

  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal);

  if (discount <= 0) return { valid: false, reason: 'قيمة الخصم صفر' };
  return { valid: true, discount };
}

// -------------------------------------------------------------- نقاط الولاء

/** حساب النقاط المكتسبة من فاتورة */
export function loyaltyPointsFor(
  total: number,
  pointsPerUnit: number,
  unitValue: number,
): number {
  if (pointsPerUnit <= 0 || unitValue <= 0) return 0;
  return Math.floor((total / unitValue) * pointsPerUnit);
}

// ---------------------------------------------------------- حالة السداد

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

/** استنتاج حالة الفاتورة من المدفوع مقابل الإجمالي */
export function paymentStatusFor(total: number, paid: number): PaymentStatus {
  const remaining = round(total - paid);
  if (remaining <= 0.009) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}
