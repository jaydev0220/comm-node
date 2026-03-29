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
	registerRequestSchema,
	loginRequestSchema,
	authResponseSchema,
	refreshResponseSchema,
	friendRequestActionSchema,
	type RegisterRequest,
	type LoginRequest,
	type AuthResponse,
	type RefreshResponse,
	type FriendRequestAction,
} from "./auth.js";

// User schemas
export {
	userSchema,
	updateUserRequestSchema,
	userSearchParamsSchema,
	type User,
	type UpdateUserRequest,
	type UserSearchParams,
} from "./users.js";

// Friendship schemas
export {
	friendshipStatusSchema,
	friendshipSchema,
	sendFriendRequestSchema,
	respondFriendRequestSchema,
	blockUserRequestSchema,
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
