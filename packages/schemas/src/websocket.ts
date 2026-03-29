import { z } from "zod";
import {
	attachmentSchema,
	messageSchema,
	messageTypeSchema,
	ogEmbedSchema,
} from "./messages.js";
import { userSchema } from "./users.js";

// ============================================================================
// Common Types
// ============================================================================

/** UUID schema for requestId correlation */
export const requestIdSchema = z.string().uuid();
export type RequestId = z.infer<typeof requestIdSchema>;

/** Error codes returned by the WebSocket server */
export const wsErrorCodeSchema = z.enum([
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"VALIDATION_FAILED",
	"INTERNAL_ERROR",
]);
export type WsErrorCode = z.infer<typeof wsErrorCodeSchema>;

/** Event type literals */
export const wsClientEventSchema = z.enum([
	"message:send",
	"message:edit",
	"message:delete",
]);
export type WsClientEvent = z.infer<typeof wsClientEventSchema>;

export const wsServerEventSchema = z.enum([
	"message:new",
	"message:edited",
	"message:deleted",
	"ack",
	"error",
]);
export type WsServerEvent = z.infer<typeof wsServerEventSchema>;

// ============================================================================
// Client → Server Events
// ============================================================================

/** message:send payload */
export const messageSendPayloadSchema = z
	.object({
		conversationId: z.string().uuid(),
		content: z.string().min(1).max(4000).optional(),
		attachmentIds: z.array(z.string().uuid()).max(10).optional(),
	})
	.refine((data) => data.content ?? data.attachmentIds, {
		message: "Message must have content or attachmentIds",
	});
export type MessageSendPayload = z.infer<typeof messageSendPayloadSchema>;

export const messageSendSchema = z.object({
	event: z.literal("message:send"),
	requestId: requestIdSchema,
	payload: messageSendPayloadSchema,
});
export type MessageSend = z.infer<typeof messageSendSchema>;

/** message:edit payload */
export const messageEditPayloadSchema = z.object({
	messageId: z.string().uuid(),
	content: z.string().min(1).max(4000),
});
export type MessageEditPayload = z.infer<typeof messageEditPayloadSchema>;

export const messageEditSchema = z.object({
	event: z.literal("message:edit"),
	requestId: requestIdSchema,
	payload: messageEditPayloadSchema,
});
export type MessageEdit = z.infer<typeof messageEditSchema>;

/** message:delete payload */
export const messageDeletePayloadSchema = z.object({
	messageId: z.string().uuid(),
});
export type MessageDeletePayload = z.infer<typeof messageDeletePayloadSchema>;

export const messageDeleteSchema = z.object({
	event: z.literal("message:delete"),
	requestId: requestIdSchema,
	payload: messageDeletePayloadSchema,
});
export type MessageDelete = z.infer<typeof messageDeleteSchema>;

/** Union of all client events for parsing incoming messages */
export const wsClientMessageSchema = z.discriminatedUnion("event", [
	messageSendSchema,
	messageEditSchema,
	messageDeleteSchema,
]);
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

// ============================================================================
// Server → Client Events
// ============================================================================

/** message:new - full message object broadcast */
export const messageNewSchema = z.object({
	event: z.literal("message:new"),
	payload: messageSchema,
});
export type MessageNew = z.infer<typeof messageNewSchema>;

/** message:edited - partial update broadcast */
export const messageEditedPayloadSchema = z.object({
	messageId: z.string().uuid(),
	content: z.string(),
	editedAt: z.string().datetime(),
});
export type MessageEditedPayload = z.infer<typeof messageEditedPayloadSchema>;

export const messageEditedSchema = z.object({
	event: z.literal("message:edited"),
	payload: messageEditedPayloadSchema,
});
export type MessageEdited = z.infer<typeof messageEditedSchema>;

/** message:deleted - deletion notification */
export const messageDeletedPayloadSchema = z.object({
	messageId: z.string().uuid(),
});
export type MessageDeletedPayload = z.infer<typeof messageDeletedPayloadSchema>;

export const messageDeletedSchema = z.object({
	event: z.literal("message:deleted"),
	payload: messageDeletedPayloadSchema,
});
export type MessageDeleted = z.infer<typeof messageDeletedSchema>;

/** ack - acknowledgement of successful operation */
export const ackPayloadSchema = z.object({
	requestId: requestIdSchema,
});
export type AckPayload = z.infer<typeof ackPayloadSchema>;

export const ackSchema = z.object({
	event: z.literal("ack"),
	payload: ackPayloadSchema,
});
export type Ack = z.infer<typeof ackSchema>;

/** error - error response to client */
export const errorPayloadSchema = z.object({
	requestId: requestIdSchema.optional(),
	code: wsErrorCodeSchema,
	message: z.string(),
});
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

export const wsErrorSchema = z.object({
	event: z.literal("error"),
	payload: errorPayloadSchema,
});
export type WsError = z.infer<typeof wsErrorSchema>;

/** Union of all server events (for type checking outgoing messages) */
export const wsServerMessageSchema = z.discriminatedUnion("event", [
	messageNewSchema,
	messageEditedSchema,
	messageDeletedSchema,
	ackSchema,
	wsErrorSchema,
]);
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;

// ============================================================================
// Re-export message-related schemas for convenience
// ============================================================================

export {
	attachmentSchema,
	messageSchema,
	messageTypeSchema,
	ogEmbedSchema,
	userSchema,
};
