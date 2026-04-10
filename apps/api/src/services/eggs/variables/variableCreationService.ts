import { prisma } from '../../../prisma/client.js';
import { DisplayException } from '../../../errors/index.js';

const RESERVED_ENV_NAMES = 'SERVER_MEMORY,SERVER_IP,SERVER_PORT,ENV,HOME,USER,STARTUP,SERVER_UUID,UUID';

/**
 * Create a new variable for a given egg.
 * Mirrors app/Services/Eggs/Variables/VariableCreationService.php
 */
export async function createVariable(eggId: number, data: {
  name: string;
  description?: string;
  env_variable: string;
  default_value?: string;
  user_viewable?: boolean;
  user_editable?: boolean;
  rules?: string;
}) {
  const reserved = RESERVED_ENV_NAMES.split(',');
  if (reserved.includes(data.env_variable.toUpperCase())) {
    throw new DisplayException(
      `Cannot use the protected name ${data.env_variable} for this environment variable.`,
      422
    );
  }

  return prisma.egg_variables.create({
    data: {
      egg_id: eggId,
      name: data.name,
      description: data.description ?? '',
      env_variable: data.env_variable,
      default_value: data.default_value ?? '',
      user_viewable: data.user_viewable ? 1 : 0,
      user_editable: data.user_editable ? 1 : 0,
      rules: data.rules ?? '',
    },
  });
}
