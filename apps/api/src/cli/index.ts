#!/usr/bin/env bun
import { makeUserCommand } from './commands/userMake.js';
import { deleteUserCommand } from './commands/userDelete.js';
import { environmentSetupCommand } from './commands/environmentSetup.js';
import { seedCommand } from './commands/seed.js';

type Command = {
  name: string;
  description: string;
  run: (args: string[]) => Promise<number>;
};

const COMMANDS: Command[] = [
  {
    name: 'user:make',
    description: 'Create a user on the panel.',
    run: makeUserCommand,
  },
  {
    name: 'user:delete',
    description: 'Delete a user by id, email, or username.',
    run: deleteUserCommand,
  },
  {
    name: 'environment:setup',
    description: 'Generate an APP_KEY and scaffold a .env file.',
    run: environmentSetupCommand,
  },
  {
    name: 'seed',
    description: 'Seed default nests and imported eggs.',
    run: seedCommand,
  },
];

function printUsage(): void {
  console.log('Usage: bun run cli <command> [options]');
  console.log('');
  console.log('Available commands:');
  for (const command of COMMANDS) {
    console.log(`  ${command.name.padEnd(24)} ${command.description}`);
  }
}

const [commandName, ...commandArgs] = process.argv.slice(2);

if (!commandName || commandName === '--help' || commandName === '-h') {
  printUsage();
  process.exit(commandName ? 0 : 1);
}

const command = COMMANDS.find((c) => c.name === commandName);
if (!command) {
  console.error(`Unknown command: ${commandName}`);
  printUsage();
  process.exit(1);
}

try {
  const exitCode = await command.run(commandArgs);
  process.exit(exitCode);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
