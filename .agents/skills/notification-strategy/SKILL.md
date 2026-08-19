---
name: notification-strategy
description: Notification delivery strategy using background queues for SMS, email, push, and WhatsApp. Triggers when implementing order updates, chat messages, payment alerts, delivery tracking, or any user-facing notification.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Notification Strategy — FashionConnect

## Why Async Notifications Are Critical

Sending notifications synchronously kills performance:

- **User places order** → waits 3s for SMS → bad UX
- **Chat message** → blocks until email sent → message delay
- **Webhook** → email blocks webhook response → gateway timeout

**Rule:** NEVER send notifications synchronously. Always push to background queue.

---

## Architecture

```
Event → Create Notification Record (DB) → Push to BullMQ Queue
                                    │
                                    ├──► SMS Queue (Twilio/Vonage)
                                    ├──► Email Queue (SendGrid/SES)
                                    ├──► Push Queue (FCM/APNS)
                                    └──► WhatsApp Queue (Meta)
                                    │
                                    ▼
                            Worker Processes
                                    │
                                    ▼
                            Update Status → Retry on Failure (exponential backoff)
                                    │
                                    ▼
                            Dead Letter Queue (after max retries)
```

---

## Database Schema

```prisma
model Notification {
  id            String            @id @default(uuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  templateCode  String            // e.g., "order.confirmed", "chat.new_message"
  channel       NotificationChannel
  status        NotificationStatus @default(PENDING)
  payload       Json              // Template variables
  priority      NotificationPriority @default(NORMAL)
  sentAt        DateTime?
  deliveredAt   DateTime?
  failedAt      DateTime?
  errorMessage  String?
  retryCount    Int               @default(0)
  maxRetries    Int               @default(3)
  scheduledAt   DateTime?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([userId, status])
  @@index([status, scheduledAt])
  @@map("notifications")
}

enum NotificationChannel { SMS EMAIL PUSH WHATSAPP IN_APP }
enum NotificationStatus { PENDING QUEUED SENT DELIVERED FAILED CANCELLED }
enum NotificationPriority { LOW NORMAL HIGH CRITICAL }
```

---

## Notification Templates (Arabic + English)

```typescript
export const NOTIFICATION_TEMPLATES = {
  'order.confirmed': {
    sms: 'طلبك #{orderNumber} تم تأكيده. المجموع: #{amount} ج.م',
    push: { title: 'Order Confirmed', body: 'Your order #{orderNumber} is confirmed' },
    whatsapp: 'مرحباً #{customerName}، طلبك #{orderNumber} تم تأكيده. المجموع: #{amount} ج.م',
  },
  'order.shipped': {
    sms: 'طلبك #{orderNumber} تم شحنه. تتبع: #{trackingUrl}',
  },
  'order.delivered': {
    sms: 'طلبك #{orderNumber} تم توصيله. شكراً لتسوقك مع FashionConnect!',
  },
  'order.cod_due': {
    sms: 'عزيزي #{customerName}، طلبك #{orderNumber} وصل. المبلغ المستحق: #{amount} ج.م. يرجى تجهيز المبلغ للكابتن.',
  },
  'payment.confirmed': {
    sms: 'تم استلام دفعتك لطلب #{orderNumber}. شكراً لك!',
  },
  'chat.new_message': {
    push: { title: 'New Message from #{senderName}', body: '#{messagePreview}' },
  },
  'delivery.out_for_delivery': {
    sms: 'طلبك #{orderNumber} في الطريق إليك. الكابتن: #{courierName} - #{courierPhone}',
  },
  'cart.abandoned': {
    email: { subject: 'You left something behind', template: 'cart-abandoned' },
    push: { title: 'Complete Your Order', body: 'Items in your cart are waiting' },
  },
} as const;
```

---

## Notification Service

```typescript
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, private bullMQ: BullMQService) {}

  async notify(params: {
    userId: string; templateCode: string; payload: Record<string, any>;
    channels?: NotificationChannel[]; priority?: NotificationPriority; scheduledAt?: Date;
  }): Promise<Notification[]> {
    const channels = params.channels || this.getDefaultChannels(params.templateCode);
    
    const notifications = await this.prisma.$transaction(async (tx) =>
      Promise.all(channels.map(channel =>
        tx.notification.create({
          data: {
            userId: params.userId,
            templateCode: params.templateCode,
            channel,
            payload: params.payload,
            priority: params.priority || NotificationPriority.NORMAL,
            scheduledAt: params.scheduledAt,
          },
        })
      ))
    );

    for (const n of notifications) {
      if (!params.scheduledAt || params.scheduledAt <= new Date()) {
        await this.bullMQ.addJob('notifications', { notificationId: n.id }, {
          priority: this.getPriorityValue(n.priority),
          delay: params.scheduledAt ? params.scheduledAt.getTime() - Date.now() : 0,
        });
      }
    }
    return notifications;
  }

  private getDefaultChannels(templateCode: string): NotificationChannel[] {
    const defaults: Record<string, NotificationChannel[]> = {
      'order.confirmed': [NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
      'order.shipped': [NotificationChannel.SMS, NotificationChannel.PUSH],
      'order.delivered': [NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
      'order.cod_due': [NotificationChannel.SMS],
      'payment.confirmed': [NotificationChannel.SMS, NotificationChannel.EMAIL],
      'chat.new_message': [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      'delivery.out_for_delivery': [NotificationChannel.SMS],
      'cart.abandoned': [NotificationChannel.EMAIL, NotificationChannel.PUSH],
    };
    return defaults[templateCode] || [NotificationChannel.IN_APP, NotificationChannel.PUSH];
  }
}
```

---

## Queue Worker

```typescript
@Injectable()
export class NotificationWorker {
  constructor(
    private prisma: PrismaService,
    private sms: SMSProvider, private email: EmailProvider,
    private push: PushProvider, private whatsapp: WhatsAppProvider,
  ) {}

  @Processor('notifications')
  async process(job: Job<{ notificationId: string }>) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
    });
    if (!notification) return;

    try {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.QUEUED },
      });

      await this.sendByChannel(notification);

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.handleFailure(notification, error);
    }
  }

  private async sendByChannel(n: Notification) {
    const template = NOTIFICATION_TEMPLATES[n.templateCode];
    const content = this.renderTemplate(template[n.channel], n.payload);

    switch (n.channel) {
      case NotificationChannel.SMS: await this.sms.send(n.payload.phone, content); break;
      case NotificationChannel.EMAIL: await this.email.send({ to: n.payload.email, subject: template?.email?.subject, html: content }); break;
      case NotificationChannel.PUSH: await this.push.send({ userId: n.userId, title: template?.push?.title, body: content }); break;
      case NotificationChannel.WHATSAPP: await this.whatsapp.send(n.payload.phone, content); break;
    }
  }

  private async handleFailure(n: Notification, error: Error) {
    const retry = n.retryCount + 1;
    if (retry >= n.maxRetries) {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: NotificationStatus.FAILED, failedAt: new Date(), errorMessage: error.message, retryCount: retry },
      });
      await this.alertOnCall(n, error);
    } else {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { retryCount: retry, status: NotificationStatus.PENDING, errorMessage: error.message },
      });
      await this.bullMQ.addJob('notifications', { notificationId: n.id }, { delay: Math.pow(2, retry) * 60000 });
    }
  }
}
```

---

## Priority & Critical Notifications

```typescript
const PRIORITY = { LOW: 1, NORMAL: 10, HIGH: 50, CRITICAL: 100 };

// Usage
await notifications.notify({
  userId, templateCode: 'order.cod_due',
  payload: { orderNumber: 'FC-1234', amount: 29999, customerName: 'أحمد' },
  priority: NotificationPriority.CRITICAL, // COD = critical
});
```

---

## What NOT To Do

- ❌ NEVER send notifications synchronously in request handlers
- ❌ NEVER hardcode channels in controllers (use template defaults)
- ❌ NEVER skip retry logic (network failures are normal)
- ❌ NEVER store notification content in queue (store ID, fetch from DB)
- ❌ NEVER send marketing without user consent (opt-in required)
- ❌ NEVER send SMS between 10 PM - 8 AM (Egypt regulations)
- ❌ NEVER expose provider API keys in code
- ❌ NEVER skip rate limiting per channel

---

## Notification Checklist

- [ ] All notifications created in DB before queueing
- [ ] Async queue (BullMQ) for all channels
- [ ] Template system with channel-specific content (Arabic + English)
- [ ] Priority levels (LOW, NORMAL, HIGH, CRITICAL)
- [ ] Exponential backoff retry (max 3)
- [ ] Dead letter queue for failed notifications
- [ ] Delivery confirmation via provider webhooks
- [ ] Scheduled notifications (cron jobs)
- [ ] User preferences (opt-out per channel)
- [ ] Rate limiting per channel/provider
- [ ] Priority bypass for critical (COD, payment failed)

---

## Related Skills
- bullmq-specialist (queue implementation)
- egyptian-market-localization (Arabic templates, SMS timing)
- test-driven-development (worker testing)
- security-checklist (provider API key management)