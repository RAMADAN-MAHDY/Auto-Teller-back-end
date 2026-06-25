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

### 2.3 حالة القوائم والترقيم (Pagination Response)
أي Endpoint يرجع قائمة بيانات (مثل جلب العملاء أو الحملات) سيرجع بيانات الترقيم (Pagination) بالشكل التالي:
```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": {
    "docs": [ { ... }, { ... } ], // مصفوفة البيانات الفعلية
    "totalDocs": 100,
    "limit": 20,
    "totalPages": 5,
    "page": 1,
    "pagingCounter": 1,
    "hasPrevPage": false,
    "hasNextPage": true,
    "prevPage": null,
    "nextPage": 2
  }
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
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
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
  params: { page: 1, limit: 20, search: 'أحمد', customerGroup: 'LATE' }
});
```

**الاستجابة (Response):**
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "id": "6a3a2d...",
        "fullName": "أحمد علي",
        "phoneNumber": "+201556299599",
        "guarantorName": "محمد",
        "guarantorPhone": "+20111222333",
        "dueDate": "2026-06-01T00:00:00.000Z",
        "importedOverdueDays": 22,
        "overdueDays": 24,
        "customerGroup": "LATE", // COMPLIANT | LATE | DEFAULTED | TRANSFERRED
        "notes": "يفضل الاتصال مساءً",
        "tags": ["vip"],
        "createdAt": "2026-06-25T00:00:00Z"
      }
    ],
    "totalDocs": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    ...
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
  "data": {
    "id": "6a3a2f...",
    "name": "رسالة المتأخرين",
    "body": "عزيزي {{fullName}}، نذكرك بأن قسطك متأخر لمدة {{overdueDays}} يوم.",
    "variables": ["fullName", "overdueDays"],
    "createdAt": "2026-06-25T00:00:00Z"
  }
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
  "data": {
    "id": "6a3a4a...",
    "title": "حملة المتأخرين شهر 6",
    "template": { "id": "...", "name": "رسالة المتأخرين" },
    "targetCustomerGroup": "LATE",
    "status": "draft", // الحالات: draft, scheduled, running, completed, failed
    "stats": {
      "total": 0,
      "sent": 0,
      "delivered": 0,
      "read": 0,
      "failed": 0
    }
  }
}
```

### 6.2 تشغيل الحملة يدوياً (Trigger Campaign)
- **المسار:** `POST /campaigns/:id/trigger`
- **الغرض:** إذا كانت الحملة بحالة `draft` ولم تكن مجدولة، يمكنك تشغيلها فوراً بهذا الطلب لتبدأ بإرسال الرسائل.

**مثال Axios:**
```javascript
await api.post(`/campaigns/${campaignId}/trigger`);
```

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
  "data": {
    "totalUsers": 5,
    "totalCustomers": 1200,
    "totalGroups": 4,
    "totalTemplates": 10,
    "totalCampaigns": {
      "total": 15,
      "draft": 2,
      "scheduled": 1,
      "running": 0,
      "completed": 12,
      "failed": 0
    },
    "messageStats": {
      "total": 5000,
      "sent": 4900,
      "delivered": 4500,
      "read": 4000,
      "failed": 100
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
  "data": [
    {
      "campaignId": "6a3a4a...",
      "title": "حملة المتأخرين شهر 6",
      "totalMessages": 100,
      "successRate": 95.5,
      "deliveryRate": 90.0,
      "readRate": 80.0
    }
  ]
}
```
