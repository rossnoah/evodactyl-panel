import { z } from 'zod';

export const createMountSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().optional().nullable(),
  source: z.string().min(1).max(191),
  target: z.string().min(1).max(191),
  read_only: z.boolean().optional().default(false),
  user_mountable: z.boolean().optional().default(false),
  eggs: z.array(z.number().int().positive()).optional(),
  nodes: z.array(z.number().int().positive()).optional(),
});

export const updateMountSchema = z.object({
  name: z.string().min(1).max(191).optional(),
  description: z.string().optional().nullable(),
  source: z.string().min(1).max(191).optional(),
  target: z.string().min(1).max(191).optional(),
  read_only: z.boolean().optional(),
  user_mountable: z.boolean().optional(),
  eggs: z.array(z.number().int().positive()).optional(),
  nodes: z.array(z.number().int().positive()).optional(),
});

export type CreateMountData = z.infer<typeof createMountSchema>;
export type UpdateMountData = z.infer<typeof updateMountSchema>;
