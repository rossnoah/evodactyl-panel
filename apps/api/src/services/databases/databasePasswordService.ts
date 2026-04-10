import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { encrypt, decrypt } from '../../lib/encryption.js';

/**
 * Generate a random string with special characters.
 */
function randomStringWithSpecialCharacters(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Create a dynamic MySQL connection to a database host.
 */
async function createHostConnection(hostId: number): Promise<mysql.Connection> {
  const host = await prisma.database_hosts.findUniqueOrThrow({
    where: { id: hostId },
  });

  return mysql.createConnection({
    host: host.host,
    port: host.port,
    user: host.username,
    password: decrypt(host.password),
  });
}

/**
 * Rotate the password for a database.
 * Mirrors app/Services/Databases/DatabasePasswordService.php
 */
export async function rotatePassword(database: {
  id: number;
  database_host_id: number;
  database: string;
  username: string;
  remote: string;
  max_connections: number | null;
}): Promise<string> {
  const password = randomStringWithSpecialCharacters(24);

  // Update the password in the panel database
  await prisma.databases.update({
    where: { id: database.id },
    data: {
      password: encrypt(password),
    },
  });

  // Update on the database host
  let connection: mysql.Connection | null = null;
  try {
    connection = await createHostConnection(database.database_host_id);

    // Drop and recreate the user with the new password
    await connection.execute(
      `DROP USER IF EXISTS \`${database.username}\`@\`${database.remote}\``
    );

    let createSql = `CREATE USER \`${database.username}\`@\`${database.remote}\` IDENTIFIED BY ?`;
    if (database.max_connections && database.max_connections > 0) {
      createSql += ` WITH MAX_USER_CONNECTIONS ${database.max_connections}`;
    }
    await connection.execute(createSql, [password]);

    await connection.execute(
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, REFERENCES, INDEX, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, CREATE TEMPORARY TABLES, CREATE VIEW, SHOW VIEW, EVENT, TRIGGER ON \`${database.database}\`.* TO \`${database.username}\`@\`${database.remote}\``
    );

    await connection.execute('FLUSH PRIVILEGES');
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }

  return password;
}
