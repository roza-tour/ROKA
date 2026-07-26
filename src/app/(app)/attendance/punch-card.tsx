'use client';

import { useTransition, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, CheckCircle2, Clock } from 'lucide-react';
import { punchAction } from '@/app/actions/employees';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/** بطاقة تسجيل الحضور والانصراف مع ساعة حيّة */
export function PunchCard({
  hasCheckedIn,
  hasCheckedOut,
  checkInTime,
  checkOutTime,
  minutes,
  labels,
}: {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  minutes: number;
  labels: { title: string; checkIn: string; checkOut: string; done: string; hours: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<string>('');

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString('ar-DZ-u-nu-latn', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  function punch() {
    startTransition(async () => {
      const result = await punchAction();
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّر التسجيل');
      }
    });
  }

  return (
    <div className="card flex flex-col justify-between gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{labels.title}</p>
          <p className="numeric mt-1 text-2xl font-bold tabular-nums" dir="ltr">
            {now || '—'}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Clock className="h-[18px] w-[18px]" />
        </span>
      </div>

      {(checkInTime || checkOutTime) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {checkInTime && (
            <span className="numeric">
              {labels.checkIn}: <span className="font-medium text-foreground">{checkInTime}</span>
            </span>
          )}
          {checkOutTime && (
            <span className="numeric">
              {labels.checkOut}:{' '}
              <span className="font-medium text-foreground">{checkOutTime}</span>
            </span>
          )}
          {minutes > 0 && (
            <span className="numeric">
              {labels.hours}:{' '}
              <span className="font-medium text-foreground">
                {Math.floor(minutes / 60)}:{String(minutes % 60).padStart(2, '0')}
              </span>
            </span>
          )}
        </div>
      )}

      {hasCheckedOut ? (
        <div className="flex items-center justify-center gap-2 rounded-md bg-success/10 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {labels.done}
        </div>
      ) : (
        <Button
          onClick={punch}
          loading={pending}
          variant={hasCheckedIn ? 'outline' : 'primary'}
          className="w-full"
          icon={
            hasCheckedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />
          }
        >
          {hasCheckedIn ? labels.checkOut : labels.checkIn}
        </Button>
      )}
    </div>
  );
}
