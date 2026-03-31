import { z } from "zod";

export const searchTypeSchema = z.enum(["messages", "users"]);

export const searchParamsSchema = z.object({
  q: z.string().min(1).max(200),
  type: searchTypeSchema,
  chatId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Types
export type SearchType = z.infer<typeof searchTypeSchema>;
export type SearchParams = z.infer<typeof searchParamsSchema>;
