'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';

import {
  resetEmployeePasswordAction,
  forceLogoutAction,
} from '@/app/actions/employees';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { CopyButton } from '@/components/copy-button';

export function EmployeeAdminActions({
  employeeId,
  labels,
}: {
  employeeId: string;
  labels: {
    resetPassword: string;
    forceLogout: string;
    confirm: string;
    cancel: string;
    resetWarning: string;
    logoutWarning: string;
    newPassword: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<'reset' | 'logout' | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  function reset() {
    startTransition(async () => {
      const result = await resetEmployeePasswordAction(employeeId);
      if (result.ok && result.password) {
        setNewPassword(result.password);
        toast.success(result.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّرت العملية');
        setDialog(null);
      }
    });
  }

  function logout() {
    startTransition(async () => {
      const result = await forceLogoutAction(employeeId);
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        setDialog(null);
        router.refresh();
      } else {
        toast.error(result.error ?? 'تعذّرت العملية');
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setNewPassword(null);
          setDialog('reset');
        }}
        icon={<KeyRound className="h-4 w-4" />}
      >
        {labels.resetPassword}
      </Button>

      <Button
        variant="ghost"
        onClick={() => setDialog('logout')}
        icon={<LogOut className="h-4 w-4" />}
      >
        {labels.forceLogout}
      </Button>

      <Dialog
        open={dialog === 'reset'}
        onClose={() => setDialog(null)}
        title={labels.resetPassword}
        size="sm"
        footer={
          newPassword ? (
            <Button onClick={() => setDialog(null)}>{labels.cancel}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                {labels.cancel}
              </Button>
              <Button variant="danger" onClick={reset} loading={pending}>
                {labels.confirm}
              </Button>
            </>
          )
        }
      >
        {newPassword ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">{labels.newPassword}</p>
            <p className="numeric font-mono text-2xl font-bold" dir="ltr">
              {newPassword}
            </p>
            <div className="flex justify-center">
              <CopyButton value={newPassword} />
            </div>
            <p className="text-xs text-muted-foreground">
              انسخها الآن — لن تظهر مرة أخرى بعد إغلاق النافذة
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.resetWarning}</p>
        )}
      </Dialog>

      <Dialog
        open={dialog === 'logout'}
        onClose={() => setDialog(null)}
        title={labels.forceLogout}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button variant="danger" onClick={logout} loading={pending}>
              {labels.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{labels.logoutWarning}</p>
      </Dialog>
    </>
  );
}
