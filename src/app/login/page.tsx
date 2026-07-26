import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { getI18n } from '@/i18n';
import { getShopInfo } from '@/lib/settings';
import { LoginForm } from './login-form';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Smartphone, Laptop, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { t } = await getI18n();
  const shop = await getShopInfo();
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : undefined;

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* اللوحة الترويجية */}
      <section className="relative hidden overflow-hidden bg-primary lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px, 64px 64px',
          }}
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-3 text-primary-foreground">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <BrandMark size={30} variant="mono" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-2xl font-bold tracking-wide">{shop.name}</span>
              <span className="mt-0.5 text-[10px] font-medium tracking-[0.3em] opacity-70">
                فيكسل
              </span>
            </span>
          </div>
        </div>

        <div className="relative space-y-6 text-primary-foreground">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-snug">{t.app.slogan}</h2>
            <p className="mt-2 text-sm text-primary-foreground/70">{t.app.tagline}</p>
          </div>
          <ul className="space-y-3 text-sm text-primary-foreground/85">
            <FeatureItem icon={Smartphone}>
              استقبال الأجهزة مع تقرير حالة كامل وتوقيع رقمي
            </FeatureItem>
            <FeatureItem icon={Laptop}>
              مخزون وفواتير وتقارير احترافية في مكان واحد
            </FeatureItem>
            <FeatureItem icon={ShieldCheck}>
              صلاحيات دقيقة وسجل عمليات كامل لحماية بياناتك
            </FeatureItem>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {shop.name}
        </p>
      </section>

      {/* نموذج الدخول */}
      <section className="flex flex-1 flex-col items-center justify-center bg-background p-6">
        <div className="absolute top-4 end-4 flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <BrandMark size={56} />
            <span className="text-2xl font-bold tracking-wide">{shop.name}</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{t.auth.loginTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>
          </div>

          <LoginForm
            next={next}
            labels={{
              username: t.auth.usernameOrEmail,
              password: t.auth.password,
              submit: t.auth.loginButton,
              submitting: t.auth.loggingIn,
            }}
          />
        </div>
      </section>
    </main>
  );
}

function FeatureItem({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
