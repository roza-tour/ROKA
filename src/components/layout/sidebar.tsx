'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavSection } from './nav-config';

export interface SidebarBadges {
  repairsActive?: number;
  lowStock?: number;
  unpaidInvoices?: number;
}

export function SidebarNav({
  sections,
  badges,
  onNavigate,
  collapsed = false,
}: {
  sections: NavSection[];
  badges?: SidebarBadges;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="القائمة الرئيسية">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed && (
            <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </h2>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon =
                (Icons[item.icon as keyof typeof Icons] as React.ElementType) ?? Icons.Circle;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.badge ? badges?.[item.badge] : undefined;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      collapsed && 'justify-center px-2',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {count ? (
                          <span
                            className={cn(
                              'numeric min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold',
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground group-hover:bg-background',
                            )}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        ) : null}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
