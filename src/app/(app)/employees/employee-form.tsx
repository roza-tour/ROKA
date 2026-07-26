'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Save, ShieldCheck, ChevronDown } from 'lucide-react';

import { createEmployeeAction, updateEmployeeAction } from '@/app/actions/employees';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from '@/components/ui/form';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { ROLES, type Role } from '@/lib/constants';
import { ROLE_PERMISSIONS, PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/lib/permissions';
import { toDateInput, cn } from '@/lib/utils';

export interface EmployeeFormValues {
  id?: string;
  username?: string;
  email?: string | null;
  fullName?: string;
  phone?: string | null;
  role?: string;
  jobTitle?: string | null;
  baseSalary?: number;
  hireDate?: Date | null;
  nationalId?: string | null;
  notes?: string | null;
  branchId?: string | null;
  isActive?: boolean;
  permissions?: string[];
}

export function EmployeeForm({
  values = {},
  branches,
  moduleLabels,
  actionLabels,
  labels,
}: {
  values?: EmployeeFormValues;
  branches: { id: string; name: string }[];
  moduleLabels: Record<string, string>;
  actionLabels: Record<string, string>;
  labels: {
    account: string;
    job: string;
    permissions: string;
    permissionsHint: string;
    username: string;
    usernameHint: string;
    email: string;
    fullName: string;
    phone: string;
    password: string;
    passwordHint: string;
    role: string;
    roles: Record<string, string>;
    jobTitle: string;
    baseSalary: string;
    hireDate: string;
    nationalId: string;
    notes: string;
    branch: string;
    active: string;
    fromRole: string;
    extra: string;
    none: string;
    save: string;
    cancel: string;
  };
}) {
  const isEdit = Boolean(values.id);
  const [state, formAction] = useActionState<FormState | null, FormData>(
    isEdit ? updateEmployeeAction : createEmployeeAction,
    null,
  );
  const toast = useToast();

  const [role, setRole] = useState<Role>((values.role as Role) ?? 'TECHNICIAN');
  const [extraPermissions, setExtraPermissions] = useState<Set<string>>(
    new Set(values.permissions ?? []),
  );
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state, toast]);

  const err = (field: string) => state?.errors?.[field];

  const rolePermissions = new Set(ROLE_PERMISSIONS[role] ?? []);
  const isAdmin = role === 'ADMIN';

  function toggle(permission: string) {
    setExtraPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={values.id} />}
      {[...extraPermissions].map((permission) => (
        <input key={permission} type="hidden" name="permissions" value={permission} />
      ))}

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Card title={labels.account}>
        <FormGrid cols={2}>
          <Field label={labels.fullName} required error={err('fullName')} htmlFor="fullName">
            <Input
              id="fullName"
              name="fullName"
              defaultValue={values.fullName ?? ''}
              required
              autoFocus
              invalid={Boolean(err('fullName'))}
            />
          </Field>

          <Field
            label={labels.username}
            required
            hint={labels.usernameHint}
            error={err('username')}
            htmlFor="username"
          >
            <Input
              id="username"
              name="username"
              defaultValue={values.username ?? ''}
              required
              dir="ltr"
              className="text-start"
              invalid={Boolean(err('username'))}
            />
          </Field>

          <Field label={labels.email} error={err('email')} htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          <Field label={labels.phone} error={err('phone')} htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={values.phone ?? ''}
              dir="ltr"
            />
          </Field>

          {!isEdit && (
            <Field
              label={labels.password}
              hint={labels.passwordHint}
              htmlFor="password"
              className="sm:col-span-2"
            >
              <Input
                id="password"
                name="password"
                type="text"
                dir="ltr"
                className="text-start"
                autoComplete="new-password"
              />
            </Field>
          )}
        </FormGrid>
      </Card>

      <Card title={labels.job}>
        <FormGrid cols={2}>
          <Field label={labels.role} required htmlFor="role">
            <Select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              options={ROLES.map((r) => ({ value: r, label: labels.roles[r] ?? r }))}
            />
          </Field>

          <Field label={labels.jobTitle} htmlFor="jobTitle">
            <Input id="jobTitle" name="jobTitle" defaultValue={values.jobTitle ?? ''} />
          </Field>

          <Field label={labels.baseSalary} htmlFor="baseSalary">
            <Input
              id="baseSalary"
              name="baseSalary"
              type="number"
              min={0}
              step="any"
              defaultValue={values.baseSalary ?? 0}
            />
          </Field>

          <Field label={labels.hireDate} htmlFor="hireDate">
            <Input
              id="hireDate"
              name="hireDate"
              type="date"
              defaultValue={toDateInput(values.hireDate ?? new Date())}
            />
          </Field>

          <Field label={labels.nationalId} htmlFor="nationalId">
            <Input
              id="nationalId"
              name="nationalId"
              defaultValue={values.nationalId ?? ''}
              dir="ltr"
              className="text-start"
            />
          </Field>

          {branches.length > 1 && (
            <Field label={labels.branch} htmlFor="branchId">
              <Select
                id="branchId"
                name="branchId"
                defaultValue={values.branchId ?? ''}
                placeholder={labels.none}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
          )}

          <Field label={labels.notes} htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ''} rows={2} />
          </Field>
        </FormGrid>

        <div className="mt-4">
          <Checkbox
            name="isActive"
            defaultChecked={values.isActive ?? true}
            label={labels.active}
          />
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {labels.permissions}
          </span>
        }
        description={labels.permissionsHint}
        actions={
          !isAdmin && (
            <button
              type="button"
              onClick={() => setShowPermissions((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {labels.extra}
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', showPermissions && 'rotate-180')}
              />
            </button>
          )
        }
      >
        {isAdmin ? (
          <p className="rounded-md bg-violet-100 p-3 text-sm text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
            مدير النظام يملك كل الصلاحيات تلقائياً
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[...rolePermissions].slice(0, 40).map((permission) => (
                <Badge key={permission} tone="blue" size="sm">
                  {permission}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{labels.fromRole}</p>

            {showPermissions && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {PERMISSION_MODULES.map((module) => (
                  <div key={module} className="flex flex-wrap items-center gap-2">
                    <span className="w-32 shrink-0 text-sm font-medium">
                      {moduleLabels[module] ?? module}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PERMISSION_ACTIONS.map((action) => {
                        const permission = `${module}:${action}`;
                        const fromRole = rolePermissions.has(permission as never);
                        const extra = extraPermissions.has(permission);
                        return (
                          <button
                            key={action}
                            type="button"
                            disabled={fromRole}
                            onClick={() => toggle(permission)}
                            className={cn(
                              'rounded border px-2 py-0.5 text-[11px] transition-colors',
                              fromRole
                                ? 'cursor-default border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                                : extra
                                  ? 'border-transparent bg-success text-success-foreground'
                                  : 'border-border text-muted-foreground hover:bg-accent',
                            )}
                            title={fromRole ? labels.fromRole : permission}
                          >
                            {actionLabels[action] ?? action}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={values.id ? `/employees/${values.id}` : '/employees'}>
          <Button type="button" variant="outline">
            {labels.cancel}
          </Button>
        </Link>
        <SubmitButton label={labels.save} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} icon={<Save className="h-4 w-4" />}>
      {label}
    </Button>
  );
}
