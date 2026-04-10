import { prisma } from '../../prisma/client.js';

/**
 * Retrieve all settings as a key-value object.
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * Upsert multiple settings at once.
 */
export async function updateSettings(data: Record<string, string>): Promise<void> {
  const operations = Object.entries(data).map(([key, value]) =>
    prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  );

  await prisma.$transaction(operations);
}
