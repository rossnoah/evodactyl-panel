import { prisma } from '../../../prisma/client.js';
import { generateUuid } from '../../../lib/uuid.js';
import { DisplayException } from '../../../errors/index.js';

const SUPPORTED_VERSIONS = ['PTDL_v1', 'PTDL_v2'];
const EXPORT_VERSION = 'PTDL_v2';

/**
 * Parse and validate an egg JSON file.
 */
export function parseEggJson(content: string): Record<string, any> {
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new DisplayException('The provided file is not valid JSON.', 422);
  }

  const version = parsed.meta?.version;
  if (!version || !SUPPORTED_VERSIONS.includes(version)) {
    throw new DisplayException('The JSON file provided is not in a format that can be recognized.', 422);
  }

  // Convert v1 to v2 if needed
  if (version !== EXPORT_VERSION) {
    return convertToV2(parsed);
  }

  return parsed;
}

function convertToV2(parsed: Record<string, any>): Record<string, any> {
  let images: string[];
  if (!parsed.images) {
    images = [parsed.image ?? 'nil'];
  } else {
    images = parsed.images;
  }

  delete parsed.images;
  delete parsed.image;

  parsed.docker_images = {};
  for (const image of images) {
    parsed.docker_images[image] = image;
  }

  if (parsed.variables) {
    parsed.variables = parsed.variables.map((v: any) => ({
      ...v,
      field_type: 'text',
    }));
  }

  return parsed;
}

/**
 * Import an egg from a JSON string into a nest.
 * Mirrors app/Services/Eggs/Sharing/EggImporterService.php
 */
export async function importEgg(jsonContent: string, nestId: number) {
  const parsed = parseEggJson(jsonContent);

  // Verify the nest exists
  await prisma.nests.findUniqueOrThrow({ where: { id: nestId } });

  return prisma.$transaction(async (tx) => {
    const dockerImages = parsed.docker_images ?? {};
    const features = parsed.features ?? null;
    const fileDenylist = Array.isArray(parsed.file_denylist)
      ? parsed.file_denylist.filter((v: string) => v !== '')
      : [];

    const egg = await tx.eggs.create({
      data: {
        uuid: generateUuid(),
        nest_id: nestId,
        author: parsed.author ?? 'unknown@unknown.com',
        copy_script_from: null,
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

    // Create variables
    if (Array.isArray(parsed.variables)) {
      for (const variable of parsed.variables) {
        await tx.egg_variables.create({
          data: {
            egg_id: egg.id,
            name: variable.name ?? '',
            description: variable.description ?? '',
            env_variable: variable.env_variable ?? '',
            default_value: variable.default_value ?? '',
            user_viewable: variable.user_viewable ? 1 : 0,
            user_editable: variable.user_editable ? 1 : 0,
            rules: variable.rules ?? '',
          },
        });
      }
    }

    return egg;
  });
}
