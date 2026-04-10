import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ask, createPromptInterface, parseOptions } from '../prompt.js';

/**
 * Port of app/Console/Commands/Environment/AppSettingsCommand.php.
 * Ensures a .env file exists at the repository root with the minimal set of
 * values the panel needs to boot, including a freshly-generated APP_KEY.
 *
 * Usage: bun run cli environment:setup [--env=<path>] [--force]
 */
export async function environmentSetupCommand(args: string[]): Promise<number> {
  const options = parseOptions(args);
  const envPath = path.resolve(options.get('env') ?? '.env');
  const force = options.has('force');

  let existing: Record<string, string> = {};
  try {
    const contents = await fs.readFile(envPath, 'utf-8');
    existing = parseDotEnv(contents);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  if (existing['APP_KEY'] && !force) {
    console.log(`APP_KEY already present in ${envPath}; pass --force to regenerate.`);
  } else {
    existing['APP_KEY'] = `base64:${crypto.randomBytes(32).toString('base64')}`;
    console.log('Generated a new APP_KEY.');
  }

  const rl = createPromptInterface();
  try {
    existing['APP_URL'] =
      options.get('url') ??
      existing['APP_URL'] ??
      (await ask(rl, 'Panel URL', 'https://panel.example.com'));
    existing['APP_TIMEZONE'] =
      options.get('timezone') ??
      existing['APP_TIMEZONE'] ??
      (await ask(rl, 'Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone));
    existing['APP_ENV'] = existing['APP_ENV'] ?? 'production';
    existing['APP_DEBUG'] = existing['APP_DEBUG'] ?? 'false';
  } finally {
    rl.close();
  }

  await fs.writeFile(envPath, serializeDotEnv(existing) + '\n', { mode: 0o600 });
  console.log(`Wrote ${envPath}.`);
  return 0;
}

function parseDotEnv(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function serializeDotEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => {
      const needsQuotes = /[\s#"']/.test(v);
      return `${k}=${needsQuotes ? `"${v.replace(/"/g, '\\"')}"` : v}`;
    })
    .join('\n');
}
