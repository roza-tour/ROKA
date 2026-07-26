import { pagePermission } from '@/lib/guards';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getI18n } from '@/i18n';
import { db } from '@/lib/db';
import { PageHeader, Card } from '@/components/ui/page';
import { TemplateEditor } from './template-editor';
import { NOTIFICATION_KEYS } from '@/lib/constants';

export const metadata: Metadata = { title: 'قوالب الإشعارات' };
export const dynamic = 'force-dynamic';

/** المتغيرات المتاحة لكل قالب */
const TEMPLATE_VARIABLES: Record<string, string[]> = {
  'repair.received': ['customerName', 'deviceName', 'orderNumber', 'trackingUrl', 'shopName', 'shopPhone'],
  'repair.diagnosing': ['customerName', 'orderNumber', 'shopName'],
  'repair.waiting_approval': ['customerName', 'orderNumber', 'estimatedCost', 'shopName', 'shopPhone'],
  'repair.waiting_parts': ['customerName', 'orderNumber', 'shopName'],
  'repair.repairing': ['customerName', 'orderNumber', 'shopName'],
  'repair.ready': ['customerName', 'deviceName', 'orderNumber', 'amountDue', 'shopName', 'shopPhone'],
  'repair.delivered': ['customerName', 'orderNumber', 'warrantyEnd', 'shopName'],
  'warranty.expiring': ['customerName', 'itemName', 'warrantyEnd', 'shopName', 'shopPhone'],
  'invoice.created': ['customerName', 'invoiceNumber', 'total', 'shopName'],
  'invoice.due': ['customerName', 'invoiceNumber', 'amountDue', 'shopName'],
  'appointment.reminder': ['customerName', 'appointmentTime', 'shopName', 'shopPhone'],
};

const KEY_LABELS: Record<string, string> = {
  'repair.received': 'استلام الجهاز',
  'repair.diagnosing': 'بدء الفحص',
  'repair.waiting_approval': 'انتظار موافقة العميل',
  'repair.waiting_parts': 'انتظار قطعة غيار',
  'repair.repairing': 'بدء الإصلاح',
  'repair.ready': 'الجهاز جاهز',
  'repair.delivered': 'تسليم الجهاز',
  'warranty.expiring': 'اقتراب انتهاء الضمان',
  'invoice.created': 'إصدار فاتورة',
  'invoice.due': 'تذكير بمبلغ مستحق',
  'appointment.reminder': 'تذكير بموعد',
};

export default async function TemplatesPage() {
  await pagePermission('notifications:view');
  const user = await getCurrentUser();
  const { t } = await getI18n();

  const templates = await db.notificationTemplate.findMany({
    orderBy: [{ key: 'asc' }, { channel: 'asc' }, { locale: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t.notification.templates}
        description="استخدم المتغيرات بين قوسين مزدوجين مثل {{customerName}} — تُستبدل تلقائياً عند الإرسال"
        backHref="/notifications"
        breadcrumbs={[
          { label: t.notification.title, href: '/notifications' },
          { label: t.notification.templates },
        ]}
      />

      {NOTIFICATION_KEYS.map((key) => {
        const group = templates.filter((tpl) => tpl.key === key);
        if (!group.length) return null;

        return (
          <Card key={key} title={KEY_LABELS[key] ?? key} description={key}>
            <TemplateEditor
              templates={group.map((tpl) => ({
                key: tpl.key,
                channel: tpl.channel,
                locale: tpl.locale,
                subject: tpl.subject,
                body: tpl.body,
                isActive: tpl.isActive,
              }))}
              variables={TEMPLATE_VARIABLES[key] ?? []}
              canEdit={can(user, 'notifications:update')}
              labels={{
                channel: t.notification.channel,
                channels: t.notification.channels as Record<string, string>,
                subject: t.notification.subject,
                body: t.notification.body,
                variables: t.notification.variables,
                save: t.actions.save,
                edit: t.actions.edit,
                cancel: t.actions.cancel,
              }}
            />
          </Card>
        );
      })}
    </div>
  );
}
