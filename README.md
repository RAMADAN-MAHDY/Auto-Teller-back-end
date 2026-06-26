# دليل مطوري الواجهة الأمامية (Frontend Integration Guide)

هذا الدليل مخصص لمطوري الـ Frontend لتوضيح كيفية ربط المشروع مع الـ API باستخدام مكتبة `axios`. تم تصميم الـ API ليكون منظماً وسهل الاستخدام ويعتمد على بنية استجابة (Response Structure) موحدة.

## 1. الإعدادات الأساسية (Base Setup)

الرابط الأساسي (Base URL) لجميع الـ Endpoints هو:
`/api/v1`
  
### إعداد Axios و WebSocket
يفضل عمل `axios instance` يضيف الـ `Authorization` header تلقائياً لكل الطلبات لتجنب تكرار الكود، وإنشاء اتصال WebSocket للتحديثات اللحظية.

```javascript
import axios from 'axios';
import { io } from 'socket.io-client';

// 1. إعداد Axios للطلبات العادية
const api = axios.create({
  baseURL: 'https://auto-teller-back-end-production.up.railway.app/api/v1',
});

// إضافة التوكن في كل طلب
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. إعداد WebSocket للتحديثات اللحظية
let socket = null;

export function initWebSocket(token) {
  socket = io('https://auto-teller-back-end-production.up.railway.app', {
    transports: ['websocket', 'polling'],
    auth: { token }
  });

  // إعداد مستمعي الأحداث
  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
  });

  socket.on('campaign-update', (data) => {
    console.log('📢 Campaign update:', data);
    // يمكنك إضافة معالجة الأحداث هنا
  });

  return socket;
}

// دوال مساعدة للـ WebSocket
export function joinCampaignRoom(campaignId) {
  if (socket) {
    socket.emit('join-campaign', campaignId);
    console.log(`🔗 Joined campaign room: ${campaignId}`);
  }
}

export function subscribeToUserCampaigns(userId) {
  if (socket) {
    socket.emit('subscribe-user-campaigns', userId);
    console.log(`👤 Subscribed to user campaigns: ${userId}`);
  }
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Disconnected from WebSocket server');
  }
}

export default api;
```

---

## 2. هيكل الاستجابة الموحد (Standard Response Structure)

جميع الردود القادمة من الـ API تتبع نفس الهيكل الموحد:

### 2.1 حالة النجاح (Success Response)
```json
{
  "success": true,
  "message": "رسالة توضيحية للإجراء (مثال: تمت الإضافة بنجاح)",
  "data": { ... } // البيانات الراجعة
}
```

### 2.2 حالة الخطأ (Error Response)
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "تفاصيل الخطأ"
}
```

---

## 3. المصادقة (Authentication)

### 3.1 تسجيل الدخول (Login)
- **المسار:** `POST /auth/login`
- **الغرض:** تسجيل الدخول والحصول على التوكنز.

**مثال Axios:**
```javascript
const response = await api.post('/auth/login', {
    email: "[EMAIL_ADDRESS]",
    password: "[PASSWORD]"
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6a3a27f...",
      "name": "Admin",
      "email": "admin@bankreach.com",
      "role": "admin",
      "isActive": true
    },
"tokens" : {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
}
  }
}
}
*(يجب حفظ الـ `accessToken` و الـ `refreshToken` في الـ `localStorage` أو الـ `cookies`).*

### 3.2 تجديد التوكن (Refresh Token)
- **المسار:** `POST /auth/refresh`
- **الغرض:** تجديد الـ `accessToken` باستخدام الـ `refreshToken` عندما ينتهي صلاحيته.

**مثال Axios:**
```javascript
const response = await api.post('/auth/refresh', {
  refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTNlMTg5YjM0MTRhM2UwOGM1OWY3NjQiLCJlbWFpbCI6ImFkbWluXzJAYmFua3JlYWNoLmNvbSIsInJvbGUiOiJlbXBsb3llZSIsImlhdCI6MTc4MjQ5MjA3MywiZXhwIjoxNzgzMDk2ODczfQ.IS_zXOpWrEXqWGboBgR780NUj_prLYs5H6s-e2br8wk"
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTNlMTg5YjM0MTRhM2UwOGM1OWY3NjQiLCJlbWFpbCI6ImFkbWluXzJAYmFua3JlYWNoLmNvbSIsInJvbGUiOiJlbXBsb3llZSIsImlhdCI6MTc4MjQ5MjExOCwiZXhwIjoxNzgyNDkzMDE4fQ.mcU1F5875-extFSpr7G7GMTcsfvNthBc4Y6GTMph_7g",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTNlMTg5YjM0MTRhM2UwOGM1OWY3NjQiLCJlbWFpbCI6ImFkbWluXzJAYmFua3JlYWNoLmNvbSIsInJvbGUiOiJlbXBsb3llZSIsImlhdCI6MTc4MjQ5MjExOCwiZXhwIjoxNzgzMDk2OTE4fQ.QOibpYJi2FNOi2rNp_v4cnQPY_Vlw82EUtmcPKCqnZA",
    "tokenType": "Bearer"
  }
}
```
*(يجب حفظ التوكنز الجديدة واستبدال القديمة بها).*

---

## 4. العملاء (Customers)

### 4.1 جلب قائمة العملاء (Get Customers)
- **المسار:** `GET /customers`
- **المتغيرات (Query Params):** `page`, `limit`, `search`, `customerGroup`

**مثال Axios:**
```javascript
// جلب العملاء المتأخرين (LATE) في الصفحة الأولى
const response = await api.get('/customers', {
  params: { page: 1, limit: 20, search: 'ramadan mahdy', customerGroup: 'LATE' }
});
```

**الاستجابة (Response):**
```json

{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [
    {
      "id": "6a3e1f7e3414a3e08c59f780",
      "fullName": "ramadan mahdy",
      "phoneNumber": "+201556299599",
      "guarantorName": "Mohamed",
      "guarantorPhone": "+20111222333",
      "dueDate": "2026-06-01T00:00:00.000Z",
      "importedOverdueDays": 22,
      "overdueDays": 25,
      "customerGroup": "LATE",
      "notes": "Preferred contact time: afternoon",
      "tags": [
        "vip",
        "salary"
      ],
      "createdAt": "2026-06-26T06:43:10.923Z",
      "updatedAt": "2026-06-26T06:43:10.923Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### 4.2 إضافة عميل جديد (Create Customer)
- **المسار:** `POST /customers`

**مثال Axios:**
```javascript
const response = await api.post('/customers', {
  fullName: "أحمد علي",
  phoneNumber: "+201556299599",
  guarantorName: "محمد",
  guarantorPhone: "+20111222333",
  dueDate: "2026-06-01T00:00:00Z", // صيغة ISO Date
  importedOverdueDays: 22,
  notes: "ملاحظات",
  tags: ["vip"]
});
```

### 4.3 رفع ملف إكسل للعملاء (Import Excel)
- **المسار:** `POST /customers/import-excel`
- **النوع:** `multipart/form-data`

**مثال Axios:**
```javascript
const formData = new FormData();
// fileInput هو عنصر الـ input من نوع file في الـ HTML
formData.append('file', fileInput.files[0]); 

const response = await api.post('/customers/import-excel', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Customer import process completed",
  "data": {
    "imported": 0,
    "updated": 30,
    "failed": 0,
    "errors": []
  }
}
```

### 4.4 تعديل عميل (Update Customer)
- **المسار:** `PATCH /customers/{id}`
- **ملاحظة:** يمكنك تحديث أي حقل من حقول العميل.

**مثال Axios:**
```javascript
const response = await api.patch(`/customers/${customerId}`, {
  fullName: "أحمد علي - محدث",
  phoneNumber: "+201556299600"
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "id": "6a3e1f7e3414a3e08c59f780",
    "fullName": "أحمد علي - محدث",
    "phoneNumber": "+201556299600",
    "guarantorName": "محمد",
    "guarantorPhone": "+20111222333",
    "dueDate": "2026-06-01T00:00:00.000Z",
    "importedOverdueDays": 22,
    "overdueDays": 25,
    "customerGroup": "LATE",
    "createdAt": "2026-06-26T06:43:10.923Z",
    "updatedAt": "2026-06-26T06:55:30.193Z"
  }
}
```

### 4.5 حذف عميل (Delete Customer)
- **المسار:** `DELETE /customers/{id}`

**مثال Axios:**
```javascript
const response = await api.delete(`/customers/${customerId}`);
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

---

## 5. قوالب الرسائل (Templates)

### 5.1 إنشاء قالب (Create Template)
- **المسار:** `POST /templates`
- **ملاحظة المتغيرات:** يمكنك وضع متغيرات بين أقواس `{{ }}` يتم استبدالها ببيانات العميل أثناء الإرسال. المتغيرات المتاحة هي: `{{fullName}}`, `{{overdueDays}}`, `{{guarantorName}}`, إلخ.

**مثال Axios:**
```javascript
const response = await api.post('/templates', {
  name: "رسالة المتأخرين",
  body: "عزيزي {{fullName}}، نذكرك بأن قسطك متأخر لمدة {{overdueDays}} يوم."
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "id": "6a3e20423414a3e08c59f789",
    "name": "Welcome Message 8",
    "body": "Dear {{fullName}}, your payment is overdue by {{overdueDays}} days.",
    "variables": [
      "fullName",
      "overdueDays"
    ],
    "createdBy": "6a3e189b3414a3e08c59f764",
    "createdAt": "2026-06-26T06:46:26.864Z",
    "updatedAt": "2026-06-26T06:46:26.864Z"
  }
}
```

---
### جلب القوالب

### عرض القوالب مع بحث + Pagination
GET {{baseUrl}}/templates?page=1&limit=20&search=Welcome
Authorization: Bearer {{accessToken}}

**الاستجابة (Response):**
```json

{
  "success": true,
  "message": "Templates retrieved successfully",
  "data": [
    {
      "id": "6a3e20423414a3e08c59f789",
      "name": "Welcome Message 8",
      "body": "Dear {{fullName}}, your payment is overdue by {{overdueDays}} days.",
      "variables": [
        "fullName",
        "overdueDays"
      ],
      "createdBy": "{\n  _id: new ObjectId('6a3e189b3414a3e08c59f764'),\n  email: 'admin_2@bankreach.com'\n}",
      "createdAt": "2026-06-26T06:46:26.864Z",
      "updatedAt": "2026-06-26T06:46:26.864Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```
### جلب قالب واحد بالـ ID
GET {{baseUrl}}/templates/{{templateId}}
Authorization: Bearer {{accessToken}}
**الاستجابة (Response):**
```json

{
  "success": true,
  "message": "Template retrieved successfully",
  "data": {
    "id": "6a3e20423414a3e08c59f789",
    "name": "Welcome Message 8",
    "body": "Dear {{fullName}}, your payment is overdue by {{overdueDays}} days.",
    "variables": [
      "fullName",
      "overdueDays"
    ],
    "createdBy": "{\n  _id: new ObjectId('6a3e189b3414a3e08c59f764'),\n  email: 'admin_2@bankreach.com'\n}",
    "createdAt": "2026-06-26T06:46:26.864Z",
    "updatedAt": "2026-06-26T06:46:26.864Z"
  }
}
```

### تعديل قالب (Update Template)
- **المسار:** `PATCH /templates/{id}`
- **ملاحظة:** يمكنك تحديث اسم القالب أو محتواه أو كليهما.

**مثال Axios:**
```javascript
const response = await api.patch(`/templates/${templateId}`, {
  name: "رسالة المتأخرين - محدثة",
  body: "عزيزي {{fullName}}، نذكرك بأن قسطك متأخر لمدة {{overdueDays}} يوم. يرجى التواصل معنا."
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "id": "6a3e20423414a3e08c59f789",
    "name": "رسالة المتأخرين - محدثة",
    "body": "عزيزي {{fullName}}، نذكرك بأن قسطك متأخر لمدة {{overdueDays}} يوم. يرجى التواصل معنا.",
    "variables": [
      "fullName",
      "overdueDays"
    ],
    "createdBy": "6a3e189b3414a3e08c59f764",
    "createdAt": "2026-06-26T06:46:26.864Z",
    "updatedAt": "2026-06-26T06:54:23.193Z"
  }
}
```

### حذف قالب (Delete Template)
- **المسار:** `DELETE /templates/{id}`

**مثال Axios:**
```javascript
const response = await api.delete(`/templates/${templateId}`);
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---




## 6. الحملات (Campaigns)

### 6.1 إنشاء حملة (Create Campaign)
- **المسار:** `POST /campaigns`
- **ملاحظة:** حقل `targetCustomerGroup` يقبل القيم التالية لاستهداف مجموعة محددة: (`COMPLIANT`, `LATE`, `DEFAULTED`, `TRANSFERRED`).

**مثال Axios:**
```javascript
const response = await api.post('/campaigns', {
  title: "حملة المتأخرين شهر 6",
  templateId: "6a3a2f...", // ID القالب المراد استخدامه
  targetCustomerGroup: "LATE", // استهداف مجموعة المتأخرين
  scheduledAt: null // اجعله null للتحضير، أو ضع تاريخ ISO للجدولة
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Campaign created successfully",
  "data": {
    "id": "6a3e221f3414a3e08c59f790",
    "title": "Late Customers Campaign",
    "template": {
      "id": "6a3e20423414a3e08c59f789",
      "name": "Welcome Message 8"
    },
    "targetCustomerGroup": "LATE",
    "status": "draft",
    "createdBy": {
      "id": "6a3e189b3414a3e08c59f764",
      "fullName": "Admin"
    },
    "stats": {
      "total": 0,
      "sent": 0,
      "delivered": 0,
      "read": 0,
      "failed": 0
    },
    "createdAt": "2026-06-26T06:54:23.193Z",
    "updatedAt": "2026-06-26T06:54:23.193Z"
  }
}
```
### عرض الحملات (Pagination)
GET {{baseUrl}}/campaigns?page=1&limit=20
Authorization: Bearer {{accessToken}}

**الاستجابة (Response):**

```json

{
  "success": true,
  "message": "Campaigns retrieved successfully",
  "data": [
    {
      "id": "6a3e221f3414a3e08c59f790",
      "title": "Late Customers Campaign",
      "template": {
        "id": "6a3e20423414a3e08c59f789",
        "name": "Welcome Message 8"
      },
      "targetCustomerGroup": "LATE",
      "status": "draft",
      "createdBy": {
        "id": "6a3e189b3414a3e08c59f764",
        "fullName": "Admin"
      },
      "stats": {
        "total": 0,
        "sent": 0,
        "delivered": 0,
        "read": 0,
        "failed": 0
      },
      "createdAt": "2026-06-26T06:54:23.193Z",
      "updatedAt": "2026-06-26T06:54:23.193Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```
### تعديل حملة (Draft/Scheduled فقط)
PATCH {{baseUrl}}/campaigns/{{campaignId}}
Content-Type: application/json
Authorization: Bearer {{accessToken}}

{
  "title": "Late Customers Campaign (updated)"
}

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Campaign updated successfully",
  "data": {
    "id": "6a3e221f3414a3e08c59f790",
    "title": "Late Customers Campaign (updated)",
    "template": {
      "id": "6a3e20423414a3e08c59f789",
      "name": "Welcome Message 8"
    },
    "targetCustomerGroup": "LATE",
    "status": "draft",
    "createdBy": {
      "id": "6a3e189b3414a3e08c59f764",
      "fullName": "Admin"
    },
    "stats": {
      "total": 0,
      "sent": 0,
      "delivered": 0,
      "read": 0,
      "failed": 0
    },
    "createdAt": "2026-06-26T06:54:23.193Z",
    "updatedAt": "2026-06-26T06:58:29.874Z"
  }
}
```
### جلب حملة واحدة بالـ ID
GET {{baseUrl}}/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}

**الاستجابة (Response):**
```json

{
  "success": true,
  "message": "Campaign retrieved successfully",
  "data": {
    "id": "6a3e221f3414a3e08c59f790",
    "title": "Late Customers Campaign (updated)",
    "template": {
      "id": "6a3e20423414a3e08c59f789",
      "name": "Welcome Message 8"
    },
    "targetCustomerGroup": "LATE",
    "status": "running",
    "createdBy": {
      "id": "6a3e189b3414a3e08c59f764",
      "fullName": "Admin"
    },
    "stats": {
      "total": 0,
      "sent": 0,
      "delivered": 0,
      "read": 0,
      "failed": 0
    },
    "createdAt": "2026-06-26T06:54:23.193Z",
    "updatedAt": "2026-06-26T07:00:04.218Z"
  }
}
```




###  تشغيل الحملة يدوياً (Trigger Campaign)
- **المسار:** `POST /campaigns/:id/trigger`
- **الغرض:** إذا كانت الحملة بحالة `draft` ولم تكن مجدولة، يمكنك تشغيلها فوراً بهذا الطلب لتبدأ بإرسال الرسائل.

**مثال Axios:**
```javascript
await api.post(`/campaigns/${campaignId}/trigger`);
```
### حذف حملة بالـ ID
DELETE {{baseUrl}}/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}

---

## 7. التقارير والإحصائيات (Reports & Dashboard)

### 7.1 إحصائيات لوحة التحكم الرئيسية (Dashboard Stats)
- **المسار:** `GET /reports/dashboard`
- **الغرض:** عرض ملخص للأرقام في الصفحة الرئيسية للمشروع.

**مثال Axios:**
```javascript
const response = await api.get('/reports/dashboard');
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "totalUsers": 2,
    "totalCustomers": 1,
    "totalGroups": 4,
    "totalTemplates": 1,
    "totalCampaigns": {
      "total": 2,
      "draft": 1,
      "scheduled": 0,
      "running": 1,
      "completed": 0,
      "failed": 0
    },
    "messageStats": {
      "total": 0,
      "pending": 0,
      "sent": 0,
      "delivered": 0,
      "read": 0,
      "failed": 0
    }
  }
}
```

### 7.2 تقرير أداء الحملات (Campaign Performance)
- **المسار:** `GET /reports/campaign-performance`
- **الغرض:** جلب نسب النجاح (وصول، قراءة) لأحدث الحملات المنتهية أو الجارية.

**مثال Axios:**
```javascript
const response = await api.get('/reports/campaign-performance');
```

**الاستجابة (Response):**
```json

{
  "success": true,
  "message": "Campaign performance report retrieved successfully",
  "data": [
    {
      "campaignId": "6a3e221f3414a3e08c59f790",
      "title": "Late Customers Campaign (updated)",
      "totalMessages": 0,
      "successRate": 0,
      "deliveryRate": 0,
      "readRate": 0
    }
  ]
}
```

---

## 8. تحديثات الحملات اللحظية عبر WebSocket

تم إضافة WebSocket server إلى النظام لتمكين تحديثات الحملات لحظيًا. يتيح ذلك للمستخدمين رؤية تقدم الحملات في الوقت الفعلي دون الحاجة لتحديث الصفحة.

### 8.1 تثبيت socket.io-client في Frontend

```bash
npm install socket.io-client
```

### 8.2 إنشاء اتصال WebSocket

```javascript
import { io } from 'socket.io-client';

const socket = io('https://auto-teller-back-end-production.up.railway.app', {
  transports: ['websocket', 'polling'],
  auth: {
    token: 'your-jwt-token' // استخدم التوكن من localStorage
  }
});
```

### 8.3 الأحداث المتاحة

| الحدث | الوصف | مثال البيانات |
|-------|-------|---------------|
| `campaign-update` | تحديث لحملة محددة | `{campaignId, status, progress, message, timestamp}` |
| `campaign-global-update` | تحديث عام لجميع الحملات | نفس هيكل campaign-update |
| `campaign-stats` | إحصائيات الحملة | `{campaignId, title, status, totalCustomers, ...}` |

### 8.4 مثال كامل للاستخدام في React

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function CampaignMonitor({ campaignId, token }) {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const socket = io('https://auto-teller-back-end-production.up.railway.app', {
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      socket.emit('join-campaign', campaignId);
    });

    socket.on('campaign-update', (data) => {
      console.log('📢 Campaign update:', data);
      setStatus(data.status);
      if (data.progress) {
        setProgress(data.progress);
      }
    });

    socket.on('campaign-stats', (stats) => {
      console.log('📊 Campaign stats:', stats);
      // تحديث المخططات البيانية
    });

    return () => {
      socket.disconnect();
    };
  }, [campaignId, token]);

  return (
    <div>
      <h3>حالة الحملة: {status}</h3>
      {progress && (
        <div>
          <p>التقدم: {progress.processed}/{progress.total}</p>
          <p>الرسائل المرسلة: {progress.sent}</p>
          <p>الرسائل الفاشلة: {progress.failed}</p>
          <progress value={progress.processed} max={progress.total} />
        </div>
      )}
    </div>
  );
}
```

### 8.5 مثال لتحديث axios instance

```javascript
import axios from 'axios';
import { io } from 'socket.io-client';

const api = axios.create({
  baseURL: 'https://auto-teller-back-end-production.up.railway.app/api/v1',
});

// إضافة التوكن في كل طلب
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// إنشاء WebSocket connection
let socket = null;

export function initWebSocket(token) {
  socket = io('https://auto-teller-back-end-production.up.railway.app', {
    transports: ['websocket', 'polling'],
    auth: { token }
  });

  return socket;
}

export function joinCampaignRoom(campaignId) {
  if (socket) {
    socket.emit('join-campaign', campaignId);
  }
}

export function subscribeToUserCampaigns(userId) {
  if (socket) {
    socket.emit('subscribe-user-campaigns', userId);
  }
}

export default api;
```

### 8.6 حالات الحملة (Status)

| الحالة | الوصف |
|--------|-------|
| `started` | بدأت الحملة |
| `in-progress` | الحملة قيد التنفيذ |
| `completed` | اكتملت الحملة |
| `error` | حدث خطأ في الحملة |

### 8.7 هيكل بيانات التقدم (Progress Structure)

```javascript
{
  total: 100,      // إجمالي العملاء المستهدفين
  processed: 45,   // عدد العملاء الذين تم معالجتهم
  sent: 40,        // عدد الرسائل المرسلة بنجاح
  failed: 5        // عدد الرسائل الفاشلة
}
```

### 8.8 فوائد استخدام WebSocket

1. **تحديثات لحظية**: رؤية تقدم الحملات في الوقت الفعلي
2. **بدون تحديث الصفحة**: لا حاجة لتحديث الصفحة يدويًا
3. **كفاءة الأداء**: اتصال واحد لجميع التحديثات
4. **تجربة مستخدم محسنة**: إشعارات فورية عن حالة الحملات

### 8.9 ملفات الأمثلة

يمكنك العثور على أمثلة كاملة في:
- `src/websocket/websocket-client-example.js` - مثال كامل للاستخدام
- `src/websocket/WEBSOCKET_API.md` - توثيق مفصل للـ API

---

## 9. استكشاف الأخطاء وإصلاحها

### 9.1 مشاكل WebSocket الشائعة

1. **لا يتم استقبال التحديثات**:
   - تحقق من اتصال WebSocket (`socket.connected`)
   - تأكد من الانضمام للغرفة الصحيحة
   - تحقق من تطابق campaignId

2. **اتصال متقطع**:
   - تفعيل إعادة الاتصال التلقائي
   - التحقق من إعدادات الشبكة
   - مراقبة استخدام الذاكرة

3. **مشاكل التوكن**:
   - تأكد من صلاحية التوكن
   - أعد تسجيل الدخول إذا انتهت صلاحية التوكن
   - استخدم refreshToken لتجديد التوكن

### 9.2 نصائح للتصحيح (Debugging)

```javascript
// تفعيل logging لـ WebSocket
socket.onAny((event, ...args) => {
  console.log(`🔍 WebSocket event: ${event}`, args);
});

// التحقق من حالة الاتصال
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);
```

---

## 10. المراجع والمصادر

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Real-time Applications Best Practices](https://ably.com/blog/websocket-authentication)
- [BankReach WebSocket API Documentation](src/websocket/WEBSOCKET_API.md)

---

**ملاحظة**: تم تصميم النظام لدعم آلاف الرسائل في الوقت الفعلي مع الحفاظ على الأداء العالي. يمكن توسيع النظام بسهولة لإضافة ميزات جديدة مثل الدردشة المباشرة أو الإشعارات المخصصة.
