import { z } from "zod";
import { userSchema } from "./users.js";

export const messageTypeSchema = z.enum(["TEXT", "FILE", "SYSTEM"]);

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  mimeType: z.string(),
  size: z.number().int(),
  name: z.string(),
});

export const ogEmbedSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  sender: userSchema,
  content: z.string().optional(),
  type: messageTypeSchema,
  attachments: z.array(attachmentSchema),
  ogEmbed: ogEmbedSchema.optional(),
  editedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
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
