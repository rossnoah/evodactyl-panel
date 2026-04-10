import { prisma } from '../../../prisma/client.js';

/**
 * Update the install script for an egg.
 * Mirrors app/Services/Eggs/Scripts/InstallScriptService.php
 */
export async function updateInstallScript(eggId: number, data: {
  script_install?: string | null;
  script_entry?: string | null;
  script_container?: string | null;
  script_is_privileged?: boolean;
  copy_script_from?: number | null;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.script_install !== undefined) updateData.script_install = data.script_install;
  if (data.script_entry !== undefined) updateData.script_entry = data.script_entry;
  if (data.script_container !== undefined) updateData.script_container = data.script_container;
  if (data.script_is_privileged !== undefined) updateData.script_is_privileged = data.script_is_privileged;
  if (data.copy_script_from !== undefined) updateData.copy_script_from = data.copy_script_from;

  await prisma.eggs.update({
    where: { id: eggId },
    data: updateData,
  });
}
