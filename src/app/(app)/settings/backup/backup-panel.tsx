'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Card } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';

export function BackupPanel({
  canBackup,
  canRestore,
  labels,
}: {
  canBackup: boolean;
  canRestore: boolean;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? 'تعذّر إنشاء النسخة');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match ? decodeURIComponent(match[1]) : 'fixel-backup.json';

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success('تم تنزيل النسخة الاحتياطية');
      router.refresh();
    } catch {
      toast.error('تعذّر إنشاء النسخة');
    } finally {
      setDownloading(false);
    }
  }

  async function restore() {
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/backup', { method: 'POST', body: formData });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        restored?: Record<string, number>;
        errors?: string[];
      };

      if (!response.ok || !data.ok) {
        toast.error(data.error ?? data.errors?.[0] ?? 'فشلت الاستعادة');
        return;
      }

      const total = Object.values(data.restored ?? {}).reduce((a, b) => a + b, 0);
      toast.success(labels.restored, `${total} سجل`);
      setShowRestore(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';

      // الاستعادة تغيّر كل شيء — نعيد تحميل الصفحة بالكامل
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('فشلت الاستعادة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={labels.create}>
          <p className="mb-4 text-sm text-muted-foreground">{labels.createHint}</p>
          <Button
            onClick={download}
            loading={downloading}
            disabled={!canBackup}
            className="w-full"
            icon={<Download className="h-4 w-4" />}
          >
            {labels.create}
          </Button>
        </Card>

        <Card title={labels.restore}>
          <p className="mb-4 text-sm text-muted-foreground">
            {canRestore ? labels.restoreHint : labels.adminOnly}
          </p>
          <Button
            variant="danger"
            onClick={() => setShowRestore(true)}
            disabled={!canRestore}
            className="w-full"
            icon={<Upload className="h-4 w-4" />}
          >
            {labels.restore}
          </Button>
        </Card>
      </div>

      <Dialog
        open={showRestore}
        onClose={() => !busy && setShowRestore(false)}
        title={labels.restore}
        size="sm"
        closeOnOverlay={!busy}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowRestore(false)} disabled={busy}>
              {labels.cancel}
            </Button>
            <Button variant="danger" onClick={restore} loading={busy} disabled={!file}>
              {labels.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{labels.restoreWarning}</span>
          </div>

          {labels.logoutNotice && (
            <p className="rounded-md bg-warning/10 p-2.5 text-xs text-warning">
              {labels.logoutNotice}
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{labels.selectFile}</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
              className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary-600"
            />
          </label>

          {file && (
            <p className="numeric rounded-md bg-muted/50 p-2 text-xs">
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}

          {busy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ الاستعادة… لا تغلق الصفحة
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
