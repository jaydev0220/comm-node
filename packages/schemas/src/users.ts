import { z } from "zod";

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.url().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const updateUserRequestSchema = z
  .object({
    displayName: z.string().min(1).max(64).optional(),
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9_]+$/)
      .optional(),
    avatarUrl: z.url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const userSearchParamsSchema = z.object({
  q: z.string().min(1).max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Types
export type User = z.infer<typeof userSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type UserSearchParams = z.infer<typeof userSearchParamsSchema>;
