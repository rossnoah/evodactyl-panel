import { prisma } from '../../../prisma/client.js';

const EXPORT_VERSION = 'PTDL_v2';

/**
 * Export an egg to JSON format.
 * Mirrors app/Services/Eggs/Sharing/EggExporterService.php
 */
export async function exportEgg(eggId: number): Promise<string> {
  const egg = await prisma.eggs.findUniqueOrThrow({
    where: { id: eggId },
    include: { egg_variables: true },
  });

  // Resolve inherited config if extending another egg
  let configFiles = egg.config_files;
  let configStartup = egg.config_startup;
  let configLogs = egg.config_logs;
  let configStop = egg.config_stop;
  let scriptInstall = egg.script_install;
  let scriptContainer = egg.script_container;
  let scriptEntry = egg.script_entry;
  let fileDenylist: string[] = [];

  if (egg.config_from) {
    const parent = await prisma.eggs.findUnique({ where: { id: egg.config_from } });
    if (parent) {
      configFiles = configFiles ?? parent.config_files;
      configStartup = configStartup ?? parent.config_startup;
      configLogs = configLogs ?? parent.config_logs;
      configStop = configStop ?? parent.config_stop;
    }
  }

  if (egg.copy_script_from) {
    const scriptParent = await prisma.eggs.findUnique({ where: { id: egg.copy_script_from } });
    if (scriptParent) {
      scriptInstall = egg.script_install ?? scriptParent.script_install;
      scriptEntry = egg.script_entry ?? scriptParent.script_entry;
      scriptContainer = egg.script_container ?? scriptParent.script_container;
    }
  }

  try {
    const parsed = typeof egg.file_denylist === 'string'
      ? JSON.parse(egg.file_denylist)
      : (egg.file_denylist ?? []);
    fileDenylist = (Array.isArray(parsed) ? parsed : []).filter((v: string) => v !== '');
  } catch {
    fileDenylist = [];
  }

  const dockerImages = typeof egg.docker_images === 'string'
    ? JSON.parse(egg.docker_images)
    : (egg.docker_images ?? {});

  const features = typeof egg.features === 'string'
    ? JSON.parse(egg.features)
    : (egg.features ?? null);

  const variables = (egg.egg_variables ?? []).map((variable: any) => ({
    name: variable.name,
    description: variable.description,
    env_variable: variable.env_variable,
    default_value: variable.default_value,
    user_viewable: Boolean(variable.user_viewable),
    user_editable: Boolean(variable.user_editable),
    rules: variable.rules,
    field_type: 'text',
  }));

  const struct = {
    _comment: 'DO NOT EDIT: FILE GENERATED AUTOMATICALLY BY PTERODACTYL PANEL - PTERODACTYL.IO',
    meta: {
      version: EXPORT_VERSION,
      update_url: (egg as any).update_url ?? null,
    },
    exported_at: new Date().toISOString(),
    name: egg.name,
    author: egg.author,
    description: egg.description,
    features,
    docker_images: dockerImages,
    file_denylist: fileDenylist,
    startup: egg.startup,
    config: {
      files: configFiles,
      startup: configStartup,
      logs: configLogs,
      stop: configStop,
    },
    scripts: {
      installation: {
        script: scriptInstall,
        container: scriptContainer,
        entrypoint: scriptEntry,
      },
    },
    variables,
  };

  return JSON.stringify(struct, null, 4);
}
