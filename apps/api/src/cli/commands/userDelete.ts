import { prisma } from '../../prisma/client.js';
import { deleteUser } from '../../services/users/userDeletionService.js';
import { ask, confirm, createPromptInterface, parseOptions } from '../prompt.js';

/**
 * Port of app/Console/Commands/User/DeleteUserCommand.php.
 * Usage: bun run cli user:delete [--user=<email|username|id>]
 */
export async function deleteUserCommand(args: string[]): Promise<number> {
  const options = parseOptions(args);
  const rl = createPromptInterface();

  try {
    const interactive = process.stdin.isTTY === true;
    const search =
      options.get('user') ?? (await ask(rl, 'Search for a user (email, username, or id)'));

    if (!search) {
      console.error('A search term is required.');
      return 1;
    }

    const searchAsNumber = Number(search);
    const results = await prisma.users.findMany({
      where: {
        OR: [
          ...(Number.isFinite(searchAsNumber) ? [{ id: searchAsNumber }] : []),
          { username: { startsWith: search } },
          { email: { startsWith: search } },
        ],
      },
      take: 20,
    });

    if (results.length === 0) {
      console.error('No users matched that search.');
      return 1;
    }

    let victim = results[0]!;
    if (results.length > 1) {
      if (!interactive) {
        console.error(
          `Multiple users matched (${results.length}). Re-run interactively or pass a more specific --user value.`
        );
        return 1;
      }
      console.table(
        results.map((u) => ({
          ID: u.id,
          Email: u.email,
          Name: `${u.name_first ?? ''} ${u.name_last ?? ''}`.trim(),
        }))
      );
      const choice = await ask(rl, 'ID of user to delete');
      const chosen = results.find((u) => String(u.id) === choice);
      if (!chosen) {
        console.error('Invalid selection.');
        return 1;
      }
      victim = chosen;
    }

    if (
      interactive &&
      !(await confirm(rl, `Really delete user "${victim.email}"?`, false))
    ) {
      console.log('Cancelled.');
      return 0;
    }

    await deleteUser(victim);
    console.log(`Deleted user ${victim.email}.`);
    return 0;
  } finally {
    rl.close();
  }
}
