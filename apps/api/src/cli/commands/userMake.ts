import { createUser } from '../../services/users/userCreationService.js';
import {
  ask,
  askSecret,
  confirm,
  createPromptInterface,
  parseOptions,
} from '../prompt.js';

/**
 * Port of app/Console/Commands/User/MakeUserCommand.php.
 * Usage: bun run cli user:make [--email=] [--username=] [--name-first=]
 *        [--name-last=] [--password=] [--admin=true|false] [--no-password]
 */
export async function makeUserCommand(args: string[]): Promise<number> {
  const options = parseOptions(args);
  const rl = createPromptInterface();

  try {
    const adminOpt = options.get('admin');
    const rootAdmin =
      adminOpt !== undefined
        ? adminOpt === 'true' || adminOpt === '1'
        : await confirm(rl, 'Is this user an administrator?', false);

    const email = options.get('email') ?? (await ask(rl, 'Email address'));
    const username = options.get('username') ?? (await ask(rl, 'Username'));
    const nameFirst =
      options.get('name-first') ?? (await ask(rl, 'First name'));
    const nameLast = options.get('name-last') ?? (await ask(rl, 'Last name'));

    let password: string | undefined = options.get('password');
    if (password === undefined && !options.has('no-password')) {
      console.warn(
        'Password must be at least 8 characters long and contain upper, lower, and a number.'
      );
      console.log('Leave blank and pass --no-password to send a reset email instead.');
      password = await askSecret('Password');
      if (!password) password = undefined;
    }

    if (!email || !username || !nameFirst || !nameLast) {
      console.error('email, username, name-first, and name-last are all required.');
      return 1;
    }

    const user = await createUser({
      email,
      username,
      name_first: nameFirst,
      name_last: nameLast,
      password,
      root_admin: rootAdmin,
    });

    console.table([
      { Field: 'UUID', Value: user.uuid },
      { Field: 'Email', Value: user.email },
      { Field: 'Username', Value: user.username },
      { Field: 'Name', Value: `${user.name_first} ${user.name_last}` },
      { Field: 'Admin', Value: user.root_admin ? 'Yes' : 'No' },
    ]);
    return 0;
  } finally {
    rl.close();
  }
}
