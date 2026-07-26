'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Save, X } from 'lucide-react';

import { saveTemplateAction } from '@/app/actions/notifications';
import type { FormState } from '@/app/actions/customers';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Checkbox } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface Template {
  key: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  isActive: boolean;
}

export function TemplateEditor({
  templates,
  variables,
  canEdit,
  labels,
}: {
  templates: Template[];
  variables: string[];
  canEdit: boolean;
  labels: {
    channel: string;
    channels: Record<string, string>;
    subject: string;
    body: string;
    variables: string;
    save: string;
    edit: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction] = useActionState<FormState | null, FormData>(
    saveTemplateAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'تم الحفظ');
      setEditing(null);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, toast, router]);

  const channels = [...new Set(templates.map((tpl) => tpl.channel))];
  const [activeChannel, setActiveChannel] = useState(channels[0] ?? 'SMS');

  const visible = templates.filter((tpl) => tpl.channel === activeChannel);

  /** إدراج متغيّر في موضع المؤشر داخل نص القالب */
  function insertVariable(variable: string) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const token = `{{${variable}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value =
      textarea.value.slice(0, start) + token + textarea.value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + token.length, start + token.length);
  }

  return (
    <div>
      <div className="mb-3 inline-flex gap-1 rounded-md bg-muted p-1">
        {channels.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => setActiveChannel(channel)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeChannel === channel
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labels.channels[channel] ?? channel}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((template) => {
          const id = `${template.key}-${template.channel}-${template.locale}`;
          const isEditing = editing === id;

          return (
            <div key={id} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden>{LOCALE_META[template.locale as Locale]?.flag}</span>
                  {LOCALE_META[template.locale as Locale]?.nativeName ?? template.locale}
                  {!template.isActive && (
                    <Badge tone="gray" size="sm">
                      معطّل
                    </Badge>
                  )}
                </span>
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={() => setEditing(id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={labels.edit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <form action={formAction} className="space-y-3">
                  <input type="hidden" name="key" value={template.key} />
                  <input type="hidden" name="channel" value={template.channel} />
                  <input type="hidden" name="locale" value={template.locale} />

                  {template.channel === 'EMAIL' && (
                    <Field label={labels.subject}>
                      <Input name="subject" defaultValue={template.subject ?? ''} />
                    </Field>
                  )}

                  <Field label={labels.body} required>
                    <Textarea
                      ref={bodyRef}
                      name="body"
                      defaultValue={template.body}
                      rows={4}
                      required
                      dir={template.locale === 'ar' ? 'rtl' : 'ltr'}
                    />
                  </Field>

                  {variables.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">{labels.variables}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {variables.map((variable) => (
                          <button
                            key={variable}
                            type="button"
                            onClick={() => insertVariable(variable)}
                            className="rounded border border-border px-2 py-0.5 font-mono text-[11px] transition-colors hover:bg-accent"
                            dir="ltr"
                          >
                            {`{{${variable}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Checkbox name="isActive" defaultChecked={template.isActive} label="مفعّل" />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(null)}
                      icon={<X className="h-3.5 w-3.5" />}
                    >
                      {labels.cancel}
                    </Button>
                    <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>
                      {labels.save}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  {template.subject && (
                    <p className="mb-1 text-xs font-medium">{template.subject}</p>
                  )}
                  <p
                    className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs leading-relaxed"
                    dir={template.locale === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {template.body}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
