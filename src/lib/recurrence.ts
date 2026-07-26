import { addDays, addMonths } from './utils';
import type { Recurrence } from './constants';

/** حساب تاريخ الاستحقاق التالي لمصروف دوري */
export function nextDueFrom(date: Date, recurrence: Recurrence): Date {
  switch (recurrence) {
    case 'DAILY':
      return addDays(date, 1);
    case 'WEEKLY':
      return addDays(date, 7);
    case 'MONTHLY':
      return addMonths(date, 1);
    case 'QUARTERLY':
      return addMonths(date, 3);
    case 'YEARLY':
      return addMonths(date, 12);
    default:
      return addMonths(date, 1);
  }
}

/** كل تواريخ الاستحقاق القادمة حتى تاريخ معيّن (لعرض التقويم) */
export function upcomingDueDates(
  start: Date,
  recurrence: Recurrence,
  until: Date,
  limit = 24,
): Date[] {
  const dates: Date[] = [];
  let current = new Date(start);
  while (current <= until && dates.length < limit) {
    dates.push(new Date(current));
    current = nextDueFrom(current, recurrence);
  }
  return dates;
}
