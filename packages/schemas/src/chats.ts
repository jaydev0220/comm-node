import { z } from "zod";
import { participantSchema } from "./participants.js";
import { messageSchema } from "./messages.js";

export const conversationTypeSchema = z.enum(["DIRECT", "GROUP"]);

// Create chat discriminated union
export const createDirectChatSchema = z.object({
  type: z.literal("DIRECT"),
  participantId: z.uuid(),
});

export const createGroupChatSchema = z.object({
  type: z.literal("GROUP"),
  name: z.string().min(1).max(100),
  avatarUrl: z.url().optional(),
  memberIds: z.array(z.uuid()).min(1).max(99),
});

export const createChatRequestSchema = z.discriminatedUnion("type", [
  createDirectChatSchema,
  createGroupChatSchema,
]);

export const updateChatRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    avatarUrl: z.url().optional(),
  })
  .refine((data) => data.name !== undefined || data.avatarUrl !== undefined, {
    message: "At least one field is required",
  });

export const listChatsParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const chatSchema = z.object({
  id: z.uuid(),
  type: conversationTypeSchema,
  name: z.string().optional(),
  avatarUrl: z.url().optional(),
  participants: z.array(participantSchema),
  lastMessage: messageSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// Types
export type ConversationType = z.infer<typeof conversationTypeSchema>;
export type CreateDirectChat = z.infer<typeof createDirectChatSchema>;
export type CreateGroupChat = z.infer<typeof createGroupChatSchema>;
export type CreateChatRequest = z.infer<typeof createChatRequestSchema>;
export type UpdateChatRequest = z.infer<typeof updateChatRequestSchema>;
export type ListChatsParams = z.infer<typeof listChatsParamsSchema>;
export type Chat = z.infer<typeof chatSchema>;
