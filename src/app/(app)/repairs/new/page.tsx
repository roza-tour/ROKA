import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';

import { getI18n } from '@/i18n';
import { getSettings, getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { fullName } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page';
import { RepairIntakeForm, type IntakeLabels } from './repair-intake-form';
import { DEVICE_TYPES, REPAIR_PRIORITIES } from '@/lib/constants';

export const metadata: Metadata = { title: 'استقبال جهاز' };
export const dynamic = 'force-dynamic';

export default async function NewRepairPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('repairs:create');
  const { locale, t } = await getI18n();
  const settings = await getSettings();
  const finance = await getFinanceSettings();
  const params = await searchParams;
  const preselectedCustomerId =
    typeof params.customerId === 'string' ? params.customerId : undefined;

  const [customers, services, products, technicians] = await Promise.all([
    db.customer.findMany({
      where: { isActive: true, isBlocked: false },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        devices: {
          select: {
            id: true,
            type: true,
            brand: true,
            model: true,
            color: true,
            imei: true,
            serialNumber: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    db.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        cost: true,
        deviceType: true,
        warrantyDays: true,
        category: { select: { name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.product.findMany({
      where: { isActive: true, type: { in: ['PART', 'ACCESSORY', 'CONSUMABLE'] } },
      select: {
        id: true,
        sku: true,
        name: true,
        sellPrice: true,
        costPrice: true,
        quantity: true,
      },
      orderBy: { name: 'asc' },
      take: 800,
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ['TECHNICIAN', 'MANAGER', 'ADMIN'] } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  // تجميع كل النصوص في خريطة مسطّحة يستهلكها مكوّن العميل
  const labels: IntakeLabels = {
    customerSection: t.repair.customer,
    deviceSection: t.repair.device,
    problemSection: t.repair.problem,
    accessoriesSection: t.repair.accessories,
    conditionSection: t.repair.conditionReport,
    itemsSection: t.repair.servicesAndParts,
    costSection: t.repair.estimatedCost,
    signaturesSection: t.repair.customerSignature,

    searchCustomer: t.customer.searchHint,
    newCustomer: t.customer.new,
    change: t.actions.edit,
    noResults: t.app.noResults,

    existingDevice: t.customer.devices,
    newDevice: t.device.new,
    deviceType: t.device.type,
    brand: t.device.brand,
    model: t.device.model,
    color: t.device.color,
    serialNumber: t.device.serialNumber,
    imei: t.device.imei,
    passcode: t.device.passcode,
    passcodeHint: t.device.passcodeHint,

    problem: t.repair.problem,
    problemPlaceholder: 'مثال: الشاشة مكسورة ولا تستجيب للمس',
    faultCategory: t.repair.faultCategory,
    faultCategoryHint: 'يُستخدم في تقرير الأعطال الأكثر تكراراً',
    priority: t.repair.priority,
    technician: t.repair.technician,
    unassigned: t.app.none,
    internalNotes: t.repair.internalNotes,
    internalNotesHint: 'لا تظهر للعميل',

    accessoriesHint: 'حدّد ما استُلم مع الجهاز',
    otherAccessories: 'ملحقات أخرى',
    otherAccessoriesPlaceholder: 'اكتب أي ملحق غير مذكور أعلاه',

    conditionHint: t.repair.damageMarksHint,
    components: 'مكوّنات الجهاز',
    physicalMarks: 'علامات فيزيائية',
    setAll: 'تعيين الكل:',
    damageMarks: t.repair.damageMarks,
    damageMarksHint: t.repair.damageMarksHint,
    photos: t.repair.photos,
    addPhoto: t.actions.add,

    addService: t.repair.addService,
    addPart: t.repair.addPart,
    addCustom: t.invoice.addCustom,
    noItems: 'لم تُضف خدمات أو قطع بعد — يمكن إضافتها لاحقاً بعد الفحص',
    item: t.invoice.item,
    itemName: t.invoice.item,
    quantity: t.invoice.quantity,
    unitPrice: t.invoice.unitPrice,
    discount: t.invoice.discount,
    total: t.app.total,
    remove: t.actions.delete,
    service: t.service.single,
    part: 'قطعة',
    searchService: t.app.searchPlaceholder,
    searchPart: t.app.searchPlaceholder,
    stock: t.product.quantity,

    estimatedCost: t.repair.estimatedCost,
    deposit: t.repair.deposit,
    remaining: t.repair.remaining,
    promisedAt: t.repair.promisedAt,
    warrantyDays: t.repair.warrantyDays,

    signaturesHint: t.repair.signatureHint,
    customerSignature: t.repair.customerSignature,
    employeeSignature: t.repair.employeeSignature,
    signHere: t.repair.signatureHint,
    clearSignature: t.repair.clearSignature,

    save: t.actions.save,
    cancel: t.actions.cancel,
  };

  for (const type of DEVICE_TYPES) {
    labels[`deviceType_${type}`] = t.device.types[type];
  }
  for (const priority of REPAIR_PRIORITIES) {
    labels[`priority_${priority}`] = t.repair.priorities[priority];
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.repair.new}
        backHref="/repairs"
        breadcrumbs={[{ label: t.repair.title, href: '/repairs' }, { label: t.repair.new }]}
      />

      <RepairIntakeForm
        customers={customers.map((c) => ({
          id: c.id,
          code: c.code,
          name: fullName(c.firstName, c.lastName),
          phone: c.phone,
          devices: c.devices,
        }))}
        services={services.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          price: s.price,
          cost: s.cost,
          deviceType: s.deviceType,
          warrantyDays: s.warrantyDays,
          categoryName: s.category?.name ?? null,
        }))}
        products={products}
        technicians={technicians.map((u) => ({ id: u.id, name: u.fullName }))}
        defaults={{
          warrantyDays: Number(settings['repair.defaultWarrantyDays'] ?? 30),
          turnaroundDays: Number(settings['repair.defaultTurnaroundDays'] ?? 3),
        }}
        locale={locale}
        currency={finance.currency}
        decimals={finance.decimals}
        t={labels}
        preselectedCustomerId={preselectedCustomerId}
      />
    </div>
  );
}
