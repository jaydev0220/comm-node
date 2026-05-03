ALTER TABLE "Notification"
ADD COLUMN "actorId" TEXT,
ADD COLUMN "conversationId" TEXT,
ADD COLUMN "conversationType" "ConversationType";

CREATE INDEX "Notification_userId_read_conversationId_idx" ON "Notification"("userId", "read", "conversationId");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
