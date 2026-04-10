import { z } from 'zod';

export const createEggSchema = z.object({
  nest_id: z.number().int().positive(),
  name: z.string().min(1).max(191),
  description: z.string().optional().nullable(),
  docker_images: z.record(z.string(), z.string()).refine(obj => Object.keys(obj).length > 0, {
    message: 'At least one docker image is required',
  }),
  startup: z.string().min(1),
  config_from: z.number().int().positive().optional().nullable(),
  config_stop: z.string().max(191).optional().nullable(),
  config_startup: z.string().optional().nullable(),
  config_logs: z.string().optional().nullable(),
  config_files: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  file_denylist: z.array(z.string()).optional().nullable(),
  force_outgoing_ip: z.boolean().optional(),
});

export const updateEggSchema = z.object({
  name: z.string().min(1).max(191).optional(),
  description: z.string().optional().nullable(),
  docker_images: z.record(z.string(), z.string()).optional(),
  startup: z.string().optional(),
  config_from: z.number().int().positive().optional().nullable(),
  config_stop: z.string().max(191).optional().nullable(),
  config_startup: z.string().optional().nullable(),
  config_logs: z.string().optional().nullable(),
  config_files: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  force_outgoing_ip: z.boolean().optional(),
});

export const createEggVariableSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().optional().default(''),
  env_variable: z.string().min(1).max(191).regex(/^[\w]{1,191}$/),
  default_value: z.string().optional().default(''),
  user_viewable: z.boolean().optional().default(false),
  user_editable: z.boolean().optional().default(false),
  rules: z.string().optional().default(''),
});

export const updateEggVariableSchema = z.object({
  name: z.string().min(1).max(191).optional(),
  description: z.string().optional(),
  env_variable: z.string().min(1).max(191).regex(/^[\w]{1,191}$/).optional(),
  default_value: z.string().optional(),
  user_viewable: z.boolean().optional(),
  user_editable: z.boolean().optional(),
  rules: z.string().optional(),
});

export type CreateEggData = z.infer<typeof createEggSchema>;
export type UpdateEggData = z.infer<typeof updateEggSchema>;
export type CreateEggVariableData = z.infer<typeof createEggVariableSchema>;
export type UpdateEggVariableData = z.infer<typeof updateEggVariableSchema>;
