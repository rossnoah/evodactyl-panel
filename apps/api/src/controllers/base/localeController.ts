import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const LANG_PATH = path.resolve(import.meta.dir, '../../../..', 'resources', 'lang');

/**
 * Simple PHP translation file parser.
 * Handles basic `'key' => 'value'` and nested arrays.
 * Not a full PHP parser — handles the specific format used in Pterodactyl translation files.
 */
function parsePhpTranslationFile(filePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract the array content between `return [` and `];`
    const match = content.match(/return\s*\[([\s\S]*)\];/);
    if (!match) return {};

    // Simple recursive parser for PHP arrays
    return parsePhpArray(match[1]);
  } catch {
    return {};
  }
}

function parsePhpArray(input: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Match 'key' => 'value' or 'key' => [...] patterns
  const regex = /['"]([^'"]+)['"]\s*=>\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(\[[\s\S]*?\]))/g;

  let match;
  while ((match = regex.exec(input)) !== null) {
    const key = match[1];
    if (match[2] !== undefined) {
      // Single-quoted string — convert Laravel :param to {{param}}
      result[key] = match[2]
        .replace(/\\'/g, "'")
        .replace(/:([\w.-]+\w)([^\w:]?|$)/g, '{{$1}}$2');
    } else if (match[3] !== undefined) {
      // Double-quoted string
      result[key] = match[3]
        .replace(/\\"/g, '"')
        .replace(/:([\w.-]+\w)([^\w:]?|$)/g, '{{$1}}$2');
    } else if (match[4]) {
      // Nested array
      result[key] = parsePhpArray(match[4].slice(1, -1));
    }
  }

  return result;
}

/**
 * Load all translation files for a locale and namespace.
 * Mirrors Laravel's translation loader.
 */
function loadTranslations(locale: string, namespace: string): Record<string, unknown> {
  const langDir = path.join(LANG_PATH, locale);
  if (!fs.existsSync(langDir)) return {};

  // If namespace is '*' or 'translation', load all files
  if (namespace === '*' || namespace === 'translation') {
    const result: Record<string, unknown> = {};
    const files = fs.readdirSync(langDir, { recursive: true }) as string[];

    for (const file of files) {
      if (!String(file).endsWith('.php')) continue;
      const filePath = path.join(langDir, String(file));
      const key = String(file).replace(/\.php$/, '').replace(/\//g, '.');
      result[key] = parsePhpTranslationFile(filePath);
    }

    return result;
  }

  // Load specific namespace file
  const filePath = path.join(langDir, `${namespace}.php`);
  return parsePhpTranslationFile(filePath);
}

// Cache translations
const cache = new Map<string, { data: Record<string, unknown>; etag: string }>();

/**
 * GET /locales/locale.json
 * Returns translations for the requested locale and namespace.
 */
export function serveLocale(req: Request, res: Response): void {
  const locale = (req.query.locale as string) || 'en';
  const namespace = (req.query.namespace as string) || 'translation';
  const cacheKey = `${locale}:${namespace}`;

  let entry = cache.get(cacheKey);
  if (!entry) {
    const translations = loadTranslations(locale, namespace);
    const response: Record<string, unknown> = {};
    response[locale] = {};
    (response[locale] as Record<string, unknown>)[namespace] = translations;

    const etag = crypto.createHash('md5').update(JSON.stringify(response)).digest('hex');
    entry = { data: response, etag };
    cache.set(cacheKey, entry);
  }

  // Check If-None-Match
  if (req.headers['if-none-match'] === entry.etag) {
    res.status(304).end();
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.setHeader('ETag', entry.etag);
  res.json(entry.data);
}
