import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../lib/password.js';

/**
 * Service for updating existing users.
 * Mirrors app/Services/Users/UserUpdateService.php
 */
export async function updateUser(
  user: any,
  data: Record<string, any>
): Promise<any> {
  const updateData: Record<string, any> = { ...data };

  // Hash password if provided, otherwise remove it from the update
  if (updateData.password && updateData.password.length > 0) {
    updateData.password = await hashPassword(updateData.password);
  } else {
    delete updateData.password;
  }

  // Remove any keys that shouldn't go directly to the database
  delete updateData.first_name;
  delete updateData.last_name;

  const updatedUser = await prisma.users.update({
    where: { id: user.id },
    data: {
      ...updateData,
      updated_at: new Date(),
    },
  });

  return updatedUser;
}
