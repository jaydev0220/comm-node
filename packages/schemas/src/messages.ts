import { z } from "zod";
import { userSchema } from "./users.js";

export const messageTypeSchema = z.enum(["TEXT", "FILE", "SYSTEM"]);

export const attachmentSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  mimeType: z.string(),
  size: z.number().int(),
  name: z.string(),
});

export const ogEmbedSchema = z.object({
  url: z.url(),
  title: z.string(),
  description: z.string().optional(),
  image: z.url().optional(),
});

export const messageSchema = z.object({
  id: z.uuid(),
  chatId: z.uuid(),
  sender: userSchema,
  content: z.string().optional(),
  type: messageTypeSchema,
  attachments: z.array(attachmentSchema),
  ogEmbed: ogEmbedSchema.optional(),
  editedAt: z.iso.datetime().optional(),
  deletedAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
});

export const listMessagesParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Types
export type MessageType = z.infer<typeof messageTypeSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type OgEmbed = z.infer<typeof ogEmbedSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ListMessagesParams = z.infer<typeof listMessagesParamsSchema>;
