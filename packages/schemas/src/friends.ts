import { z } from "zod";
import { userSchema } from "./users.js";

export const friendshipStatusSchema = z.enum(["PENDING", "ACCEPTED", "BLOCKED"]);

export const friendWithPresenceSchema = userSchema.extend({
  isOnline: z.boolean(),
});

export const friendsListResponseSchema = z.object({
  data: z.array(friendWithPresenceSchema),
});

export const friendshipSchema = z.object({
  id: z.uuid(),
  status: friendshipStatusSchema,
  requester: userSchema,
  addressee: userSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const sendFriendRequestSchema = z.object({
  addresseeId: z.uuid(),
});

export const respondFriendRequestSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export const blockUserRequestSchema = z.object({
  targetId: z.uuid(),
});

// Types
export type FriendWithPresence = z.infer<typeof friendWithPresenceSchema>;
export type FriendsListResponse = z.infer<typeof friendsListResponseSchema>;
export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>;
export type Friendship = z.infer<typeof friendshipSchema>;
export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>;
export type RespondFriendRequest = z.infer<typeof respondFriendRequestSchema>;
export type BlockUserRequest = z.infer<typeof blockUserRequestSchema>;
