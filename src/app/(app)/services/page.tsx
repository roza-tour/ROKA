import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { getFinanceSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { formatMoney, formatNumber } from '@/lib/utils';
import { DEVICE_TYPES } from '@/lib/constants';

import { PageHeader } from '@/components/ui/page';
import { SearchFilters } from '@/components/ui/search-filters';
import { ServiceCatalog } from './service-catalog';

export const metadata: Metadata = { title: 'كتالوج الخدمات' };
export const dynamic = 'force-dynamic';

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pagePermission('services:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const finance = await getFinanceSettings();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : '';
  const deviceType = typeof params.deviceType === 'string' ? params.deviceType : '';
  const showInactive = params.status === 'inactive';

  const where: Prisma.ServiceWhereInput = {
    isActive: !showInactive,
    ...(categoryId ? { categoryId } : {}),
    ...(deviceType ? { deviceType } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { description: { contains: q } },
            { nameFr: { contains: q } },
            { nameEn: { contains: q } },
          ],
        }
      : {}),
  };

  const [services, categories, stats] = await Promise.all([
    db.service.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.serviceCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, deviceType: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.service.aggregate({ where: { isActive: true }, _count: true, _avg: { price: true } }),
  ]);

  const money = (v: number) =>
    formatMoney(v, { currency: finance.currency, decimals: finance.decimals, locale });

  return (
    <div>
      <PageHeader
        title={t.service.title}
        description={`${formatNumber(stats._count, locale)} خدمة · متوسط السعر ${money(stats._avg.price ?? 0)}`}
      />

      <SearchFilters
        placeholder="ابحث باسم الخدمة أو رمزها"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'categoryId',
            label: t.service.category,
            options: categories.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: 'deviceType',
            label: t.service.deviceType,
            options: [
              { value: 'ALL', label: t.app.all },
              ...DEVICE_TYPES.map((dt) => ({ value: dt, label: t.device.types[dt] })),
            ],
          },
          {
            name: 'status',
            label: t.service.active,
            options: [{ value: 'inactive', label: 'معطّلة' }],
          },
        ]}
      />

      <ServiceCatalog
        services={services.map((service) => ({
          id: service.id,
          code: service.code,
          name: service.name,
          nameFr: service.nameFr,
          nameEn: service.nameEn,
          categoryId: service.categoryId,
          categoryName: service.category?.name ?? null,
          deviceType: service.deviceType,
          description: service.description,
          price: service.price,
          cost: service.cost,
          estimatedMinutes: service.estimatedMinutes,
          warrantyDays: service.warrantyDays,
          requiresParts: service.requiresParts,
          isActive: service.isActive,
        }))}
        categories={categories}
        canEdit={can(user, 'services:create')}
        canDelete={can(user, 'services:delete')}
        currency={finance.currency}
        decimals={finance.decimals}
        locale={locale}
        deviceTypeLabels={t.device.types as Record<string, string>}
        labels={{
          newService: t.service.new,
          newCategory: t.service.newCategory,
          bulkPrices: t.service.bulkPriceUpdate,
          code: t.service.code,
          name: t.service.name,
          nameFr: 'الاسم بالفرنسية',
          nameEn: 'الاسم بالإنجليزية',
          category: t.service.category,
          deviceType: t.service.deviceType,
          description: t.service.description,
          price: t.service.price,
          cost: t.service.cost,
          duration: t.service.duration,
          warranty: t.service.warranty,
          requiresParts: t.service.requiresParts,
          active: t.service.active,
          margin: t.product.margin,
          edit: t.actions.edit,
          delete: t.actions.delete,
          save: t.actions.save,
          cancel: t.actions.cancel,
          confirmDelete: t.app.confirmDelete,
          empty: t.app.noData,
          all: t.app.all,
          none: t.app.none,
          mode: 'طريقة التعديل',
          percent: t.invoice.percent,
          fixed: t.invoice.fixed,
          value: 'القيمة',
          apply: t.app.apply,
          bulkHint: 'قيمة موجبة تزيد الأسعار، وسالبة تنقصها',
          minutes: 'دقيقة',
          days: 'يوم',
        }}
      />
    </div>
  );
}
