import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

/**
 * Parses --flag=value and --flag value style options. Returns a Map with
 * option names (without the leading --) as keys. Flags without values map
 * to the string "true".
 */
export function parseOptions(args: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith('--')) continue;

    const eq = arg.indexOf('=');
    if (eq >= 0) {
      result.set(arg.slice(2, eq), arg.slice(eq + 1));
    } else {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result.set(arg.slice(2), next);
        i++;
      } else {
        result.set(arg.slice(2), 'true');
      }
    }
  }
  return result;
}

export async function ask(
  rl: readline.Interface,
  question: string,
  defaultValue?: string
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || defaultValue || '';
}

export async function confirm(
  rl: readline.Interface,
  question: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = (await rl.question(`${question} ${suffix}: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === 'y' || answer === 'yes';
}

/**
 * Reads a secret from stdin with echo disabled. Falls back to plain input
 * if stdin is not a TTY (e.g. piped input in CI).
 */
export async function askSecret(
  question: string
): Promise<string> {
  if (!stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      return (await rl.question(`${question}: `)).trim();
    } finally {
      rl.close();
    }
  }

  return new Promise((resolve) => {
    stdout.write(`${question}: `);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    const onData = (char: string) => {
      switch (char) {
        case '\u0004': // Ctrl-D
        case '\r':
        case '\n':
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(input);
          break;
        case '\u0003': // Ctrl-C
          stdout.write('\n');
          process.exit(130);
          break;
        case '\u007f': // Backspace
          input = input.slice(0, -1);
          break;
        default:
          input += char;
      }
    };
    stdin.on('data', onData);
  });
}

export function createPromptInterface(): readline.Interface {
  return readline.createInterface({ input: stdin, output: stdout });
}
