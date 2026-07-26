'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { changeRepairStatusAction } from '@/app/actions/repairs';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea, Select, Checkbox } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { REPAIR_STATUS_FLOW, type RepairStatus, type NotificationChannel } from '@/lib/constants';
import { RepairStatusBadge } from '@/components/repair-status-badge';

export function StatusChanger({
  repairId,
  currentStatus,
  customerPhone,
  customerEmail,
  labels,
}: {
  repairId: string;
  currentStatus: string;
  customerPhone: string;
  customerEmail: string | null;
  labels: {
    statuses: Record<string, string>;
    note: string;
    notify: string;
    channel: string;
    channels: Record<string, string>;
    confirm: string;
    cancel: string;
    noTransitions: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<RepairStatus | null>(null);
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [channel, setChannel] = useState<NotificationChannel>('SMS');

  const next = REPAIR_STATUS_FLOW[currentStatus as RepairStatus] ?? [];

  function submit() {
    if (!target) return;
    startTransition(async () => {
      const result = await changeRepairStatusAction(
        repairId,
        target,
        note.trim() || undefined,
        notify,
        channel,
      );
      if (result.ok) {
        toast.success(result.message ?? 'تم تغيير الحالة');
        setTarget(null);
        setNote('');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر تغيير الحالة');
      }
    });
  }

  if (!next.length) {
    return <p className="text-sm text-muted-foreground">{labels.noTransitions}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {next.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setTarget(status)}
            disabled={pending}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2.5 text-start transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <RepairStatusBadge status={status} labels={labels.statuses} />
            <ArrowLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        ))}
      </div>

      <Dialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={
          target ? `${labels.confirm}: ${labels.statuses[target] ?? target}` : ''
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button onClick={submit} loading={pending}>
              {labels.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={labels.note}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="اختياري"
            />
          </Field>

          <Checkbox
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            label={
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                {labels.notify}
              </span>
            }
          />

          {notify && (
            <Field label={labels.channel}>
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                options={[
                  { value: 'SMS', label: `${labels.channels.SMS} (${customerPhone})` },
                  { value: 'WHATSAPP', label: `${labels.channels.WHATSAPP} (${customerPhone})` },
                  ...(customerEmail
                    ? [{ value: 'EMAIL', label: `${labels.channels.EMAIL} (${customerEmail})` }]
                    : []),
                ]}
              />
            </Field>
          )}
        </div>
      </Dialog>
    </>
  );
}
