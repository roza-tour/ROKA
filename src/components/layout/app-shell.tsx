'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Wrench, LogOut, UserCircle, KeyRound, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { SidebarNav, type SidebarBadges } from './sidebar';
import type { NavSection } from './nav-config';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { GlobalSearch } from '@/components/global-search';
import { logoutAction } from '@/app/actions/auth';
import type { Locale } from '@/i18n/config';

export interface AppShellProps {
  sections: NavSection[];
  badges: SidebarBadges;
  user: { fullName: string; role: string; roleLabel: string; avatarUrl: string | null };
  shopName: string;
  locale: Locale;
  labels: {
    profile: string;
    changePassword: string;
    logout: string;
    search: string;
  };
  children: React.ReactNode;
}

export function AppShell({
  sections,
  badges,
  user,
  shopName,
  locale,
  labels,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // إغلاق القائمة الجانبية عند تغيّر المسار
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // استرجاع حالة الطيّ
  useEffect(() => {
    setCollapsed(localStorage.getItem('roka_sidebar_collapsed') === 'true');
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem('roka_sidebar_collapsed', String(!v));
      return !v;
    });
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-border bg-card lg:flex',
          'transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <BrandHeader shopName={shopName} collapsed={collapsed} />
        <SidebarNav sections={sections} badges={badges} collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 rtl:rotate-180" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 rtl:rotate-180" />
                <span>طيّ القائمة</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* الشريط الجانبي — الجوال */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] animate-slide-in flex-col border-e border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <BrandHeader shopName={shopName} collapsed={false} bare />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="إغلاق القائمة"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav
              sections={sections}
              badges={badges}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4 no-print">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>

          <GlobalSearch placeholder={labels.search} />

          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitcher current={locale} />
            <ThemeToggle />

            {/* قائمة المستخدم */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md p-1 ps-2 transition-colors hover:bg-accent"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="hidden text-end sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight">
                    {user.fullName}
                  </span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {user.roleLabel}
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(user.fullName)}
                </span>
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    className="absolute end-0 top-full z-50 mt-1 w-56 animate-fade-in overflow-hidden rounded-md border border-border bg-popover p-1 shadow-card"
                  >
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm font-medium">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user.roleLabel}</p>
                    </div>
                    <MenuLink href="/profile" icon={UserCircle}>
                      {labels.profile}
                    </MenuLink>
                    <MenuLink href="/profile/password" icon={KeyRound}>
                      {labels.changePassword}
                    </MenuLink>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        <LogOut className="h-4 w-4" />
                        {labels.logout}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function BrandHeader({
  shopName,
  collapsed,
  bare,
}: {
  shopName: string;
  collapsed: boolean;
  bare?: boolean;
}) {
  const content = (
    <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wrench className="h-5 w-5" />
      </span>
      {!collapsed && (
        <span className="truncate text-lg font-bold tracking-tight">{shopName}</span>
      )}
    </Link>
  );

  if (bare) return content;

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b border-border px-4',
        collapsed && 'justify-center px-2',
      )}
    >
      {content}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-accent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Link>
  );
}
