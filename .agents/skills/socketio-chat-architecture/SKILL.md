---
name: socketio-chat-architecture
description: Socket.IO real-time chat between end-users and brands with moderation, notifications, and thread management. Triggers when building chat features, real-time messaging, or order tracking updates.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Socket.IO Chat Architecture — FashionConnect

## Why Real-Time Chat Is Critical

For the Egyptian marketplace, instant communication is non-negotiable:

- **Pre-sale Q&A**: Product sizing, availability, shipping
- **Order tracking**: Real-time delivery status updates
- **Post-sale support**: Returns, complaints, COD issues
- **Trust building**: Direct brand interaction increases conversion

**Without real-time chat:** Users go to WhatsApp/Instagram → platform loses control.

---

## Architecture Overview

```
┌────────────────┐    ┌──────────────────┐    ┌────────────────┐
│  User (Mobile) │    │ Socket.IO Server │    │ Brand (Web)    │
└───────┬────────┘    └────────┬─────────┘    └───────┬────────┘
        │                      │                      │
        │ JWT Auth             │                      │ JWT Auth
        │──────────────────────→│←─────────────────────│
        │                      │                      │
        │ Join Thread Room     │                      │
        │──────────────────────→│←─────────────────────│
        │                      │                      │
        │ Send Message         │                      │
        │──────────────────────→│←─────────────────────│
        │                      │                      │
        │ Message Validated      │                    │
        │──────────────────────→│                      │
        │                      │ Broadcast            │
        │                      │─────────────────────→│
        │                      │ Receive              │
        │ Receive New Message  │←─────────────────────│
```

---

## Core Concepts

### Thread-Based Rooms

```typescript
// Each chat thread has a unique room
// Only thread participants can join
// Messages broadcast to room members only

// Thread creation (REST API → Socket.IO)
const thread = await prisma.chatThread.create({
  data: {
    participantA: userId,      // The user
    participantB: brandId,     // The brand
  },
});

// Join socket room
socket.join(threadId);
```

### Socket Authentication

```typescript
// Use existing JWT strategy
const token = socket.handshake.auth.token;
const user = jwtService.verify(token); // Same JWT as REST API

if (!user) {
  socket.disconnect(true);
}
```

---

## Chat Thread Model

```typescript
// prisma/schema.prisma
model ChatThread {
  id          String   @id @default(uuid())
  participantA String   // userId of end-user
  participantB String   // userId of brand owner
  orderId     String?   // Optional link to order
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  messages    ChatMessage[]
  
  @@unique([participantA, participantB])
  @@map("chat_threads")
}

model ChatMessage {
  id        String   @id @default(uuid())
  threadId  String
  thread    ChatThread @relation(...)
  senderId  String
  content   String
  createdAt DateTime @default(now())
  
  @@index([threadId, createdAt])
  @@map("chat_messages")
}
```

---

## Event Patterns

### 1. Join Thread

```typescript
@SubscribeMessage('join_thread')
async handleJoinThread(client: Socket, payload: { threadId: string }) {
  const user = client.data.user;
  
  // Validate access
  const thread = await this.prisma.chatThread.findUnique({
    where: { id: payload.threadId },
    select: { participantA: true, participantB: true },
  });
  
  if (!thread) {
    client.emit('error', { message: 'Thread not found' });
    return;
  }
  
  if (![thread.participantA, thread.participantB].includes(user.id)) {
    client.emit('error', { message: 'Access denied' });
    return;
  }
  
  // Track unread count
  await this.markAsRead(payload.threadId, user.id);
  
  // Join room
  client.join(payload.threadId);
  client.to(payload.threadId).emit('user_joined', user.id);
}
```

### 2. Send Message

```typescript
@SubscribeMessage('send_message')
async handleMessage(client: Socket, payload: {
  threadId: string;
  message: string;
  orderId?: string;
}) {
  const user = client.data.user;
  
  // Validate inputs
  if (!payload.message || payload.message.length > 2000) {
    client.emit('error', { message: 'Message too long or empty' });
    return;
  }
  
  // Save to database
  const message = await this.prisma.chatMessage.create({
    data: {
      threadId: payload.threadId,
      senderId: user.id,
      content: payload.message,
      orderId: payload.orderId,
    },
  });
  
  // Broadcast to thread members
  client.to(payload.threadId).emit('new_message', {
    id: message.id,
    senderId: user.id,
    content: payload.message,
    createdAt: message.createdAt,
    orderReference: payload.orderId,
  });
}
```

### 3. Typing Indicator

```typescript
@SubscribeMessage('typing')
handleTyping(client: Socket, threadId: string) {
  const user = client.data.user;
  client.to(threadId).emit('user_typing', {
    userId: user.id,
    threadId,
  });
}
```

### 4. Mark as Read

```typescript
@SubscribeMessage('mark_read')
async handleMarkRead(client: Socket, threadId: string) {
  const user = client.data.user;
  
  await this.prisma.chatThread.update({
    where: { id: threadId },
    data: {
      lastReadAt: new Date(), // Track per-user read state
    },
  });
  
  // Notify other participant
  client.to(threadId).emit('message_read', { threadId, userId: user.id });
}
```

---

## Real-Time Notifications

```typescript
// Order status updates via Socket.IO
@OnEvent('order.status.updated')
async handleOrderStatus(order: Order) {
  this.server
    .to(`user:${order.userId}`)
    .emit('order_update', {
      orderId: order.id,
      status: order.status,
      timestamp: new Date(),
    });
  
  this.server
    .to(`brand:${order.brandId}`)
    .emit('order_update', {
      orderId: order.id,
      status: order.status,
    });
}
```

---

## Redis Adapter (Multi-Instance)

```typescript
// src/main.ts
import { createAdapter } from '@socket.io/redis-adapter';

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEBSOCKET_ORIGIN?.split(',') || [],
    credentials: true,
  },
});

// Scale across multiple instances
io.adapter(createAdapter(redisPub, redisSub));
```

---

## Moderation System

```typescript
// Report inappropriate message
@SubscribeMessage('flag_message')
async handleFlag(client: Socket, payload: { messageId: string; reason: string }) {
  const user = client.data.user;
  
  await this.prisma.moderationFlag.create({
    data: {
      messageId: payload.messageId,
      flaggedBy: user.id,
      reason: payload.reason,
      status: 'PENDING',
    },
  });
  
  // Notify moderators
  this.server.to('admin_room').emit('new_flag', {
    messageId: payload.messageId,
    reason: payload.reason,
  });
  
  client.emit('flag_confirmed', { messageId: payload.messageId });
}
```

---

## Client-Side Reconnection

```typescript
// Handle token refresh + reconnect
const setupSocket = () => {
  const socket = io(process.env.SOCKET_URL, {
    auth: { token: getAccessToken() },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Re-authenticate on token refresh
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await refreshAccessToken();
        socket.auth = { token: getAccessToken() };
        socket.disconnect();
        socket.connect();
      }
      return Promise.reject(error);
    }
  );
};
```

---

## What NOT To Do

- ❌ NEVER trust client-provided threadId without access validation
- ❌ NEVER store sensitive data in socket messages without encryption
- ❌ NEVER skip rate limiting on message sending (spam protection)
- ❌ NEVER use broadcast for user-specific messages
- ❌ NEVER skip JWT verification on socket connection
- ❌ NEVER store large media in socket payloads (use pre-signed URLs)
- ❌ NEVER forget room cleanup on disconnect
- ❌ NEVER log sensitive chat content in server logs

---

## Socket.IO Implementation Checklist

- [ ] JWT authentication on socket connection
- [ ] Thread-based room management (not user-based rooms)
- [ ] Access validation before joining any thread
- [ ] Message length/content validation
- [ ] Rate limiting on message sending
- [ ] Read receipts / mark-as-read functionality
- [ ] Typing indicators for better UX
- [ ] Moderation flagging system
- [ ] Redis adapter for multi-instance scaling
- [ ] Automatic reconnection with token refresh
- [ ] Connection lifecycle management (connect/disconnect)
- [ ] Unread message counting and notifications
- [ ] Order-related message linking
- [ ] Graceful error handling for connection failures
- [ ] Message pagination for loading history

---

## Related Skills
- jwt-refresh-token-strategy (socket authentication)
- rate-limiting-redis (message rate limiting)
- prisma-patterns (chat schema design)
- security-checklist (real-time security)
