import { z } from 'zod';

export const createDatabaseHostSchema = z.object({
  name: z.string().min(1).max(191),
  host: z.string().min(1).max(191),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1).max(191),
  password: z.string().min(1),
  node_id: z.number().int().positive().optional().nullable(),
});

export const updateDatabaseHostSchema = z.object({
  name: z.string().min(1).max(191).optional(),
  host: z.string().min(1).max(191).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).max(191).optional(),
  password: z.string().optional(),
  node_id: z.number().int().positive().optional().nullable(),
});

export type CreateDatabaseHostData = z.infer<typeof createDatabaseHostSchema>;
export type UpdateDatabaseHostData = z.infer<typeof updateDatabaseHostSchema>;
