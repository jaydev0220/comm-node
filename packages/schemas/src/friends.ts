import { z } from "zod";
import { userSchema } from "./users.js";

export const friendshipStatusSchema = z.enum(["PENDING", "ACCEPTED", "BLOCKED"]);

export const friendshipSchema = z.object({
  id: z.string().uuid(),
  status: friendshipStatusSchema,
  requester: userSchema,
  addressee: userSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sendFriendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
});

export const respondFriendRequestSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export const blockUserRequestSchema = z.object({
  targetId: z.string().uuid(),
});

// Types
export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>;
export type Friendship = z.infer<typeof friendshipSchema>;
export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>;
export type RespondFriendRequest = z.infer<typeof respondFriendRequestSchema>;
export type BlockUserRequest = z.infer<typeof blockUserRequestSchema>;
