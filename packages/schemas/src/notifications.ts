import { z } from "zod";
import { offsetPageSchema } from "./common.js";

export const notificationTypeSchema = z.enum(["NEW_MESSAGE", "FRIEND_REQUEST"]);

export const notificationSchema = z.object({
	id: z.uuid(),
	type: notificationTypeSchema,
	referenceId: z.uuid(),
	read: z.boolean(),
	createdAt: z.iso.datetime(),
});

export const listNotificationsParamsSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationsListResponseSchema = z.object({
	data: z.array(notificationSchema),
	pagination: offsetPageSchema,
});

export const unreadCountResponseSchema = z.object({
	messages: z.number().int().nonnegative(),
	friendRequests: z.number().int().nonnegative(),
});

export const markNotificationsReadRequestSchema = z.object({
	ids: z.array(z.uuid()).min(1).max(100),
});

// Types
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type ListNotificationsParams = z.infer<typeof listNotificationsParamsSchema>;
export type NotificationsListResponse = z.infer<typeof notificationsListResponseSchema>;
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;
