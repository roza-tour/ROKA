import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { fullName, normalizeDigits } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const LIMIT_PER_TYPE = 5;

/** بحث عام سريع عبر الوحدات الرئيسية */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = (url.searchParams.get('q') ?? '').trim();
  if (raw.length < 2) return NextResponse.json({ results: [] });

  const q = normalizeDigits(raw);

  const results: {
    type: string;
    id: string;
    href: string;
    title: string;
    subtitle?: string;
    meta?: string;
  }[] = [];

  const [repairs, customers, products, invoices] = await Promise.all([
    can(user, 'repairs:view')
      ? db.repairOrder.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { customer: { phone: { contains: q } } },
              { customer: { firstName: { contains: q } } },
              { customer: { lastName: { contains: q } } },
              { device: { imei: { contains: q } } },
              { device: { serialNumber: { contains: q } } },
              { device: { model: { contains: q } } },
            ],
          },
          select: {
            id: true,
            number: true,
            status: true,
            customer: { select: { firstName: true, lastName: true } },
            device: { select: { brand: true, model: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: LIMIT_PER_TYPE,
        })
      : [],

    can(user, 'customers:view')
      ? db.customer.findMany({
          where: {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { phone: { contains: q } },
              { phone2: { contains: q } },
              { code: { contains: q } },
              { email: { contains: q } },
            ],
          },
          select: { id: true, code: true, firstName: true, lastName: true, phone: true },
          orderBy: { updatedAt: 'desc' },
          take: LIMIT_PER_TYPE,
        })
      : [],

    can(user, 'inventory:view')
      ? db.product.findMany({
          where: {
            isActive: true,
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { barcode: { contains: q } },
              { model: { contains: q } },
              { brand: { contains: q } },
            ],
          },
          select: { id: true, name: true, sku: true, quantity: true, sellPrice: true },
          orderBy: { name: 'asc' },
          take: LIMIT_PER_TYPE,
        })
      : [],

    can(user, 'invoices:view')
      ? db.invoice.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { customer: { phone: { contains: q } } },
              { customer: { firstName: { contains: q } } },
            ],
          },
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            customer: { select: { firstName: true, lastName: true } },
          },
          orderBy: { issuedAt: 'desc' },
          take: LIMIT_PER_TYPE,
        })
      : [],
  ]);

  for (const r of repairs) {
    results.push({
      type: 'repair',
      id: r.id,
      href: `/repairs/${r.id}`,
      title: r.number,
      subtitle: `${fullName(r.customer.firstName, r.customer.lastName)} · ${r.device.brand} ${r.device.model}`,
    });
  }

  for (const c of customers) {
    results.push({
      type: 'customer',
      id: c.id,
      href: `/customers/${c.id}`,
      title: fullName(c.firstName, c.lastName),
      subtitle: c.phone,
      meta: c.code,
    });
  }

  for (const p of products) {
    results.push({
      type: 'product',
      id: p.id,
      href: `/inventory/${p.id}`,
      title: p.name,
      subtitle: p.sku,
      meta: String(p.quantity),
    });
  }

  for (const i of invoices) {
    results.push({
      type: 'invoice',
      id: i.id,
      href: `/invoices/${i.id}`,
      title: i.number,
      subtitle: i.customer
        ? fullName(i.customer.firstName, i.customer.lastName)
        : undefined,
      meta: i.total.toFixed(2),
    });
  }

  return NextResponse.json({ results });
}
