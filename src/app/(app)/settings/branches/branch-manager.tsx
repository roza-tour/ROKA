'use client';

import { useActionState, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Building2 } from 'lucide-react';

import { saveBranchAction } from '@/app/actions/settings';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Checkbox, FormGrid } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';

interface Branch {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  isDefault: boolean;
  isActive: boolean;
  usersCount: number;
  repairsCount: number;
  invoicesCount: number;
}

export function BranchManager({
  branches,
  canEdit,
  labels,
}: {
  branches: Branch[];
  canEdit: boolean;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [open, setOpen] = useState(false);

  const [state, formAction] = useActionState<FormState | null, FormData>(
    saveBranchAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setOpen(false);
      setEditing(null);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  return (
    <>
      {canEdit && (
        <div className="border-b border-border p-3">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            icon={<Plus className="h-4 w-4" />}
          >
            {labels.add}
          </Button>
        </div>
      )}

      {branches.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {branches.map((branch) => (
            <li key={branch.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-[18px] w-[18px]" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {branch.name}
                  <span className="numeric text-xs text-muted-foreground">{branch.code}</span>
                  {branch.isDefault && (
                    <Badge tone="violet" size="sm">
                      {labels.isDefault}
                    </Badge>
                  )}
                  {!branch.isActive && (
                    <Badge tone="gray" size="sm">
                      معطّل
                    </Badge>
                  )}
                </p>
                <p className="numeric text-xs text-muted-foreground">
                  {branch.usersCount} {labels.users} · {branch.repairsCount} {labels.repairs} ·{' '}
                  {branch.invoicesCount} {labels.invoices}
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(branch);
                    setOpen(true);
                  }}
                  className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={labels.edit}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? labels.edit : labels.add}
        size="md"
      >
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <FormGrid cols={2}>
            <Field label={labels.name} required>
              <Input name="name" defaultValue={editing?.name ?? ''} required autoFocus />
            </Field>

            <Field label={labels.code} required>
              <Input
                name="code"
                defaultValue={editing?.code ?? ''}
                required
                dir="ltr"
                className="text-start uppercase"
              />
            </Field>

            <Field label={labels.phone}>
              <Input name="phone" defaultValue={editing?.phone ?? ''} dir="ltr" />
            </Field>

            <Field label={labels.email}>
              <Input
                name="email"
                type="email"
                defaultValue={editing?.email ?? ''}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <Field label={labels.address} className="sm:col-span-2">
              <Input name="address" defaultValue={editing?.address ?? ''} />
            </Field>

            <Field label={labels.taxNumber}>
              <Input
                name="taxNumber"
                defaultValue={editing?.taxNumber ?? ''}
                dir="ltr"
                className="text-start"
              />
            </Field>
          </FormGrid>

          <Checkbox
            name="isActive"
            defaultChecked={editing?.isActive ?? true}
            label={labels.active}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              {labels.cancel}
            </Button>
            <Button type="submit">{labels.save}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
