/**
 * Mirror Test Runner
 *
 * Sends identical API requests to both PHP and TS backends,
 * compares responses, and optionally verifies database state.
 *
 * Usage: bun run tests/mirror/runner.ts [--php-url=...] [--ts-url=...]
 */

import mysql from 'mysql2/promise';

// --- Config ---
const args = process.argv.slice(2);
const getArg = (key: string, def: string) => args.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=') ?? def;

const PHP_URL = getArg('php-url', 'http://localhost:8080');
const TS_URL = getArg('ts-url', 'http://localhost:3000');
const PHP_DB_PORT = parseInt(getArg('php-db-port', '13306'));
const TS_DB_PORT = parseInt(getArg('ts-db-port', '13307'));

// Known tokens from seed.ts
const APP_TOKEN = 'mirrorAppToken00aaaabbbbccccddddeeeeffffgggghhhh';
const CLIENT_TOKEN = 'mirrorCliToken00iiiijjjjkkkkllllmmmmnnnnoooopppp';

// --- Types ---
interface Scenario {
  name: string;
  method: string;
  path: string;
  body?: Record<string, unknown>;
  token?: 'app' | 'client';
  dbCheck?: { table: string; where: string; field?: string; expected?: unknown };
  skipValueCompare?: boolean;
}

interface ApiResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

interface CompareResult {
  name: string;
  statusMatch: boolean;
  structureMatch: boolean;
  valueMatch: boolean;
  dbMatch: boolean | null;
  phpStatus: number;
  tsStatus: number;
  diffs: string[];
}

// --- Scenarios ---
const SCENARIOS: Scenario[] = [
  // Application API (read)
  { name: 'List users', method: 'GET', path: '/api/application/users' },
  { name: 'List users (paginated)', method: 'GET', path: '/api/application/users?per_page=2' },
  { name: 'Single user', method: 'GET', path: '/api/application/users/1' },
  { name: 'User with include=servers', method: 'GET', path: '/api/application/users/1?include=servers' },
  { name: 'List nodes', method: 'GET', path: '/api/application/nodes' },
  { name: 'Node with include=location', method: 'GET', path: '/api/application/nodes/1?include=location' },
  { name: 'Node configuration', method: 'GET', path: '/api/application/nodes/1/configuration' },
  { name: 'List locations', method: 'GET', path: '/api/application/locations' },
  { name: 'Single location', method: 'GET', path: '/api/application/locations/1' },
  { name: 'List nests', method: 'GET', path: '/api/application/nests' },
  { name: 'Nests with include=eggs', method: 'GET', path: '/api/application/nests?include=eggs' },
  { name: 'List servers', method: 'GET', path: '/api/application/servers' },
  { name: 'Single server', method: 'GET', path: '/api/application/servers/1' },
  { name: 'List allocations', method: 'GET', path: '/api/application/nodes/1/allocations' },

  // Client API (read)
  { name: 'Client: server list', method: 'GET', path: '/api/client', token: 'client' },
  { name: 'Client: permissions', method: 'GET', path: '/api/client/permissions', token: 'client' },
  { name: 'Client: account', method: 'GET', path: '/api/client/account', token: 'client' },
  { name: 'Client: API keys', method: 'GET', path: '/api/client/account/api-keys', token: 'client' },
  { name: 'Client: SSH keys', method: 'GET', path: '/api/client/account/ssh-keys', token: 'client' },

  // Error cases
  { name: 'Auth: no token', method: 'GET', path: '/api/application/users', token: undefined as any },
  { name: '404: nonexistent user', method: 'GET', path: '/api/application/users/99999' },

  // Write operations
  { name: 'Create location', method: 'POST', path: '/api/application/locations',
    body: { short: 'ap-south', long: 'Asia Pacific South' },
    dbCheck: { table: 'locations', where: "short = 'ap-south'" } },
  { name: 'Update location', method: 'PATCH', path: '/api/application/locations/1',
    body: { long: 'US East Coast (Updated)' },
    dbCheck: { table: 'locations', where: 'id = 1', field: 'long', expected: 'US East Coast (Updated)' } },
];

// --- HTTP ---
async function fetchEndpoint(baseUrl: string, scenario: Scenario): Promise<ApiResponse> {
  const url = `${baseUrl}${scenario.path}`;
  const tokenType = scenario.token ?? 'app';
  const token = tokenType === 'client' ? CLIENT_TOKEN : APP_TOKEN;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // The "no token" scenario
  if (scenario.name !== 'Auth: no token') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOpts: RequestInit = { method: scenario.method, headers };
  if (scenario.body && ['POST', 'PUT', 'PATCH'].includes(scenario.method)) {
    fetchOpts.body = JSON.stringify(scenario.body);
  }

  try {
    const res = await fetch(url, fetchOpts);
    let body: unknown;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { respHeaders[k] = v; });

    return { status: res.status, body, headers: respHeaders };
  } catch (err: any) {
    return { status: 0, body: { error: err.message }, headers: {} };
  }
}

// --- Deep comparison ---
function deepCompareStructure(a: unknown, b: unknown, path: string = '$'): string[] {
  const diffs: string[] = [];

  if (a === null && b === null) return diffs;
  if (a === undefined && b === undefined) return diffs;
  if (a === null && b !== null) { diffs.push(`${path}: PHP=null, TS=${typeof b}`); return diffs; }
  if (a !== null && b === null) { diffs.push(`${path}: PHP=${typeof a}, TS=null`); return diffs; }

  const typeA = Array.isArray(a) ? 'array' : typeof a;
  const typeB = Array.isArray(b) ? 'array' : typeof b;

  if (typeA !== typeB) {
    diffs.push(`${path}: type PHP=${typeA}, TS=${typeB}`);
    return diffs;
  }

  if (typeA === 'object' && a !== null && b !== null) {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = new Set(Object.keys(objA));
    const keysB = new Set(Object.keys(objB));

    for (const key of keysA) {
      if (!keysB.has(key)) diffs.push(`${path}.${key}: missing in TS`);
    }
    for (const key of keysB) {
      if (!keysA.has(key)) diffs.push(`${path}.${key}: extra in TS`);
    }
    for (const key of keysA) {
      if (keysB.has(key)) {
        diffs.push(...deepCompareStructure(objA[key], objB[key], `${path}.${key}`));
      }
    }
  }

  if (typeA === 'array') {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) {
      diffs.push(`${path}: array length PHP=${arrA.length}, TS=${arrB.length}`);
    }
    // Compare first element structure only
    if (arrA.length > 0 && arrB.length > 0) {
      diffs.push(...deepCompareStructure(arrA[0], arrB[0], `${path}[0]`));
    }
  }

  return diffs;
}

function compareValues(a: unknown, b: unknown, path: string = '$'): string[] {
  const diffs: string[] = [];
  if (typeof a !== typeof b) return [`${path}: type mismatch`];
  if (a === null || b === null) {
    if (a !== b) diffs.push(`${path}: PHP=${JSON.stringify(a)}, TS=${JSON.stringify(b)}`);
    return diffs;
  }
  if (typeof a === 'object' && !Array.isArray(a)) {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    for (const key of Object.keys(objA)) {
      if (key in objB) {
        // Skip non-deterministic values
        if (['updated_at', 'created_at', 'last_used_at', 'token'].includes(key)) continue;
        diffs.push(...compareValues(objA[key], objB[key], `${path}.${key}`));
      }
    }
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length > 0 && b.length > 0) {
      diffs.push(...compareValues(a[0], b[0], `${path}[0]`));
    }
  } else if (a !== b) {
    diffs.push(`${path}: PHP=${JSON.stringify(a)}, TS=${JSON.stringify(b)}`);
  }
  return diffs;
}

// --- DB comparison ---
async function compareDbState(
  phpPort: number,
  tsPort: number,
  check: NonNullable<Scenario['dbCheck']>
): Promise<{ match: boolean; diffs: string[] }> {
  const diffs: string[] = [];

  const phpConn = await mysql.createConnection({
    host: '127.0.0.1', port: phpPort, user: 'root', password: 'secret', database: 'panel', ssl: false,
  } as any);
  const tsConn = await mysql.createConnection({
    host: '127.0.0.1', port: tsPort, user: 'root', password: 'secret', database: 'panel', ssl: false,
  } as any);

  const [phpRows] = await phpConn.query(`SELECT * FROM ${check.table} WHERE ${check.where}`) as any;
  const [tsRows] = await tsConn.query(`SELECT * FROM ${check.table} WHERE ${check.where}`) as any;

  if (phpRows.length !== tsRows.length) {
    diffs.push(`DB ${check.table}: row count PHP=${phpRows.length}, TS=${tsRows.length}`);
  }

  if (check.field && check.expected !== undefined) {
    const phpVal = phpRows[0]?.[check.field];
    const tsVal = tsRows[0]?.[check.field];
    if (phpVal !== check.expected) diffs.push(`DB PHP ${check.table}.${check.field}: expected ${check.expected}, got ${phpVal}`);
    if (tsVal !== check.expected) diffs.push(`DB TS ${check.table}.${check.field}: expected ${check.expected}, got ${tsVal}`);
  }

  await phpConn.end();
  await tsConn.end();

  return { match: diffs.length === 0, diffs };
}

// --- Main ---
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║         Mirror Test: PHP ↔ TS Comparison         ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  PHP: ${PHP_URL.padEnd(42)} ║`);
  console.log(`║  TS:  ${TS_URL.padEnd(42)} ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  let passed = 0;
  let failed = 0;
  const results: CompareResult[] = [];

  for (const scenario of SCENARIOS) {
    const [phpRes, tsRes] = await Promise.all([
      fetchEndpoint(PHP_URL, scenario),
      fetchEndpoint(TS_URL, scenario),
    ]);

    const statusMatch = phpRes.status === tsRes.status;
    const structDiffs = deepCompareStructure(phpRes.body, tsRes.body);
    const structureMatch = structDiffs.length === 0;
    const valueDiffs = statusMatch ? compareValues(phpRes.body, tsRes.body) : [];
    const valueMatch = valueDiffs.length === 0;

    let dbMatch: boolean | null = null;
    let dbDiffs: string[] = [];
    if (scenario.dbCheck && statusMatch) {
      const dbResult = await compareDbState(PHP_DB_PORT, TS_DB_PORT, scenario.dbCheck);
      dbMatch = dbResult.match;
      dbDiffs = dbResult.diffs;
    }

    const allDiffs = [...structDiffs.slice(0, 5), ...valueDiffs.slice(0, 3), ...dbDiffs];
    const allPass = statusMatch && structureMatch && valueMatch && (dbMatch === null || dbMatch);

    const result: CompareResult = {
      name: scenario.name,
      statusMatch, structureMatch, valueMatch, dbMatch,
      phpStatus: phpRes.status, tsStatus: tsRes.status,
      diffs: allDiffs,
    };
    results.push(result);

    if (allPass) {
      const dbInfo = dbMatch !== null ? ', db: match' : '';
      console.log(`  ✓ ${scenario.name} — ${phpRes.status}/${tsRes.status}${dbInfo}`);
      passed++;
    } else {
      const parts = [];
      if (!statusMatch) parts.push(`status: ${phpRes.status}/${tsRes.status}`);
      if (!structureMatch) parts.push(`structure: DIFF`);
      if (!valueMatch) parts.push(`values: DIFF`);
      if (dbMatch === false) parts.push(`db: DIFF`);
      console.log(`  ✗ ${scenario.name} — ${parts.join(', ')}`);
      for (const diff of allDiffs.slice(0, 5)) {
        console.log(`      ${diff}`);
      }
      if (allDiffs.length > 5) {
        console.log(`      ... and ${allDiffs.length - 5} more`);
      }
      failed++;
    }
  }

  console.log(`\n  ═══════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${SCENARIOS.length} scenarios`);
  console.log(`  ═══════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Runner failed:', err);
  process.exit(1);
});
