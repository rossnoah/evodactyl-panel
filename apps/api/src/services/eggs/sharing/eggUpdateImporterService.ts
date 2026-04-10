import { prisma } from '../../../prisma/client.js';
import { parseEggJson } from './eggImporterService.js';

/**
 * Update an existing egg using an imported JSON file.
 * Mirrors app/Services/Eggs/Sharing/EggUpdateImporterService.php
 */
export async function updateEggFromImport(eggId: number, jsonContent: string) {
  const parsed = parseEggJson(jsonContent);

  await prisma.eggs.findUniqueOrThrow({ where: { id: eggId } });

  return prisma.$transaction(async (tx) => {
    const dockerImages = parsed.docker_images ?? {};
    const features = parsed.features ?? null;
    const fileDenylist = Array.isArray(parsed.file_denylist)
      ? parsed.file_denylist.filter((v: string) => v !== '')
      : [];

    await tx.eggs.update({
      where: { id: eggId },
      data: {
        author: parsed.author ?? 'unknown@unknown.com',
        name: parsed.name,
        description: parsed.description ?? null,
        features: features ? JSON.stringify(features) : null,
        docker_images: JSON.stringify(dockerImages),
        file_denylist: JSON.stringify(fileDenylist),
        update_url: parsed.meta?.update_url ?? null,
        config_files: typeof parsed.config?.files === 'string'
          ? parsed.config.files
          : JSON.stringify(parsed.config?.files ?? null),
        config_startup: typeof parsed.config?.startup === 'string'
          ? parsed.config.startup
          : JSON.stringify(parsed.config?.startup ?? null),
        config_logs: typeof parsed.config?.logs === 'string'
          ? parsed.config.logs
          : JSON.stringify(parsed.config?.logs ?? null),
        config_stop: parsed.config?.stop ?? null,
        startup: parsed.startup ?? '',
        script_install: parsed.scripts?.installation?.script ?? null,
        script_entry: parsed.scripts?.installation?.entrypoint ?? 'bash',
        script_container: parsed.scripts?.installation?.container ?? 'alpine:3.4',
      },
    });

    // Upsert variables — match by env_variable, same as PHP's updateOrCreate
    const importedEnvVars: string[] = [];
    if (Array.isArray(parsed.variables)) {
      for (const variable of parsed.variables) {
        const envVar = variable.env_variable ?? '';
        importedEnvVars.push(envVar);

        const existing = await tx.egg_variables.findFirst({
          where: { egg_id: eggId, env_variable: envVar },
        });

        const data = {
          name: variable.name ?? '',
          description: variable.description ?? '',
          default_value: variable.default_value ?? '',
          user_viewable: variable.user_viewable ? 1 : 0,
          user_editable: variable.user_editable ? 1 : 0,
          rules: variable.rules ?? '',
        };

        if (existing) {
          await tx.egg_variables.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await tx.egg_variables.create({
            data: {
              egg_id: eggId,
              env_variable: envVar,
              ...data,
            },
          });
        }
      }
    }

    // Delete variables not present in the import
    await tx.egg_variables.deleteMany({
      where: {
        egg_id: eggId,
        env_variable: { notIn: importedEnvVars },
      },
    });

    return tx.eggs.findUniqueOrThrow({ where: { id: eggId } });
  });
}
