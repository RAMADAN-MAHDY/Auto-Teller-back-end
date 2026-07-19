# 🎯 دليل تكامل Meta Webhooks مع WebSocket - Frontend (Next.js)

**للمطورين الذين يعملون بـ Next.js لاستقبال أحداث Meta Webhooks عبر WebSocket في الوقت الفعلي**

---

## 📋 المحتويات

1. [المقدمة والمفاهيم](#المقدمة-والمفاهيم)
2. [التثبيت والإعداد](#التثبيت-والإعداد)
3. [الأحداث المدعومة](#الأحداث-المدعومة)
4. [أمثلة عملية](#أمثلة-عملية)
5. [أفضل الممارسات](#أفضل-الممارسات)
6. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## 🔍 المقدمة والمفاهيم

### ما هي Meta Webhooks؟
عندما تقوم Meta (WhatsApp) بإرسال رسالة أو عندما يقرأ العميل الرسالة، ترسل Meta **بيانات الحدث** مباشرة للخادم الخاص بك (Backend). هذه البيانات تشمل:

- ✅ **Delivered**: تم استقبال الرسالة من قبل العميل
- 👁️ **Read**: قرأ العميل الرسالة
- 📤 **Sent**: تم إرسال الرسالة بنجاح
- ❌ **Failed**: فشل الإرسال

### دور WebSocket
البيانات التي يستقبلها الخادم تُرسَل عبر **WebSocket** للواجهة الأمامية **في الوقت الفعلي**، بدلاً من انتظار الـ Frontend ليطلب البيانات.

### تدفق البيانات الكامل

```
Meta WhatsApp API
       ↓
    Webhook Endpoint (Backend)
       ↓
Database Update
       ↓
WebSocket Event Emission
       ↓
Frontend (Next.js) يستقبل الحدث
       ↓
تحديث واجهة المستخدم لحظيًا
```

---

## ⚙️ التثبيت والإعداد

### 1️⃣ تثبيت المكتبات المطلوبة

```bash
npm install socket.io-client
# أو
yarn add socket.io-client
# أو
pnpm add socket.io-client
```

### 2️⃣ إنشاء Web Socket Client Hook

أنشئ ملف جديد: `lib/hooks/useWebSocket.ts`

```typescript
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketConfig {
  url?: string;
  token?: string;
  autoConnect?: boolean;
}

interface CampaignUpdate {
  campaignId: string;
  status: 'started' | 'in-progress' | 'completed' | 'error';
  progress?: {
    total: number;
    processed: number;
    sent: number;
    failed: number;
  };
  message?: string;
  timestamp: string;
}

interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipientPhone?: string;
}

export function useWebSocket(config: WebSocketConfig = {}) {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
    token,
    autoConnect = true,
  } = config;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [campaignUpdates, setCampaignUpdates] = useState<CampaignUpdate | null>(null);
  const [messageStatusUpdates, setMessageStatusUpdates] = useState<MessageStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // إنشاء الاتصال
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    try {
      socketRef.current = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        auth: token
          ? {
              token,
            }
          : undefined,
      });

      // حدث الاتصال
      socketRef.current.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
        setIsConnected(true);
        setError(null);
      });

      // حدث قطع الاتصال
      socketRef.current.on('disconnect', () => {
        console.log('🔌 Disconnected from WebSocket server');
        setIsConnected(false);
      });

      // حدث الخطأ
      socketRef.current.on('error', (err) => {
        console.error('❌ WebSocket error:', err);
        setError(err.message || 'Connection error');
      });

      // استقبال تحديثات الحملات
      socketRef.current.on('campaign-update', (data: CampaignUpdate) => {
        console.log('📢 Campaign update:', data);
        setCampaignUpdates(data);
      });

      // استقبال تحديثات الحملات العام
      socketRef.current.on('campaign-global-update', (data: CampaignUpdate) => {
        console.log('🌍 Global campaign update:', data);
        setCampaignUpdates(data);
      });

      // استقبال أحداث Meta Webhooks (حالات الرسائل)
      socketRef.current.on('message-status-update', (data: MessageStatus) => {
        console.log('📨 Message status update:', data);
        setMessageStatusUpdates(data);
      });

      // استقبال إحصائيات الحملة
      socketRef.current.on('campaign-stats', (stats: any) => {
        console.log('📊 Campaign stats:', stats);
      });
    } catch (err) {
      console.error('Failed to connect:', err);
      setError('Failed to establish connection');
    }
  }, [url, token]);

  // قطع الاتصال
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setIsConnected(false);
    }
  }, []);

  // الانضمام لغرفة حملة محددة
  const joinCampaign = useCallback((campaignId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-campaign', campaignId);
      console.log(`🔗 Joined campaign room: ${campaignId}`);
    }
  }, []);

  // الاشتراك في حملات المستخدم
  const subscribeToUserCampaigns = useCallback((userId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe-user-campaigns', userId);
      console.log(`👤 Subscribed to user campaigns: ${userId}`);
    }
  }, []);

  // تسجيل event listener مخصص
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  // إزالة event listener
  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  // إرسال حدث
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    campaignUpdates,
    messageStatusUpdates,
    error,
    connect,
    disconnect,
    joinCampaign,
    subscribeToUserCampaigns,
    on,
    off,
    emit,
  };
}
```

---

## 📡 الأحداث المدعومة

### 1. `campaign-update` - تحديث حملة محددة

**يُرسَل عندما:**
- تبدأ حملة
- يتقدم إرسال الحملة
- تكتمل الحملة
- يحدث خطأ في الحملة

**هيكل البيانات:**
```json
{
  "campaignId": "6a3e221f3414a3e08c59f790",
  "status": "in-progress",
  "progress": {
    "total": 100,
    "processed": 45,
    "sent": 40,
    "failed": 5
  },
  "message": "جاري إرسال الرسائل...",
  "timestamp": "2026-06-26T08:30:00Z"
}
```

---

### 2. `campaign-global-update` - تحديث عام لجميع الحملات

**يُرسَل عندما:** أي تغيير في أي حملة

**نفس هيكل `campaign-update`**

---

### 3. `message-status-update` - أحداث Meta Webhooks (الرسائل)

**يُرسَل عندما:**
- تُرسَل الرسالة بنجاح
- يستقبل العميل الرسالة
- يقرأ العميل الرسالة
- يفشل الإرسال

**هيكل البيانات:**
```json
{
  "messageId": "wamid.xxxx",
  "status": "delivered",
  "recipientPhone": "+201556299599",
  "timestamp": "2026-06-26T08:35:00Z"
}
```

---

### 4. `campaign-stats` - إحصائيات الحملة

**يُرسَل عندما:** تكتمل الحملة أو عند طلب الإحصائيات

**هيكل البيانات:**
```json
{
  "campaignId": "6a3e221f3414a3e08c59f790",
  "title": "حملة المتأخرين",
  "totalMessages": 100,
  "sent": 98,
  "delivered": 95,
  "read": 87,
  "failed": 2,
  "successRate": 98,
  "deliveryRate": 95,
  "readRate": 87
}
```

---

## 💡 أمثلة عملية

### مثال 1️⃣: مكون React لمتابعة تقدم الحملة

```typescript
// components/CampaignMonitor.tsx
'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface CampaignMonitorProps {
  campaignId: string;
  token: string;
}

export function CampaignMonitor({ campaignId, token }: CampaignMonitorProps) {
  const { isConnected, campaignUpdates, joinCampaign } = useWebSocket({
    token,
  });

  useEffect(() => {
    if (isConnected) {
      joinCampaign(campaignId);
    }
  }, [isConnected, campaignId, joinCampaign]);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">متابعة الحملة</h2>

      {/* حالة الاتصال */}
      <div className="mb-4">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            isConnected
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {isConnected ? '✅ متصل' : '❌ غير متصل'}
        </span>
      </div>

      {/* بيانات التحديث */}
      {campaignUpdates && (
        <div className="space-y-4">
          {/* حالة الحملة */}
          <div>
            <p className="text-gray-600 text-sm">حالة الحملة</p>
            <p className="text-xl font-semibold">
              {campaignUpdates.status === 'in-progress' && '🔄 قيد التنفيذ'}
              {campaignUpdates.status === 'completed' && '✅ مكتملة'}
              {campaignUpdates.status === 'started' && '▶️ بدأت'}
              {campaignUpdates.status === 'error' && '❌ خطأ'}
            </p>
          </div>

          {/* الرسالة */}
          {campaignUpdates.message && (
            <div>
              <p className="text-gray-600 text-sm">الرسالة</p>
              <p className="text-lg">{campaignUpdates.message}</p>
            </div>
          )}

          {/* شريط التقدم */}
          {campaignUpdates.progress && (
            <div>
              <p className="text-gray-600 text-sm mb-2">التقدم</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (campaignUpdates.progress.processed /
                        campaignUpdates.progress.total) *
                      100
                    }%`,
                  }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {campaignUpdates.progress.processed} /{' '}
                {campaignUpdates.progress.total}
              </p>
            </div>
          )}

          {/* الإحصائيات */}
          {campaignUpdates.progress && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-gray-600 text-xs">مرسلة</p>
                <p className="text-2xl font-bold text-blue-600">
                  {campaignUpdates.progress.sent}
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <p className="text-gray-600 text-xs">فاشلة</p>
                <p className="text-2xl font-bold text-red-600">
                  {campaignUpdates.progress.failed}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-gray-600 text-xs">معالجة</p>
                <p className="text-2xl font-bold text-green-600">
                  {campaignUpdates.progress.total - campaignUpdates.progress.processed}
                </p>
              </div>
            </div>
          )}

          {/* آخر تحديث */}
          <p className="text-xs text-gray-500">
            آخر تحديث: {new Date(campaignUpdates.timestamp).toLocaleTimeString('ar-EG')}
          </p>
        </div>
      )}

      {/* حالة الانتظار */}
      {!campaignUpdates && isConnected && (
        <div className="text-center py-8">
          <p className="text-gray-500">⏳ في انتظار تحديثات الحملة...</p>
        </div>
      )}
    </div>
  );
}
```

---

### مثال 2️⃣: مكون لمتابعة حالات الرسائل (Meta Webhooks)

```typescript
// components/MessageStatusTracker.tsx
'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface MessageStatus {
  messageId: string;
  status: string;
  phone: string;
  time: string;
}

export function MessageStatusTracker({ token }: { token: string }) {
  const { isConnected, messageStatusUpdates, on } = useWebSocket({ token });
  const [messages, setMessages] = useState<MessageStatus[]>([]);

  useEffect(() => {
    // تسجيل listener مخصص لأحداث Meta Webhooks
    on('message-status-update', (data) => {
      const newMessage: MessageStatus = {
        messageId: data.messageId,
        status: data.status,
        phone: data.recipientPhone || 'Unknown',
        time: new Date(data.timestamp).toLocaleTimeString('ar-EG'),
      };

      setMessages((prev) => [newMessage, ...prev.slice(0, 9)]);
    });
  }, [on]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return '📤';
      case 'delivered':
        return '✅';
      case 'read':
        return '👁️';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-50 border-blue-200';
      case 'delivered':
        return 'bg-green-50 border-green-200';
      case 'read':
        return 'bg-purple-50 border-purple-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">حالات الرسائل</h2>

      <div className="mb-4">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            isConnected
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {isConnected ? '✅ متصل' : '❌ غير متصل'}
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            لا توجد تحديثات بعد
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.messageId}
              className={`p-4 border rounded-lg ${getStatusColor(msg.status)}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {getStatusIcon(msg.status)} {msg.status.toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-600">{msg.phone}</p>
                </div>
                <p className="text-xs text-gray-500">{msg.time}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

### مثال 3️⃣: استخدام في صفحة رئيسية (Page)

```typescript
// app/campaigns/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CampaignMonitor } from '@/components/CampaignMonitor';
import { MessageStatusTracker } from '@/components/MessageStatusTracker';

export default function CampaignPage() {
  const params = useParams();
  const { data: session } = useSession();
  const campaignId = params.id as string;
  const token = session?.user?.token as string;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">لوحة تحكم الحملة</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* مراقب الحملة */}
          <CampaignMonitor campaignId={campaignId} token={token} />

          {/* متتبع حالات الرسائل */}
          <MessageStatusTracker token={token} />
        </div>
      </div>
    </div>
  );
}
```

---

## ✨ أفضل الممارسات

### 1. إدارة الاتصال
```typescript
// ✅ صحيح: تنظيف الموارد
useEffect(() => {
  const { connect, disconnect } = useWebSocket();
  connect();
  return () => disconnect();
}, []);

// ❌ خطأ: عدم تنظيف الموارد
useWebSocket();
```

### 2. معالجة الأخطاء
```typescript
const { isConnected, error } = useWebSocket();

if (error) {
  return <ErrorAlert message={error} />;
}
```

### 3. إعادة الاتصال التلقائي
```typescript
// Hook يتعامل مع إعادة الاتصال تلقائياً
const { isConnected } = useWebSocket({
  url: process.env.NEXT_PUBLIC_SOCKET_URL,
  autoConnect: true, // تفعيل إعادة الاتصال
});
```

### 4. تحسين الأداء
```typescript
// استخدام useCallback لتجنب إعادة الحسابات
const handleJoinCampaign = useCallback((campaignId) => {
  joinCampaign(campaignId);
}, [joinCampaign]);
```

### 5. متغيرات البيئة
```bash
# .env.local
NEXT_PUBLIC_SOCKET_URL=https://your-backend.com
NEXT_PUBLIC_API_URL=https://your-backend.com/api/v1
```

---

## 🔧 استكشاف الأخطاء

### المشكلة: لا يوجد اتصال
```typescript
// الحل 1: تحقق من الـ URL
console.log('Socket URL:', process.env.NEXT_PUBLIC_SOCKET_URL);

// الحل 2: تحقق من التوكن
const token = localStorage.getItem('accessToken');
console.log('Token exists:', !!token);

// الحل 3: تحقق من CORS في الخادم
// التأكد من أن الخادم يقبل الاتصالات من origin الفرونت
```

### المشكلة: لا يتم استقبال التحديثات
```typescript
// تحقق من الانضمام للغرفة الصحيحة
socket.emit('join-campaign', campaignId);

// تحقق من استماع الأحداث
socket.on('campaign-update', (data) => {
  console.log('Received:', data);
});

// تفعيل debug logging
socket.onAny((event, ...args) => {
  console.log(`Event: ${event}`, args);
});
```

### المشكلة: الاتصال يقطع بسرعة
```typescript
// اضبط معاملات إعادة الاتصال
const socket = io(url, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10, // زيادة المحاولات
});
```

### تفعيل Debug Mode
```typescript
// أضف هذا في بداية الملف
localStorage.debug = '*';

// أو في الـ Browser Console
localStorage.setItem('debug', 'socket.io-client:*');
```

---

## 📊 مثال متقدم: Dashboard كامل

```typescript
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalMessages: number;
  deliveredMessages: number;
  readMessages: number;
  failedMessages: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { isConnected, on } = useWebSocket({
    token: session?.user?.token,
  });
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    failedMessages: 0,
  });

  useEffect(() => {
    // استقبال إحصائيات الحملة
    on('campaign-stats', (statsData) => {
      setStats((prev) => ({
        ...prev,
        totalMessages: statsData.totalMessages || prev.totalMessages,
        deliveredMessages: statsData.delivered || prev.deliveredMessages,
        readMessages: statsData.read || prev.readMessages,
        failedMessages: statsData.failed || prev.failedMessages,
      }));
    });

    // استقبال تحديثات الحملة
    on('campaign-update', (data) => {
      if (data.status === 'started') {
        setStats((prev) => ({
          ...prev,
          activeCampaigns: prev.activeCampaigns + 1,
        }));
      } else if (data.status === 'completed') {
        setStats((prev) => ({
          ...prev,
          activeCampaigns: Math.max(prev.activeCampaigns - 1, 0),
        }));
      }
    });
  }, [on]);

  const StatCard = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value: number;
    icon: string;
  }) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <p className="text-gray-600 text-sm">{label}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-3xl font-bold">{value}</p>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">لوحة التحكم</h1>
          <span
            className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {isConnected ? '✅ WebSocket متصل' : '❌ WebSocket غير متصل'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard label="إجمالي الحملات" value={stats.totalCampaigns} icon="📊" />
          <StatCard label="الحملات النشطة" value={stats.activeCampaigns} icon="🔄" />
          <StatCard label="إجمالي الرسائل" value={stats.totalMessages} icon="💬" />
          <StatCard label="رسائل مُسَلَّمة" value={stats.deliveredMessages} icon="✅" />
          <StatCard label="رسائل مقروءة" value={stats.readMessages} icon="👁️" />
          <StatCard label="رسائل فاشلة" value={stats.failedMessages} icon="❌" />
        </div>
      </div>
    </div>
  );
}
```

---

## 🚀 الخطوات التالية

1. **اختبر الاتصال**: تأكد من اتصال WebSocket في DevTools
2. **أضف معالجة الأخطاء**: تعامل مع جميع حالات الأخطاء المحتملة
3. **حسّن الأداء**: استخدم memoization و useCallback
4. **أضف توثيق**: وثّق الأحداث المخصصة في مشروعك
5. **اختبر في الإنتاج**: تأكد من أن CORS والتوكن يعملان صحيحاً

---

## 📞 الدعم والمراجع

- [Socket.io Documentation](https://socket.io/docs/v4/client-api/)
- [Next.js Real-time Guide](https://nextjs.org/docs)
- [Meta Webhook Documentation](https://developers.facebook.com/docs/whatsapp/webhooks)

**تم إعداد هذا الدليل بتاريخ**: 2026-07-14
