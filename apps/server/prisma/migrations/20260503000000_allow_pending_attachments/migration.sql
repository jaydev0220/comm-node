-- Allow uploads to create attachment metadata before a message claims the file.
ALTER TABLE "Attachment" ALTER COLUMN "messageId" DROP NOT NULL;
