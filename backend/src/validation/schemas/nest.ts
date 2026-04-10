import { z } from 'zod';

export const createNestSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().optional().nullable(),
});

export const updateNestSchema = z.object({
  name: z.string().min(1).max(191).optional(),
  description: z.string().optional().nullable(),
});

export type CreateNestData = z.infer<typeof createNestSchema>;
export type UpdateNestData = z.infer<typeof updateNestSchema>;
