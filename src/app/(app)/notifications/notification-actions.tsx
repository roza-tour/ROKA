'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, Send, ShieldAlert } from 'lucide-react';

import {
  processQueueAction,
  resendNotificationAction,
  sendTestNotificationAction,
  sendWarrantyRemindersAction,
} from '@/app/actions/notifications';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '@/lib/constants';

export function NotificationActions({
  labels,
}: {
  labels: {
    processQueue: string;
    testSend: string;
    channel: string;
    channels: Record<string, string>;
    recipient: string;
    send: string;
    cancel: string;
    warrantyReminders: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showTest, setShowTest] = useState(false);
  const [channel, setChannel] = useState<NotificationChannel>('SMS');
  const [to, setTo] = useState('');

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(result.error ?? 'حدث خطأ');
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        loading={pending}
        onClick={() => run(processQueueAction)}
        icon={<RefreshCcw className="h-4 w-4" />}
      >
        {labels.processQueue}
      </Button>

      <Button
        variant="outline"
        loading={pending}
        onClick={() => run(() => sendWarrantyRemindersAction(7))}
        icon={<ShieldAlert className="h-4 w-4" />}
      >
        {labels.warrantyReminders}
      </Button>

      <Button onClick={() => setShowTest(true)} icon={<Send className="h-4 w-4" />}>
        {labels.testSend}
      </Button>

      <Dialog
        open={showTest}
        onClose={() => setShowTest(false)}
        title={labels.testSend}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowTest(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              loading={pending}
              disabled={!to.trim()}
              onClick={() => {
                run(() => sendTestNotificationAction(channel, to));
                setShowTest(false);
              }}
            >
              {labels.send}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={labels.channel}>
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotificationChannel)}
              options={NOTIFICATION_CHANNELS.filter((c) => c !== 'INTERNAL').map((c) => ({
                value: c,
                label: labels.channels[c] ?? c,
              }))}
            />
          </Field>

          <Field label={labels.recipient}>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              dir="ltr"
              className="text-start"
              placeholder={channel === 'EMAIL' ? 'name@example.com' : '0555123456'}
              autoFocus
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function ResendButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resendNotificationAction(id);
          if (result.ok) {
            toast.success(result.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(result.error ?? 'فشل الإرسال');
          }
        })
      }
      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-50"
      title={label}
      aria-label={label}
    >
      <RefreshCcw className={pending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
    </button>
  );
}
