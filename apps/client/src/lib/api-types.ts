export interface User {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatarUrl?: string;
	createdAt: string;
	updatedAt: string;
}

export interface FriendWithPresence extends User {
	isOnline: boolean;
}

export interface FriendsResponse {
	data: FriendWithPresence[];
}

export interface AuthResponse {
	accessToken: string;
	user: User;
}

export interface CursorPage {
	nextCursor?: string;
	prevCursor?: string;
	hasMore: boolean;
}

export interface OffsetPage {
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

export interface ChatParticipant {
	user: User;
	role: 'OWNER' | 'ADMIN' | 'MEMBER';
	joinedAt: string;
}

export interface ChatMessageAttachment {
	id: string;
	url: string;
	mimeType: string;
	size: number;
	name: string;
}

export interface ChatMessage {
	id: string;
	chatId: string;
	sender: User;
	content?: string;
	type: 'TEXT' | 'FILE' | 'SYSTEM';
	attachments: ChatMessageAttachment[];
	editedAt?: string;
	deletedAt?: string;
	createdAt: string;
}

export interface Chat {
	id: string;
	type: 'DIRECT' | 'GROUP';
	name?: string;
	avatarUrl?: string;
	participants: ChatParticipant[];
	lastMessage?: ChatMessage;
	createdAt: string;
	updatedAt: string;
}
