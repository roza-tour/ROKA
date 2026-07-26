'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextSku, nextBarcode, nextCode, nextNumber } from '@/lib/numbering';
import {
  productSchema,
  stockAdjustSchema,
  supplierSchema,
  purchaseOrderSchema,
  firstError,
  fieldErrors,
} from '@/lib/validation';
import { recordStockMovement, InsufficientStockError } from '@/lib/inventory';
import { round } from '@/lib/utils';
import type { FormState } from './customers';
import type { StockMovementType } from '@/lib/constants';

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue;
    obj[key] = value;
  }
  return obj;
}

// ---------------------------------------------------------------- المنتجات

export async function createProductAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  try {
    const user = await requirePermission('inventory:create');
    const parsed = productSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const product = await db.$transaction(async (tx) => {
      const sku = data.sku || (await nextSku(tx));
      const barcode = data.barcode || (await nextBarcode(tx));

      // التحقق من التفرّد
      const conflict = await tx.product.findFirst({
        where: { OR: [{ sku }, { barcode }] },
        select: { sku: true, barcode: true },
      });
      if (conflict) {
        throw new Error(
          conflict.sku === sku ? 'رمز المنتج (SKU) مستخدم مسبقاً' : 'الباركود مستخدم مسبقاً',
        );
      }

      const created = await tx.product.create({
        data: {
          sku,
          barcode,
          name: data.name,
          nameFr: data.nameFr,
          nameEn: data.nameEn,
          type: data.type,
          categoryId: data.categoryId,
          brand: data.brand,
          model: data.model,
          compatibleWith: data.compatibleWith,
          description: data.description,
          unit: data.unit,
          costPrice: data.costPrice,
          sellPrice: data.sellPrice,
          wholesalePrice: data.wholesalePrice,
          taxRate: data.taxRate,
          quantity: 0, // تُضبط عبر حركة مخزون حتى يبقى السجل متسقاً
          minQuantity: data.minQuantity,
          maxQuantity: data.maxQuantity,
          location: data.location,
          supplierId: data.supplierId,
          trackSerial: data.trackSerial,
          warrantyDays: data.warrantyDays,
          isActive: data.isActive,
        },
      });

      if (data.quantity > 0) {
        await recordStockMovement(tx, {
          productId: created.id,
          type: 'IN',
          quantity: data.quantity,
          unitCost: data.costPrice,
          reason: 'رصيد افتتاحي',
          refType: 'MANUAL',
          userId: user.id,
          branchId: user.branchId,
        });
      }

      return created;
    });

    await audit({
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      summary: `إنشاء منتج: ${product.name} (${product.sku})`,
      after: product,
      user,
    });

    createdId = product.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message.includes('مستخدم مسبقاً')) {
      return { ok: false, error: error.message };
    }
    console.error('[createProduct]', error);
    return { ok: false, error: 'تعذّر إنشاء المنتج' };
  }

  revalidatePath('/inventory');
  redirect(`/inventory/${createdId}`);
}

export async function updateProductAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('inventory:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف المنتج مفقود' };

    const parsed = productSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const before = await db.product.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'المنتج غير موجود' };

    const data = parsed.data;

    if (data.sku && data.sku !== before.sku) {
      const conflict = await db.product.findFirst({
        where: { sku: data.sku, id: { not: id } },
        select: { id: true },
      });
      if (conflict) return { ok: false, error: 'رمز المنتج (SKU) مستخدم مسبقاً' };
    }
    if (data.barcode && data.barcode !== before.barcode) {
      const conflict = await db.product.findFirst({
        where: { barcode: data.barcode, id: { not: id } },
        select: { id: true },
      });
      if (conflict) return { ok: false, error: 'الباركود مستخدم مسبقاً' };
    }

    // الكمية لا تُعدَّل هنا — تُعدَّل عبر تسوية مخزون مسجّلة
    const after = await db.product.update({
      where: { id },
      data: {
        sku: data.sku ?? before.sku,
        barcode: data.barcode,
        name: data.name,
        nameFr: data.nameFr,
        nameEn: data.nameEn,
        type: data.type,
        categoryId: data.categoryId,
        brand: data.brand,
        model: data.model,
        compatibleWith: data.compatibleWith,
        description: data.description,
        unit: data.unit,
        costPrice: data.costPrice,
        sellPrice: data.sellPrice,
        wholesalePrice: data.wholesalePrice,
        taxRate: data.taxRate,
        minQuantity: data.minQuantity,
        maxQuantity: data.maxQuantity,
        location: data.location,
        supplierId: data.supplierId,
        trackSerial: data.trackSerial,
        warrantyDays: data.warrantyDays,
        isActive: data.isActive,
      },
    });

    await audit({
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      summary: `تعديل منتج: ${after.name}`,
      before,
      after,
      user,
    });

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
    return { ok: true, message: 'تم تحديث المنتج', id };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[updateProduct]', error);
    return { ok: false, error: 'تعذّر تحديث المنتج' };
  }
}

/** تسوية المخزون: إدخال، إخراج، تسوية مطلقة، أو تسجيل تالف */
export async function adjustStockAction(
  productId: string,
  type: StockMovementType,
  quantity: number,
  reason: string,
  unitCost?: number,
): Promise<FormState> {
  try {
    const user = await requirePermission('inventory:update');

    const parsed = stockAdjustSchema.safeParse({
      productId,
      type,
      quantity,
      reason,
      unitCost: unitCost ?? 0,
    });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true, quantity: true },
    });
    if (!product) return { ok: false, error: 'المنتج غير موجود' };

    const result = await db.$transaction((tx) =>
      recordStockMovement(tx, {
        productId,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        unitCost: parsed.data.unitCost,
        reason: parsed.data.reason ?? 'تسوية يدوية',
        refType: 'MANUAL',
        userId: user.id,
        branchId: user.branchId,
      }),
    );

    await audit({
      action: 'STOCK_ADJUST',
      entity: 'Product',
      entityId: productId,
      summary: `${product.name}: ${type} ${quantity} — الرصيد ${product.quantity} → ${result.balanceAfter}`,
      before: { quantity: product.quantity },
      after: { quantity: result.balanceAfter },
      user,
    });

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${productId}`);
    return { ok: true, message: `تم التعديل — الرصيد الجديد: ${result.balanceAfter}` };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof InsufficientStockError) return { ok: false, error: error.message };
    console.error('[adjustStock]', error);
    return { ok: false, error: 'تعذّرت تسوية المخزون' };
  }
}

export async function deleteProductAction(id: string): Promise<FormState> {
  try {
    const user = await requirePermission('inventory:delete');

    const product = await db.product.findUnique({
      where: { id },
      include: {
        _count: { select: { invoiceItems: true, repairItems: true, stockMoves: true } },
      },
    });
    if (!product) return { ok: false, error: 'المنتج غير موجود' };

    const linked = product._count.invoiceItems + product._count.repairItems;
    if (linked > 0) {
      await db.product.update({ where: { id }, data: { isActive: false } });
      await audit({
        action: 'UPDATE',
        entity: 'Product',
        entityId: id,
        summary: `تعطيل منتج مرتبط بـ ${linked} عملية: ${product.name}`,
        user,
      });
      revalidatePath('/inventory');
      return { ok: true, message: `المنتج مستخدم في ${linked} عملية — تم تعطيله بدل حذفه` };
    }

    await db.product.delete({ where: { id } });
    await audit({
      action: 'DELETE',
      entity: 'Product',
      entityId: id,
      summary: `حذف منتج: ${product.name}`,
      before: product,
      user,
    });

    revalidatePath('/inventory');
    return { ok: true, message: 'تم حذف المنتج' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[deleteProduct]', error);
    return { ok: false, error: 'تعذّر حذف المنتج' };
  }
}

/** تعديل الأسعار بالجملة (نسبة أو مبلغ) */
export async function bulkUpdatePricesAction(
  filter: { categoryId?: string; type?: string; supplierId?: string },
  change: { field: 'sellPrice' | 'costPrice'; mode: 'PERCENT' | 'FIXED'; value: number },
): Promise<FormState> {
  try {
    const user = await requirePermission('inventory:update');
    if (!Number.isFinite(change.value) || change.value === 0) {
      return { ok: false, error: 'أدخل قيمة تغيير صالحة' };
    }

    const products = await db.product.findMany({
      where: {
        isActive: true,
        ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      },
      select: { id: true, sellPrice: true, costPrice: true },
    });

    if (!products.length) return { ok: false, error: 'لا توجد منتجات مطابقة' };

    await db.$transaction(
      products.map((product) => {
        const current = product[change.field];
        const next =
          change.mode === 'PERCENT'
            ? round(current * (1 + change.value / 100))
            : round(current + change.value);
        return db.product.update({
          where: { id: product.id },
          data: { [change.field]: Math.max(0, next) },
        });
      }),
    );

    await audit({
      action: 'UPDATE',
      entity: 'Product',
      summary: `تعديل أسعار بالجملة: ${products.length} منتج، ${change.field} ${change.mode === 'PERCENT' ? `${change.value}%` : change.value}`,
      user,
    });

    revalidatePath('/inventory');
    return { ok: true, message: `تم تعديل أسعار ${products.length} منتج` };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[bulkUpdatePrices]', error);
    return { ok: false, error: 'تعذّر تعديل الأسعار' };
  }
}

// ---------------------------------------------------------------- الموردون

export async function createSupplierAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  try {
    const user = await requirePermission('suppliers:create');
    const parsed = supplierSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const supplier = await db.$transaction(async (tx) =>
      tx.supplier.create({
        data: { code: await nextCode('SUP', tx), ...parsed.data },
      }),
    );

    await audit({
      action: 'CREATE',
      entity: 'Supplier',
      entityId: supplier.id,
      summary: `إنشاء مورد: ${supplier.name}`,
      after: supplier,
      user,
    });

    createdId = supplier.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createSupplier]', error);
    return { ok: false, error: 'تعذّر إنشاء المورد' };
  }

  revalidatePath('/suppliers');
  redirect(`/suppliers/${createdId}`);
}

export async function updateSupplierAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission('suppliers:update');
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'معرّف المورد مفقود' };

    const parsed = supplierSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }

    const before = await db.supplier.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'المورد غير موجود' };

    const after = await db.supplier.update({ where: { id }, data: parsed.data });

    await audit({
      action: 'UPDATE',
      entity: 'Supplier',
      entityId: id,
      summary: `تعديل مورد: ${after.name}`,
      before,
      after,
      user,
    });

    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return { ok: true, message: 'تم تحديث المورد' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تحديث المورد' };
  }
}

// -------------------------------------------------------------- المشتريات

export async function createPurchaseOrderAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  try {
    const user = await requirePermission('purchases:create');

    const payloadRaw = formData.get('payload');
    if (typeof payloadRaw !== 'string') return { ok: false, error: 'بيانات النموذج مفقودة' };

    const parsed = purchaseOrderSchema.safeParse(JSON.parse(payloadRaw));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;

    const subtotal = round(data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0));
    const total = round(subtotal - data.discount + data.tax + data.shipping);

    const order = await db.$transaction(async (tx) =>
      tx.purchaseOrder.create({
        data: {
          number: await nextNumber('PO', tx),
          supplierId: data.supplierId,
          userId: user.id,
          status: 'ORDERED',
          subtotal,
          discount: data.discount,
          tax: data.tax,
          shipping: data.shipping,
          total,
          notes: data.notes,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: round(item.quantity * item.unitCost),
            })),
          },
        },
      }),
    );

    await audit({
      action: 'CREATE',
      entity: 'PurchaseOrder',
      entityId: order.id,
      summary: `أمر شراء ${order.number} بقيمة ${total}`,
      after: { number: order.number, total },
      user,
    });

    createdId = order.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createPurchaseOrder]', error);
    return { ok: false, error: 'تعذّر إنشاء أمر الشراء' };
  }

  revalidatePath('/purchases');
  redirect(`/purchases/${createdId}`);
}

/** استلام بضاعة أمر شراء وإدخالها للمخزون */
export async function receivePurchaseAction(
  purchaseId: string,
  received: { itemId: string; quantity: number }[],
): Promise<FormState> {
  try {
    const user = await requirePermission('purchases:update');

    const order = await db.purchaseOrder.findUnique({
      where: { id: purchaseId },
      include: { items: true, supplier: { select: { name: true } } },
    });
    if (!order) return { ok: false, error: 'أمر الشراء غير موجود' };
    if (order.status === 'RECEIVED') return { ok: false, error: 'تم استلام هذا الأمر بالكامل' };

    await db.$transaction(async (tx) => {
      for (const entry of received) {
        const item = order.items.find((i) => i.id === entry.itemId);
        if (!item || entry.quantity <= 0) continue;

        const remaining = item.quantity - item.receivedQuantity;
        const quantity = Math.min(entry.quantity, remaining);
        if (quantity <= 0) continue;

        await recordStockMovement(tx, {
          productId: item.productId,
          type: 'IN',
          quantity,
          unitCost: item.unitCost,
          reason: `استلام أمر شراء ${order.number}`,
          refType: 'PurchaseOrder',
          refId: order.id,
          refNumber: order.number,
          userId: user.id,
          branchId: user.branchId,
        });

        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { receivedQuantity: { increment: quantity } },
        });

        // تحديث سعر التكلفة بآخر سعر شراء
        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: item.unitCost },
        });
      }

      const updatedItems = await tx.purchaseItem.findMany({ where: { purchaseId } });
      const complete = updatedItems.every((i) => i.receivedQuantity >= i.quantity);
      const partial = updatedItems.some((i) => i.receivedQuantity > 0);

      await tx.purchaseOrder.update({
        where: { id: purchaseId },
        data: {
          status: complete ? 'RECEIVED' : partial ? 'PARTIAL' : order.status,
          receivedAt: complete ? new Date() : order.receivedAt,
        },
      });

      // زيادة الرصيد المستحق للمورد
      if (complete) {
        await tx.supplier.update({
          where: { id: order.supplierId },
          data: { balance: { increment: order.total - order.paidAmount } },
        });
      }
    });

    await audit({
      action: 'UPDATE',
      entity: 'PurchaseOrder',
      entityId: purchaseId,
      summary: `استلام بضاعة أمر الشراء ${order.number}`,
      user,
    });

    revalidatePath('/purchases');
    revalidatePath(`/purchases/${purchaseId}`);
    revalidatePath('/inventory');
    return { ok: true, message: 'تم استلام البضاعة وإدخالها للمخزون' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[receivePurchase]', error);
    return { ok: false, error: 'تعذّر استلام البضاعة' };
  }
}

/** تسجيل دفعة لمورد */
export async function payPurchaseAction(
  purchaseId: string,
  amount: number,
): Promise<FormState> {
  try {
    const user = await requirePermission('purchases:update');
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'أدخل مبلغاً صالحاً' };
    }

    const order = await db.purchaseOrder.findUnique({ where: { id: purchaseId } });
    if (!order) return { ok: false, error: 'أمر الشراء غير موجود' };

    const remaining = round(order.total - order.paidAmount);
    if (amount > remaining) {
      return { ok: false, error: `المبلغ أكبر من المتبقي (${remaining})` };
    }

    await db.$transaction([
      db.purchaseOrder.update({
        where: { id: purchaseId },
        data: { paidAmount: { increment: amount } },
      }),
      db.supplier.update({
        where: { id: order.supplierId },
        data: { balance: { decrement: amount } },
      }),
    ]);

    await audit({
      action: 'PAYMENT',
      entity: 'PurchaseOrder',
      entityId: purchaseId,
      summary: `دفعة للمورد على أمر ${order.number}: ${amount}`,
      user,
    });

    revalidatePath(`/purchases/${purchaseId}`);
    revalidatePath('/suppliers');
    return { ok: true, message: 'تم تسجيل الدفعة' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر تسجيل الدفعة' };
  }
}
