// Common schemas
export {
	uuidSchema,
	errorDetailSchema,
	errorSchema,
	cursorPageSchema,
	offsetPageSchema,
	type ErrorDetail,
	type ApiError,
	type CursorPage,
	type OffsetPage,
} from "./common.js";

// Auth schemas
export {
	registerStartRequestSchema,
	registerCompleteRequestSchema,
	registerRequestSchema,
	loginRequestSchema,
	authResponseSchema,
	refreshResponseSchema,
	friendRequestActionSchema,
	googleCompleteRequestSchema,
	type RegisterStartRequest,
	type RegisterCompleteRequest,
	type RegisterRequest,
	type LoginRequest,
	type AuthResponse,
	type RefreshResponse,
	type FriendRequestAction,
	type GoogleCompleteRequest,
} from "./auth.js";

// User schemas
export {
	userSchema,
	avatarMimeTypeSchema,
	avatarUploadSchema,
	updateUserRequestSchema,
	userSearchParamsSchema,
	type User,
	type AvatarMimeType,
	type AvatarUpload,
	type UpdateUserRequest,
	type UserSearchParams,
} from "./users.js";

// Friendship schemas
export {
	friendshipStatusSchema,
	friendWithPresenceSchema,
	friendsListResponseSchema,
	friendshipSchema,
	sendFriendRequestSchema,
	respondFriendRequestSchema,
	blockUserRequestSchema,
	type FriendWithPresence,
	type FriendsListResponse,
	type FriendshipStatus,
	type Friendship,
	type SendFriendRequest,
	type RespondFriendRequest,
	type BlockUserRequest,
} from "./friends.js";

// Chat schemas
export {
	conversationTypeSchema,
	createDirectChatSchema,
	createGroupChatSchema,
	createChatRequestSchema,
	updateChatRequestSchema,
	listChatsParamsSchema,
	chatSchema,
	type ConversationType,
	type CreateDirectChat,
	type CreateGroupChat,
	type CreateChatRequest,
	type UpdateChatRequest,
	type ListChatsParams,
	type Chat,
} from "./chats.js";

// Participant schemas
export {
	participantRoleSchema,
	participantSchema,
	addParticipantRequestSchema,
	updateParticipantRoleRequestSchema,
	type ParticipantRole,
	type Participant,
	type AddParticipantRequest,
	type UpdateParticipantRoleRequest,
} from "./participants.js";

// Message schemas
export {
	messageTypeSchema,
	attachmentSchema,
	ogEmbedSchema,
	messageSchema,
	listMessagesParamsSchema,
	type MessageType,
	type Attachment,
	type OgEmbed,
	type Message,
	type ListMessagesParams,
} from "./messages.js";

// Search schemas
export {
	searchTypeSchema,
	searchParamsSchema,
	type SearchType,
	type SearchParams,
} from "./search.js";

// WebSocket schemas
export {
	// Common types
	requestIdSchema,
	wsErrorCodeSchema,
	wsClientEventSchema,
	wsServerEventSchema,
	type RequestId,
	type WsErrorCode,
	type WsClientEvent,
	type WsServerEvent,
	// WebSocket-specific message types
	wsUserSchema,
	wsAttachmentSchema,
	wsOgEmbedSchema,
	wsMessageTypeSchema,
	wsMessageSchema,
	type WsUser,
	type WsAttachment,
	type WsOgEmbed,
	type WsMessageType,
	type WsMessage,
	// Client → Server events
	messageSendPayloadSchema,
	messageSendSchema,
	messageEditPayloadSchema,
	messageEditSchema,
	messageDeletePayloadSchema,
	messageDeleteSchema,
	wsClientMessageSchema,
	type MessageSendPayload,
	type MessageSend,
	type MessageEditPayload,
	type MessageEdit,
	type MessageDeletePayload,
	type MessageDelete,
	type WsClientMessage,
	// Server → Client events
	messageNewSchema,
	messageEditedPayloadSchema,
	messageEditedSchema,
	messageDeletedPayloadSchema,
	messageDeletedSchema,
	ackPayloadSchema,
	ackSchema,
	errorPayloadSchema,
	wsErrorSchema,
	wsServerMessageSchema,
	type MessageNew,
	type MessageEditedPayload,
	type MessageEdited,
	type MessageDeletedPayload,
	type MessageDeleted,
	type AckPayload,
	type Ack,
	type ErrorPayload,
	type WsError,
	type WsServerMessage,
} from "./websocket.js";
