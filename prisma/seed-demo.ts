/**
 * بيانات تجريبية للاختبار والعرض التوضيحي.
 * ⚠️ لا تشغّلها على قاعدة بيانات إنتاجية.
 *
 * التشغيل:  npx tsx prisma/seed-demo.ts
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import crypto from 'node:crypto';

const db = new PrismaClient();

const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function nextNumber(prefix: string, tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(counter.value).padStart(6, '0')}`;
}

async function nextCode(prefix: string, tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { key: prefix },
    create: { key: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(6, '0')}`;
}

const FIRST_NAMES = ['محمد', 'أحمد', 'يوسف', 'عبد الرحمن', 'كريم', 'أمين', 'سفيان', 'فاطمة', 'خديجة', 'أمينة', 'ياسمين', 'نور'];
const LAST_NAMES = ['بن علي', 'العمراني', 'بوزيد', 'حمداوي', 'الطيب', 'مرابط', 'شريف', 'زروقي', 'بلعيد', 'قاسمي'];
const CITIES = ['الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'سطيف', 'باتنة', 'تلمسان'];

const PHONE_MODELS = [
  ['Apple', 'iPhone 13'], ['Apple', 'iPhone 12'], ['Apple', 'iPhone 14 Pro'],
  ['Samsung', 'Galaxy S22'], ['Samsung', 'Galaxy A54'], ['Samsung', 'Galaxy A14'],
  ['Xiaomi', 'Redmi Note 12'], ['Xiaomi', 'Poco X5'], ['Huawei', 'Nova 11'],
  ['Oppo', 'A78'], ['Infinix', 'Hot 30'], ['Realme', 'C55'],
];
const LAPTOP_MODELS = [
  ['HP', 'Pavilion 15'], ['Dell', 'Latitude 5420'], ['Lenovo', 'ThinkPad E14'],
  ['Asus', 'VivoBook 15'], ['Acer', 'Aspire 5'], ['Apple', 'MacBook Air M1'],
];

const FAULTS = [
  'شاشة مكسورة', 'لا يشحن', 'بطارية ضعيفة', 'لا يعمل', 'مشكلة برمجية',
  'دخول ماء', 'صوت', 'كاميرا', 'شبكة', 'حرارة مرتفعة',
];

const PROBLEMS = [
  'الشاشة مكسورة ولا تستجيب للمس',
  'الجهاز لا يشحن ويسخن عند التوصيل',
  'البطارية تنفد بسرعة خلال ساعتين',
  'الجهاز لا يعمل نهائياً بعد سقوطه',
  'الجهاز بطيء ويعلق كثيراً',
  'دخل الماء إلى الجهاز أمس',
  'السماعة لا تعمل أثناء المكالمات',
  'الكاميرا الخلفية ضبابية',
];

const PARTS = [
  { name: 'شاشة iPhone 13 أصلية', category: 'شاشات', cost: 5500, price: 8000, qty: 8 },
  { name: 'شاشة Samsung A54', category: 'شاشات', cost: 4200, price: 6500, qty: 6 },
  { name: 'شاشة Redmi Note 12', category: 'شاشات', cost: 2800, price: 4500, qty: 12 },
  { name: 'بطارية iPhone 12', category: 'بطاريات', cost: 2200, price: 3500, qty: 15 },
  { name: 'بطارية Samsung A14', category: 'بطاريات', cost: 1600, price: 2800, qty: 20 },
  { name: 'بطارية HP Pavilion', category: 'بطاريات', cost: 3800, price: 6000, qty: 4 },
  { name: 'منفذ شحن Type-C', category: 'منافذ شحن', cost: 600, price: 1500, qty: 30 },
  { name: 'منفذ شحن Lightning', category: 'منافذ شحن', cost: 800, price: 1800, qty: 18 },
  { name: 'كاميرا خلفية iPhone 13', category: 'كاميرات', cost: 2500, price: 4200, qty: 5 },
  { name: 'سماعة داخلية عامة', category: 'سماعات وميكروفونات', cost: 400, price: 1000, qty: 25 },
  { name: 'فلات باور عام', category: 'فلاتات', cost: 350, price: 900, qty: 22 },
  { name: 'SSD 512GB NVMe', category: 'ذاكرة وتخزين', cost: 6500, price: 9500, qty: 7 },
  { name: 'RAM 8GB DDR4', category: 'ذاكرة وتخزين', cost: 3200, price: 5000, qty: 10 },
  { name: 'معجون حراري MX-4', category: 'مستهلكات ورشة', cost: 900, price: 1800, qty: 6 },
];

const ACCESSORIES = [
  { name: 'شاحن سريع 25W', category: 'شواحن وكابلات', cost: 900, price: 1800, qty: 40 },
  { name: 'كابل Type-C مضفّر', category: 'شواحن وكابلات', cost: 350, price: 900, qty: 60 },
  { name: 'واقي شاشة زجاجي', category: 'واقيات شاشة', cost: 200, price: 800, qty: 100 },
  { name: 'جراب سيليكون شفاف', category: 'جرابات', cost: 250, price: 900, qty: 80 },
  { name: 'سماعة بلوتوث TWS', category: 'سماعات رأس', cost: 2200, price: 4000, qty: 15 },
  { name: 'باور بانك 10000mAh', category: 'شواحن وكابلات', cost: 2400, price: 4200, qty: 12 },
];

const EXPENSE_ITEMS: [string, string, number][] = [
  ['الإيجار', 'إيجار المحل', 45000],
  ['الكهرباء', 'فاتورة الكهرباء', 6500],
  ['الإنترنت', 'اشتراك الإنترنت', 3500],
  ['أدوات الصيانة', 'شراء مكواة لحام', 12000],
  ['مواد التنظيف', 'كحول تنظيف ومناديل', 2200],
  ['النقل', 'نقل بضاعة من المورد', 4000],
  ['الدعاية والإعلانات', 'إعلان ممول على فيسبوك', 8000],
];

async function main() {
  console.log('🎲 توليد بيانات تجريبية…\n');

  const branch = await db.branch.findFirst({ where: { isDefault: true } });
  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
  if (!branch || !admin) {
    throw new Error('شغّل npm run db:seed أولاً');
  }

  // ------------------------------------------------------------ الموظفون
  const bcrypt = (await import('bcryptjs')).default;
  const staffSpec = [
    { username: 'tech1', fullName: 'سمير بوعلام', role: 'TECHNICIAN', jobTitle: 'فني هواتف', salary: 45000 },
    { username: 'tech2', fullName: 'رياض مزيان', role: 'TECHNICIAN', jobTitle: 'فني حواسيب', salary: 48000 },
    { username: 'cashier1', fullName: 'ليلى حاجي', role: 'CASHIER', jobTitle: 'أمينة صندوق', salary: 38000 },
    { username: 'reception1', fullName: 'هدى بلقاسم', role: 'RECEPTIONIST', jobTitle: 'موظفة استقبال', salary: 35000 },
  ];

  const staff: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>[] = [];
  for (const spec of staffSpec) {
    const existing = await db.user.findUnique({ where: { username: spec.username } });
    if (existing) {
      staff.push(existing);
      continue;
    }
    staff.push(
      await db.user.create({
        data: {
          username: spec.username,
          email: `${spec.username}@fixel.local`,
          passwordHash: await bcrypt.hash('Demo@12345', 10),
          fullName: spec.fullName,
          phone: `05${randomInt(50, 59)}${randomInt(100000, 999999)}`,
          role: spec.role,
          jobTitle: spec.jobTitle,
          baseSalary: spec.salary,
          hireDate: addDays(new Date(), -randomInt(200, 900)),
          branchId: branch.id,
          isActive: true,
        },
      }),
    );
  }
  const technicians = staff.filter((s) => s.role === 'TECHNICIAN');
  console.log(`✓ الموظفون: ${staff.length}`);

  // ------------------------------------------------------------- الموردون
  const supplierNames = ['مؤسسة النور للقطع', 'الشرق للإلكترونيات', 'تك سبير بارتس'];
  const suppliers: NonNullable<Awaited<ReturnType<typeof db.supplier.findFirst>>>[] = [];
  for (const name of supplierNames) {
    const existing = await db.supplier.findFirst({ where: { name } });
    if (existing) {
      suppliers.push(existing);
      continue;
    }
    suppliers.push(
      await db.$transaction(async (tx) =>
        tx.supplier.create({
          data: {
            code: await nextCode('SUP', tx),
            name,
            company: name,
            phone: `02${randomInt(10, 99)}${randomInt(100000, 999999)}`,
            city: undefined,
            address: pick(CITIES),
          } as Prisma.SupplierUncheckedCreateInput,
        }),
      ),
    );
  }
  console.log(`✓ الموردون: ${suppliers.length}`);

  // ------------------------------------------------------------- المنتجات
  const categories = await db.productCategory.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  const products: NonNullable<Awaited<ReturnType<typeof db.product.findFirst>>>[] = [];
  for (const spec of [...PARTS, ...ACCESSORIES]) {
    const existing = await db.product.findFirst({ where: { name: spec.name } });
    if (existing) {
      products.push(existing);
      continue;
    }

    const isPart = PARTS.includes(spec as never);
    const product = await db.$transaction(async (tx) => {
      const skuCounter = await tx.counter.upsert({
        where: { key: 'SKU' },
        create: { key: 'SKU', value: 1 },
        update: { value: { increment: 1 } },
      });
      const barcodeCounter = await tx.counter.upsert({
        where: { key: 'BARCODE' },
        create: { key: 'BARCODE', value: 1 },
        update: { value: { increment: 1 } },
      });
      const body = `200${String(barcodeCounter.value).padStart(9, '0')}`;
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
      const barcode = body + String((10 - (sum % 10)) % 10);

      const created = await tx.product.create({
        data: {
          sku: `P${String(skuCounter.value).padStart(6, '0')}`,
          barcode,
          name: spec.name,
          type: isPart ? 'PART' : 'ACCESSORY',
          categoryId: categoryByName.get(spec.category) ?? null,
          costPrice: spec.cost,
          sellPrice: spec.price,
          quantity: spec.qty,
          minQuantity: Math.max(2, Math.floor(spec.qty * 0.2)),
          supplierId: pick(suppliers).id,
          warrantyDays: isPart ? 30 : 0,
          location: `رف ${pick(['A', 'B', 'C'])}-${randomInt(1, 9)}`,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: created.id,
          branchId: branch.id,
          type: 'IN',
          quantity: spec.qty,
          balanceAfter: spec.qty,
          unitCost: spec.cost,
          reason: 'رصيد افتتاحي',
          refType: 'MANUAL',
          userId: admin.id,
        },
      });

      return created;
    });
    products.push(product);
  }
  console.log(`✓ المنتجات: ${products.length}`);

  // -------------------------------------------------------------- العملاء
  const existingCustomers = await db.customer.count();
  const customers: NonNullable<Awaited<ReturnType<typeof db.customer.findFirst>>>[] = [];

  if (existingCustomers < 5) {
    for (let i = 0; i < 30; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const customer = await db.$transaction(async (tx) =>
        tx.customer.create({
          data: {
            code: await nextCode('CUS', tx),
            firstName,
            lastName,
            phone: `0${pick(['5', '6', '7'])}${randomInt(10, 99)}${randomInt(100000, 999999)}`,
            city: pick(CITIES),
            email: Math.random() > 0.6 ? `customer${i}@example.com` : null,
            branchId: branch.id,
            createdAt: addDays(new Date(), -randomInt(1, 300)),
          },
        }),
      );
      customers.push(customer);
    }
  } else {
    customers.push(...(await db.customer.findMany({ take: 30 })));
  }
  console.log(`✓ العملاء: ${customers.length}`);

  // -------------------------------------------------------------- الأجهزة
  const devices: NonNullable<Awaited<ReturnType<typeof db.device.findFirst>>>[] = [];
  for (const customer of customers) {
    const count = randomInt(1, 2);
    for (let i = 0; i < count; i++) {
      const isPhone = Math.random() > 0.25;
      const [brand, model] = isPhone ? pick(PHONE_MODELS) : pick(LAPTOP_MODELS);
      devices.push(
        await db.device.create({
          data: {
            customerId: customer.id,
            type: isPhone ? 'PHONE' : 'LAPTOP',
            brand,
            model,
            color: pick(['أسود', 'أبيض', 'أزرق', 'ذهبي', 'رمادي']),
            imei: isPhone ? String(randomInt(100000000000000, 999999999999999)) : null,
            serialNumber: isPhone ? null : `SN${randomInt(1000000, 9999999)}`,
          },
        }),
      );
    }
  }
  console.log(`✓ الأجهزة: ${devices.length}`);

  // -------------------------------------------------------- أوامر الصيانة
  const services = await db.service.findMany({ where: { isActive: true } });
  const parts = products.filter((p) => p.type === 'PART');
  const statuses = ['RECEIVED', 'DIAGNOSING', 'WAITING_PARTS', 'REPAIRING', 'READY', 'DELIVERED', 'DELIVERED', 'DELIVERED'];

  let repairCount = 0;
  for (const device of devices) {
    if (Math.random() > 0.75) continue;

    const receivedAt = addDays(new Date(), -randomInt(0, 90));
    const status = pick(statuses);
    const service = pick(services.filter((s) => s.deviceType === 'ALL' || s.deviceType === device.type));
    const part = Math.random() > 0.4 ? pick(parts) : null;

    const items: Prisma.RepairItemCreateWithoutRepairOrderInput[] = [
      {
        kind: 'SERVICE',
        service: { connect: { id: service.id } },
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        unitCost: service.cost,
        total: service.price,
      },
    ];
    if (part) {
      items.push({
        kind: 'PART',
        product: { connect: { id: part.id } },
        name: part.name,
        quantity: 1,
        unitPrice: part.sellPrice,
        unitCost: part.costPrice,
        total: part.sellPrice,
      });
    }

    const finalCost = round(items.reduce((sum, i) => sum + (i.total ?? 0), 0));
    const partsCost = part ? part.costPrice : 0;
    const delivered = status === 'DELIVERED';

    await db.$transaction(async (tx) => {
      const order = await tx.repairOrder.create({
        data: {
          number: await nextNumber('RO', tx),
          customerId: device.customerId,
          deviceId: device.id,
          branchId: branch.id,
          receivedById: admin.id,
          technicianId: pick(technicians).id,
          status,
          priority: pick(['NORMAL', 'NORMAL', 'NORMAL', 'HIGH', 'URGENT']),
          problemDescription: pick(PROBLEMS),
          faultCategory: pick(FAULTS),
          accessories: JSON.stringify({ charger: Math.random() > 0.5, case: Math.random() > 0.6 }),
          conditionReport: JSON.stringify({
            screen: Math.random() > 0.6 ? 'FAULTY' : 'OK',
            battery: 'OK',
            speaker: 'OK',
            chargingPort: Math.random() > 0.8 ? 'FAULTY' : 'OK',
            scratches: Math.random() > 0.5 ? 'YES' : 'NO',
          }),
          damageMarks: JSON.stringify(
            Math.random() > 0.6
              ? [{ x: randomInt(20, 80), y: randomInt(20, 80), type: pick(['scratch', 'crack']) }]
              : [],
          ),
          photos: '[]',
          estimatedCost: finalCost,
          finalCost,
          partsCost,
          laborCost: round(finalCost - partsCost),
          depositAmount: Math.random() > 0.6 ? round(finalCost * 0.3) : 0,
          receivedAt,
          promisedAt: addDays(receivedAt, randomInt(1, 5)),
          completedAt: delivered ? addDays(receivedAt, randomInt(1, 4)) : null,
          deliveredAt: delivered ? addDays(receivedAt, randomInt(2, 6)) : null,
          warrantyDays: 30,
          warrantyEndsAt: delivered ? addDays(receivedAt, 36) : null,
          trackingToken: crypto.randomBytes(12).toString('base64url'),
          items: { create: items },
          history: {
            create: { status: 'RECEIVED', note: 'تم استلام الجهاز', userId: admin.id, createdAt: receivedAt },
          },
        },
      });

      if (part) {
        const current = await tx.product.findUnique({ where: { id: part.id }, select: { quantity: true } });
        const balanceAfter = round((current?.quantity ?? 0) - 1);
        await tx.product.update({ where: { id: part.id }, data: { quantity: balanceAfter } });
        await tx.stockMovement.create({
          data: {
            productId: part.id,
            branchId: branch.id,
            type: 'OUT',
            quantity: 1,
            balanceAfter,
            unitCost: part.costPrice,
            reason: `قطع مستخدمة في ${order.number}`,
            refType: 'RepairOrder',
            refId: order.id,
            refNumber: order.number,
            userId: admin.id,
            createdAt: receivedAt,
          },
        });
      }

      await tx.customer.update({
        where: { id: device.customerId },
        data: { visitsCount: { increment: 1 } },
      });

      // فاتورة للأجهزة المسلّمة
      if (delivered) {
        const issuedAt = addDays(receivedAt, randomInt(2, 6));
        const costTotal = round(items.reduce((s, i) => s + (i.unitCost ?? 0), 0));
        const paid = Math.random() > 0.15 ? finalCost : round(finalCost * 0.5);

        const invoice = await tx.invoice.create({
          data: {
            number: await nextNumber('INV', tx),
            type: 'REPAIR',
            customerId: device.customerId,
            repairOrderId: order.id,
            branchId: branch.id,
            userId: pick(staff).id,
            status: paid >= finalCost ? 'PAID' : 'PARTIAL',
            subtotal: finalCost,
            total: finalCost,
            paidAmount: paid,
            dueAmount: round(finalCost - paid),
            costTotal,
            profit: round(finalCost - costTotal),
            issuedAt,
            paidAt: paid >= finalCost ? issuedAt : null,
            warrantyDays: 30,
            warrantyEndsAt: addDays(issuedAt, 30),
            items: {
              create: items.map((item) => ({
                kind: item.kind === 'PART' ? 'PRODUCT' : 'SERVICE',
                name: item.name,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice ?? 0,
                unitCost: item.unitCost ?? 0,
                total: item.total ?? 0,
              })),
            },
          },
        });

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId: device.customerId,
            amount: paid,
            method: pick(['CASH', 'CASH', 'CASH', 'CARD', 'BANK_TRANSFER']),
            userId: pick(staff).id,
            createdAt: issuedAt,
          },
        });

        await tx.customer.update({
          where: { id: device.customerId },
          data: {
            totalRepairs: { increment: finalCost },
            balance: paid < finalCost ? { decrement: round(finalCost - paid) } : undefined,
            loyaltyPoints: { increment: Math.floor(finalCost / 100) },
          },
        });

        await tx.warranty.create({
          data: {
            number: await nextNumber('WR', tx),
            customerId: device.customerId,
            repairOrderId: order.id,
            invoiceId: invoice.id,
            itemName: `صيانة ${device.brand} ${device.model}`,
            serial: device.imei ?? device.serialNumber,
            days: 30,
            startsAt: issuedAt,
            endsAt: addDays(issuedAt, 30),
            status: addDays(issuedAt, 30) > new Date() ? 'ACTIVE' : 'EXPIRED',
          },
        });
      }
    });

    repairCount++;
  }
  console.log(`✓ أوامر الصيانة: ${repairCount}`);

  // ------------------------------------------------------- فواتير مبيعات
  const accessories = products.filter((p) => p.type === 'ACCESSORY');
  let salesCount = 0;

  for (let i = 0; i < 45; i++) {
    const issuedAt = addDays(new Date(), -randomInt(0, 60));
    const customer = Math.random() > 0.3 ? pick(customers) : null;
    const lineCount = randomInt(1, 3);
    const chosen: typeof accessories = [];
    for (let j = 0; j < lineCount; j++) {
      const item = pick(accessories);
      if (!chosen.includes(item)) chosen.push(item);
    }

    // نقرأ الكمية الفعلية ولا نبيع أكثر من المتاح — نفس قاعدة النظام الحقيقي
    const lines: {
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      total: number;
    }[] = [];
    for (const product of chosen) {
      const live = await db.product.findUnique({
        where: { id: product.id },
        select: { quantity: true },
      });
      const available = live?.quantity ?? 0;
      if (available <= 0) continue;

      const quantity = Math.min(randomInt(1, 3), available);
      lines.push({
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.sellPrice,
        unitCost: product.costPrice,
        total: round(product.sellPrice * quantity),
      });
    }
    if (!lines.length) continue;

    const subtotal = round(lines.reduce((s, l) => s + l.total, 0));
    const costTotal = round(lines.reduce((s, l) => s + l.unitCost * l.quantity, 0));

    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          number: await nextNumber('INV', tx),
          type: 'SALE',
          customerId: customer?.id ?? null,
          branchId: branch.id,
          userId: pick(staff).id,
          status: 'PAID',
          subtotal,
          total: subtotal,
          paidAmount: subtotal,
          dueAmount: 0,
          costTotal,
          profit: round(subtotal - costTotal),
          issuedAt,
          paidAt: issuedAt,
          items: {
            create: lines.map((line) => ({
              kind: 'PRODUCT',
              productId: line.productId,
              name: line.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              total: line.total,
            })),
          },
        },
      });

      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: customer?.id ?? null,
          amount: subtotal,
          method: pick(['CASH', 'CASH', 'CARD', 'WALLET']),
          userId: pick(staff).id,
          createdAt: issuedAt,
        },
      });

      for (const line of lines) {
        const current = await tx.product.findUnique({
          where: { id: line.productId },
          select: { quantity: true },
        });
        const balanceAfter = round((current?.quantity ?? 0) - line.quantity);
        await tx.product.update({
          where: { id: line.productId },
          data: { quantity: balanceAfter },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            branchId: branch.id,
            type: 'OUT',
            quantity: line.quantity,
            balanceAfter,
            unitCost: line.unitCost,
            reason: `بيع — ${invoice.number}`,
            refType: 'Invoice',
            refId: invoice.id,
            refNumber: invoice.number,
            userId: admin.id,
            createdAt: issuedAt,
          },
        });
      }

      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalPurchases: { increment: subtotal },
            visitsCount: { increment: 1 },
            loyaltyPoints: { increment: Math.floor(subtotal / 100) },
          },
        });
      }
    });

    salesCount++;
  }
  console.log(`✓ فواتير المبيعات: ${salesCount}`);

  // ------------------------------------------------------------ المصروفات
  const expenseCategories = await db.expenseCategory.findMany();
  const expenseCategoryByName = new Map(expenseCategories.map((c) => [c.name, c]));

  let expenseCount = 0;
  for (let month = 0; month < 3; month++) {
    for (const [categoryName, description, amount] of EXPENSE_ITEMS) {
      if (month > 0 && !expenseCategoryByName.get(categoryName)?.isRecurringDefault) continue;

      const date = addDays(new Date(), -(month * 30 + randomInt(1, 25)));
      const category = expenseCategoryByName.get(categoryName);

      await db.$transaction(async (tx) => {
        await tx.expense.create({
          data: {
            number: await nextNumber('EXP', tx),
            categoryId: category?.id ?? null,
            description,
            amount: round(amount * (0.9 + Math.random() * 0.2)),
            date,
            paymentMethod: 'CASH',
            isRecurring: month === 0 && (category?.isRecurringDefault ?? false),
            recurrence: month === 0 && category?.isRecurringDefault ? 'MONTHLY' : null,
            nextDueDate:
              month === 0 && category?.isRecurringDefault ? addDays(date, 30) : null,
            userId: admin.id,
            branchId: branch.id,
          },
        });
      });
      expenseCount++;
    }
  }
  console.log(`✓ المصروفات: ${expenseCount}`);

  // -------------------------------------------------------------- الحضور
  let attendanceCount = 0;
  for (const employee of staff) {
    for (let day = 1; day <= 20; day++) {
      const date = addDays(new Date(), -day);
      date.setHours(0, 0, 0, 0);
      if (date.getDay() === 5) continue; // الجمعة عطلة

      const checkIn = new Date(date);
      checkIn.setHours(randomInt(8, 9), randomInt(0, 59));
      const checkOut = new Date(date);
      checkOut.setHours(randomInt(17, 19), randomInt(0, 59));

      const existing = await db.attendance.findUnique({
        where: { userId_date: { userId: employee.id, date } },
      });
      if (existing) continue;

      await db.attendance.create({
        data: {
          userId: employee.id,
          date,
          checkIn,
          checkOut,
          minutes: Math.round((checkOut.getTime() - checkIn.getTime()) / 60000),
          status: checkIn.getHours() >= 9 ? 'LATE' : 'PRESENT',
        },
      });
      attendanceCount++;
    }
  }
  console.log(`✓ سجلات الحضور: ${attendanceCount}`);

  // ------------------------------------------------------------- المواعيد
  let appointmentCount = 0;
  for (let i = 0; i < 12; i++) {
    const customer = pick(customers);
    const scheduledAt = addDays(new Date(), randomInt(0, 10));
    scheduledAt.setHours(randomInt(9, 17), pick([0, 30]), 0, 0);

    await db.$transaction(async (tx) => {
      await tx.appointment.create({
        data: {
          number: await nextNumber('APT', tx),
          customerId: customer.id,
          customerName: `${customer.firstName} ${customer.lastName ?? ''}`.trim(),
          customerPhone: customer.phone,
          deviceType: pick(['PHONE', 'PHONE', 'LAPTOP', 'TABLET']),
          description: pick(PROBLEMS),
          scheduledAt,
          durationMinutes: pick([30, 45, 60]),
          assignedToId: pick(technicians).id,
          status: pick(['SCHEDULED', 'SCHEDULED', 'CONFIRMED']),
        },
      });
    });
    appointmentCount++;
  }
  console.log(`✓ المواعيد: ${appointmentCount}`);

  // ------------------------------------------------------------- الكوبونات
  const couponSpecs = [
    { code: 'WELCOME10', description: 'خصم ترحيبي', type: 'PERCENT', value: 10, minAmount: 2000 },
    { code: 'SUMMER500', description: 'عرض الصيف', type: 'FIXED', value: 500, minAmount: 5000 },
  ];
  for (const spec of couponSpecs) {
    const existing = await db.coupon.findUnique({ where: { code: spec.code } });
    if (existing) continue;
    await db.coupon.create({
      data: { ...spec, endsAt: addDays(new Date(), 60), usageLimit: 50 },
    });
  }
  console.log(`✓ الكوبونات: ${couponSpecs.length}`);

  console.log('\n✅ اكتمل توليد البيانات التجريبية');
  console.log('   بيانات دخول الموظفين: tech1 / cashier1 / reception1 — كلمة المرور: Demo@12345');
}

main()
  .catch((error) => {
    console.error('❌ فشل التوليد:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
