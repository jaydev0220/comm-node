import { z } from "zod";
import { userSchema } from "./users.js";

export const participantRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const participantSchema = z.object({
  user: userSchema,
  role: participantRoleSchema,
  joinedAt: z.string().datetime(),
});

export const addParticipantRequestSchema = z.object({
  userId: z.string().uuid(),
});

// Note: Can only assign ADMIN or MEMBER via API, not OWNER
export const updateParticipantRoleRequestSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

// Types
export type ParticipantRole = z.infer<typeof participantRoleSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type AddParticipantRequest = z.infer<typeof addParticipantRequestSchema>;
export type UpdateParticipantRoleRequest = z.infer<typeof updateParticipantRoleRequestSchema>;
