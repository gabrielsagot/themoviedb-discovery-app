import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_DATABASE_PATH = '/tmp/movies-default.sqlite';

const closeMock = vi.fn();
const getDatabaseMock = vi.fn(() => ({
  close: closeMock,
}));

vi.mock('./database/schema.ts', () => ({
  DEFAULT_DATABASE_PATH,
  getDatabase: getDatabaseMock,
}));

/**
 * Executes the backend CLI with the specified command-line arguments
 * @param args The command-line arguments to pass to the CLI
 */
async function runCliWithArgs(args: string[]): Promise<void> {
  const originalArgv = process.argv;
  process.argv = ['node', 'src/back-end/backend-cli.ts', ...args];
  try {
    await import('./backend-cli.ts');
  } finally {
    process.argv = originalArgv;
  }
}

describe('backend-cli.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  /**
   * Runs the CLI with the given arguments and checks that it created the
   * database at the expected path, closed it and reported its location.
   * @param args The command-line arguments to pass to the CLI.
   * @param expectedPath The database path the CLI is expected to use.
   */
  async function expectDatabaseCreated(
    args: string[],
    expectedPath: string,
  ): Promise<void> {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCliWithArgs(args);

      expect(getDatabaseMock).toHaveBeenCalledOnce();
      expect(getDatabaseMock).toHaveBeenCalledWith(expectedPath);
      expect(closeMock).toHaveBeenCalledOnce();
      expect(logSpy).toHaveBeenCalledWith(
        `Database available at ${resolve(expectedPath)}`,
      );
    } finally {
      logSpy.mockRestore();
    }
  }

  const customDatabasePath = './data/custom-movies.sqlite';

  describe('without a command', () => {
    it('creates and initializes the default database', async () => {
      await expectDatabaseCreated([], DEFAULT_DATABASE_PATH);
    });

    it('creates and initializes the database passed in --path', async () => {
      await expectDatabaseCreated(
        ['--path', customDatabasePath],
        customDatabasePath,
      );
    });

    it('accepts the short -p option', async () => {
      await expectDatabaseCreated(
        ['-p', customDatabasePath],
        customDatabasePath,
      );
    });
  });

  describe('create-database', () => {
    it('uses the default database path when no path option is given', async () => {
      await expectDatabaseCreated(['create-database'], DEFAULT_DATABASE_PATH);
    });

    it('uses the path passed in --path after the command', async () => {
      await expectDatabaseCreated(
        ['create-database', '--path', customDatabasePath],
        customDatabasePath,
      );
    });

    it('uses the path passed in --path before the command', async () => {
      await expectDatabaseCreated(
        ['--path', customDatabasePath, 'create-database'],
        customDatabasePath,
      );
    });
  });
});
