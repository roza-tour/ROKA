import type { Metadata } from 'next';
import { CalendarClock, CalendarCheck, CalendarX } from 'lucide-react';
import type { Prisma } from '@prisma/client';

import { requirePermission, getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import {
  formatDate,
  formatTime,
  formatNumber,
  fullName,
  startOfDay,
  endOfDay,
  addDays,
} from '@/lib/utils';
import { APPOINTMENT_STATUSES, DEVICE_TYPES, type DeviceType } from '@/lib/constants';

import { PageHeader, Card } from '@/components/ui/page';
import { StatCard } from '@/components/ui/stat-card';
import { SearchFilters } from '@/components/ui/search-filters';
import { AppointmentBoard } from './appointment-board';

export const metadata: Metadata = { title: 'المواعيد' };
export const dynamic = 'force-dynamic';

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('appointments:view');
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const dateParam = typeof params.date === 'string' ? new Date(params.date) : null;

  const focusDate =
    dateParam && !Number.isNaN(dateParam.getTime()) ? dateParam : new Date();
  const rangeFrom = startOfDay(focusDate);
  const rangeTo = endOfDay(addDays(focusDate, 13));

  const where: Prisma.AppointmentWhereInput = {
    scheduledAt: { gte: rangeFrom, lte: rangeTo },
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q } },
            { customerPhone: { contains: q } },
            { number: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  };

  const [appointments, customers, technicians, todayCount, weekCount, noShowCount] =
    await Promise.all([
      db.appointment.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      db.customer.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, phone: true },
        orderBy: { updatedAt: 'desc' },
        take: 300,
      }),
      db.user.findMany({
        where: { isActive: true, role: { in: ['TECHNICIAN', 'MANAGER', 'ADMIN'] } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      db.appointment.count({
        where: {
          scheduledAt: { gte: startOfDay(), lte: endOfDay() },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      db.appointment.count({
        where: {
          scheduledAt: { gte: startOfDay(), lte: endOfDay(addDays(new Date(), 7)) },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      db.appointment.count({ where: { status: 'NO_SHOW' } }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.appointment.title}
        description={`${formatDate(rangeFrom, locale)} — ${formatDate(rangeTo, locale)}`}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`${t.appointment.title} · ${t.app.today}`}
          value={formatNumber(todayCount, locale)}
          icon={CalendarClock}
          tone="primary"
        />
        <StatCard
          label={`${t.appointment.title} · ${t.app.thisWeek}`}
          value={formatNumber(weekCount, locale)}
          icon={CalendarCheck}
          tone="info"
        />
        <StatCard
          label={t.appointment.statuses.NO_SHOW}
          value={formatNumber(noShowCount, locale)}
          icon={CalendarX}
          tone={noShowCount > 0 ? 'warning' : 'default'}
        />
      </section>

      <SearchFilters
        placeholder="ابحث باسم العميل أو الهاتف"
        labels={{ clear: t.app.clear, filter: t.app.filter }}
        filters={[
          {
            name: 'status',
            label: t.invoice.status,
            options: APPOINTMENT_STATUSES.map((s) => ({
              value: s,
              label: t.appointment.statuses[s],
            })),
          },
        ]}
      />

      <AppointmentBoard
        appointments={appointments.map((appointment) => ({
          id: appointment.id,
          number: appointment.number,
          customerId: appointment.customerId,
          customerName: appointment.customer
            ? fullName(appointment.customer.firstName, appointment.customer.lastName)
            : appointment.customerName,
          customerPhone: appointment.customerPhone,
          deviceType: appointment.deviceType,
          description: appointment.description,
          scheduledAt: appointment.scheduledAt.toISOString(),
          dateLabel: formatDate(appointment.scheduledAt, locale, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          }),
          timeLabel: formatTime(appointment.scheduledAt, locale),
          durationMinutes: appointment.durationMinutes,
          assignedToId: appointment.assignedToId,
          assignedToName: appointment.assignedTo?.fullName ?? null,
          status: appointment.status,
          notes: appointment.notes,
        }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: fullName(c.firstName, c.lastName),
          phone: c.phone,
        }))}
        technicians={technicians.map((tech) => ({ id: tech.id, name: tech.fullName }))}
        canEdit={can(user, 'appointments:create')}
        canDelete={can(user, 'appointments:delete')}
        deviceTypeLabels={t.device.types as Record<string, string>}
        statusLabels={t.appointment.statuses as Record<string, string>}
        labels={{
          new: t.appointment.new,
          empty: t.app.noData,
          customerName: t.appointment.customerName,
          customerPhone: t.appointment.customerPhone,
          existingCustomer: t.customer.single,
          deviceType: t.device.type,
          description: t.repair.problem,
          scheduledAt: t.appointment.scheduledAt,
          duration: t.appointment.duration,
          assignedTo: t.appointment.assignedTo,
          status: t.invoice.status,
          notes: t.customer.notes,
          save: t.actions.save,
          cancel: t.actions.cancel,
          edit: t.actions.edit,
          delete: t.actions.delete,
          confirmDelete: t.app.confirmDelete,
          none: t.app.none,
          minutes: 'دقيقة',
          createRepair: t.nav.newRepair,
        }}
      />
    </div>
  );
}
