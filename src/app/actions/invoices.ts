'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import { requirePermission, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextNumber } from '@/lib/numbering';
import { invoiceSchema, paymentSchema, firstError, fieldErrors } from '@/lib/validation';
import { getSettings, getShopInfo, getFinanceSettings } from '@/lib/settings';
import { consumeStock, returnStock, InsufficientStockError } from '@/lib/inventory';
import {
  calculatePricing,
  lineTotal,
  evaluateCoupon,
  loyaltyPointsFor,
  paymentStatusFor,
} from '@/lib/pricing';
import { queueNotification } from '@/lib/notifications';
import { addDays, round, formatMoney, normalizePhone } from '@/lib/utils';
import type { FormState } from './customers';
import type { NotificationChannel } from '@/lib/constants';

/**
 * إنشاء فاتورة.
 * كل شيء داخل معاملة واحدة: البنود، خصم المخزون، الدفعة الأولى،
 * الضمانات، نقاط الولاء، وتحديث رصيد العميل.
 */
export async function createInvoiceAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let createdId: string;
  const redirectTo = String(formData.get('redirectTo') ?? '');

  try {
    const user = await requirePermission('invoices:create');

    const payloadRaw = formData.get('payload');
    if (typeof payloadRaw !== 'string') return { ok: false, error: 'بيانات النموذج مفقودة' };

    const parsed = invoiceSchema.safeParse(JSON.parse(payloadRaw));
    if (!parsed.success) {
      return { ok: false, error: firstError(parsed.error), errors: fieldErrors(parsed.error) };
    }
    const input = parsed.data;

    const settings = await getSettings();
    const loyaltyEnabled = settings['loyalty.enabled'] === 'true';
    const pointsPerUnit = Number(settings['loyalty.pointsPerUnit'] ?? 1);
    const unitValue = Number(settings['loyalty.unitValue'] ?? 100);

    const invoice = await db.$transaction(async (tx) => {
      // 1) الكوبون
      let couponId: string | null = null;
      let couponDiscount = 0;

      if (input.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: input.couponCode.toUpperCase() },
        });
        if (coupon) {
          const preSubtotal = round(input.items.reduce((s, i) => s + lineTotal(i), 0));
          const check = evaluateCoupon(coupon, preSubtotal);
          if (!check.valid) throw new Error(check.reason);
          couponId = coupon.id;
          couponDiscount = check.discount;
        } else {
          throw new Error('الكوبون غير موجود');
        }
      }

      // 2) الحسابات
      const pricing = calculatePricing({
        items: input.items,
        discountType: input.discountType,
        discountValue: input.discountValue,
        taxRate: input.taxRate,
        couponDiscount,
      });

      const paymentAmount = Math.min(input.payment?.amount ?? 0, pricing.total);
      const status = paymentStatusFor(pricing.total, paymentAmount);
      const now = new Date();

      const branch = user.branchId
        ? null
        : await tx.branch.findFirst({ where: { isDefault: true }, select: { id: true } });

      // 3) الفاتورة
      const created = await tx.invoice.create({
        data: {
          number: await nextNumber('INV', tx),
          type: input.type,
          customerId: input.customerId || null,
          repairOrderId: input.repairOrderId || null,
          branchId: user.branchId ?? branch?.id ?? null,
          userId: user.id,
          status,
          subtotal: pricing.subtotal,
          discountType: input.discountType,
          discountValue: input.discountValue,
          discountAmount: pricing.discountAmount,
          taxRate: input.taxRate,
          taxAmount: pricing.taxAmount,
          total: pricing.total,
          paidAmount: paymentAmount,
          dueAmount: round(pricing.total - paymentAmount),
          costTotal: pricing.costTotal,
          profit: pricing.profit,
          couponId,
          notes: input.notes,
          terms: input.terms ?? settings['invoice.terms'] ?? null,
          warrantyDays: input.warrantyDays,
          warrantyEndsAt:
            input.warrantyDays > 0 ? addDays(now, input.warrantyDays) : null,
          dueDate: input.dueDate ?? null,
          paidAt: status === 'PAID' ? now : null,
          items: {
            create: input.items.map((item) => ({
              kind: item.kind,
              productId: item.productId || null,
              serviceId: item.serviceId || null,
              name: item.name,
              description: item.description ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              discount: item.discount,
              taxRate: item.taxRate,
              total: lineTotal(item),
            })),
          },
        },
        include: { items: true },
      });

      // 4) خصم المخزون للمنتجات المباعة
      const products = created.items
        .filter((i) => i.kind === 'PRODUCT' && i.productId)
        .map((i) => ({ productId: i.productId as string, quantity: i.quantity }));
      if (products.length) {
        await consumeStock(tx, products, {
          refType: 'Invoice',
          refId: created.id,
          refNumber: created.number,
          userId: user.id,
          branchId: created.branchId,
          reason: `بيع — ${created.number}`,
        });
      }

      // 5) الدفعة
      if (paymentAmount > 0 && input.payment) {
        await tx.payment.create({
          data: {
            invoiceId: created.id,
            customerId: input.customerId || null,
            amount: paymentAmount,
            method: input.payment.method,
            reference: input.payment.reference ?? null,
            userId: user.id,
          },
        });
      }

      // 6) استخدام الكوبون
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // 7) الضمانات لكل منتج له مدة ضمان
      for (const item of created.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { warrantyDays: true, name: true },
        });
        if (!product?.warrantyDays || !input.customerId) continue;
        await tx.warranty.create({
          data: {
            number: await nextNumber('WR', tx),
            customerId: input.customerId,
            invoiceId: created.id,
            itemName: product.name,
            days: product.warrantyDays,
            startsAt: now,
            endsAt: addDays(now, product.warrantyDays),
            status: 'ACTIVE',
          },
        });
      }

      // ضمان على مستوى الفاتورة (خدمات/صيانة)
      if (input.warrantyDays > 0 && input.customerId) {
        await tx.warranty.create({
          data: {
            number: await nextNumber('WR', tx),
            customerId: input.customerId,
            invoiceId: created.id,
            itemName: `فاتورة ${created.number}`,
            days: input.warrantyDays,
            startsAt: now,
            endsAt: addDays(now, input.warrantyDays),
            terms: settings['invoice.terms'] ?? null,
            status: 'ACTIVE',
          },
        });
      }

      // 8) تحديث العميل: الإحصائيات، الرصيد، نقاط الولاء
      if (input.customerId) {
        const unpaid = round(pricing.total - paymentAmount);
        const points = loyaltyEnabled
          ? loyaltyPointsFor(pricing.total, pointsPerUnit, unitValue)
          : 0;

        await tx.customer.update({
          where: { id: input.customerId },
          data: {
            totalPurchases: { increment: input.type === 'REPAIR' ? 0 : pricing.total },
            totalRepairs: { increment: input.type === 'REPAIR' ? pricing.total : 0 },
            balance: unpaid > 0 ? { decrement: unpaid } : undefined,
            loyaltyPoints: points > 0 ? { increment: points } : undefined,
          },
        });

        if (points > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              customerId: input.customerId,
              points,
              reason: `فاتورة ${created.number}`,
              refType: 'Invoice',
              refId: created.id,
            },
          });
        }
      }

      // 9) ربط الفاتورة بأمر الصيانة
      if (input.repairOrderId) {
        await tx.repairOrder.update({
          where: { id: input.repairOrderId },
          data: { finalCost: pricing.total },
        });
      }

      return created;
    });

    await audit({
      action: 'CREATE',
      entity: 'Invoice',
      entityId: invoice.id,
      summary: `فاتورة ${invoice.number} بقيمة ${invoice.total}`,
      after: { number: invoice.number, total: invoice.total, status: invoice.status },
      user,
    });

    createdId = invoice.id;
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof InsufficientStockError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message.startsWith('الكوبون')) {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes('الحد الأدنى')) {
      return { ok: false, error: error.message };
    }
    console.error('[createInvoice]', error);
    return { ok: false, error: 'تعذّر إنشاء الفاتورة' };
  }

  revalidatePath('/invoices');
  revalidatePath('/dashboard');

  if (redirectTo === 'none') {
    return { ok: true, message: 'تم إنشاء الفاتورة', id: createdId };
  }
  redirect(`/invoices/${createdId}?created=1`);
}

/** تسجيل دفعة على فاتورة */
export async function addPaymentAction(
  invoiceId: string,
  amount: number,
  method: string,
  reference?: string,
  notes?: string,
): Promise<FormState> {
  try {
    const user = await requirePermission('payments:create');

    const parsed = paymentSchema.safeParse({
      invoiceId,
      amount,
      method,
      reference: reference ?? '',
      notes: notes ?? '',
    });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { ok: false, error: 'الفاتورة غير موجودة' };
    if (invoice.status === 'CANCELLED') return { ok: false, error: 'الفاتورة ملغاة' };

    const remaining = round(invoice.total - invoice.paidAmount);
    if (parsed.data.amount > remaining + 0.009) {
      return { ok: false, error: `المبلغ أكبر من المتبقي (${remaining})` };
    }

    const newPaid = round(invoice.paidAmount + parsed.data.amount);
    const status = paymentStatusFor(invoice.total, newPaid);

    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          customerId: invoice.customerId,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          userId: user.id,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid,
          dueAmount: round(invoice.total - newPaid),
          status,
          paidAt: status === 'PAID' ? new Date() : null,
        },
      });

      // الدفعة تقلل دَين العميل
      if (invoice.customerId) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { balance: { increment: parsed.data.amount } },
        });
      }
    });

    await audit({
      action: 'PAYMENT',
      entity: 'Invoice',
      entityId: invoiceId,
      summary: `دفعة ${parsed.data.amount} على الفاتورة ${invoice.number} (${parsed.data.method})`,
      user,
    });

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/invoices');
    revalidatePath('/payments');
    return { ok: true, message: 'تم تسجيل الدفعة' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[addPayment]', error);
    return { ok: false, error: 'تعذّر تسجيل الدفعة' };
  }
}

/** إلغاء فاتورة: إرجاع المخزون وعكس الأثر المالي */
export async function cancelInvoiceAction(
  invoiceId: string,
  reason: string,
): Promise<FormState> {
  try {
    const user = await requirePermission('invoices:delete');

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!invoice) return { ok: false, error: 'الفاتورة غير موجودة' };
    if (invoice.status === 'CANCELLED') return { ok: false, error: 'الفاتورة ملغاة مسبقاً' };

    await db.$transaction(async (tx) => {
      // إرجاع المنتجات للمخزون
      const products = invoice.items
        .filter((i) => i.kind === 'PRODUCT' && i.productId)
        .map((i) => ({ productId: i.productId as string, quantity: i.quantity }));
      if (products.length) {
        await returnStock(tx, products, {
          refType: 'Invoice',
          refId: invoice.id,
          refNumber: invoice.number,
          userId: user.id,
          branchId: invoice.branchId,
          reason: `إلغاء الفاتورة ${invoice.number}`,
        });
      }

      // عكس أثر العميل
      if (invoice.customerId) {
        const unpaid = round(invoice.total - invoice.paidAmount);
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: {
            totalPurchases: {
              decrement: invoice.type === 'REPAIR' ? 0 : invoice.total,
            },
            totalRepairs: { decrement: invoice.type === 'REPAIR' ? invoice.total : 0 },
            balance: unpaid > 0 ? { increment: unpaid } : undefined,
          },
        });

        // سحب نقاط الولاء الممنوحة
        const loyalty = await tx.loyaltyTransaction.findFirst({
          where: { refType: 'Invoice', refId: invoice.id },
        });
        if (loyalty) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { loyaltyPoints: { decrement: loyalty.points } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              customerId: invoice.customerId,
              points: -loyalty.points,
              reason: `إلغاء الفاتورة ${invoice.number}`,
              refType: 'Invoice',
              refId: invoice.id,
            },
          });
        }
      }

      // إبطال الضمانات المرتبطة
      await tx.warranty.updateMany({
        where: { invoiceId: invoice.id },
        data: { status: 'VOID' },
      });

      // تحرير الكوبون
      if (invoice.couponId) {
        await tx.coupon.update({
          where: { id: invoice.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED',
          notes: invoice.notes
            ? `${invoice.notes}\n[ملغاة] ${reason}`
            : `[ملغاة] ${reason}`,
        },
      });
    });

    await audit({
      action: 'DELETE',
      entity: 'Invoice',
      entityId: invoiceId,
      summary: `إلغاء الفاتورة ${invoice.number}: ${reason}`,
      before: { status: invoice.status },
      after: { status: 'CANCELLED' },
      user,
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/dashboard');
    return { ok: true, message: 'تم إلغاء الفاتورة وإرجاع المخزون' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[cancelInvoice]', error);
    return { ok: false, error: 'تعذّر إلغاء الفاتورة' };
  }
}

/** التحقق من كوبون قبل تطبيقه (يُستدعى من نقطة البيع) */
export async function checkCouponAction(
  code: string,
  subtotal: number,
): Promise<{ ok: boolean; discount?: number; error?: string }> {
  try {
    await requirePermission('invoices:create');
    const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon) return { ok: false, error: 'الكوبون غير موجود' };

    const result = evaluateCoupon(coupon, subtotal);
    if (!result.valid) return { ok: false, error: result.reason };
    return { ok: true, discount: result.discount };
  } catch {
    return { ok: false, error: 'تعذّر التحقق من الكوبون' };
  }
}

/** إرسال الفاتورة للعميل عبر قناة إشعار */
export async function sendInvoiceNotificationAction(
  invoiceId: string,
  channel: NotificationChannel,
): Promise<FormState> {
  try {
    const user = await requirePermission('notifications:create');

    const [invoice, shop, finance] = await Promise.all([
      db.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true },
      }),
      getShopInfo(),
      getFinanceSettings(),
    ]);

    if (!invoice) return { ok: false, error: 'الفاتورة غير موجودة' };
    if (!invoice.customer) return { ok: false, error: 'الفاتورة بلا عميل مسجّل' };

    const to =
      channel === 'EMAIL'
        ? (invoice.customer.email ?? '')
        : normalizePhone(invoice.customer.phone);
    if (!to) return { ok: false, error: 'لا توجد بيانات تواصل للعميل على هذه القناة' };

    const money = (v: number) =>
      formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale: 'ar' });

    await queueNotification({
      key: invoice.dueAmount > 0 ? 'invoice.due' : 'invoice.created',
      channel,
      to,
      customerId: invoice.customerId,
      refType: 'Invoice',
      refId: invoice.id,
      vars: {
        customerName: invoice.customer.firstName,
        invoiceNumber: invoice.number,
        total: money(invoice.total),
        amountDue: money(invoice.dueAmount),
        shopName: shop.name,
        shopPhone: shop.phone,
      },
    });

    await audit({
      action: 'NOTIFY',
      entity: 'Invoice',
      entityId: invoiceId,
      summary: `إرسال الفاتورة ${invoice.number} عبر ${channel}`,
      user,
    });

    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true, message: 'تم إرسال الإشعار' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    return { ok: false, error: 'تعذّر إرسال الإشعار' };
  }
}

/** إنشاء خطة أقساط لفاتورة */
export async function createInstallmentPlanAction(
  invoiceId: string,
  months: number,
  downPayment: number,
  startDate: Date,
): Promise<FormState> {
  try {
    const user = await requirePermission('invoices:create');

    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { ok: false, error: 'الفاتورة غير موجودة' };
    if (!invoice.customerId) return { ok: false, error: 'الفاتورة بلا عميل — لا يمكن التقسيط' };
    if (months < 1 || months > 60) return { ok: false, error: 'عدد الأشهر يجب أن يكون بين 1 و60' };

    const financed = round(invoice.total - downPayment);
    if (financed <= 0) return { ok: false, error: 'المبلغ المتبقي للتقسيط صفر' };

    const monthly = round(financed / months);

    await db.$transaction(async (tx) => {
      const plan = await tx.installmentPlan.create({
        data: {
          number: await nextNumber('INS', tx),
          customerId: invoice.customerId!,
          invoiceId: invoice.id,
          totalAmount: invoice.total,
          downPayment,
          months,
          startDate,
          status: 'ACTIVE',
        },
      });

      // آخر قسط يستوعب فروق التقريب
      const installments: Prisma.InstallmentCreateManyInput[] = [];
      let allocated = 0;
      for (let i = 1; i <= months; i++) {
        const amount = i === months ? round(financed - allocated) : monthly;
        allocated = round(allocated + amount);
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({ planId: plan.id, sequence: i, amount, dueDate });
      }
      await tx.installment.createMany({ data: installments });
    });

    await audit({
      action: 'CREATE',
      entity: 'InstallmentPlan',
      entityId: invoiceId,
      summary: `خطة أقساط للفاتورة ${invoice.number}: ${months} شهر`,
      user,
    });

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/installments');
    return { ok: true, message: 'تم إنشاء خطة الأقساط' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[createInstallmentPlan]', error);
    return { ok: false, error: 'تعذّر إنشاء خطة الأقساط' };
  }
}

/** تسديد قسط */
export async function payInstallmentAction(
  installmentId: string,
  method: string,
): Promise<FormState> {
  try {
    const user = await requirePermission('payments:create');

    const installment = await db.installment.findUnique({
      where: { id: installmentId },
      include: { plan: { include: { invoice: true } } },
    });
    if (!installment) return { ok: false, error: 'القسط غير موجود' };
    if (installment.status === 'PAID') return { ok: false, error: 'القسط مسدّد مسبقاً' };

    await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: installment.plan.invoiceId,
          customerId: installment.plan.customerId,
          amount: installment.amount,
          method,
          notes: `قسط ${installment.sequence} من خطة ${installment.plan.number}`,
          userId: user.id,
          installmentId: installment.id,
        },
      });

      await tx.installment.update({
        where: { id: installmentId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      // تحديث الفاتورة المرتبطة
      if (installment.plan.invoice) {
        const invoice = installment.plan.invoice;
        const newPaid = round(invoice.paidAmount + installment.amount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            dueAmount: round(invoice.total - newPaid),
            status: paymentStatusFor(invoice.total, newPaid),
          },
        });
      }

      await tx.customer.update({
        where: { id: installment.plan.customerId },
        data: { balance: { increment: installment.amount } },
      });

      // إغلاق الخطة عند سداد كل الأقساط
      const pending = await tx.installment.count({
        where: { planId: installment.planId, status: { not: 'PAID' } },
      });
      if (pending === 0) {
        await tx.installmentPlan.update({
          where: { id: installment.planId },
          data: { status: 'COMPLETED' },
        });
      }

      return payment;
    });

    await audit({
      action: 'PAYMENT',
      entity: 'Installment',
      entityId: installmentId,
      summary: `سداد قسط ${installment.sequence} بقيمة ${installment.amount}`,
      user,
    });

    revalidatePath('/installments');
    return { ok: true, message: 'تم تسديد القسط' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error('[payInstallment]', error);
    return { ok: false, error: 'تعذّر تسديد القسط' };
  }
}
