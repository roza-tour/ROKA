/**
 * تعبئة قاعدة البيانات بالبيانات الأساسية.
 * آمن للتشغيل المتكرر (idempotent) — لا يكرّر السجلات الموجودة.
 *
 * التشغيل:  npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  SERVICE_CATALOG,
  EXPENSE_CATEGORIES,
  PRODUCT_CATEGORIES,
  NOTIFICATION_TEMPLATES,
} from './seed-data/services';

const db = new PrismaClient();

const DEFAULT_SETTINGS: Record<string, string> = {
  'shop.name': 'ROKA',
  'shop.legalName': 'ROKA — بيع وصيانة الأجهزة الإلكترونية',
  'shop.phone': '',
  'shop.email': '',
  'shop.address': '',
  'finance.currency': 'DZD',
  'finance.taxRate': '0',
  'finance.taxEnabled': 'false',
  'finance.decimals': '2',
  'repair.defaultWarrantyDays': '30',
  'repair.defaultTurnaroundDays': '3',
  'repair.terms':
    'المحل غير مسؤول عن أي بيانات مفقودة أثناء الصيانة. يجب استلام الجهاز خلال 30 يوماً من تاريخ إشعار الجاهزية. الضمان لا يشمل الكسر أو دخول الماء أو سوء الاستخدام أو فتح الجهاز لدى جهة أخرى.',
  'invoice.terms':
    'البضاعة المباعة لا تُرد ولا تُستبدل بعد 48 ساعة إلا بعيب مصنعي. الضمان حسب الشروط المذكورة أعلاه.',
  'invoice.footer': 'شكراً لتعاملكم معنا',
  'loyalty.enabled': 'true',
  'loyalty.pointsPerUnit': '1',
  'loyalty.unitValue': '100',
  'notifications.autoOnStatusChange': 'true',
  'notifications.defaultChannel': 'SMS',
  'inventory.lowStockAlert': 'true',
  'ui.defaultLocale': 'ar',
  'ui.theme': 'system',
};

async function main() {
  console.log('🌱 بدء تعبئة قاعدة البيانات…\n');

  // ------------------------------------------------------------ الفرع الرئيسي
  const branch = await db.branch.upsert({
    where: { code: 'MAIN' },
    create: {
      code: 'MAIN',
      name: 'الفرع الرئيسي',
      isDefault: true,
      isActive: true,
    },
    update: {},
  });
  console.log(`✓ الفرع: ${branch.name}`);

  // -------------------------------------------------------------- الإعدادات
  let settingsCount = 0;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db.setting.findUnique({ where: { key } });
    if (!existing) {
      await db.setting.create({
        data: { key, value, group: key.split('.')[0] ?? 'general' },
      });
      settingsCount++;
    }
  }
  console.log(`✓ الإعدادات: ${settingsCount} إعداد جديد`);

  // ------------------------------------------------------------- المدير الأول
  const adminUsername = (process.env.SEED_ADMIN_USERNAME ?? 'admin').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@roka.local').toLowerCase();

  const existingAdmin = await db.user.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        fullName: 'مدير النظام',
        role: 'ADMIN',
        jobTitle: 'مدير',
        isActive: true,
        mustChangePw: true,
        branchId: branch.id,
        hireDate: new Date(),
      },
    });
    console.log(`✓ المدير: ${adminUsername} / ${adminPassword}`);
    console.log('  ⚠️  غيّر كلمة المرور فوراً بعد أول تسجيل دخول');
  } else {
    console.log(`· المدير موجود مسبقاً: ${adminUsername}`);
  }

  // -------------------------------------------------------- تصنيفات الخدمات
  let categoryCount = 0;
  let serviceCount = 0;

  for (const [index, cat] of SERVICE_CATALOG.entries()) {
    let category = await db.serviceCategory.findFirst({ where: { name: cat.name } });
    if (!category) {
      category = await db.serviceCategory.create({
        data: {
          name: cat.name,
          nameFr: cat.nameFr,
          nameEn: cat.nameEn,
          deviceType: cat.deviceType,
          icon: cat.icon,
          sortOrder: index,
        },
      });
      categoryCount++;
    }

    for (const [i, svc] of cat.services.entries()) {
      const existing = await db.service.findUnique({ where: { code: svc.code } });
      if (existing) continue;
      await db.service.create({
        data: {
          code: svc.code,
          name: svc.name,
          nameFr: svc.nameFr,
          nameEn: svc.nameEn,
          categoryId: category.id,
          deviceType: cat.deviceType,
          description: svc.description ?? null,
          price: svc.price,
          cost: svc.cost ?? 0,
          estimatedMinutes: svc.minutes,
          warrantyDays: svc.warrantyDays,
          requiresParts: svc.requiresParts ?? false,
          sortOrder: i,
        },
      });
      serviceCount++;
    }
  }
  console.log(`✓ الخدمات: ${categoryCount} تصنيف، ${serviceCount} خدمة`);

  // -------------------------------------------------------- تصنيفات المنتجات
  let productCatCount = 0;
  for (const [index, cat] of PRODUCT_CATEGORIES.entries()) {
    const existing = await db.productCategory.findFirst({ where: { name: cat.name } });
    if (existing) continue;
    await db.productCategory.create({
      data: {
        name: cat.name,
        nameFr: cat.nameFr,
        nameEn: cat.nameEn,
        icon: cat.icon,
        sortOrder: index,
      },
    });
    productCatCount++;
  }
  console.log(`✓ تصنيفات المنتجات: ${productCatCount}`);

  // ------------------------------------------------------ تصنيفات المصروفات
  let expenseCatCount = 0;
  for (const [index, cat] of EXPENSE_CATEGORIES.entries()) {
    const existing = await db.expenseCategory.findUnique({ where: { name: cat.name } });
    if (existing) continue;
    await db.expenseCategory.create({
      data: {
        name: cat.name,
        nameFr: cat.nameFr,
        nameEn: cat.nameEn,
        icon: cat.icon,
        color: cat.color,
        isRecurringDefault: cat.recurring,
        sortOrder: index,
      },
    });
    expenseCatCount++;
  }
  console.log(`✓ تصنيفات المصروفات: ${expenseCatCount}`);

  // -------------------------------------------------------- قوالب الإشعارات
  let templateCount = 0;
  for (const tpl of NOTIFICATION_TEMPLATES) {
    for (const channel of ['SMS', 'WHATSAPP', 'EMAIL'] as const) {
      for (const [locale, body] of Object.entries({
        ar: tpl.ar,
        fr: tpl.fr,
        en: tpl.en,
      })) {
        const existing = await db.notificationTemplate.findUnique({
          where: { key_channel_locale: { key: tpl.key, channel, locale } },
        });
        if (existing) continue;
        await db.notificationTemplate.create({
          data: {
            key: tpl.key,
            channel,
            locale,
            subject: channel === 'EMAIL' ? subjectFor(tpl.key, locale) : null,
            body,
          },
        });
        templateCount++;
      }
    }
  }
  console.log(`✓ قوالب الإشعارات: ${templateCount}`);

  console.log('\n✅ اكتملت التعبئة بنجاح');
}

function subjectFor(key: string, locale: string): string {
  const subjects: Record<string, Record<string, string>> = {
    'repair.received': {
      ar: 'تم استلام جهازك',
      fr: 'Appareil reçu',
      en: 'Device received',
    },
    'repair.ready': {
      ar: 'جهازك جاهز للاستلام',
      fr: 'Votre appareil est prêt',
      en: 'Your device is ready',
    },
    'repair.waiting_approval': {
      ar: 'بانتظار موافقتك على الإصلاح',
      fr: 'Votre accord est requis',
      en: 'Your approval is required',
    },
    'warranty.expiring': {
      ar: 'ضمانك يقترب من الانتهاء',
      fr: 'Votre garantie expire bientôt',
      en: 'Your warranty is expiring soon',
    },
    'invoice.created': {
      ar: 'فاتورتك',
      fr: 'Votre facture',
      en: 'Your invoice',
    },
  };
  return subjects[key]?.[locale] ?? 'ROKA';
}

main()
  .catch((error) => {
    console.error('❌ فشلت التعبئة:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
