/**
 * API Response Compatibility Tester
 *
 * Sends identical HTTP requests to both the PHP (Laravel) and TypeScript (Express)
 * backends, then diffs the JSON responses to verify behavioral compatibility.
 *
 * Usage:
 *   bun run tests/compatibility/responseComparer.ts \
 *     --php-url=http://localhost:8080 \
 *     --ts-url=http://localhost:3000 \
 *     --token=<api_token>
 */

interface ComparisonResult {
  endpoint: string;
  method: string;
  phpStatus: number;
  tsStatus: number;
  statusMatch: boolean;
  structureMatch: boolean;
  differences: string[];
}

const ENDPOINTS = [
  // Application API (uses --token, type 2 application key)
  { method: 'GET', path: '/api/application/users', client: false },
  { method: 'GET', path: '/api/application/users?per_page=2', client: false },
  { method: 'GET', path: '/api/application/nodes', client: false },
  { method: 'GET', path: '/api/application/nodes?include=location', client: false },
  { method: 'GET', path: '/api/application/locations', client: false },
  { method: 'GET', path: '/api/application/nests', client: false },
  { method: 'GET', path: '/api/application/nests?include=eggs', client: false },

  // Client API (uses --client-token, type 1 account key)
  { method: 'GET', path: '/api/client', client: true },
  { method: 'GET', path: '/api/client/permissions', client: true },
  { method: 'GET', path: '/api/client/account', client: true },
  { method: 'GET', path: '/api/client/account/api-keys', client: true },
  { method: 'GET', path: '/api/client/account/ssh-keys', client: true },
];

function deepCompareStructure(
  phpVal: unknown,
  tsVal: unknown,
  path: string = '$'
): string[] {
  const diffs: string[] = [];

  if (phpVal === null && tsVal === null) return diffs;
  if (phpVal === undefined && tsVal === undefined) return diffs;

  // Type mismatch
  const phpType = Array.isArray(phpVal) ? 'array' : typeof phpVal;
  const tsType = Array.isArray(tsVal) ? 'array' : typeof tsVal;

  if (phpType !== tsType) {
    diffs.push(`${path}: type mismatch (php=${phpType}, ts=${tsType})`);
    return diffs;
  }

  if (phpType === 'object' && phpVal !== null && tsVal !== null) {
    const phpObj = phpVal as Record<string, unknown>;
    const tsObj = tsVal as Record<string, unknown>;

    // Check for missing keys
    const phpKeys = new Set(Object.keys(phpObj));
    const tsKeys = new Set(Object.keys(tsObj));

    for (const key of phpKeys) {
      if (!tsKeys.has(key)) {
        diffs.push(`${path}.${key}: missing in TS response`);
      }
    }
    for (const key of tsKeys) {
      if (!phpKeys.has(key)) {
        diffs.push(`${path}.${key}: extra in TS response`);
      }
    }

    // Recurse into shared keys
    for (const key of phpKeys) {
      if (tsKeys.has(key)) {
        diffs.push(...deepCompareStructure(phpObj[key], tsObj[key], `${path}.${key}`));
      }
    }
  }

  if (phpType === 'array') {
    const phpArr = phpVal as unknown[];
    const tsArr = tsVal as unknown[];

    if (phpArr.length !== tsArr.length) {
      diffs.push(`${path}: array length mismatch (php=${phpArr.length}, ts=${tsArr.length})`);
    }

    // Compare first element structure if both non-empty
    if (phpArr.length > 0 && tsArr.length > 0) {
      diffs.push(...deepCompareStructure(phpArr[0], tsArr[0], `${path}[0]`));
    }
  }

  return diffs;
}

async function fetchEndpoint(
  baseUrl: string,
  method: string,
  path: string,
  token: string
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }

  return { status: res.status, body };
}

async function compareEndpoint(
  phpUrl: string,
  tsUrl: string,
  token: string,
  method: string,
  path: string
): Promise<ComparisonResult> {
  const [phpRes, tsRes] = await Promise.all([
    fetchEndpoint(phpUrl, method, path, token),
    fetchEndpoint(tsUrl, method, path, token),
  ]);

  const differences = deepCompareStructure(phpRes.body, tsRes.body);

  return {
    endpoint: `${method} ${path}`,
    method,
    phpStatus: phpRes.status,
    tsStatus: tsRes.status,
    statusMatch: phpRes.status === tsRes.status,
    structureMatch: differences.length === 0,
    differences,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const phpUrl = args.find(a => a.startsWith('--php-url='))?.split('=')[1] ?? 'http://localhost:8080';
  const tsUrl = args.find(a => a.startsWith('--ts-url='))?.split('=')[1] ?? 'http://localhost:3000';
  const token = args.find(a => a.startsWith('--token='))?.split('=')[1];
  const clientToken = args.find(a => a.startsWith('--client-token='))?.split('=').slice(1).join('=');

  if (!token) {
    console.error('Usage: bun run tests/compatibility/responseComparer.ts --token=<app_token> --client-token=<client_token> [--php-url=...] [--ts-url=...]');
    process.exit(1);
  }

  console.log(`\nComparing API responses:`);
  console.log(`  PHP backend:  ${phpUrl}`);
  console.log(`  TS backend:   ${tsUrl}\n`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const endpoint of ENDPOINTS) {
    const useToken = endpoint.client ? clientToken : token;
    if (!useToken) {
      console.log(`  - ${endpoint.method} ${endpoint.path} — SKIPPED (no ${endpoint.client ? 'client' : 'app'} token)`);
      skipped++;
      continue;
    }
    const result = await compareEndpoint(phpUrl, tsUrl, useToken, endpoint.method, endpoint.path);

    const statusIcon = result.statusMatch ? '✓' : '✗';
    const structIcon = result.structureMatch ? '✓' : '✗';

    if (result.statusMatch && result.structureMatch) {
      console.log(`  ${statusIcon} ${result.endpoint} — status: ${result.phpStatus}/${result.tsStatus}, structure: match`);
      passed++;
    } else {
      console.log(`  ${statusIcon} ${result.endpoint} — status: ${result.phpStatus}/${result.tsStatus}, structure: ${structIcon}`);
      if (result.differences.length > 0) {
        for (const diff of result.differences.slice(0, 5)) {
          console.log(`      ${diff}`);
        }
        if (result.differences.length > 5) {
          console.log(`      ... and ${result.differences.length - 5} more differences`);
        }
      }
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${skipped} skipped out of ${ENDPOINTS.length} endpoints\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
