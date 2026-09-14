# CHAT INTEGRATION — Conversation, Chat Messages, Timeline and Socket Events

> This file documents the chat feature integration in a separate place, so the main implementation plan remains clean and the runtime data contract remains visible to the frontend team.

## 1. REST API Endpoints

All chat conversation APIs are currently mounted under the same authenticated route group used by the project:

```http
GET /api/v1/conversations
GET /api/v1/conversations/:id
GET /api/v1/conversations/:id/messages
GET /api/v1/conversations/:id/timeline
POST /api/v1/conversations/:id/messages
PATCH /api/v1/conversations/:id/read
PATCH /api/v1/conversations/:id/close
```

### Purpose

- `GET /conversations` → list conversation summaries with pagination and unread filter.
- `GET /conversations/:id` → get one conversation.
- `GET /conversations/:id/messages` → paginated chat message list only.
- `GET /conversations/:id/timeline` → returns a single merged timeline containing:
  - campaign event objects from `MessageRepository`
  - chat message objects from `ChatMessageRepository`
  - each event tagged with `source: 'campaign' | 'chat'`
- `POST /conversations/:id/messages` → send an outbound text reply after 24-hour window validation.
- `PATCH /conversations/:id/read` → mark conversation read.
- `PATCH /conversations/:id/close` → close conversation.

## 2. Timeline Contract

The timeline is assembled in memory by the service layer and is not persisted as a separate collection.

Example payload:

```json
[
  {
    "id": "64e...",
    "createdAt": "2026-09-14T09:00:00.000Z",
    "source": "campaign",
    "payload": { "campaignId": "...", "status": "sent" }
  },
  {
    "id": "65f...",
    "createdAt": "2026-09-14T10:00:00.000Z",
    "source": "chat",
    "payload": { "conversationId": "...", "direction": "OUTBOUND", "text": "..." }
  }
]
```

Important rule:

- Messages are merged by `createdAt` only.
- No new collection or table is introduced.
- `source` is a tag, not a stored relation.

## 3. Socket.IO Chat Events

The WebSocket server already supports campaign broadcasts. For chat, the project now exposes the following event patterns from the socket layer:

```text
chat:message:new
chat:conversation:updated
```

### Room behavior

The backend joins conversation-specific rooms through the WebSocket namespace:

```js
socket.emit('join-conversation', conversationId)
```

and the server can broadcast:

```js
socket.emit('chat:message:new', payload)
socket.emit('chat:conversation:updated', payload)
```

### Example payload shape

```json
{
  "conversationId": "64e...",
  "chatMessageId": "65f...",
  "direction": "INBOUND",
  "text": "مرحبا",
  "whatsappMessageId": "wamid_123",
  "status": "SENT",
  "createdAt": "2026-09-14T10:33:00.000Z"
}
```

And the conversation update payload:

```json
{
  "conversationId": "64e...",
  "customerId": "c-1",
  "unreadCount": 1,
  "lastMessage": "مرحبا",
  "lastMessageAt": "2026-09-14T10:33:00.000Z",
  "status": "OPEN",
  "updatedAt": "2026-09-14T10:33:00.000Z"
}
```

## 4. Response Shape Contract

The application uses a standardized success envelope through the shared `sendSuccess` / `sendCreated` helpers:

```json
{
  "success": true,
  "message": "Conversation timeline retrieved successfully",
  "data": [
    {
      "id": "64e...",
      "createdAt": "2026-09-14T10:00:00.000Z",
      "source": "campaign",
      "payload": {
        "campaignId": "64c...",
        "customerId": "64d...",
        "phoneNumber": "+201000000000",
        "status": "sent",
        "whatsappMessageId": "wamid_123"
      }
    },
    {
      "id": "65f...",
      "createdAt": "2026-09-14T10:10:00.000Z",
      "source": "chat",
      "payload": {
        "conversationId": "66a...",
        "customerId": "64d...",
        "direction": "OUTBOUND",
        "type": "text",
        "text": "مرحبا، كيف يمكنني مساعدتك؟",
        "status": "PENDING",
        "whatsappMessageId": "wamid_1234"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Important frontend expectations

- `success` is always `true` for successful responses.
- `message` is a human-readable status message.
- `data` carries the requested payload.
- `meta` is returned only when the endpoint is paginated, and follows the common `IPaginationMeta` shape.

### Common response example for list endpoints

```json
{
  "success": true,
  "message": "Conversations retrieved successfully",
  "data": [
    {
      "id": "66aa...",
      "customerId": "64d...",
      "phoneNumber": "+201000000000",
      "whatsappPhoneNumberId": "123456789",
      "status": "OPEN",
      "lastMessage": "مرحبا",
      "lastMessageAt": "2026-09-14T10:10:00.000Z",
      "lastInboundAt": "2026-09-14T10:00:00.000Z",
      "lastOutboundAt": "2026-09-14T10:10:00.000Z",
      "unreadCount": 1,
      "createdAt": "2026-09-14T09:00:00.000Z",
      "updatedAt": "2026-09-14T09:00:00.000Z"
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

### Chat message response example

```json
{
  "success": true,
  "message": "Chat messages retrieved successfully",
  "data": [
    {
      "id": "66bb...",
      "conversationId": "66aa...",
      "customerId": "64d...",
      "whatsappMessageId": "wamid_987",
      "direction": "INBOUND",
      "type": "text",
      "text": "مرحبا",
      "status": "SENT",
      "createdAt": "2026-09-14T10:00:00.000Z",
      "updatedAt": "2026-09-14T10:01:00.000Z"
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

### Reply creation response example

```json
{
  "success": true,
  "message": "Outbound reply created successfully",
  "data": {
    "id": "66cc...",
    "conversationId": "66aa...",
    "whatsappMessageId": "wamid_456",
    "status": "PENDING",
    "direction": "OUTBOUND",
    "text": "مرحبا، كيف يمكنني مساعدتك؟",
    "createdAt": "2026-09-14T10:12:00.000Z"
  }
}
```

### Error response example

```json
{
  "success": false,
  "message": "24-hour WhatsApp window is closed. Please send a template instead.",
  "errors": [
    { "field": "conversationId", "message": "Conversation not found" }
  ]
}
```

For errors, the server may also return the usual `stack` field in development mode.

## 5. Frontend Notes

The frontend should:

1. Subscribe to a `conversation:<id>` room if the UI has a chat tab or conversation-detail screen.
2. Listen to `chat:message:new` and render the message immediately.
3. Listen to `chat:conversation:updated` to refresh the conversation list/unread badge.
4. Use the timeline endpoint to render merged campaign + chat history without modifying the campaign collection model.

## 6. Data & Persistence Impact

No new persistent collection has been created. The changes in the chat feature remain within:

- existing `Conversation` model
- existing `ChatMessage` model
- existing `Message` model
- production read/repository methods and event callbacks only

No write operation is performed to a new database table or a new frontend-tracked data model.

The only runtime side-effect is:

- Socket emission of chat events to browser clients when `WebSocketServer` is initialized.
- In-memory merge of campaign and chat event arrays for the timeline endpoint.

This means the current addition should not create a data migration, schema conflict, or tenant-specific storage drift.
