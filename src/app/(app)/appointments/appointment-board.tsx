'use client';

import { useActionState, useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Clock, User, Phone, Wrench, Check, X } from 'lucide-react';

import {
  saveAppointmentAction,
  changeAppointmentStatusAction,
  deleteAppointmentAction,
} from '@/app/actions/appointments';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Textarea, Select, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/page';
import { StatusBadge } from '@/components/repair-status-badge';
import { DEVICE_TYPES, APPOINTMENT_STATUSES, type AppointmentStatus } from '@/lib/constants';
import { toDateTimeInput, cn } from '@/lib/utils';

interface Appointment {
  id: string;
  number: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  description: string | null;
  scheduledAt: string;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  assignedToId: string | null;
  assignedToName: string | null;
  status: string;
  notes: string | null;
}

export function AppointmentBoard({
  appointments,
  customers,
  technicians,
  canEdit,
  canDelete,
  deviceTypeLabels,
  statusLabels,
  labels,
}: {
  appointments: Appointment[];
  customers: { id: string; name: string; phone: string }[];
  technicians: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  deviceTypeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [state, formAction] = useActionState<FormState | null, FormData>(
    saveAppointmentAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setShowForm(false);
      setEditing(null);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  // تجميع المواعيد حسب اليوم
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const list = map.get(appointment.dateLabel) ?? [];
      list.push(appointment);
      map.set(appointment.dateLabel, list);
    }
    return [...map.entries()];
  }, [appointments]);

  function changeStatus(id: string, status: AppointmentStatus) {
    startTransition(async () => {
      const result = await changeAppointmentStatusAction(id, status);
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(result.error ?? 'حدث خطأ');
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAppointmentAction(id);
      if (result.ok) {
        toast.success(result.message ?? 'تم الحذف');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر الحذف');
      }
    });
  }

  function openNew() {
    setEditing(null);
    setSelectedCustomerId('');
    setShowForm(true);
  }

  function openEdit(appointment: Appointment) {
    setEditing(appointment);
    setSelectedCustomerId(appointment.customerId ?? '');
    setShowForm(true);
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-4">
      {canEdit && (
        <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>
          {labels.new}
        </Button>
      )}

      {byDay.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        byDay.map(([day, items]) => (
          <Card key={day} title={day} bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {items.map((appointment) => (
                <li key={appointment.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="numeric flex w-16 shrink-0 items-center gap-1 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {appointment.timeLabel}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {appointment.customerId ? (
                        <Link
                          href={`/customers/${appointment.customerId}`}
                          className="hover:text-primary"
                        >
                          {appointment.customerName}
                        </Link>
                      ) : (
                        appointment.customerName
                      )}
                      <a
                        href={`tel:${appointment.customerPhone}`}
                        className="numeric inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {appointment.customerPhone}
                      </a>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deviceTypeLabels[appointment.deviceType] ?? appointment.deviceType}
                      {appointment.description ? ` · ${appointment.description}` : ''}
                      {appointment.assignedToName ? ` · ${appointment.assignedToName}` : ''}
                    </p>
                  </div>

                  <StatusBadge status={appointment.status} labels={statusLabels} />

                  {canEdit && (
                    <div className="flex shrink-0 gap-0.5">
                      {appointment.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          onClick={() => changeStatus(appointment.id, 'CONFIRMED')}
                          disabled={pending}
                          className="rounded p-1.5 text-muted-foreground hover:bg-success/10 hover:text-success"
                          title={statusLabels.CONFIRMED}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => changeStatus(appointment.id, 'ARRIVED')}
                            disabled={pending}
                            className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            title={statusLabels.ARRIVED}
                          >
                            <User className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/repairs/new${appointment.customerId ? `?customerId=${appointment.customerId}` : ''}`}
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={labels.createRepair}
                          >
                            <Wrench className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => changeStatus(appointment.id, 'NO_SHOW')}
                            disabled={pending}
                            className="rounded p-1.5 text-muted-foreground hover:bg-warning/10 hover:text-warning"
                            title={statusLabels.NO_SHOW}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(appointment)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title={labels.edit}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteId(appointment.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                          title={labels.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <Dialog
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        title={editing ? labels.edit : labels.new}
        size="md"
      >
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <Field label={labels.existingCustomer} hint={labels.none}>
            <Select
              name="customerId"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              placeholder={labels.none}
              options={customers.map((c) => ({
                value: c.id,
                label: `${c.name} · ${c.phone}`,
              }))}
            />
          </Field>

          <FormGrid cols={2}>
            <Field label={labels.customerName} required>
              <Input
                name="customerName"
                key={selectedCustomerId || editing?.id || 'new'}
                defaultValue={selectedCustomer?.name ?? editing?.customerName ?? ''}
                required
              />
            </Field>

            <Field label={labels.customerPhone} required>
              <Input
                name="customerPhone"
                type="tel"
                key={`${selectedCustomerId}-phone`}
                defaultValue={selectedCustomer?.phone ?? editing?.customerPhone ?? ''}
                required
                dir="ltr"
              />
            </Field>

            <Field label={labels.scheduledAt} required>
              <Input
                name="scheduledAt"
                type="datetime-local"
                defaultValue={
                  editing ? toDateTimeInput(editing.scheduledAt) : toDateTimeInput(new Date())
                }
                required
              />
            </Field>

            <Field label={labels.duration}>
              <Input
                name="durationMinutes"
                type="number"
                min={5}
                step={5}
                defaultValue={editing?.durationMinutes ?? 30}
              />
            </Field>

            <Field label={labels.deviceType}>
              <Select
                name="deviceType"
                defaultValue={editing?.deviceType ?? 'PHONE'}
                options={DEVICE_TYPES.map((dt) => ({
                  value: dt,
                  label: deviceTypeLabels[dt] ?? dt,
                }))}
              />
            </Field>

            <Field label={labels.assignedTo}>
              <Select
                name="assignedToId"
                defaultValue={editing?.assignedToId ?? ''}
                placeholder={labels.none}
                options={technicians.map((tech) => ({ value: tech.id, label: tech.name }))}
              />
            </Field>

            {editing && (
              <Field label={labels.status}>
                <Select
                  name="status"
                  defaultValue={editing.status}
                  options={APPOINTMENT_STATUSES.map((s) => ({
                    value: s,
                    label: statusLabels[s] ?? s,
                  }))}
                />
              </Field>
            )}

            <Field label={labels.description} className="sm:col-span-2">
              <Input name="description" defaultValue={editing?.description ?? ''} />
            </Field>

            <Field label={labels.notes} className="sm:col-span-2">
              <Textarea name="notes" defaultValue={editing?.notes ?? ''} rows={2} />
            </Field>
          </FormGrid>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove(deleteId);
        }}
        title={labels.delete}
        message={labels.confirmDelete}
      />
    </div>
  );
}
