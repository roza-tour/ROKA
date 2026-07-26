'use client';

import { useActionState, useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';

import { changePasswordAction, type ActionState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';

export function ChangePasswordForm({
  labels,
}: {
  labels: {
    current: string;
    new: string;
    confirm: string;
    submit: string;
    hint: string;
    mismatch: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState<ActionState | null, FormData>(
    changePasswordAction,
    null,
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم تغيير كلمة المرور');
      // تغيير كلمة المرور يُبطل الجلسات — يجب إعادة الدخول
      setTimeout(() => router.push('/login'), 2000);
    }
  }, [state, toast, router]);

  const mismatch = confirm.length > 0 && newPassword !== confirm;

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      {state?.ok && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      )}

      <Field label={labels.current} required>
        <Input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="text-start"
        />
      </Field>

      <Field label={labels.new} required hint={labels.hint}>
        <Input
          name="newPassword"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          dir="ltr"
          className="text-start"
        />
      </Field>

      <Field label={labels.confirm} required error={mismatch ? labels.mismatch : undefined}>
        <Input
          name="confirmPassword"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          dir="ltr"
          className="text-start"
          invalid={mismatch}
        />
      </Field>

      <SubmitButton label={labels.submit} disabled={mismatch || newPassword.length < 8} />
    </form>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      disabled={disabled}
      className="w-full"
      icon={<Save className="h-4 w-4" />}
    >
      {label}
    </Button>
  );
}
