import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const errorDetailSchema = z.object({
  field: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});

export const cursorPageSchema = z.object({
  nextCursor: z.string().optional(),
  prevCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export const offsetPageSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  hasMore: z.boolean(),
});

// Inferred types
export type ErrorDetail = z.infer<typeof errorDetailSchema>;
export type ApiError = z.infer<typeof errorSchema>;
export type CursorPage = z.infer<typeof cursorPageSchema>;
export type OffsetPage = z.infer<typeof offsetPageSchema>;
