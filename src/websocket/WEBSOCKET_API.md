# WebSocket API للحملات اللحظية

## نظرة عامة

تم إضافة WebSocket server إلى النظام لتمكين تحديثات الحملات لحظيًا. يتيح ذلك للمستخدمين رؤية تقدم الحملات في الوقت الفعلي دون الحاجة لتحديث الصفحة.

## التثبيت

تم تثبيت المكتبات التالية:
- `socket.io` - WebSocket server
- `@types/socket.io` - تعريفات TypeScript

## بنية الملفات

```
src/websocket/
├── websocket.server.ts          # WebSocket server الرئيسي
├── campaign-websocket.service.ts # خدمة WebSocket للحملات
├── index.ts                     # تصدير جميع الملفات
├── websocket-client-example.js  # مثال لاستخدام client
└── WEBSOCKET_API.md            # هذا الملف
```

## كيفية العمل

### 1. تهيئة WebSocket Server

يتم تهيئة WebSocket server في ملف `app.ts`:

```typescript
// Initialize WebSocket Server
const webSocketServer = Container.get(WebSocketServer);
webSocketServer.initialize(httpServer);
```

### 2. إدارة الغرف (Rooms)

يدعم النظام الغرف التالية:
- `campaign:{campaignId}` - غرفة حملة محددة
- `user:{userId}` - غرفة مستخدم معين

### 3. الأحداث (Events)

#### الأحداث المرسلة من الخادم:

| الحدث | الوصف | البيانات |
|-------|-------|----------|
| `campaign-update` | تحديث لحملة محددة | `CampaignUpdateEvent` |
| `campaign-global-update` | تحديث عام لجميع الحملات | `CampaignUpdateEvent` |
| `campaign-stats` | إحصائيات الحملة | `CampaignStats` |

#### الأحداث المستلمة من العميل:

| الحدث | الوصف | البيانات |
|-------|-------|----------|
| `join-campaign` | الانضمام لغرفة حملة | `campaignId: string` |
| `leave-campaign` | مغادرة غرفة حملة | `campaignId: string` |
| `subscribe-user-campaigns` | الاشتراك في حملات مستخدم | `userId: string` |

### 4. هياكل البيانات

#### CampaignUpdateEvent
```typescript
interface CampaignUpdateEvent {
  campaignId: string;
  status: string; // 'started', 'in-progress', 'completed', 'error'
  progress?: {
    total: number;
    processed: number;
    failed: number;
    sent: number;
  };
  message?: string;
  timestamp: Date;
}
```

#### CampaignStats
```typescript
interface CampaignStats {
  campaignId: string;
  title: string;
  status: string;
  totalCustomers: number;
  processedCustomers: number;
  sentMessages: number;
  failedMessages: number;
  startTime?: Date;
  endTime?: Date;
}
```

## الاستخدام في الحملات

### 1. إرسال إشعار بدء الحملة

```typescript
// في campaign.service.ts
this.campaignWebSocketService.notifyCampaignStarted(
  campaign.id,
  campaign.title,
  campaign.createdBy.toString()
);
```

### 2. تحديث تقدم الحملة

```typescript
this.campaignWebSocketService.updateCampaignProgress(
  campaignId,
  totalCustomers,
  processedCustomers,
  sentMessages,
  failedMessages
);
```

### 3. إشعار انتهاء الحملة

```typescript
const stats = this.campaignWebSocketService.createCampaignStats(
  campaignId,
  title,
  'completed',
  totalCustomers,
  processedCustomers,
  sentMessages,
  failedMessages,
  startTime,
  endTime
);

this.campaignWebSocketService.notifyCampaignCompleted(
  campaignId,
  title,
  userId,
  stats
);
```

## الاستخدام في Frontend

### 1. تثبيت socket.io-client

```bash
npm install socket.io-client
```

### 2. إنشاء اتصال WebSocket

```javascript
import { io } from 'socket.io-client';

const socket = io('https://your-server.com', {
  transports: ['websocket', 'polling'],
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 3. الاستماع للأحداث

```javascript
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

socket.on('campaign-update', (data) => {
  console.log('Campaign update:', data);
  // تحديث واجهة المستخدم
});

socket.on('campaign-stats', (stats) => {
  console.log('Campaign stats:', stats);
  // تحديث المخططات
});
```

### 4. الانضمام للغرف

```javascript
// الانضمام لغرفة حملة محددة
socket.emit('join-campaign', 'campaign-id-123');

// الاشتراك في حملات مستخدم
socket.emit('subscribe-user-campaignات', 'user-id-456');
```

## مثال كامل للاستخدام

راجع ملف `websocket-client-example.js` لمثال كامل على استخدام WebSocket client في frontend.

## الأمان

- يتم استخدام نفس إعدادات CORS الخاصة بـ Express
- يمكن إضافة مصادقة JWT للأحداث الحساسة
- يتم فصل الغرف حسب المستخدمين للحفاظ على الخصوصية

## التطوير المستقبلي

1. **مصادقة WebSocket**: إضافة مصادقة JTokn لأحداث WebSocket
2. **إعادة الاتصال التلقائي**: تحسين مرونة الاتصال
3. **ضغط البيانات**: تحسين أداء نقل البيانات
4. **مراقبة الأداء**: إضافة مقاييس لمراقبة استخدام WebSocket

## استكشاف الأخطاء وإصلاحها

### المشكلة: لا يتم استقبال التحديثات
1. تحقق من اتصال WebSocket (`socket.connected`)
2. تحقق من الانضمام للغرفة الصحيحة
3. تحقق من تطابق campaignId

### المشكلة: اتصال متقطع
1. تفعيل إعادة الاتصال التلقائي
2. التحقق من إعدادات الشبكة
3. مراقبة استخدام الذاكرة

## المراجع

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Real-time Applications Best Practices](https://ably.com/blog/websocket-authentication)