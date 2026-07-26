'use client';

import { useState, useMemo } from 'react';
import { Eye } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** عرض الفروق بين الحالة قبل وبعد العملية */
export function AuditDetails({
  before,
  after,
  summary,
  labels,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  summary: string;
  labels: {
    details: string;
    changes: string;
    field: string;
    oldValue: string;
    newValue: string;
    close: string;
    noChanges: string;
  };
}) {
  const [open, setOpen] = useState(false);

  const changes = useMemo(() => {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    const rows: { field: string; from: string; to: string }[] = [];

    for (const key of keys) {
      const from = format(before?.[key]);
      const to = format(after?.[key]);
      if (from !== to) rows.push({ field: key, from, to });
    }
    return rows;
  }, [before, after]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={labels.details}
        title={labels.details}
      >
        <Eye className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.changes}
        description={summary}
        size="lg"
        footer={<Button onClick={() => setOpen(false)}>{labels.close}</Button>}
      >
        {changes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.noChanges}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{labels.field}</th>
                  <th>{labels.oldValue}</th>
                  <th>{labels.newValue}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.field}>
                    <td className="font-mono text-xs" dir="ltr">
                      {change.field}
                    </td>
                    <td className="max-w-xs break-words text-xs text-danger">
                      {change.from || '—'}
                    </td>
                    <td className="max-w-xs break-words text-xs text-success">
                      {change.to || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
    </>
  );
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 200 ? `${json.slice(0, 200)}…` : json;
    } catch {
      return '[object]';
    }
  }
  const text = String(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}
