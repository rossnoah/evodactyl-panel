import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../prisma/client.js';
import { generateUuid } from '../../lib/uuid.js';
import { importEgg } from '../../services/eggs/sharing/eggImporterService.js';
import { updateEggFromImport } from '../../services/eggs/sharing/eggUpdateImporterService.js';

const DEFAULT_AUTHOR = 'support@pterodactyl.io';

/**
 * Port of database/Seeders/DatabaseSeeder.php + NestSeeder.php + EggSeeder.php.
 *
 * Usage: bun run cli seed [--only=nests|eggs] [--eggs-dir=<path>]
 *
 * Default eggs directory is packages/db/prisma/seed-data/eggs (relative to the
 * repo root). Caller can override via --eggs-dir for tests or custom setups.
 */
export async function seedCommand(args: string[]): Promise<number> {
  const only = getOption(args, '--only');
  const eggsDir =
    getOption(args, '--eggs-dir') ??
    path.resolve(
      fileURLToPath(import.meta.url),
      '../../../../../packages/db/prisma/seed-data/eggs'
    );

  if (!only || only === 'nests') {
    await seedNests();
  }
  if (!only || only === 'eggs') {
    await seedEggs(eggsDir);
  }
  return 0;
}

const NESTS: Array<{ name: string; description: string }> = [
  {
    name: 'Minecraft',
    description:
      'Minecraft - the classic game from Mojang. With support for Vanilla MC, Spigot, and many others!',
  },
  {
    name: 'Source Engine',
    description: 'Includes support for most Source Dedicated Server games.',
  },
  {
    name: 'Voice Servers',
    description: 'Voice servers such as Mumble and Teamspeak 3.',
  },
  {
    name: 'Rust',
    description: 'Rust - A game where you must fight to survive.',
  },
];

async function seedNests(): Promise<void> {
  console.log('Seeding nests…');
  for (const nest of NESTS) {
    const existing = await prisma.nests.findFirst({
      where: { author: DEFAULT_AUTHOR, name: nest.name },
    });
    if (existing) {
      console.log(`  skip ${nest.name} (already present)`);
      continue;
    }
    await prisma.nests.create({
      data: {
        uuid: generateUuid(),
        author: DEFAULT_AUTHOR,
        name: nest.name,
        description: nest.description,
      },
    });
    console.log(`  + ${nest.name}`);
  }
}

/**
 * Convert a nest name like "Source Engine" to the directory slug used in the
 * egg fixtures (`source-engine`). Mirrors Laravel's `kebab_case` helper.
 */
function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

async function seedEggs(eggsDir: string): Promise<void> {
  console.log(`Seeding eggs from ${eggsDir}…`);

  for (const nestName of NESTS.map((n) => n.name)) {
    const nest = await prisma.nests.findFirst({
      where: { author: DEFAULT_AUTHOR, name: nestName },
    });
    if (!nest) {
      console.warn(`  nest "${nestName}" not found, skipping egg import`);
      continue;
    }

    const dir = path.join(eggsDir, kebabCase(nestName));
    let files: string[];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    } catch {
      console.warn(`  no egg fixtures found at ${dir}`);
      continue;
    }

    console.log(`  [${nestName}] ${files.length} egg fixtures`);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const json = await fs.readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(json);

      const existing = await prisma.eggs.findFirst({
        where: {
          nest_id: nest.id,
          author: parsed.author ?? DEFAULT_AUTHOR,
          name: parsed.name,
        },
      });

      if (existing) {
        await updateEggFromImport(existing.id, json);
        console.log(`    ~ updated ${parsed.name}`);
      } else {
        await importEgg(json, nest.id);
        console.log(`    + created ${parsed.name}`);
      }
    }
  }
}

function getOption(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === flag) return args[i + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
}
