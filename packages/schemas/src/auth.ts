import { z } from "zod";

import { userSchema } from "./users";

export const registerRequestSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
});

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});

export const friendRequestActionSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export const googleCompleteRequestSchema = z.object({
  token: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  avatarUrl: z.string().url().optional(),
});

// Types
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type FriendRequestAction = z.infer<typeof friendRequestActionSchema>;
export type GoogleCompleteRequest = z.infer<typeof googleCompleteRequestSchema>;
