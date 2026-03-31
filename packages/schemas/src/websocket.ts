import { z } from "zod";

// ============================================================================
// Common Types
// ============================================================================

/** UUID schema for requestId correlation */
export const requestIdSchema = z.uuid();
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
// WebSocket-specific Message Schema (matches AsyncAPI spec)
// ============================================================================

/** Simplified user for WS messages (per AsyncAPI spec) */
export const wsUserSchema = z.object({
	id: z.uuid(),
	username: z.string(),
	displayName: z.string(),
	avatarUrl: z.url().nullable(),
});
export type WsUser = z.infer<typeof wsUserSchema>;

/** Attachment schema for WS messages */
export const wsAttachmentSchema = z.object({
	id: z.uuid(),
	url: z.url(),
	mimeType: z.string(),
	size: z.number().int(),
	name: z.string(),
});
export type WsAttachment = z.infer<typeof wsAttachmentSchema>;

/** OG embed schema for WS messages */
export const wsOgEmbedSchema = z.object({
	url: z.url(),
	title: z.string(),
	description: z.string().nullable(),
	image: z.url().nullable(),
});
export type WsOgEmbed = z.infer<typeof wsOgEmbedSchema>;

/** Message type enum */
export const wsMessageTypeSchema = z.enum(["TEXT", "FILE", "SYSTEM"]);
export type WsMessageType = z.infer<typeof wsMessageTypeSchema>;

/** Full message schema for WS (uses conversationId, not chatId) */
export const wsMessageSchema = z.object({
	id: z.uuid(),
	conversationId: z.uuid(),
	sender: wsUserSchema,
	content: z.string().nullable(),
	type: wsMessageTypeSchema,
	attachments: z.array(wsAttachmentSchema),
	ogEmbed: wsOgEmbedSchema.nullable(),
	editedAt: z.iso.datetime().nullable(),
	deletedAt: z.iso.datetime().nullable(),
	createdAt: z.iso.datetime(),
});
export type WsMessage = z.infer<typeof wsMessageSchema>;

// ============================================================================
// Client → Server Events
// ============================================================================

/** message:send payload */
export const messageSendPayloadSchema = z
	.object({
		conversationId: z.uuid(),
		content: z.string().min(1).max(4000).optional(),
		attachmentIds: z.array(z.uuid()).max(10).optional(),
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
	messageId: z.uuid(),
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
	messageId: z.uuid(),
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
	payload: wsMessageSchema,
});
export type MessageNew = z.infer<typeof messageNewSchema>;

/** message:edited - partial update broadcast */
export const messageEditedPayloadSchema = z.object({
	messageId: z.uuid(),
	content: z.string(),
	editedAt: z.iso.datetime(),
});
export type MessageEditedPayload = z.infer<typeof messageEditedPayloadSchema>;

export const messageEditedSchema = z.object({
	event: z.literal("message:edited"),
	payload: messageEditedPayloadSchema,
});
export type MessageEdited = z.infer<typeof messageEditedSchema>;

/** message:deleted - deletion notification */
export const messageDeletedPayloadSchema = z.object({
	messageId: z.uuid(),
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
