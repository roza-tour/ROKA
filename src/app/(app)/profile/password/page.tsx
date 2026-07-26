import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { PageHeader, Card } from '@/components/ui/page';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'تغيير كلمة المرور' };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { t } = await getI18n();

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title={t.auth.changePassword}
        backHref="/profile"
        breadcrumbs={[{ label: t.nav.profile, href: '/profile' }, { label: t.auth.changePassword }]}
      />

      <Card title={t.auth.changePassword}>
        <ChangePasswordForm
          labels={{
            current: t.auth.currentPassword,
            new: t.auth.newPassword,
            confirm: t.auth.confirmPassword,
            submit: t.actions.save,
            hint: 'ثمانية أحرف على الأقل، وتحتوي على حرف ورقم',
            mismatch: t.auth.passwordMismatch,
          }}
        />
      </Card>
    </div>
  );
}
