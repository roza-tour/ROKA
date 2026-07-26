import 'server-only';

import type { Prisma } from '@prisma/client';
import { STOCK_IN_TYPES, type StockMovementType } from './constants';
import { round } from './utils';

/**
 * خدمة المخزون — كل تغيير على الكميات يمرّ من هنا حتى يبقى
 * جدول StockMovement مطابقاً تماماً لحقل Product.quantity.
 *
 * كل الدوال تتطلب عميل معاملة (tx) لضمان الذرّية مع العملية الأصلية
 * (فاتورة، أمر صيانة، أمر شراء).
 */

export interface StockMoveInput {
  productId: string;
  type: StockMovementType;
  /** كمية موجبة دائماً — الاتجاه يحدده type */
  quantity: number;
  unitCost?: number;
  reason?: string | null;
  refType?: string | null;
  refId?: string | null;
  refNumber?: string | null;
  userId?: string | null;
  branchId?: string | null;
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `الكمية المتوفرة من «${productName}» غير كافية: المتاح ${available}، المطلوب ${requested}`,
    );
    this.name = 'InsufficientStockError';
  }
}

/** هل تزيد هذه الحركة المخزون؟ */
function isIncoming(type: StockMovementType): boolean {
  return (STOCK_IN_TYPES as StockMovementType[]).includes(type);
}

/**
 * تسجيل حركة مخزون وتحديث كمية المنتج ذرّياً.
 * ADJUST يعامل `quantity` كقيمة نهائية مطلقة، لا كفرق.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  input: StockMoveInput,
  options: { allowNegative?: boolean } = {},
): Promise<{ balanceAfter: number }> {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, quantity: true, costPrice: true },
  });

  if (!product) {
    throw new Error(`المنتج غير موجود: ${input.productId}`);
  }

  const qty = Math.abs(input.quantity);
  let balanceAfter: number;
  let movementQty = qty;

  if (input.type === 'ADJUST') {
    // تسوية: الكمية المرسلة هي الرصيد الجديد
    balanceAfter = qty;
    movementQty = round(Math.abs(qty - product.quantity), 3);
  } else if (isIncoming(input.type)) {
    balanceAfter = round(product.quantity + qty, 3);
  } else {
    balanceAfter = round(product.quantity - qty, 3);
    if (balanceAfter < 0 && !options.allowNegative) {
      throw new InsufficientStockError(product.name, product.quantity, qty);
    }
  }

  await tx.product.update({
    where: { id: product.id },
    data: { quantity: balanceAfter },
  });

  await tx.stockMovement.create({
    data: {
      productId: product.id,
      branchId: input.branchId ?? null,
      type: input.type,
      quantity: movementQty,
      balanceAfter,
      unitCost: input.unitCost ?? product.costPrice,
      reason: input.reason ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      refNumber: input.refNumber ?? null,
      userId: input.userId ?? null,
    },
  });

  // تحديث رصيد الفرع إن وُجد
  if (input.branchId) {
    const delta =
      input.type === 'ADJUST'
        ? balanceAfter - product.quantity
        : isIncoming(input.type)
          ? qty
          : -qty;
    await tx.productStock.upsert({
      where: { productId_branchId: { productId: product.id, branchId: input.branchId } },
      create: { productId: product.id, branchId: input.branchId, quantity: Math.max(0, delta) },
      update: { quantity: { increment: delta } },
    });
  }

  return { balanceAfter };
}

/**
 * خصم قطع الغيار المستهلكة في أمر صيانة أو فاتورة.
 * يتحقق أولاً من توفّر كل الكميات ثم يخصمها — إما الكل أو لا شيء.
 */
export async function consumeStock(
  tx: Prisma.TransactionClient,
  items: { productId: string; quantity: number }[],
  context: {
    refType: string;
    refId: string;
    refNumber?: string;
    userId?: string | null;
    branchId?: string | null;
    reason?: string;
  },
): Promise<void> {
  if (!items.length) return;

  // تجميع الكميات لنفس المنتج (قد يتكرر في بنود متعددة)
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  if (!merged.size) return;

  // تحقق مسبق من التوفّر
  const products = await tx.product.findMany({
    where: { id: { in: [...merged.keys()] } },
    select: { id: true, name: true, quantity: true },
  });

  for (const product of products) {
    const requested = merged.get(product.id) ?? 0;
    if (product.quantity < requested) {
      throw new InsufficientStockError(product.name, product.quantity, requested);
    }
  }

  for (const [productId, quantity] of merged) {
    await recordStockMovement(tx, {
      productId,
      type: 'OUT',
      quantity,
      reason: context.reason ?? 'استهلاك في عملية',
      refType: context.refType,
      refId: context.refId,
      refNumber: context.refNumber ?? null,
      userId: context.userId ?? null,
      branchId: context.branchId ?? null,
    });
  }
}

/** إرجاع قطع إلى المخزون (عند إلغاء فاتورة أو أمر صيانة) */
export async function returnStock(
  tx: Prisma.TransactionClient,
  items: { productId: string; quantity: number }[],
  context: {
    refType: string;
    refId: string;
    refNumber?: string;
    userId?: string | null;
    branchId?: string | null;
    reason?: string;
  },
): Promise<void> {
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  for (const [productId, quantity] of merged) {
    await recordStockMovement(tx, {
      productId,
      type: 'RETURN_IN',
      quantity,
      reason: context.reason ?? 'إرجاع للمخزون',
      refType: context.refType,
      refId: context.refId,
      refNumber: context.refNumber ?? null,
      userId: context.userId ?? null,
      branchId: context.branchId ?? null,
    });
  }
}
