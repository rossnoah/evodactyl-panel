import { prisma } from '../../../prisma/client.js';
import { DisplayException } from '../../../errors/index.js';

const RESERVED_ENV_NAMES = 'SERVER_MEMORY,SERVER_IP,SERVER_PORT,ENV,HOME,USER,STARTUP,SERVER_UUID,UUID';

/**
 * Update an existing egg variable.
 * Mirrors app/Services/Eggs/Variables/VariableUpdateService.php
 */
export async function updateVariable(variableId: number, eggId: number, data: {
  name?: string;
  description?: string;
  env_variable?: string;
  default_value?: string;
  user_viewable?: boolean;
  user_editable?: boolean;
  rules?: string;
}) {
  // Validate env_variable if provided
  if (data.env_variable != null) {
    const reserved = RESERVED_ENV_NAMES.split(',');
    if (reserved.includes(data.env_variable.toUpperCase())) {
      throw new DisplayException(
        `Cannot use the protected name ${data.env_variable} for this environment variable.`,
        422
      );
    }

    // Check uniqueness within the egg
    const existing = await prisma.egg_variables.count({
      where: {
        env_variable: data.env_variable,
        egg_id: eggId,
        NOT: { id: variableId },
      },
    });

    if (existing > 0) {
      throw new DisplayException(
        `The environment variable name ${data.env_variable} is already in use for this egg.`,
        422
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.env_variable !== undefined) updateData.env_variable = data.env_variable;
  if (data.default_value !== undefined) updateData.default_value = data.default_value;
  if (data.user_viewable !== undefined) updateData.user_viewable = data.user_viewable ? 1 : 0;
  if (data.user_editable !== undefined) updateData.user_editable = data.user_editable ? 1 : 0;
  if (data.rules !== undefined) updateData.rules = data.rules;

  await prisma.egg_variables.update({
    where: { id: variableId },
    data: updateData,
  });
}
