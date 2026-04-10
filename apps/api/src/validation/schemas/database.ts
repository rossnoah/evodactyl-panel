import { z } from 'zod';

export const createServerDatabaseSchema = z.object({
  database: z.string().min(1).max(48),
  remote: z.string().min(1).max(191).default('%'),
  database_host_id: z.number().int().positive(),
  max_connections: z.number().int().min(0).optional().nullable().default(0),
});

export const createClientDatabaseSchema = z.object({
  database: z.string().min(1).max(48).regex(/^[\w-]+$/, {
    message: 'Database name must only contain alphanumeric characters, dashes, and underscores.',
  }),
  remote: z.string().min(1).max(191).default('%'),
});

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

export type CreateServerDatabaseData = z.infer<typeof createServerDatabaseSchema>;
export type CreateClientDatabaseData = z.infer<typeof createClientDatabaseSchema>;
export type CreateDatabaseHostData = z.infer<typeof createDatabaseHostSchema>;
export type UpdateDatabaseHostData = z.infer<typeof updateDatabaseHostSchema>;
