'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, Bell } from 'lucide-react';

import {
  refreshWarrantyStatusesAction,
  sendWarrantyRemindersAction,
} from '@/app/actions/notifications';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function WarrantyMaintenanceButton({
  labels,
  canNotify,
}: {
  labels: { refresh: string; remind: string };
  canNotify: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

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
        onClick={() => run(refreshWarrantyStatusesAction)}
        icon={<RefreshCcw className="h-4 w-4" />}
      >
        {labels.refresh}
      </Button>

      {canNotify && (
        <Button
          loading={pending}
          onClick={() => run(() => sendWarrantyRemindersAction(7))}
          icon={<Bell className="h-4 w-4" />}
        >
          {labels.remind}
        </Button>
      )}
    </>
  );
}
