import { z } from 'zod';

export const updateEggScriptSchema = z.object({
  script_install: z.string().optional().nullable(),
  script_entry: z.string().max(191).optional().nullable(),
  script_container: z.string().max(191).optional().nullable(),
  script_is_privileged: z.boolean().optional(),
  copy_script_from: z.number().int().positive().optional().nullable(),
});

export type UpdateEggScriptData = z.infer<typeof updateEggScriptSchema>;
