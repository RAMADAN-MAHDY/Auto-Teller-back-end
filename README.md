# دليل مطوري الواجهة الأمامية (Frontend Integration Guide)

هذا الدليل مخصص لمطوري الـ Frontend لتوضيح كيفية ربط المشروع مع الـ API باستخدام مكتبة `axios`. تم تصميم الـ API ليكون منظماً وسهل الاستخدام ويعتمد على بنية استجابة (Response Structure) موحدة.

## 1. الإعدادات الأساسية (Base Setup)

الرابط الأساسي (Base URL) لجميع الـ Endpoints هو:
`/api/v1`

### إعداد Axios
يفضل عمل `axios instance` يضيف الـ `Authorization` header تلقائياً لكل الطلبات لتجنب تكرار الكود.

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://0946-197-133-64-172.ngrok-free.app/api/v1',
});

// إضافة التوكن في كل طلب
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
```
*(يجب حفظ الـ `accessToken` في الـ `localStorage` أو الـ `cookies`).*

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
  "message": "Import completed successfully",
  "data": {
    "imported": 50,
    "updated": 10,
    "failed": 2
  }
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

### حذف قالب
DELETE {{baseUrl}}/templates/{{templateId}}
Authorization: Bearer {{accessToken}}

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
