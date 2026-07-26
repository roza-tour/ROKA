'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, Eye, EyeOff, KeyRound, User } from 'lucide-react';
import { loginAction, type ActionState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';

export function LoginForm({
  labels,
  next,
}: {
  labels: { username: string; password: string; submit: string; submitting: string };
  /** المسار الذي حاول المستخدم فتحه قبل تسجيل الدخول */
  next?: string;
}) {
  const [state, formAction] = useActionState<ActionState | null, FormData>(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Field label={labels.username} htmlFor="username">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          dir="ltr"
          className="text-start"
          leading={<User className="h-4 w-4" />}
        />
      </Field>

      <Field label={labels.password} htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            dir="ltr"
            className="pe-10 text-start"
            leading={<KeyRound className="h-4 w-4" />}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <SubmitButton label={labels.submit} loadingLabel={labels.submitting} />
    </form>
  );
}

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? loadingLabel : label}
    </Button>
  );
}
