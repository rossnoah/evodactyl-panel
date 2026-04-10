#!/usr/bin/env bun
/**
 * Captures API response snapshots from a running Pterodactyl backend.
 *
 * Fetches each endpoint and saves the response (body, status, headers)
 * as JSON files in the output directory. These snapshots can later be
 * compared against the TS backend's responses.
 *
 * Usage:
 *   bun run tests/compatibility/captureSnapshots.ts \
 *     --url=http://localhost:8080 \
 *     --token=<api_token> \
 *     --output=tests/compatibility/snapshots/
 *
 * Options:
 *   --url      Base URL of the backend to capture from (default: http://localhost:8080)
 *   --token    Bearer token for API authentication (required)
 *   --output   Directory to write snapshot files (default: tests/compatibility/snapshots/)
 *   --client-token   Separate token for client API if different from application token
 *   --help     Show this help message
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

interface EndpointDef {
  method: string;
  path: string;
  name: string;
  /** Use client token instead of application token */
  isClient?: boolean;
}

const ENDPOINTS: EndpointDef[] = [
  // Application API
  { method: 'GET', path: '/api/application/users', name: 'application-users-list' },
  { method: 'GET', path: '/api/application/users?per_page=2', name: 'application-users-list-paginated' },
  { method: 'GET', path: '/api/application/nodes', name: 'application-nodes-list' },
  { method: 'GET', path: '/api/application/nodes?include=location', name: 'application-nodes-list-include-location' },
  { method: 'GET', path: '/api/application/locations', name: 'application-locations-list' },
  { method: 'GET', path: '/api/application/locations?include=nodes', name: 'application-locations-list-include-nodes' },
  { method: 'GET', path: '/api/application/nests', name: 'application-nests-list' },
  { method: 'GET', path: '/api/application/nests?include=eggs', name: 'application-nests-list-include-eggs' },

  // Client API
  { method: 'GET', path: '/api/client', name: 'client-servers-list', isClient: true },
  { method: 'GET', path: '/api/client/account', name: 'client-account', isClient: true },
  { method: 'GET', path: '/api/client/permissions', name: 'client-permissions', isClient: true },
  { method: 'GET', path: '/api/client/account/api-keys', name: 'client-api-keys', isClient: true },
  { method: 'GET', path: '/api/client/account/ssh-keys', name: 'client-ssh-keys', isClient: true },
];

interface SnapshotResult {
  endpoint: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  capturedAt: string;
}

function parseArgs(argv: string[]): {
  url: string;
  token: string | null;
  clientToken: string | null;
  output: string;
  help: boolean;
} {
  const result = {
    url: 'http://localhost:8080',
    token: null as string | null,
    clientToken: null as string | null,
    output: 'tests/compatibility/snapshots/',
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg.startsWith('--url=')) {
      result.url = arg.slice('--url='.length);
    } else if (arg.startsWith('--token=')) {
      result.token = arg.slice('--token='.length);
    } else if (arg.startsWith('--client-token=')) {
      result.clientToken = arg.slice('--client-token='.length);
    } else if (arg.startsWith('--output=')) {
      result.output = arg.slice('--output='.length);
    }
  }

  return result;
}

async function captureEndpoint(
  baseUrl: string,
  method: string,
  path: string,
  token: string,
): Promise<SnapshotResult> {
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  let body: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  // Collect response headers
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    endpoint: `${method} ${path}`,
    method,
    status: response.status,
    headers,
    body,
    capturedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Capture API response snapshots from a running Pterodactyl backend.

Usage:
  bun run tests/compatibility/captureSnapshots.ts [options]

Options:
  --url=<url>              Base URL (default: http://localhost:8080)
  --token=<token>          Bearer token for application API (required)
  --client-token=<token>   Bearer token for client API (defaults to --token)
  --output=<dir>           Output directory (default: tests/compatibility/snapshots/)
  --help                   Show this help message
`);
    process.exit(0);
  }

  if (!args.token) {
    console.error(
      'Error: --token is required.\n\n' +
        'Usage: bun run tests/compatibility/captureSnapshots.ts --token=<api_token> [--url=...] [--output=...]',
    );
    process.exit(1);
  }

  const outputDir = resolve(args.output);
  mkdirSync(outputDir, { recursive: true });

  const clientToken = args.clientToken ?? args.token;

  console.log(`\nCapturing API snapshots:`);
  console.log(`  Backend URL:  ${args.url}`);
  console.log(`  Output dir:   ${outputDir}`);
  console.log(`  Endpoints:    ${ENDPOINTS.length}\n`);

  let succeeded = 0;
  let failed = 0;

  for (const endpoint of ENDPOINTS) {
    const token = endpoint.isClient ? clientToken : args.token;

    try {
      const result = await captureEndpoint(args.url, endpoint.method, endpoint.path, token);

      const filePath = join(outputDir, `${endpoint.name}.json`);
      writeFileSync(filePath, JSON.stringify(result, null, 2) + '\n');

      const icon = result.status >= 200 && result.status < 400 ? 'OK' : `${result.status}`;
      console.log(`  [${icon}] ${result.endpoint} -> ${endpoint.name}.json`);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  [ERR] ${endpoint.method} ${endpoint.path} -> ${message}`);
      failed++;
    }
  }

  console.log(`\n  Done: ${succeeded} captured, ${failed} failed\n`);

  // Write an index file listing all captured endpoints
  const index = {
    capturedAt: new Date().toISOString(),
    backendUrl: args.url,
    endpoints: ENDPOINTS.map((e) => ({
      name: e.name,
      method: e.method,
      path: e.path,
      file: `${e.name}.json`,
    })),
  };

  writeFileSync(join(outputDir, '_index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`  Index written to ${join(outputDir, '_index.json')}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
