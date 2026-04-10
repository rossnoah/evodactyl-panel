/**
 * Mirror Test Database Seeder
 *
 * Seeds both PHP and TS MySQL databases with identical data.
 * Uses mysql2 directly to avoid any framework-specific issues.
 *
 * Usage: bun run tests/mirror/seed.ts [--php-db-port=3306] [--ts-db-port=3306]
 */

import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const APP_KEY_RAW = Buffer.from('MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', 'base64');
const HASHIDS_SALT = 'mirror_test_salt_2026';

// --- Laravel-compatible encryption ---
function laravelEncrypt(value: string): string {
  const iv = crypto.randomBytes(16);
  const serialized = `s:${Buffer.byteLength(value)}:"${value}";`;
  const cipher = crypto.createCipheriv('aes-256-cbc', APP_KEY_RAW, iv);
  let encrypted = cipher.update(serialized, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const ivBase64 = iv.toString('base64');
  const hmac = crypto.createHmac('sha256', APP_KEY_RAW);
  hmac.update(ivBase64 + encrypted);
  const mac = hmac.digest('hex');
  const payload = JSON.stringify({ iv: ivBase64, value: encrypted, mac, tag: '' });
  return Buffer.from(payload).toString('base64');
}

// --- Bcrypt a password ---
import bcrypt from 'bcryptjs';
const HASHED_PASSWORD = bcrypt.hashSync('password', 10);

// --- Config ---
interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function getArgs() {
  const args = process.argv.slice(2);
  const get = (key: string, def: string) => args.find(a => a.startsWith(`--${key}=`))?.split('=')[1] ?? def;
  return {
    phpHost: get('php-db-host', '127.0.0.1'),
    phpPort: parseInt(get('php-db-port', '13306')),
    tsHost: get('ts-db-host', '127.0.0.1'),
    tsPort: parseInt(get('ts-db-port', '13307')),
  };
}

async function connectDb(config: DbConfig): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true,
    ssl: false,
  } as any);
}

async function loadSchema(conn: mysql.Connection): Promise<void> {
  const schemaPath = path.resolve(import.meta.dir, '../../../database/schema/mysql-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await conn.query(schema);
  console.log('  Schema loaded');

  // Populate migrations table so PHP doesn't try to re-run them
  const migrationsDir = path.resolve(import.meta.dir, '../../../database/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.php'));
  if (files.length > 0) {
    const values = files.map(f => `('${f.replace('.php', '')}', 1)`).join(',');
    await conn.query(`INSERT INTO migrations (migration, batch) VALUES ${values}`);
  }
  console.log(`  Migrations table populated (${files.length} entries)`);
}

async function seedData(conn: mysql.Connection): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // --- Users ---
  await conn.query(`INSERT INTO users (id, uuid, username, email, name_first, name_last, password, language, root_admin, use_totp, gravatar, created_at, updated_at) VALUES
    (1, '11111111-1111-1111-1111-111111111111', 'admin', 'admin@mirror.test', 'Admin', 'User', ?, 'en', 1, 0, 1, ?, ?),
    (2, '22222222-2222-2222-2222-222222222222', 'testuser', 'user@mirror.test', 'Test', 'User', ?, 'en', 0, 0, 0, ?, ?),
    (3, '33333333-3333-3333-3333-333333333333', 'thirduser', 'third@mirror.test', 'Third', 'Person', ?, 'en', 0, 0, 1, ?, ?)
  `, [HASHED_PASSWORD, now, now, HASHED_PASSWORD, now, now, HASHED_PASSWORD, now, now]);
  console.log('  Users seeded (3)');

  // --- Locations ---
  await conn.query(`INSERT INTO locations (id, \`short\`, \`long\`, created_at, updated_at) VALUES
    (1, 'us-east', 'US East Coast', ?, ?),
    (2, 'eu-west', 'EU West', ?, ?)
  `, [now, now, now, now]);
  console.log('  Locations seeded (2)');

  // --- Nodes ---
  const daemonToken1 = crypto.randomBytes(32).toString('hex');
  const daemonToken2 = crypto.randomBytes(32).toString('hex');

  await conn.query(`INSERT INTO nodes (id, uuid, public, name, description, location_id, fqdn, scheme, behind_proxy, maintenance_mode, memory, memory_overallocate, disk, disk_overallocate, upload_size, daemon_token_id, daemon_token, daemonListen, daemonSFTP, daemonBase, created_at, updated_at) VALUES
    (1, '44444444-4444-4444-4444-444444444444', 1, 'Node US-1', 'Primary US node', 1, 'node1.mirror.test', 'https', 0, 0, 8192, 0, 50000, 0, 100, 'mirror_token_id1', ?, 8080, 2022, '/var/lib/pterodactyl/volumes', ?, ?),
    (2, '55555555-5555-5555-5555-555555555555', 1, 'Node EU-1', 'Primary EU node', 2, 'node2.mirror.test', 'https', 0, 0, 16384, 10, 100000, 10, 200, 'mirror_token_id2', ?, 8080, 2022, '/var/lib/pterodactyl/volumes', ?, ?)
  `, [laravelEncrypt(daemonToken1), now, now, laravelEncrypt(daemonToken2), now, now]);
  console.log('  Nodes seeded (2)');

  // --- Allocations ---
  const allocValues: string[] = [];
  const allocParams: any[] = [];
  let allocId = 1;
  for (let port = 25565; port <= 25569; port++) {
    allocValues.push(`(${allocId++}, 1, '0.0.0.0', ${port}, NULL, NULL, ?, ?)`);
    allocParams.push(now, now);
  }
  for (let port = 25565; port <= 25569; port++) {
    allocValues.push(`(${allocId++}, 2, '0.0.0.0', ${port}, NULL, NULL, ?, ?)`);
    allocParams.push(now, now);
  }
  await conn.query(`INSERT INTO allocations (id, node_id, ip, port, server_id, notes, created_at, updated_at) VALUES ${allocValues.join(',')}`, allocParams);
  console.log('  Allocations seeded (10)');

  // --- Nests ---
  await conn.query(`INSERT INTO nests (id, uuid, author, name, description, created_at, updated_at) VALUES
    (1, '66666666-6666-6666-6666-666666666666', 'support@pterodactyl.io', 'Minecraft', 'Minecraft game servers', ?, ?),
    (2, '77777777-7777-7777-7777-777777777777', 'support@pterodactyl.io', 'Rust', 'Rust game servers', ?, ?)
  `, [now, now, now, now]);
  console.log('  Nests seeded (2)');

  // --- Eggs ---
  await conn.query(`INSERT INTO eggs (id, uuid, nest_id, author, name, description, docker_images, startup, config_files, config_startup, config_logs, config_stop, created_at, updated_at) VALUES
    (1, '88888888-8888-8888-8888-888888888881', 1, 'support@pterodactyl.io', 'Vanilla Minecraft', 'Standard Minecraft server', '{"Java 17":"ghcr.io/pterodactyl/yolks:java_17"}', 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar', '{}', '{"done":"Done"}', '{}', 'stop', ?, ?),
    (2, '88888888-8888-8888-8888-888888888882', 1, 'support@pterodactyl.io', 'Paper', 'Paper Minecraft server', '{"Java 17":"ghcr.io/pterodactyl/yolks:java_17"}', 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar', '{}', '{"done":"Done"}', '{}', 'stop', ?, ?),
    (3, '88888888-8888-8888-8888-888888888883', 2, 'support@pterodactyl.io', 'Rust', 'Rust game server', '{"Rust":"ghcr.io/pterodactyl/games:rust"}', './RustDedicated -batchmode', '{}', '{"done":"Ready"}', '{}', 'quit', ?, ?)
  `, [now, now, now, now, now, now]);
  console.log('  Eggs seeded (3)');

  // --- Egg Variables ---
  await conn.query(`INSERT INTO egg_variables (id, egg_id, name, description, env_variable, default_value, user_viewable, user_editable, rules, created_at, updated_at) VALUES
    (1, 1, 'Server Version', 'Minecraft version', 'MINECRAFT_VERSION', 'latest', 1, 1, 'required|string', ?, ?),
    (2, 1, 'Server JAR', 'Server JAR file', 'SERVER_JARFILE', 'server.jar', 1, 1, 'required|string', ?, ?)
  `, [now, now, now, now]);
  console.log('  Egg variables seeded (2)');

  // --- Server ---
  await conn.query(`INSERT INTO servers (id, uuid, uuidShort, node_id, name, description, status, skip_scripts, owner_id, memory, swap, disk, io, cpu, oom_disabled, allocation_id, nest_id, egg_id, startup, image, database_limit, allocation_limit, backup_limit, created_at, updated_at) VALUES
    (1, '99999999-9999-9999-9999-999999999999', '99999999', 1, 'Test MC Server', 'A test Minecraft server', NULL, 0, 1, 1024, 0, 5000, 500, 100, 0, 1, 1, 1, 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar', 'ghcr.io/pterodactyl/yolks:java_17', 2, 3, 5, ?, ?)
  `, [now, now]);
  // Assign allocation to server
  await conn.query(`UPDATE allocations SET server_id = 1 WHERE id = 1`);
  console.log('  Server seeded (1)');

  // --- API Keys ---
  // Application key (type 2): identifier = 'mirrorAppToken00', plaintext = 'aaaabbbbccccddddeeeeffffgggghhhh'
  const appIdentifier = 'mirrorAppToken00';
  const appPlainToken = 'aaaabbbbccccddddeeeeffffgggghhhh';
  await conn.query(`INSERT INTO api_keys (id, user_id, key_type, identifier, token, memo, r_servers, r_nodes, r_allocations, r_users, r_locations, r_nests, r_eggs, r_database_hosts, r_server_databases, created_at, updated_at) VALUES
    (1, 1, 2, ?, ?, 'Mirror test app key', 3, 3, 3, 3, 3, 3, 3, 3, 3, ?, ?)
  `, [appIdentifier, laravelEncrypt(appPlainToken), now, now]);

  // Client key (type 1): identifier = 'mirrorCliToken00', plaintext = 'iiiijjjjkkkkllllmmmmnnnnoooopppp'
  const clientIdentifier = 'mirrorCliToken00';
  const clientPlainToken = 'iiiijjjjkkkkllllmmmmnnnnoooopppp';
  await conn.query(`INSERT INTO api_keys (id, user_id, key_type, identifier, token, memo, created_at, updated_at) VALUES
    (2, 1, 1, ?, ?, 'Mirror test client key', ?, ?)
  `, [clientIdentifier, laravelEncrypt(clientPlainToken), now, now]);

  console.log('  API keys seeded (2)');
  console.log(`    APP_TOKEN=${appIdentifier}${appPlainToken}`);
  console.log(`    CLIENT_TOKEN=${clientIdentifier}${clientPlainToken}`);
}

async function verifyRowCounts(phpConn: mysql.Connection, tsConn: mysql.Connection): Promise<boolean> {
  const tables = ['users', 'locations', 'nodes', 'allocations', 'nests', 'eggs', 'egg_variables', 'servers', 'api_keys'];
  let allMatch = true;

  for (const table of tables) {
    const [phpRows] = await phpConn.query(`SELECT COUNT(*) as cnt FROM ${table}`) as any;
    const [tsRows] = await tsConn.query(`SELECT COUNT(*) as cnt FROM ${table}`) as any;
    const phpCount = phpRows[0].cnt;
    const tsCount = tsRows[0].cnt;

    if (phpCount !== tsCount) {
      console.log(`  ✗ ${table}: PHP=${phpCount}, TS=${tsCount}`);
      allMatch = false;
    } else {
      console.log(`  ✓ ${table}: ${phpCount} rows`);
    }
  }
  return allMatch;
}

// --- Main ---
async function main() {
  const args = getArgs();

  const phpConfig: DbConfig = { host: args.phpHost, port: args.phpPort, user: 'root', password: 'secret', database: 'panel' };
  const tsConfig: DbConfig = { host: args.tsHost, port: args.tsPort, user: 'root', password: 'secret', database: 'panel' };

  console.log(`\nConnecting to PHP MySQL (${phpConfig.host}:${phpConfig.port})...`);
  const phpConn = await connectDb(phpConfig);

  console.log(`Connecting to TS MySQL (${tsConfig.host}:${tsConfig.port})...`);
  const tsConn = await connectDb(tsConfig);

  console.log('\n--- Seeding PHP database ---');
  await loadSchema(phpConn);
  await seedData(phpConn);

  console.log('\n--- Seeding TS database ---');
  await loadSchema(tsConn);
  await seedData(tsConn);

  console.log('\n--- Verifying row counts match ---');
  const match = await verifyRowCounts(phpConn, tsConn);

  await phpConn.end();
  await tsConn.end();

  if (match) {
    console.log('\n✓ Both databases seeded identically.\n');
  } else {
    console.log('\n✗ Row count mismatch!\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
