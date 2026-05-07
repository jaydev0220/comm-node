'use client';

import { Paperclip, Plus, Send, X, type LucideIcon } from 'lucide-react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent
} from 'react';
import Avatar from '@/components/avatar';
import { GroupChatTopBar } from '@/components/group-chat-top-bar';
import { MessageActionsMenu, type MessageActionState } from '@/components/message-actions-menu';
import { Button } from '@/components/ui';
import { api, getApiUrl, getAssetUrl } from '@/lib/api';
import type { Chat, ChatMessage, ChatMessageAttachment, CursorPage, User } from '@/lib/api-types';
import Image from 'next/image';

interface GroupChatViewProps {
	accessToken: string;
	currentUser: User;
	groupId: string;
	group?: Chat | null;
	onOpenAddUserModal: (group: Chat) => void;
	onLeaveGroup: (group: Chat) => Promise<void>;
	onDeleteGroup: (group: Chat) => Promise<void>;
	onMessageDeleteIntent?: (intent: GroupMessageDeleteIntent) => void;
}

export interface GroupMessageDeleteIntent {
	messageId: string;
	deleteScope: 'sender' | 'group-owner';
}

interface MessageHistoryResponse {
	data: ChatMessage[];
	pagination: CursorPage;
}

interface WsMessageUser {
	id: string;
	username: string;
	displayName: string;
	avatarUrl?: string | null;
}

interface WsMessage {
	id: string;
	conversationId: string;
	sender: WsMessageUser;
	content: string | null;
	type: 'TEXT' | 'FILE' | 'SYSTEM';
	attachments: ChatMessageAttachment[];
	editedAt?: string | null;
	deletedAt?: string | null;
	createdAt: string;
}

interface GroupMessage {
	id: string;
	conversationId: string;
	sender: WsMessageUser;
	content: string | null;
	type: 'TEXT' | 'FILE' | 'SYSTEM';
	attachments: ChatMessageAttachment[];
	editedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	isPending: boolean;
}

type UploadAttachmentResponse = ChatMessageAttachment;

interface QueuedAttachment {
	id: string;
	file: File;
}

interface EditingMessage {
	messageId: string;
	originalContent: string;
}

type AttachmentPreviewKind = 'image' | 'audio' | 'video' | 'file';

type PendingMessageRequest =
	| {
			type: 'send';
			messageId: string;
	  }
	| {
			type: 'edit';
			messageId: string;
			previousMessage: GroupMessage;
	  }
	| {
			type: 'delete';
			messageId: string;
			previousMessage: GroupMessage;
	  };

const MAX_ATTACHMENT_COUNT = 10;
const MESSAGES_PAGE_LIMIT = 50;
const MAX_TEXTAREA_LINES = 4;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const getErrorMessage = (error: unknown): string => {
	if (isRecord(error) && typeof error.message === 'string' && error.message.length > 0) {
		return error.message;
	}

	return '發生錯誤，請稍後再試';
};

const toWebSocketUrl = (url: string, accessToken: string): string => {
	const wsUrl = new URL(url);
	wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
	wsUrl.searchParams.set('token', accessToken);
	return wsUrl.toString();
};

const formatTime = (dateString: string): string => {
	const date = new Date(dateString);

	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return date.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit'
	});
};

const formatFileSize = (size: number): string => {
	if (size < 1024) {
		return `${size} B`;
	}

	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}

	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const IMAGE_PREVIEW_MIME_TYPES = new Set<string>([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/jpg'
]);
const AUDIO_PREVIEW_MIME_TYPES = new Set<string>([
	'audio/aac',
	'audio/mp3',
	'audio/mpeg',
	'audio/opus',
	'audio/ogg',
	'audio/wav',
	'audio/x-wav',
	'audio/webm'
]);
const VIDEO_PREVIEW_MIME_TYPES = new Set<string>([
	'video/mp4',
	'video/webm',
	'video/matroska',
	'video/x-matroska'
]);

const getAttachmentPreviewKind = (mimeType: string): AttachmentPreviewKind => {
	if (IMAGE_PREVIEW_MIME_TYPES.has(mimeType)) {
		return 'image';
	}

	if (AUDIO_PREVIEW_MIME_TYPES.has(mimeType)) {
		return 'audio';
	}

	if (VIDEO_PREVIEW_MIME_TYPES.has(mimeType)) {
		return 'video';
	}

	return 'file';
};

const getQueuedAttachmentKey = (file: File): string =>
	`${file.name}:${file.size}:${file.type}:${file.lastModified}`;

const mapChatMessageToGroupMessage = (message: ChatMessage): GroupMessage => ({
	id: message.id,
	conversationId: message.chatId,
	sender: {
		id: message.sender.id,
		username: message.sender.username,
		displayName: message.sender.displayName,
		avatarUrl: message.sender.avatarUrl
	},
	content: message.content ?? null,
	type: message.type,
	attachments: message.attachments,
	editedAt: message.editedAt ?? null,
	deletedAt: message.deletedAt ?? null,
	createdAt: message.createdAt,
	isPending: false
});

const mapWsMessageToGroupMessage = (message: WsMessage): GroupMessage => ({
	id: message.id,
	conversationId: message.conversationId,
	sender: message.sender,
	content: message.content,
	type: message.type,
	attachments: message.attachments,
	editedAt: message.editedAt ?? null,
	deletedAt: message.deletedAt ?? null,
	createdAt: message.createdAt,
	isPending: false
});

const applyDeletedMessageState = (
	message: GroupMessage,
	deletedMessageId: string,
	isPending = message.isPending
): GroupMessage => {
	if (message.id !== deletedMessageId) {
		return message;
	}

	return {
		...message,
		content: null,
		attachments: [],
		deletedAt: message.deletedAt ?? new Date().toISOString(),
		isPending
	};
};

const findFirstPendingSendRequestId = (
	pendingRequests: Map<string, PendingMessageRequest>
): string | null => {
	for (const [requestId, request] of pendingRequests) {
		if (request.type === 'send') {
			return requestId;
		}
	}

	return null;
};

const parseWsMessage = (value: unknown): WsMessage | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, conversationId, sender, content, type, attachments, editedAt, deletedAt, createdAt } =
		value;

	if (
		typeof id !== 'string' ||
		typeof conversationId !== 'string' ||
		!isRecord(sender) ||
		typeof sender.id !== 'string' ||
		typeof sender.username !== 'string' ||
		typeof sender.displayName !== 'string' ||
		(sender.avatarUrl !== undefined &&
			sender.avatarUrl !== null &&
			typeof sender.avatarUrl !== 'string') ||
		(content !== null && typeof content !== 'string') ||
		(type !== 'TEXT' && type !== 'FILE' && type !== 'SYSTEM') ||
		!Array.isArray(attachments) ||
		(editedAt !== undefined && editedAt !== null && typeof editedAt !== 'string') ||
		(deletedAt !== undefined && deletedAt !== null && typeof deletedAt !== 'string') ||
		typeof createdAt !== 'string'
	) {
		return null;
	}

	const parsedAttachments: ChatMessageAttachment[] = [];

	for (const attachment of attachments) {
		if (
			!isRecord(attachment) ||
			typeof attachment.id !== 'string' ||
			typeof attachment.url !== 'string' ||
			typeof attachment.mimeType !== 'string' ||
			typeof attachment.size !== 'number' ||
			typeof attachment.name !== 'string'
		) {
			return null;
		}

		parsedAttachments.push({
			id: attachment.id,
			url: attachment.url,
			mimeType: attachment.mimeType,
			size: attachment.size,
			name: attachment.name
		});
	}

	return {
		id,
		conversationId,
		sender: {
			id: sender.id,
			username: sender.username,
			displayName: sender.displayName,
			avatarUrl: sender.avatarUrl as string | null | undefined
		},
		content,
		type,
		attachments: parsedAttachments,
		editedAt: (editedAt as string | null | undefined) ?? null,
		deletedAt: (deletedAt as string | null | undefined) ?? null,
		createdAt
	};
};

const GroupChatBubble = ({
	isSelf,
	isPending,
	message,
	actionState,
	isMenuOpen,
	onToggleMenu,
	onCloseMenu,
	onCopy,
	onEdit,
	onDelete,
	editDisabled,
	deleteDisabled
}: {
	isSelf: boolean;
	isPending: boolean;
	message: GroupMessage;
	actionState: MessageActionState;
	isMenuOpen: boolean;
	onToggleMenu: () => void;
	onCloseMenu: () => void;
	onCopy: () => void | Promise<void>;
	onEdit: () => void;
	onDelete: () => void;
	editDisabled: boolean;
	deleteDisabled: boolean;
}) => {
	const bubbleClassName = isSelf
		? 'bg-action text-action-fg rounded-br-sm'
		: 'bg-surface-raised text-text-primary rounded-bl-sm';
	const attachmentFrameClassName = isSelf
		? 'border-action-fg/30 bg-action-fg/10'
		: 'border-border bg-background/80';
	const attachmentLinkClassName = isSelf
		? 'border-action-fg/40 text-action-fg hover:bg-action-fg/10'
		: 'border-border text-text-secondary hover:bg-surface';

	return (
		<div className={`group flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
			{!isSelf ? (
				<div className="mr-2 mb-1 shrink-0 self-end">
					<Avatar
						name={message.sender.displayName}
						avatarUrl={message.sender.avatarUrl ?? undefined}
						size="sm"
					/>
				</div>
			) : null}
			<div
				className={`flex max-w-[80%] items-center gap-2 ${isSelf ? 'flex-row' : 'flex-row-reverse'}`}
			>
				<MessageActionsMenu
					state={actionState}
					isOpen={isMenuOpen}
					onToggle={onToggleMenu}
					onClose={onCloseMenu}
					onCopy={onCopy}
					onEdit={onEdit}
					onDelete={onDelete}
					editDisabled={editDisabled}
					deleteDisabled={deleteDisabled}
				/>
				<div className="min-w-0">
					{!isSelf ? (
						<p className="text-text-muted mb-1 px-1 text-xs font-medium">
							{message.sender.displayName}
						</p>
					) : null}
					<div
						className={`rounded-2xl px-3 py-2 shadow-sm transition-opacity ${bubbleClassName} ${
							isPending ? 'opacity-50' : 'opacity-100'
						}`}
					>
						{message.deletedAt ? (
							<p className="text-sm italic">訊息已刪除</p>
						) : (
							<>
								{message.content ? (
									<p className="text-sm wrap-break-word whitespace-pre-wrap">{message.content}</p>
								) : null}
								{message.attachments.length > 0 ? (
									<div className={`mt-2 flex flex-col gap-1 ${message.content ? '' : 'mt-0'}`}>
										{message.attachments.map((attachment) => {
											const attachmentUrl = getAssetUrl(attachment.url) ?? attachment.url;
											const previewKind =
												attachmentUrl.length > 0
													? getAttachmentPreviewKind(attachment.mimeType)
													: 'file';

											if (previewKind === 'image') {
												return (
													<a
														key={attachment.id}
														href={attachmentUrl}
														target="_blank"
														rel="noreferrer"
														className={`block max-w-sm overflow-hidden rounded-xl border p-2 ${attachmentFrameClassName}`}
													>
														<Image
															src={attachmentUrl}
															alt={attachment.name}
															loading="lazy"
															className="max-h-64 w-full rounded-lg object-cover"
														/>
														<span className="mt-2 block truncate text-xs">{attachment.name}</span>
													</a>
												);
											}

											if (previewKind === 'audio') {
												return (
													<div
														key={attachment.id}
														className={`max-w-sm rounded-xl border p-2 ${attachmentFrameClassName}`}
													>
														<audio
															controls
															preload="metadata"
															className="block h-10 w-full max-w-xs"
														>
															<source src={attachmentUrl} type={attachment.mimeType} />
														</audio>
														<a
															href={attachmentUrl}
															target="_blank"
															rel="noreferrer"
															className="mt-2 inline-flex min-w-0 items-center gap-1 text-xs underline-offset-2 hover:underline"
														>
															<Paperclip className="size-3 shrink-0" />
															<span className="truncate">{attachment.name}</span>
														</a>
													</div>
												);
											}

											if (previewKind === 'video') {
												return (
													<div
														key={attachment.id}
														className={`max-w-sm rounded-xl border p-2 ${attachmentFrameClassName}`}
													>
														<video
															controls
															preload="metadata"
															className="max-h-64 w-full rounded-lg bg-black"
														>
															<source src={attachmentUrl} type={attachment.mimeType} />
														</video>
														<a
															href={attachmentUrl}
															target="_blank"
															rel="noreferrer"
															className="mt-2 inline-flex min-w-0 items-center gap-1 text-xs underline-offset-2 hover:underline"
														>
															<Paperclip className="size-3 shrink-0" />
															<span className="truncate">{attachment.name}</span>
														</a>
													</div>
												);
											}

											return attachmentUrl.length > 0 ? (
												<a
													key={attachment.id}
													href={attachmentUrl}
													target="_blank"
													rel="noreferrer"
													className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${attachmentLinkClassName}`}
												>
													<Paperclip className="size-3" />
													<span className="truncate">{attachment.name}</span>
												</a>
											) : (
												<div
													key={attachment.id}
													className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${attachmentLinkClassName}`}
												>
													<Paperclip className="size-3" />
													<span className="truncate">{attachment.name}</span>
												</div>
											);
										})}
									</div>
								) : null}
							</>
						)}
						<div
							className={`mt-1 flex items-center gap-1 text-[11px] ${
								isSelf ? 'text-action-fg/80' : 'text-text-muted'
							}`}
						>
							<span>{formatTime(message.createdAt)}</span>
							{message.editedAt ? <span>已編輯</span> : null}
							{isPending ? <span>傳送中…</span> : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const IconButton = ({
	icon: Icon,
	label,
	onClick,
	disabled = false,
	variant = 'default'
}: {
	icon: LucideIcon;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	variant?: 'default' | 'danger';
}) => (
	<button
		type="button"
		aria-label={label}
		disabled={disabled}
		onClick={onClick}
		className={`rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
			variant === 'danger'
				? 'text-red-400 hover:bg-red-500/10 focus-visible:ring-red-400'
				: 'text-text-muted hover:bg-surface-raised focus-visible:ring-border'
		}`}
	>
		<Icon className="size-4" />
	</button>
);

export function GroupChatView({
	accessToken,
	currentUser,
	groupId,
	group,
	onOpenAddUserModal,
	onLeaveGroup,
	onDeleteGroup,
	onMessageDeleteIntent
}: GroupChatViewProps) {
	const [groupChat, setGroupChat] = useState<Chat | null>(group?.id === groupId ? group : null);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [messages, setMessages] = useState<GroupMessage[]>([]);
	const [olderCursor, setOlderCursor] = useState<string | null>(null);
	const [hasMoreOlder, setHasMoreOlder] = useState(false);
	const [isLoadingInitialMessages, setIsLoadingInitialMessages] = useState(true);
	const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [inputValue, setInputValue] = useState('');
	const [queuedAttachments, setQueuedAttachments] = useState<QueuedAttachment[]>([]);
	const [isDragOverInput, setIsDragOverInput] = useState(false);
	const [socketConnected, setSocketConnected] = useState(false);
	const [conversationError, setConversationError] = useState<string | null>(null);
	const [sendError, setSendError] = useState<string | null>(null);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);
	const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
	const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
	const [deletingMessageIds, setDeletingMessageIds] = useState<string[]>([]);
	const [isMutatingGroup, setIsMutatingGroup] = useState(false);
	const historyContainerRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const pendingMessageRequestsRef = useRef<Map<string, PendingMessageRequest>>(new Map());
	const shouldScrollToBottomRef = useRef(false);
	const scrollRestoreRef = useRef<{
		height: number;
		top: number;
	} | null>(null);

	const queueFileSelection = useCallback((fileList: FileList | File[]) => {
		const files = Array.from(fileList);

		if (files.length === 0) {
			return;
		}

		setQueuedAttachments((currentQueuedAttachments) => {
			const existingKeys = new Set(
				currentQueuedAttachments.map((queuedAttachment) =>
					getQueuedAttachmentKey(queuedAttachment.file)
				)
			);
			const nextQueuedAttachments = [...currentQueuedAttachments];

			for (const file of files) {
				const fileKey = getQueuedAttachmentKey(file);

				if (existingKeys.has(fileKey)) {
					continue;
				}

				nextQueuedAttachments.push({
					id: crypto.randomUUID(),
					file
				});
				existingKeys.add(fileKey);
			}

			if (nextQueuedAttachments.length > MAX_ATTACHMENT_COUNT) {
				setAttachmentError(`最多只能附加 ${MAX_ATTACHMENT_COUNT} 個附件`);
				return nextQueuedAttachments.slice(0, MAX_ATTACHMENT_COUNT);
			}

			if (nextQueuedAttachments.length > 0) {
				setAttachmentError(null);
			}

			return nextQueuedAttachments;
		});
	}, []);

	const uploadAttachment = useCallback(
		async (attachment: QueuedAttachment): Promise<UploadAttachmentResponse> => {
			const formData = new FormData();
			formData.append('file', attachment.file);
			const response = await api.requestRaw('/uploads', {
				method: 'POST',
				body: formData
			});

			const responseText = await response.text();

			if (!response.ok) {
				throw new Error(responseText || '附件上傳失敗');
			}

			const parsedResponse = JSON.parse(responseText) as UploadAttachmentResponse;

			if (
				typeof parsedResponse.id !== 'string' ||
				typeof parsedResponse.url !== 'string' ||
				typeof parsedResponse.mimeType !== 'string' ||
				typeof parsedResponse.size !== 'number' ||
				typeof parsedResponse.name !== 'string'
			) {
				throw new Error('附件上傳回傳格式錯誤');
			}

			return parsedResponse;
		},
		[]
	);

	const loadOlderMessages = useCallback(async () => {
		if (!conversationId || !olderCursor || !hasMoreOlder || isLoadingOlderMessages) {
			return;
		}

		const historyContainer = historyContainerRef.current;

		if (historyContainer) {
			scrollRestoreRef.current = {
				height: historyContainer.scrollHeight,
				top: historyContainer.scrollTop
			};
		}

		setIsLoadingOlderMessages(true);

		try {
			const searchParams = new URLSearchParams({
				cursor: olderCursor,
				limit: String(MESSAGES_PAGE_LIMIT)
			});
			const response = await api.get<MessageHistoryResponse>(
				`/chats/${conversationId}/messages?${searchParams.toString()}`
			);
			const nextOlderMessages = response.data.map(mapChatMessageToGroupMessage).reverse();

			setMessages((currentMessages) => [...nextOlderMessages, ...currentMessages]);
			setOlderCursor(response.pagination.nextCursor ?? null);
			setHasMoreOlder(Boolean(response.pagination.hasMore && response.pagination.nextCursor));
		} catch (error) {
			setConversationError(getErrorMessage(error));
			scrollRestoreRef.current = null;
		} finally {
			setIsLoadingOlderMessages(false);
		}
	}, [conversationId, hasMoreOlder, isLoadingOlderMessages, olderCursor]);

	useEffect(() => {
		if (!group || group.id !== groupId || group.type !== 'GROUP') {
			return;
		}

		setGroupChat(group);
	}, [group, groupId]);

	useEffect(() => {
		let isActive = true;

		setGroupChat(null);
		setConversationId(null);
		setMessages([]);
		setOlderCursor(null);
		setHasMoreOlder(false);
		setConversationError(null);
		setSendError(null);
		setAttachmentError(null);
		setOpenMessageMenuId(null);
		setEditingMessage(null);
		setDeletingMessageIds([]);
		setInputValue('');
		setQueuedAttachments([]);
		pendingMessageRequestsRef.current.clear();
		setIsLoadingInitialMessages(true);

		const setupGroupConversation = async () => {
			try {
				const chat = await api.get<Chat>(`/chats/${groupId}`);

				if (!isActive) {
					return;
				}

				if (chat.type !== 'GROUP') {
					throw new Error('此對話不是群組聊天');
				}

				setGroupChat(chat);
				setConversationId(chat.id);

				const searchParams = new URLSearchParams({
					limit: String(MESSAGES_PAGE_LIMIT)
				});
				const messagesResponse = await api.get<MessageHistoryResponse>(
					`/chats/${chat.id}/messages?${searchParams.toString()}`
				);

				if (!isActive) {
					return;
				}

				setMessages(messagesResponse.data.map(mapChatMessageToGroupMessage).reverse());
				setOlderCursor(messagesResponse.pagination.nextCursor ?? null);
				setHasMoreOlder(
					Boolean(messagesResponse.pagination.hasMore && messagesResponse.pagination.nextCursor)
				);
				setConversationError(null);
				shouldScrollToBottomRef.current = true;
			} catch (error) {
				if (!isActive) {
					return;
				}

				setConversationError(getErrorMessage(error));
			} finally {
				if (isActive) {
					setIsLoadingInitialMessages(false);
				}
			}
		};

		void setupGroupConversation();

		return () => {
			isActive = false;
		};
	}, [groupId]);

	useEffect(() => {
		if (!conversationId) {
			return;
		}

		const socket = new WebSocket(toWebSocketUrl(getApiUrl('/ws'), accessToken));
		socketRef.current = socket;

		const onOpen = () => {
			setSocketConnected(true);
		};
		const onClose = () => {
			setSocketConnected(false);
		};
		const onMessage = (event: MessageEvent) => {
			if (typeof event.data !== 'string') {
				return;
			}

			let parsedMessage: unknown;

			try {
				parsedMessage = JSON.parse(event.data);
			} catch {
				return;
			}

			if (!isRecord(parsedMessage) || typeof parsedMessage.event !== 'string') {
				return;
			}

			if (parsedMessage.event === 'message:new') {
				const payload = parseWsMessage(parsedMessage.payload);

				if (!payload || payload.conversationId !== conversationId) {
					return;
				}

				setMessages((currentMessages) => {
					if (currentMessages.some((message) => message.id === payload.id)) {
						return currentMessages;
					}

					if (payload.sender.id === currentUser.id) {
						const firstPendingRequestId = findFirstPendingSendRequestId(
							pendingMessageRequestsRef.current
						);

						if (firstPendingRequestId) {
							let replaced = false;
							const withReplacement = currentMessages.map((message) => {
								if (message.id !== firstPendingRequestId) {
									return message;
								}

								replaced = true;
								return mapWsMessageToGroupMessage(payload);
							});

							if (replaced) {
								pendingMessageRequestsRef.current.delete(firstPendingRequestId);
								return withReplacement;
							}
						}
					}

					return [...currentMessages, mapWsMessageToGroupMessage(payload)];
				});
				shouldScrollToBottomRef.current = true;
				return;
			}

			if (parsedMessage.event === 'message:edited') {
				const payload = parsedMessage.payload;

				if (
					!isRecord(payload) ||
					typeof payload.messageId !== 'string' ||
					typeof payload.content !== 'string' ||
					typeof payload.editedAt !== 'string'
				) {
					return;
				}

				const editedMessageId = payload.messageId;
				const editedContent = payload.content;
				const editedAt = payload.editedAt;

				setMessages((currentMessages) =>
					currentMessages.map((message) =>
						message.id === editedMessageId
							? {
									...message,
									content: editedContent,
									editedAt
								}
							: message
					)
				);
				return;
			}

			if (parsedMessage.event === 'message:deleted') {
				const payload = parsedMessage.payload;

				if (!isRecord(payload) || typeof payload.messageId !== 'string') {
					return;
				}

				const deletedMessageId = payload.messageId;

				setMessages((currentMessages) =>
					currentMessages.map((message) => applyDeletedMessageState(message, deletedMessageId))
				);
				return;
			}

			if (parsedMessage.event === 'ack') {
				const payload = parsedMessage.payload;

				if (!isRecord(payload) || typeof payload.requestId !== 'string') {
					return;
				}

				const acknowledgedRequestId = payload.requestId;
				const pendingRequest = pendingMessageRequestsRef.current.get(acknowledgedRequestId);

				if (!pendingRequest) {
					return;
				}

				if (pendingRequest.type !== 'send') {
					pendingMessageRequestsRef.current.delete(acknowledgedRequestId);
				}
				setMessages((currentMessages) =>
					currentMessages.map((message) =>
						message.id === pendingRequest.messageId
							? {
									...message,
									isPending: false
								}
							: message
					)
				);

				if (pendingRequest.type === 'delete') {
					setDeletingMessageIds((currentMessageIds) =>
						currentMessageIds.filter(
							(currentMessageId) => currentMessageId !== pendingRequest.messageId
						)
					);
				}
				return;
			}

			if (parsedMessage.event === 'error') {
				const payload = parsedMessage.payload;

				if (!isRecord(payload) || typeof payload.message !== 'string') {
					return;
				}

				const errorMessage = payload.message;

				if (typeof payload.requestId === 'string') {
					const failedRequestId = payload.requestId;
					const pendingRequest = pendingMessageRequestsRef.current.get(failedRequestId);

					pendingMessageRequestsRef.current.delete(failedRequestId);

					if (pendingRequest) {
						if (pendingRequest.type === 'send') {
							setMessages((currentMessages) =>
								currentMessages.filter((message) => message.id !== pendingRequest.messageId)
							);
						} else {
							setMessages((currentMessages) =>
								currentMessages.map((message) =>
									message.id === pendingRequest.messageId ? pendingRequest.previousMessage : message
								)
							);

							if (pendingRequest.type === 'delete') {
								setDeletingMessageIds((currentMessageIds) =>
									currentMessageIds.filter(
										(currentMessageId) => currentMessageId !== pendingRequest.messageId
									)
								);
							}
						}
					}
				}

				setSendError(errorMessage);
			}
		};

		socket.addEventListener('open', onOpen);
		socket.addEventListener('close', onClose);
		socket.addEventListener('message', onMessage);

		return () => {
			socket.removeEventListener('open', onOpen);
			socket.removeEventListener('close', onClose);
			socket.removeEventListener('message', onMessage);
			socket.close();
			socketRef.current = null;
			setSocketConnected(false);
		};
	}, [accessToken, conversationId, currentUser.id]);

	const syncTextareaHeight = useCallback(() => {
		const textareaElement = textareaRef.current;

		if (!textareaElement) {
			return;
		}

		textareaElement.style.height = 'auto';
		const computedStyle = window.getComputedStyle(textareaElement);
		const lineHeight = Number.parseFloat(computedStyle.lineHeight || '20');
		const borderTop = Number.parseFloat(computedStyle.borderTopWidth || '0');
		const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth || '0');
		const paddingTop = Number.parseFloat(computedStyle.paddingTop || '0');
		const paddingBottom = Number.parseFloat(computedStyle.paddingBottom || '0');
		const maxHeight =
			lineHeight * MAX_TEXTAREA_LINES + borderTop + borderBottom + paddingTop + paddingBottom;
		const nextHeight = Math.min(textareaElement.scrollHeight, maxHeight);

		textareaElement.style.height = `${nextHeight}px`;
		textareaElement.style.overflowY = textareaElement.scrollHeight > maxHeight ? 'auto' : 'hidden';
	}, []);

	useEffect(() => {
		syncTextareaHeight();
	}, [inputValue, syncTextareaHeight]);

	useLayoutEffect(() => {
		const historyContainer = historyContainerRef.current;

		if (!historyContainer) {
			return;
		}

		if (scrollRestoreRef.current) {
			const { height, top } = scrollRestoreRef.current;

			historyContainer.scrollTop = historyContainer.scrollHeight - height + top;
			scrollRestoreRef.current = null;
			return;
		}

		if (shouldScrollToBottomRef.current) {
			historyContainer.scrollTop = historyContainer.scrollHeight;
			shouldScrollToBottomRef.current = false;
		}
	}, [messages]);

	const handleHistoryScroll = useCallback(() => {
		const historyContainer = historyContainerRef.current;

		if (!historyContainer || historyContainer.scrollTop > 64) {
			return;
		}

		void loadOlderMessages();
	}, [loadOlderMessages]);

	const removeQueuedAttachment = useCallback((attachmentId: string) => {
		setQueuedAttachments((currentAttachments) =>
			currentAttachments.filter((attachment) => attachment.id !== attachmentId)
		);
	}, []);

	const uploadQueuedAttachments = useCallback(
		async (attachments: QueuedAttachment[]): Promise<UploadAttachmentResponse[]> => {
			if (attachments.length === 0) {
				return [];
			}

			return Promise.all(attachments.map((attachment) => uploadAttachment(attachment)));
		},
		[uploadAttachment]
	);

	const sendMessage = useCallback(async () => {
		if (!conversationId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
			setSendError('連線尚未建立，請稍後再試');
			return;
		}

		const normalizedContent = inputValue.trim();
		const queuedSnapshot = [...queuedAttachments];

		if (!normalizedContent && queuedSnapshot.length === 0) {
			return;
		}

		const requestId = crypto.randomUUID();
		const now = new Date().toISOString();
		const optimisticAttachments: ChatMessageAttachment[] = queuedSnapshot.map((attachment) => ({
			id: attachment.id,
			url: '',
			mimeType: attachment.file.type,
			size: attachment.file.size,
			name: attachment.file.name
		}));
		const optimisticMessage: GroupMessage = {
			id: requestId,
			conversationId,
			sender: {
				id: currentUser.id,
				username: currentUser.username,
				displayName: currentUser.displayName,
				avatarUrl: currentUser.avatarUrl
			},
			content: normalizedContent || null,
			type: queuedSnapshot.length > 0 ? 'FILE' : 'TEXT',
			attachments: optimisticAttachments,
			editedAt: null,
			deletedAt: null,
			createdAt: now,
			isPending: true
		};

		setInputValue('');
		setQueuedAttachments([]);
		setSendError(null);
		setAttachmentError(null);
		setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
		pendingMessageRequestsRef.current.set(requestId, {
			type: 'send',
			messageId: requestId
		});
		shouldScrollToBottomRef.current = true;
		setIsSendingMessage(true);

		try {
			const uploadedAttachments = await uploadQueuedAttachments(queuedSnapshot);

			setMessages((currentMessages) =>
				currentMessages.map((message) =>
					message.id === requestId
						? {
								...message,
								attachments: uploadedAttachments
							}
						: message
				)
			);

			socketRef.current.send(
				JSON.stringify({
					event: 'message:send',
					requestId,
					payload: {
						conversationId,
						...(normalizedContent ? { content: normalizedContent } : {}),
						...(uploadedAttachments.length > 0
							? {
									attachmentIds: uploadedAttachments.map((attachment) => attachment.id)
								}
							: {})
					}
				})
			);
		} catch (error) {
			pendingMessageRequestsRef.current.delete(requestId);
			setMessages((currentMessages) =>
				currentMessages.filter((message) => message.id !== requestId)
			);
			setSendError(getErrorMessage(error));
		} finally {
			setIsSendingMessage(false);
		}
	}, [conversationId, currentUser, inputValue, queuedAttachments, uploadQueuedAttachments]);

	const cancelEditingMessage = useCallback(() => {
		setEditingMessage(null);
		setInputValue('');
		setSendError(null);
	}, []);

	const saveEditedMessage = useCallback(async () => {
		if (!editingMessage || inputValue.trim() === editingMessage.originalContent) {
			return;
		}
		if (!conversationId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
			setSendError('連線尚未建立，請稍後再試');
			return;
		}

		const requestId = crypto.randomUUID();
		const normalizedContent = inputValue.trim();

		if (!normalizedContent) {
			return;
		}

		const previousMessage = messages.find((message) => message.id === editingMessage.messageId);

		if (!previousMessage || previousMessage.deletedAt) {
			return;
		}

		pendingMessageRequestsRef.current.set(requestId, {
			type: 'edit',
			messageId: editingMessage.messageId,
			previousMessage
		});
		setIsSendingMessage(true);
		setSendError(null);
		setMessages((currentMessages) =>
			currentMessages.map((message) =>
				message.id === editingMessage.messageId
					? {
							...message,
							content: normalizedContent,
							editedAt: new Date().toISOString(),
							isPending: true
						}
					: message
			)
		);

		try {
			socketRef.current.send(
				JSON.stringify({
					event: 'message:edit',
					requestId,
					payload: {
						messageId: editingMessage.messageId,
						content: normalizedContent
					}
				})
			);
			setEditingMessage(null);
			setInputValue('');
		} catch (error) {
			pendingMessageRequestsRef.current.delete(requestId);
			setMessages((currentMessages) =>
				currentMessages.map((message) =>
					message.id === previousMessage.id ? previousMessage : message
				)
			);
			setEditingMessage(null);
			setInputValue('');
			setSendError(getErrorMessage(error));
		} finally {
			setIsSendingMessage(false);
		}
	}, [conversationId, editingMessage, inputValue, messages]);

	const submitComposer = useCallback(async () => {
		if (editingMessage) {
			await saveEditedMessage();
			return;
		}

		await sendMessage();
	}, [editingMessage, saveEditedMessage, sendMessage]);

	const handleTextareaKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key !== 'Enter' || event.shiftKey) {
				return;
			}

			event.preventDefault();
			void submitComposer();
		},
		[submitComposer]
	);

	const onFileInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (editingMessage) {
				event.target.value = '';
				return;
			}

			if (!event.target.files) {
				return;
			}

			queueFileSelection(event.target.files);
			event.target.value = '';
		},
		[editingMessage, queueFileSelection]
	);

	const onDropOnInput = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			setIsDragOverInput(false);

			if (editingMessage) {
				return;
			}

			if (event.dataTransfer.files.length > 0) {
				queueFileSelection(event.dataTransfer.files);
			}
		},
		[editingMessage, queueFileSelection]
	);

	const canSendMessage = useMemo(() => {
		if (isSendingMessage) {
			return false;
		}

		const normalizedContent = inputValue.trim();

		if (editingMessage) {
			return Boolean(conversationId) && normalizedContent.length > 0;
		}

		return (
			(socketConnected ||
				Boolean(socketRef.current && socketRef.current.readyState === WebSocket.OPEN)) &&
			(normalizedContent.length > 0 || queuedAttachments.length > 0)
		);
	}, [
		conversationId,
		editingMessage,
		inputValue,
		isSendingMessage,
		queuedAttachments.length,
		socketConnected
	]);

	const currentUserGroupRole = useMemo(() => {
		if (!groupChat) {
			return null;
		}

		const currentParticipant = groupChat.participants.find(
			(participant) => participant.user.id === currentUser.id
		);

		return currentParticipant?.role ?? null;
	}, [currentUser.id, groupChat]);

	const handleCopyMessage = useCallback(async (message: GroupMessage): Promise<void> => {
		if (!navigator.clipboard?.writeText) {
			setSendError('此瀏覽器不支援複製功能');
			return;
		}

		try {
			await navigator.clipboard.writeText(message.content ?? '');
		} catch {
			setSendError('複製訊息失敗，請稍後再試');
		}
	}, []);

	const handleEditMessageIntent = useCallback(
		(message: GroupMessage) => {
			if (message.sender.id !== currentUser.id || !message.content || message.deletedAt) {
				return;
			}

			setOpenMessageMenuId(null);
			setEditingMessage({
				messageId: message.id,
				originalContent: message.content
			});
			setInputValue(message.content);
			setQueuedAttachments([]);
			setAttachmentError(null);
			setSendError(null);
			requestAnimationFrame(() => textareaRef.current?.focus());
		},
		[currentUser.id]
	);

	const handleDeleteMessageIntent = useCallback(
		(message: GroupMessage, actionState: MessageActionState) => {
			const isSelfMessage = message.sender.id === currentUser.id;
			const canDeleteAsSender = actionState.deleteScope === 'sender' && isSelfMessage;
			const canDeleteAsGroupOwner =
				actionState.deleteScope === 'group-owner' &&
				currentUserGroupRole === 'OWNER' &&
				!isSelfMessage;

			if (
				(!canDeleteAsSender && !canDeleteAsGroupOwner) ||
				message.deletedAt ||
				deletingMessageIds.includes(message.id)
			) {
				return;
			}
			if (
				!conversationId ||
				!socketRef.current ||
				socketRef.current.readyState !== WebSocket.OPEN
			) {
				setSendError('連線尚未建立，請稍後再試');
				return;
			}

			const messageId = message.id;
			const requestId = crypto.randomUUID();
			const deleteScope: GroupMessageDeleteIntent['deleteScope'] = canDeleteAsSender
				? 'sender'
				: 'group-owner';
			const previousMessage = messages.find((currentMessage) => currentMessage.id === messageId);

			if (!previousMessage) {
				return;
			}

			pendingMessageRequestsRef.current.set(requestId, {
				type: 'delete',
				messageId,
				previousMessage
			});
			setOpenMessageMenuId(null);
			setSendError(null);
			onMessageDeleteIntent?.({
				messageId,
				deleteScope
			});
			setDeletingMessageIds((currentMessageIds) =>
				currentMessageIds.includes(messageId)
					? currentMessageIds
					: [...currentMessageIds, messageId]
			);

			try {
				socketRef.current.send(
					JSON.stringify({
						event: 'message:delete',
						requestId,
						payload: { messageId }
					})
				);
				setMessages((currentMessages) =>
					currentMessages.map((currentMessage) =>
						applyDeletedMessageState(currentMessage, messageId, true)
					)
				);

				if (editingMessage?.messageId === messageId) {
					cancelEditingMessage();
				}
			} catch (error) {
				pendingMessageRequestsRef.current.delete(requestId);
				setMessages((currentMessages) =>
					currentMessages.map((currentMessage) =>
						currentMessage.id === previousMessage.id ? previousMessage : currentMessage
					)
				);
				setSendError(getErrorMessage(error));
				setDeletingMessageIds((currentMessageIds) =>
					currentMessageIds.filter((currentMessageId) => currentMessageId !== messageId)
				);
			}
		},
		[
			cancelEditingMessage,
			conversationId,
			currentUser.id,
			currentUserGroupRole,
			deletingMessageIds,
			editingMessage?.messageId,
			messages,
			onMessageDeleteIntent
		]
	);

	useEffect(() => {
		if (!editingMessage) {
			return;
		}

		const targetMessage = messages.find((message) => message.id === editingMessage.messageId);

		if (!targetMessage || targetMessage.deletedAt || !targetMessage.content) {
			cancelEditingMessage();
		}
	}, [cancelEditingMessage, editingMessage, messages]);

	const handleOpenAddUserModal = useCallback(
		(targetGroup: Chat) => {
			if (isMutatingGroup) {
				return;
			}

			setConversationError(null);
			onOpenAddUserModal(targetGroup);
		},
		[isMutatingGroup, onOpenAddUserModal]
	);

	const handleLeaveGroup = useCallback(
		async (targetGroup: Chat) => {
			if (isMutatingGroup) {
				return;
			}

			setIsMutatingGroup(true);
			setConversationError(null);

			try {
				await onLeaveGroup(targetGroup);
			} catch (error) {
				setConversationError(getErrorMessage(error));
			} finally {
				setIsMutatingGroup(false);
			}
		},
		[isMutatingGroup, onLeaveGroup]
	);

	const handleDeleteGroup = useCallback(
		async (targetGroup: Chat) => {
			if (isMutatingGroup) {
				return;
			}

			setIsMutatingGroup(true);
			setConversationError(null);

			try {
				await onDeleteGroup(targetGroup);
			} catch (error) {
				setConversationError(getErrorMessage(error));
			} finally {
				setIsMutatingGroup(false);
			}
		},
		[isMutatingGroup, onDeleteGroup]
	);

	return (
		<div className="bg-background flex h-full w-full flex-col overflow-hidden">
			{groupChat ? (
				<GroupChatTopBar
					group={groupChat}
					currentUserId={currentUser.id}
					onAddUser={handleOpenAddUserModal}
					onLeaveGroup={handleLeaveGroup}
					onDeleteGroup={handleDeleteGroup}
					disabled={isMutatingGroup}
				/>
			) : (
				<header className="border-border bg-surface flex items-center border-b px-4 py-3">
					<p className="text-text-muted text-sm">載入群組中…</p>
				</header>
			)}

			<div className="relative flex min-h-0 grow flex-col">
				<div
					ref={historyContainerRef}
					onScroll={handleHistoryScroll}
					className="invisible-scroll-y flex min-h-0 grow flex-col gap-3 overflow-y-auto px-4 py-4"
				>
					{isLoadingOlderMessages ? (
						<p className="text-text-muted text-center text-xs">載入更多訊息中…</p>
					) : null}
					{isLoadingInitialMessages ? (
						<p className="text-text-muted text-center text-sm">載入訊息中…</p>
					) : null}
					{!isLoadingInitialMessages && messages.length === 0 ? (
						<p className="text-text-muted text-center text-sm">還沒有訊息，開始聊天吧</p>
					) : null}
					{messages.map((message) => {
						const isSelf = message.sender.id === currentUser.id;
						const canDeleteAsGroupOwner = currentUserGroupRole === 'OWNER' && !isSelf;
						const canEditMessage = isSelf && !message.deletedAt && Boolean(message.content);
						const actionState: MessageActionState = {
							canEdit: isSelf,
							deleteScope: isSelf ? 'sender' : canDeleteAsGroupOwner ? 'group-owner' : 'none'
						};

						return (
							<GroupChatBubble
								key={message.id}
								isSelf={isSelf}
								isPending={message.isPending}
								message={message}
								actionState={actionState}
								isMenuOpen={openMessageMenuId === message.id}
								onToggleMenu={() =>
									setOpenMessageMenuId((currentMenuId) =>
										currentMenuId === message.id ? null : message.id
									)
								}
								onCloseMenu={() =>
									setOpenMessageMenuId((currentMenuId) =>
										currentMenuId === message.id ? null : currentMenuId
									)
								}
								onCopy={() => handleCopyMessage(message)}
								onEdit={() => handleEditMessageIntent(message)}
								onDelete={() => handleDeleteMessageIntent(message, actionState)}
								editDisabled={!canEditMessage}
								deleteDisabled={
									Boolean(message.deletedAt) || deletingMessageIds.includes(message.id)
								}
							/>
						);
					})}
				</div>

				<div className="border-border bg-surface sticky bottom-0 border-t px-4 py-3">
					{conversationError ? (
						<p className="mb-2 text-sm text-red-400" aria-live="polite">
							{conversationError}
						</p>
					) : null}
					{sendError ? (
						<p className="mb-2 text-sm text-red-400" aria-live="polite">
							{sendError}
						</p>
					) : null}
					{attachmentError ? (
						<p className="mb-2 text-sm text-red-400" aria-live="polite">
							{attachmentError}
						</p>
					) : null}

					{editingMessage ? (
						<div className="border-border bg-background mb-2 flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
							<div className="min-w-0">
								<p className="text-action text-xs font-medium">正在編輯訊息</p>
								<p className="text-text-muted truncate text-xs">{editingMessage.originalContent}</p>
							</div>
							<button
								type="button"
								onClick={cancelEditingMessage}
								className="text-text-muted hover:text-text-primary shrink-0 text-xs transition-colors"
							>
								取消
							</button>
						</div>
					) : null}

					{!editingMessage && queuedAttachments.length > 0 ? (
						<div className="mb-2 flex flex-wrap gap-2">
							{queuedAttachments.map((attachment) => (
								<div
									key={attachment.id}
									className="border-border bg-surface-raised inline-flex items-center gap-2 rounded-md border px-2 py-1"
								>
									<Paperclip className="text-text-muted size-3" />
									<span className="text-text-secondary max-w-48 truncate text-xs">
										{attachment.file.name}
									</span>
									<span className="text-text-muted text-[11px]">
										{formatFileSize(attachment.file.size)}
									</span>
									<IconButton
										icon={X}
										label="移除附件"
										onClick={() => removeQueuedAttachment(attachment.id)}
										variant="danger"
									/>
								</div>
							))}
						</div>
					) : null}

					<div
						className={`border-border bg-background focus-within:ring-action/30 flex items-end gap-2 rounded-xl border p-2 transition ${
							isDragOverInput && !editingMessage ? 'ring-action/40 ring-2' : ''
						}`}
						onDragEnter={(event) => {
							if (editingMessage) {
								return;
							}

							event.preventDefault();
							event.stopPropagation();
							setIsDragOverInput(true);
						}}
						onDragOver={(event) => {
							if (editingMessage) {
								return;
							}

							event.preventDefault();
							event.stopPropagation();
							setIsDragOverInput(true);
						}}
						onDragLeave={(event) => {
							event.preventDefault();
							event.stopPropagation();
							setIsDragOverInput(false);
						}}
						onDrop={onDropOnInput}
					>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							className="hidden"
							onChange={onFileInputChange}
						/>
						<IconButton
							icon={Plus}
							label="新增附件"
							onClick={() => fileInputRef.current?.click()}
							disabled={isSendingMessage || Boolean(editingMessage)}
						/>
						<textarea
							ref={textareaRef}
							rows={1}
							value={inputValue}
							onChange={(event) => {
								setInputValue(event.target.value);
								setSendError(null);
							}}
							onKeyDown={handleTextareaKeyDown}
							placeholder={editingMessage ? '編輯訊息...' : '輸入訊息...'}
							className="text-text-primary placeholder:text-text-muted max-h-36 min-h-9 grow resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none"
						/>
						<Button
							type="button"
							size="sm"
							onClick={() => {
								void submitComposer();
							}}
							disabled={!canSendMessage}
							loading={isSendingMessage}
							className="h-9 px-3"
						>
							{editingMessage ? '儲存' : <Send className="size-4" />}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
