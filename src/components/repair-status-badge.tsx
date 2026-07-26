import { Badge, type BadgeTone } from '@/components/ui/badge';
import { REPAIR_STATUS_COLORS, type RepairStatus } from '@/lib/constants';

export function RepairStatusBadge({
  status,
  labels,
  size = 'sm',
}: {
  status: string;
  labels: Record<string, string>;
  size?: 'sm' | 'md';
}) {
  const tone = (REPAIR_STATUS_COLORS[status as RepairStatus] ?? 'gray') as BadgeTone;
  return (
    <Badge tone={tone} dot size={size}>
      {labels[status] ?? status}
    </Badge>
  );
}

const INVOICE_TONES: Record<string, BadgeTone> = {
  DRAFT: 'gray',
  UNPAID: 'rose',
  PARTIAL: 'amber',
  PAID: 'emerald',
  REFUNDED: 'violet',
  CANCELLED: 'gray',
};

export function InvoiceStatusBadge({
  status,
  labels,
  size = 'sm',
}: {
  status: string;
  labels: Record<string, string>;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge tone={INVOICE_TONES[status] ?? 'gray'} dot size={size}>
      {labels[status] ?? status}
    </Badge>
  );
}

const GENERIC_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'emerald',
  EXPIRED: 'gray',
  CLAIMED: 'amber',
  VOID: 'rose',
  DRAFT: 'gray',
  SENT: 'blue',
  ACCEPTED: 'emerald',
  REJECTED: 'rose',
  CONVERTED: 'violet',
  ORDERED: 'blue',
  RECEIVED: 'emerald',
  PARTIAL: 'amber',
  CANCELLED: 'gray',
  SCHEDULED: 'blue',
  CONFIRMED: 'teal',
  ARRIVED: 'violet',
  DONE: 'emerald',
  NO_SHOW: 'rose',
  PENDING: 'amber',
  PAID: 'emerald',
  FAILED: 'rose',
  SKIPPED: 'gray',
  PRESENT: 'emerald',
  ABSENT: 'rose',
  LATE: 'amber',
  LEAVE: 'blue',
  HOLIDAY: 'violet',
  OVERDUE: 'rose',
  WAIVED: 'gray',
  COMPLETED: 'emerald',
  DEFAULTED: 'rose',
};

export function StatusBadge({
  status,
  labels,
  size = 'sm',
}: {
  status: string;
  labels: Record<string, string>;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge tone={GENERIC_TONES[status] ?? 'gray'} dot size={size}>
      {labels[status] ?? status}
    </Badge>
  );
}
