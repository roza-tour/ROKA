'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, Check, X, Receipt, Wrench, ExternalLink } from 'lucide-react';

import {
  changeQuotationStatusAction,
  convertQuotationToRepairAction,
} from '@/app/actions/quotations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { QuotationStatus } from '@/lib/constants';

export function QuotationActions({
  quotationId,
  status,
  hasDevice,
  canUpdate,
  canConvertInvoice,
  canConvertRepair,
  convertedInvoiceId,
  convertedRepairId,
  labels,
}: {
  quotationId: string;
  status: string;
  hasDevice: boolean;
  canUpdate: boolean;
  canConvertInvoice: boolean;
  canConvertRepair: boolean;
  convertedInvoiceId: string | null;
  convertedRepairId: string | null;
  labels: {
    statuses: Record<string, string>;
    send: string;
    accept: string;
    reject: string;
    toInvoice: string;
    toRepair: string;
    viewConverted: string;
    needsDevice: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: QuotationStatus) {
    startTransition(async () => {
      const result = await changeQuotationStatusAction(quotationId, next);
      if (result.ok) {
        toast.success(result.message ?? 'تم');
        router.refresh();
      } else {
        toast.error(result.error ?? 'حدث خطأ');
      }
    });
  }

  function convertToRepair() {
    if (!hasDevice) {
      toast.warning(labels.needsDevice);
      return;
    }
    startTransition(async () => {
      const result = await convertQuotationToRepairAction(quotationId);
      // عند النجاح يعيد الإجراء التوجيه؛ لا يصل التنفيذ إلى هنا
      if (result && !result.ok) toast.error(result.error ?? 'تعذّر التحويل');
    });
  }

  if (status === 'CONVERTED') {
    const href = convertedInvoiceId
      ? `/invoices/${convertedInvoiceId}`
      : convertedRepairId
        ? `/repairs/${convertedRepairId}`
        : null;
    return href ? (
      <Link href={href}>
        <Button variant="outline" icon={<ExternalLink className="h-4 w-4" />}>
          {labels.viewConverted}
        </Button>
      </Link>
    ) : null;
  }

  return (
    <>
      {canUpdate && status === 'DRAFT' && (
        <Button
          variant="outline"
          onClick={() => changeStatus('SENT')}
          loading={pending}
          icon={<Send className="h-4 w-4" />}
        >
          {labels.send}
        </Button>
      )}

      {canUpdate && (status === 'SENT' || status === 'DRAFT') && (
        <>
          <Button
            variant="success"
            onClick={() => changeStatus('ACCEPTED')}
            loading={pending}
            icon={<Check className="h-4 w-4" />}
          >
            {labels.accept}
          </Button>
          <Button
            variant="ghost"
            onClick={() => changeStatus('REJECTED')}
            loading={pending}
            icon={<X className="h-4 w-4" />}
          >
            {labels.reject}
          </Button>
        </>
      )}

      {canConvertInvoice && status !== 'REJECTED' && (
        <Link href={`/invoices/new?quotationId=${quotationId}`}>
          <Button icon={<Receipt className="h-4 w-4" />}>{labels.toInvoice}</Button>
        </Link>
      )}

      {canConvertRepair && status !== 'REJECTED' && (
        <Button
          variant="outline"
          onClick={convertToRepair}
          loading={pending}
          icon={<Wrench className="h-4 w-4" />}
        >
          {labels.toRepair}
        </Button>
      )}
    </>
  );
}
