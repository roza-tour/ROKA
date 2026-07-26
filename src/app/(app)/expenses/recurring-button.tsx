'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { payRecurringExpenseAction } from '@/app/actions/expenses';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/** زر تسجيل دفعة مصروف دوري مستحق */
export function RecurringExpenseButton({
  expenseId,
  label,
}: {
  expenseId: string;
  label: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      icon={<Check className="h-3.5 w-3.5" />}
      onClick={() =>
        startTransition(async () => {
          const result = await payRecurringExpenseAction(expenseId);
          if (result.ok) {
            toast.success(result.message ?? 'تم');
            router.refresh();
          } else {
            toast.error(result.error ?? 'حدث خطأ');
          }
        })
      }
    >
      {label}
    </Button>
  );
}
