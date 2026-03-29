# Overview

PostgreSQL database managed via **Prisma ORM**. All IDs are UUIDs. All timestamps are UTC ISO 8601.

The schema is organized into 4 domains:

- **Identity** — Users, OAuth accounts, refresh tokens
- **Social** — Friendships (friends + blocks)
- **Conversations** — Conversations, participants, roles
- **Messaging** — Messages, attachments

---

# Entity Relationship Summary

```
User ──< OAuthAccount
User ──< RefreshToken
User ──< Friendship (as requester)
User ──< Friendship (as addressee)
User ──< ConversationParticipant
User ──< Message (as sender)

Conversation ──< ConversationParticipant
Conversation ──< Message

Message ──< Attachment
```

---

# Domain: Identity

## User

Core identity record. `passwordHash` is null for OAuth-only accounts (Google login). `username` is the public handle; `displayName` is the shown name.

| Column       | Type     | Constraints        | Notes                        |
| ------------ | -------- | ------------------ | ---------------------------- |
| id           | UUID     | PK, default uuid() |                              |
| email        | String   | UNIQUE, NOT NULL   |                              |
| username     | String   | UNIQUE, NOT NULL   | 3–32 chars, `^[a-z0-9_]+$`   |
| displayName  | String   | NOT NULL           | 1–64 chars                   |
| avatarUrl    | String?  | nullable           | URI                          |
| passwordHash | String?  | nullable           | null for OAuth-only accounts |
| createdAt    | DateTime | default now()      |                              |
| updatedAt    | DateTime | auto-updated       |                              |

**Indexes:** `email` (unique), `username` (unique)

---

## OAuthAccount

Links a User to one or more OAuth providers. A single user can have multiple providers in the future (e.g., Google + GitHub).

| Column            | Type          | Constraints                              | Notes                  |
| ----------------- | ------------- | ---------------------------------------- | ---------------------- |
| id                | UUID          | PK, default uuid()                       |                        |
| userId            | UUID          | FK → [User.id](http://User.id) (CASCADE) |                        |
| provider          | OAuthProvider | NOT NULL                                 | Enum: `GOOGLE`         |
| providerAccountId | String        | NOT NULL                                 | Provider's own user ID |

**Indexes:** `(provider, providerAccountId)` (unique composite)

---

## RefreshToken

Stores hashed refresh tokens for rotation. Raw token is sent as an httpOnly cookie; only the hash is persisted.

| Column    | Type     | Constraints                              | Notes                            |
| --------- | -------- | ---------------------------------------- | -------------------------------- |
| id        | UUID     | PK, default uuid()                       |                                  |
| userId    | UUID     | FK → [User.id](http://User.id) (CASCADE) |                                  |
| tokenHash | String   | UNIQUE, NOT NULL                         | bcrypt/SHA-256 hash of raw token |
| expiresAt | DateTime | NOT NULL                                 |                                  |
| createdAt | DateTime | default now()                            |                                  |

**Indexes:** `tokenHash` (unique)

---

# Domain: Social

## Friendship

Models all peer relationships: friend requests, accepted friends, and blocks. A pair of users has at most one Friendship record, enforced by the composite unique constraint.

| Column      | Type             | Constraints                    | Notes              |
| ----------- | ---------------- | ------------------------------ | ------------------ |
| id          | UUID             | PK, default uuid()             |                    |
| requesterId | UUID             | FK → [User.id](http://User.id) | User who initiated |
| addresseeId | UUID             | FK → [User.id](http://User.id) | User who received  |
| status      | FriendshipStatus | NOT NULL, default PENDING      | Enum below         |
| createdAt   | DateTime         | default now()                  |                    |
| updatedAt   | DateTime         | auto-updated                   |                    |

**Indexes:** `(requesterId, addresseeId)` (unique composite)

### Enum: FriendshipStatus

| Value    | Description                           |
| -------- | ------------------------------------- |
| PENDING  | Friend request sent, not yet accepted |
| ACCEPTED | Both users are friends                |
| BLOCKED  | requester has blocked addressee       |

### Business Rules

- Query both directions `(A→B OR B→A)` to check if a relationship exists.
- A BLOCKED record suppresses friend requests from the blocked user.
- Rejecting a request deletes the row entirely (no REJECTED status).

---

# Domain: Conversations

## Conversation

Unified table for both DMs and group channels, discriminated by `type`. `name` and `avatarUrl` are only meaningful for GROUP. `callChannelId` is reserved for future voice call extensibility.

| Column        | Type             | Constraints        | Notes                             |
| ------------- | ---------------- | ------------------ | --------------------------------- |
| id            | UUID             | PK, default uuid() |                                   |
| type          | ConversationType | NOT NULL           | Enum: `DIRECT`, `GROUP`           |
| name          | String?          | nullable           | Group only, 1–100 chars           |
| avatarUrl     | String?          | nullable           | Group only, URI                   |
| callChannelId | String?          | nullable           | Reserved for future voice support |
| createdAt     | DateTime         | default now()      |                                   |
| updatedAt     | DateTime         | auto-updated       |                                   |

### Enum: ConversationType

| Value  | Description                       |
| ------ | --------------------------------- |
| DIRECT | 1-on-1 DM between exactly 2 users |
| GROUP  | Multi-member channel with roles   |

### Business Rules

- DIRECT conversations must always have exactly 2 participants.
- Only one DIRECT conversation may exist per user pair (enforced at application layer).
- GROUP conversations require at least 2 members including the creator (auto-assigned OWNER).

---

## ConversationParticipant

Join table between User and Conversation. Carries a role for permission enforcement in groups.

| Column         | Type            | Constraints                                              | Notes |
| -------------- | --------------- | -------------------------------------------------------- | ----- |
| id             | UUID            | PK, default uuid()                                       |       |
| conversationId | UUID            | FK → [Conversation.id](http://Conversation.id) (CASCADE) |       |
| userId         | UUID            | FK → [User.id](http://User.id) (CASCADE)                 |       |
| role           | ParticipantRole | NOT NULL, default MEMBER                                 |       |
| joinedAt       | DateTime        | default now()                                            |       |

**Indexes:** `(conversationId, userId)` (unique composite)

### Enum: ParticipantRole

| Value  | Permissions                                                         |
| ------ | ------------------------------------------------------------------- |
| OWNER  | Full control: delete conversation, transfer ownership, manage roles |
| ADMIN  | Add/remove members, edit conversation metadata, delete any message  |
| MEMBER | Send messages, edit/delete own messages only                        |

### Business Rules

- Every GROUP must have exactly one OWNER at all times.
- Ownership can only be transferred explicitly — it is not inherited on leave.
- If the OWNER leaves without transferring, the application must block the action or auto-promote the longest-standing ADMIN.
- DIRECT conversations assign MEMBER to both participants (role is irrelevant for DMs).

---

# Domain: Messaging

## Message

All conversation messages. Soft-deleted via `deletedAt` (row is retained; client renders a "message deleted" placeholder). `ogEmbed` is populated server-side when the message content contains a URL.

| Column         | Type        | Constraints                                              | Notes                                          |
| -------------- | ----------- | -------------------------------------------------------- | ---------------------------------------------- |
| id             | UUID        | PK, default uuid()                                       |                                                |
| conversationId | UUID        | FK → [Conversation.id](http://Conversation.id) (CASCADE) |                                                |
| senderId       | UUID        | FK → [User.id](http://User.id)                           | Not cascaded — retain messages if user deleted |
| content        | String?     | nullable                                                 | Required if no attachments, max 4000 chars     |
| type           | MessageType | NOT NULL, default TEXT                                   | Enum below                                     |
| ogEmbed        | Json?       | nullable                                                 | `{ url, title, description?, image? }`         |
| editedAt       | DateTime?   | nullable                                                 | Set on edit                                    |
| deletedAt      | DateTime?   | nullable                                                 | Set on soft delete                             |
| createdAt      | DateTime    | default now()                                            |                                                |

**Indexes:** `(conversationId, createdAt DESC)` — primary query pattern for history fetch

### Enum: MessageType

| Value  | Description                                            |
| ------ | ------------------------------------------------------ |
| TEXT   | Plain text message, optionally with OG embed           |
| FILE   | Message with one or more file attachments              |
| SYSTEM | System-generated event (e.g., "Jane joined the group") |

### Business Rules

- A message must have `content` OR at least one `Attachment` — not neither.
- `ogEmbed` is fetched and stored server-side at send time; not re-fetched on edit.
- Soft-deleted messages retain their row; `content` is cleared and `deletedAt` is set.
- `senderId` uses a restricted FK (no cascade) so message history is preserved if a user account is deleted.

---

## Attachment

Files uploaded via `POST /uploads` and linked to a message. The file itself lives in object storage (S3); only metadata is stored here.

| Column    | Type     | Constraints                                    | Notes              |
| --------- | -------- | ---------------------------------------------- | ------------------ |
| id        | UUID     | PK, default uuid()                             |                    |
| messageId | UUID     | FK → [Message.id](http://Message.id) (CASCADE) |                    |
| url       | String   | NOT NULL                                       | Object storage URI |
| mimeType  | String   | NOT NULL                                       | e.g. `image/png`   |
| size      | Int      | NOT NULL                                       | Size in bytes      |
| name      | String   | NOT NULL                                       | Original filename  |
| createdAt | DateTime | default now()                                  |                    |

---

# Enums Summary

| Enum             | Values                     |
| ---------------- | -------------------------- |
| OAuthProvider    | GOOGLE                     |
| FriendshipStatus | PENDING, ACCEPTED, BLOCKED |
| ConversationType | DIRECT, GROUP              |
| ParticipantRole  | OWNER, ADMIN, MEMBER       |
| MessageType      | TEXT, FILE, SYSTEM         |

---

# Prisma Schema

```
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────

enum OAuthProvider {
  GOOGLE
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}

enum ConversationType {
  DIRECT
  GROUP
}

enum ParticipantRole {
  OWNER
  ADMIN
  MEMBER
}

enum MessageType {
  TEXT
  FILE
  SYSTEM
}

// ─── Identity ────────────────────────────────────────────

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  username     String   @unique
  displayName  String
  avatarUrl    String?
  passwordHash String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  oauthAccounts       OAuthAccount[]
  refreshTokens       RefreshToken[]
  sentFriendships     Friendship[]              @relation("Requester")
  receivedFriendships Friendship[]              @relation("Addressee")
  participations      ConversationParticipant[]
  messages            Message[]
}

model OAuthAccount {
  id                String        @id @default(uuid())
  userId            String
  provider          OAuthProvider
  providerAccountId String
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ─── Social ──────────────────────────────────────────────

model Friendship {
  id          String           @id @default(uuid())
  requesterId String
  addresseeId String
  status      FriendshipStatus @default(PENDING)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  requester   User             @relation("Requester", fields: [requesterId], references: [id])
  addressee   User             @relation("Addressee", fields: [addresseeId], references: [id])

  @@unique([requesterId, addresseeId])
}

// ─── Conversations ───────────────────────────────────────

model Conversation {
  id            String           @id @default(uuid())
  type          ConversationType
  name          String?
  avatarUrl     String?
  callChannelId String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  participants ConversationParticipant[]
  messages     Message[]
}

model ConversationParticipant {
  id             String          @id @default(uuid())
  conversationId String
  userId         String
  role           ParticipantRole @default(MEMBER)
  joinedAt       DateTime        @default(now())
  conversation   Conversation    @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
}

// ─── Messaging ───────────────────────────────────────────

model Message {
  id             String       @id @default(uuid())
  conversationId String
  senderId       String
  content        String?
  type           MessageType  @default(TEXT)
  ogEmbed        Json?
  editedAt       DateTime?
  deletedAt      DateTime?
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation(fields: [senderId], references: [id])
  attachments    Attachment[]

  @@index([conversationId, createdAt(sort: Desc)])
}

model Attachment {
  id        String   @id @default(uuid())
  messageId String
  url       String
  mimeType  String
  size      Int
  name      String
  createdAt DateTime @default(now())
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
}
```
