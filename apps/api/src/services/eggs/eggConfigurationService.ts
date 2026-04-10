import { prisma } from '../../prisma/client.js';

/**
 * Return an egg configuration for the daemon.
 * Mirrors app/Services/Eggs/EggConfigurationService.php
 *
 * This service generates the configuration structure that Wings (the daemon)
 * uses to manage server startup, stop, and config file parsing.
 */

interface StartupConfig {
  done: string[];
  user_interaction: string[];
  strip_ansi: boolean;
}

interface StopConfig {
  type: 'command' | 'signal';
  value: string;
}

interface ConfigReplace {
  match: string;
  if_value?: string;
  replace_with: unknown;
}

interface ConfigEntry {
  parser: string;
  find: Record<string, unknown>;
  file: string;
  replace: ConfigReplace[];
}

function convertStartupToNewFormat(startup: Record<string, unknown>): StartupConfig {
  const done = startup.done;
  return {
    done: typeof done === 'string' ? [done] : (done as string[] ?? []),
    user_interaction: [],
    strip_ansi: (startup.strip_ansi as boolean) ?? false,
  };
}

function convertStopToNewFormat(stop: string): StopConfig {
  if (!stop.startsWith('^')) {
    return { type: 'command', value: stop };
  }
  return { type: 'signal', value: stop.substring(1).toUpperCase() };
}

function replaceLegacyModifiers(key: string, value: string): string {
  let replace: string;
  switch (key) {
    case 'config.docker.interface':
      replace = 'config.docker.network.interface';
      break;
    case 'server.build.env.SERVER_MEMORY':
    case 'env.SERVER_MEMORY':
      replace = 'server.build.memory';
      break;
    case 'server.build.env.SERVER_IP':
    case 'env.SERVER_IP':
      replace = 'server.build.default.ip';
      break;
    case 'server.build.env.SERVER_PORT':
    case 'env.SERVER_PORT':
      replace = 'server.build.default.port';
      break;
    default:
      replace = key;
  }
  return value.replace(`{{${key}}}`, `{{${replace}}}`);
}

function matchAndReplaceKeys(value: unknown, structure: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;

  const regex = /\{\{(?<key>[\w.\-]*)\}\}/g;
  let result = value;
  let match;

  while ((match = regex.exec(value)) !== null) {
    const key = match.groups?.key;
    if (!key) continue;

    if (!key.startsWith('server.') && !key.startsWith('env.') && !key.startsWith('config.')) {
      continue;
    }

    result = replaceLegacyModifiers(key, result as string);

    if (key.startsWith('config.')) continue;

    if (key.startsWith('server.')) {
      const lookupKey = key.replace(/^server\./, '');
      const plucked = getNestedValue(structure, lookupKey) ?? '';
      result = (result as string).replace(`{{${key}}}`, String(plucked));
      continue;
    }

    // env. prefix
    const envKey = key.replace(/^env\./, 'build.env.');
    const plucked = getNestedValue(structure, envKey) ?? '';
    result = (result as string).replace(`{{${key}}}`, String(plucked));
  }

  return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function iterate(data: unknown, structure: Record<string, unknown>): unknown {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return iterate(item, structure);
      }
      return matchAndReplaceKeys(item, structure);
    });
  }

  const clone: Record<string, unknown> = { ...data as Record<string, unknown> };
  for (const [key, value] of Object.entries(clone)) {
    if (typeof value === 'object' && value !== null) {
      clone[key] = iterate(value, structure);
    } else {
      clone[key] = matchAndReplaceKeys(value, structure);
    }
  }
  return clone;
}

/**
 * Build the egg configuration for a given server.
 * This is used by Wings to configure the server process.
 */
export async function getEggConfiguration(serverId: number): Promise<{
  startup: StartupConfig;
  stop: StopConfig;
  configs: ConfigEntry[];
}> {
  const server = await prisma.servers.findUniqueOrThrow({
    where: { id: serverId },
    include: {
      eggs: true,
      allocations: { where: { id: undefined } },
    },
  });

  const egg = server.eggs;
  if (!egg) {
    throw new Error('Server does not have an associated egg.');
  }

  // If the egg extends another, use the parent's config
  let configFiles = egg.config_files;
  let configStartup = egg.config_startup;
  let configStop = egg.config_stop ?? '';
  let configLogs = egg.config_logs;

  if (egg.config_from) {
    const parent = await prisma.eggs.findUnique({ where: { id: egg.config_from } });
    if (parent) {
      configFiles = configFiles ?? parent.config_files;
      configStartup = configStartup ?? parent.config_startup;
      configStop = configStop || parent.config_stop || '';
      configLogs = configLogs ?? parent.config_logs;
    }
  }

  const startupParsed = configStartup ? JSON.parse(configStartup) : { done: [] };
  const filesParsed = configFiles ? JSON.parse(configFiles) : {};

  // Build a basic structure for placeholder replacement
  const structure: Record<string, unknown> = {
    build: {
      memory: server.memory,
      default: {
        ip: '0.0.0.0',
        port: 0,
      },
      env: {},
    },
  };

  const configs: ConfigEntry[] = [];
  for (const [file, data] of Object.entries(filesParsed)) {
    if (!data || typeof data !== 'object' || !(data as any).find) {
      continue;
    }

    const entry: ConfigEntry = {
      ...(data as Record<string, unknown>),
      file,
      replace: [],
    } as unknown as ConfigEntry;

    const findData = iterate((data as any).find, structure);
    if (findData && typeof findData === 'object') {
      for (const [findKey, replaceValue] of Object.entries(findData as Record<string, unknown>)) {
        if (replaceValue && typeof replaceValue === 'object' && !Array.isArray(replaceValue)) {
          for (const [matchVal, replaceWith] of Object.entries(replaceValue as Record<string, unknown>)) {
            entry.replace.push({
              match: findKey,
              if_value: matchVal,
              replace_with: replaceWith,
            });
          }
        } else {
          entry.replace.push({
            match: findKey,
            replace_with: replaceValue,
          });
        }
      }
    }

    delete (entry as any).find;
    configs.push(entry);
  }

  return {
    startup: convertStartupToNewFormat(startupParsed),
    stop: convertStopToNewFormat(configStop),
    configs,
  };
}
