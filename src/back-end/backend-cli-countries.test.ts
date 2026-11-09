import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listCountries, upsertCountries } from './database/country-repository';
import { getDatabase } from './database/schema';

/**
 * Integration tests of the country commands: unlike backend-cli.test.ts, the
 * database layer is not mocked, so every command runs against a real SQLite
 * file in a temporary directory.
 */

/**
 * Executes the backend CLI with the specified command-line arguments. The
 * module registry is reset first so that every call re-evaluates the CLI,
 * even when a test runs it several times.
 * @param args The command-line arguments to pass to the CLI.
 */
async function runCliWithArgs(args: string[]): Promise<void> {
  vi.resetModules();
  const originalArgv = process.argv;
  process.argv = ['node', 'src/back-end/backend-cli.ts', ...args];
  try {
    await import('./backend-cli.ts');
  } finally {
    process.argv = originalArgv;
  }
}

/**
 * Reads the countries stored in a database file, then closes it.
 * @param databasePath The path to the SQLite database file.
 * @returns The stored countries, sorted by code.
 */
function readStoredCountries(databasePath: string) {
  const database = getDatabase(databasePath);
  try {
    return listCountries(database);
  } finally {
    database.close();
  }
}

describe('backend-cli.ts country commands', () => {
  let directory: string;
  let databasePath: string;
  let logSpy: MockInstance<typeof console.log>;
  let errorSpy: MockInstance<typeof console.error>;
  let closeSpy: MockInstance<DatabaseSync['close']>;

  /**
   * Writes a CSV document in the temporary directory.
   * @param name The file name.
   * @param content The CSV document.
   * @returns The path to the file.
   */
  function writeCsv(name: string, content: string): string {
    const filePath = join(directory, name);
    writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'backend-cli-countries-'));
    databasePath = join(directory, 'movies.sqlite');
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  describe('add-countries', () => {
    it('imports the countries into the database selected by --path', async () => {
      const csvFile = writeCsv(
        'countries.csv',
        'code,name\nFR,France\nBE,Belgique\n',
      );

      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      expect(readStoredCountries(databasePath)).toEqual([
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
      ]);
      expect(logSpy).toHaveBeenCalledWith(
        `Imported 2 countries into ${resolve(databasePath)}`,
      );
      expect(process.exitCode).toBeUndefined();
    });

    it('accepts --path after the command and its argument', async () => {
      const csvFile = writeCsv('countries.csv', 'code,name\nFR,France\n');

      await runCliWithArgs(['add-countries', csvFile, '--path', databasePath]);

      expect(readStoredCountries(databasePath)).toEqual([
        { code: 'FR', name: 'France' },
      ]);
      expect(logSpy).toHaveBeenCalledWith(
        `Imported 1 country into ${resolve(databasePath)}`,
      );
    });

    it('imports into the default database when --path is omitted', async () => {
      const originalCwd = process.cwd();
      process.chdir(directory);
      try {
        const csvFile = writeCsv('countries.csv', 'code,name\nFR,France\n');

        await runCliWithArgs(['add-countries', csvFile]);

        const defaultPath = join(directory, 'data', 'movies.sqlite');
        expect(readStoredCountries(defaultPath)).toEqual([
          { code: 'FR', name: 'France' },
        ]);
        expect(logSpy).toHaveBeenCalledWith(
          `Imported 1 country into ${resolve(defaultPath)}`,
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('updates existing countries without creating duplicates', async () => {
      const csvFile = writeCsv(
        'countries.csv',
        'code,name\nUS,United States of America\nFR,France\n',
      );
      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      const updatedCsvFile = writeCsv(
        'countries-fr.csv',
        'code,name\nUS,United States\nUS,États-Unis\n',
      );
      await runCliWithArgs([
        '--path',
        databasePath,
        'add-countries',
        updatedCsvFile,
      ]);

      expect(readStoredCountries(databasePath)).toEqual([
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'États-Unis' },
      ]);
      // A repeated code counts as one imported country
      expect(logSpy).toHaveBeenLastCalledWith(
        `Imported 1 country into ${resolve(databasePath)}`,
      );
    });

    it('reports 0 countries for a CSV with only the header', async () => {
      const csvFile = writeCsv('countries.csv', 'code,name\n');

      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      expect(readStoredCountries(databasePath)).toEqual([]);
      expect(logSpy).toHaveBeenCalledWith(
        `Imported 0 countries into ${resolve(databasePath)}`,
      );
    });

    it('validates the whole CSV before opening the database', async () => {
      // The invalid code is on the last line: nothing may be written before
      // the whole file has been checked.
      const csvFile = writeCsv(
        'countries.csv',
        'code,name\nFR,France\nbe,Belgique\n',
      );

      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      expect(existsSync(databasePath)).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'error: Invalid country code "be" on line 3: expected two uppercase letters, such as FR.',
      );
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it('reports a CSV file that cannot be read', async () => {
      const csvFile = join(directory, 'missing.csv');

      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      expect(existsSync(databasePath)).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `error: Cannot read countries CSV "${csvFile}"`,
        ),
      );
      expect(process.exitCode).toBe(1);
    });

    it('rolls back the whole import when a write fails', async () => {
      // Seed the database with an existing country and a trigger that makes
      // SQLite refuse the code ZZ, so the import fails halfway through.
      const database = getDatabase(databasePath);
      upsertCountries(database, [{ code: 'FR', name: 'France' }]);
      database.exec(`
        CREATE TRIGGER reject_country_zz BEFORE INSERT ON countries
        WHEN NEW.code = 'ZZ'
        BEGIN SELECT RAISE(ABORT, 'country ZZ rejected'); END;
      `);
      database.close();
      closeSpy.mockClear();

      const csvFile = writeCsv(
        'countries.csv',
        'code,name\nBE,Belgique\nFR,République française\nZZ,Inconnu\n',
      );
      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      expect(readStoredCountries(databasePath)).toEqual([
        { code: 'FR', name: 'France' },
      ]);
      expect(errorSpy).toHaveBeenCalledWith('error: country ZZ rejected');
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      // The CLI's own connection is closed despite the failure (the second
      // close comes from readStoredCountries)
      expect(closeSpy).toHaveBeenCalledTimes(2);
    });

    it('closes the database connection after a successful import', async () => {
      const csvFile = writeCsv('countries.csv', 'code,name\nFR,France\n');

      await runCliWithArgs(['--path', databasePath, 'add-countries', csvFile]);

      expect(closeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('clean-countries', () => {
    /**
     * Seeds the database with four countries, two of them associated with a
     * movie, then closes it.
     */
    function seedCountriesAndMovie(): void {
      const database = getDatabase(databasePath);
      upsertCountries(database, [
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
        { code: 'GB', name: 'Royaume-Uni' },
        { code: 'US', name: 'États-Unis' },
      ]);
      database.exec(`
        INSERT INTO movies (id, title, original_title, original_language, overview, collected_at)
        VALUES (1, 'Titre', 'Title', 'fr', '', '2026-11-09T00:00:00Z');
        INSERT INTO production_countries (movie_id, country_code) VALUES (1, 'FR'), (1, 'BE');
      `);
      database.close();
      closeSpy.mockClear();
    }

    it('removes only the countries not associated with a movie', async () => {
      seedCountriesAndMovie();

      await runCliWithArgs(['--path', databasePath, 'clean-countries']);

      expect(readStoredCountries(databasePath)).toEqual([
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
      ]);
      expect(logSpy).toHaveBeenCalledWith(
        `Removed 2 unused countries from ${resolve(databasePath)}`,
      );
      expect(process.exitCode).toBeUndefined();
    });

    it('accepts --path after the command', async () => {
      seedCountriesAndMovie();

      await runCliWithArgs(['clean-countries', '--path', databasePath]);

      expect(readStoredCountries(databasePath)).toHaveLength(2);
    });

    it('uses the singular for a single removed country', async () => {
      const database = getDatabase(databasePath);
      upsertCountries(database, [{ code: 'US', name: 'États-Unis' }]);
      database.close();

      await runCliWithArgs(['--path', databasePath, 'clean-countries']);

      expect(logSpy).toHaveBeenCalledWith(
        `Removed 1 unused country from ${resolve(databasePath)}`,
      );
    });

    it('reports when there is nothing to remove', async () => {
      await runCliWithArgs(['--path', databasePath, 'clean-countries']);

      expect(logSpy).toHaveBeenCalledWith(
        `Removed 0 unused countries from ${resolve(databasePath)}`,
      );
    });

    it('closes the database connection', async () => {
      seedCountriesAndMovie();

      await runCliWithArgs(['--path', databasePath, 'clean-countries']);

      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('closes the connection and reports the error when the deletion fails', async () => {
      // A trigger makes SQLite refuse any country deletion
      const database = getDatabase(databasePath);
      upsertCountries(database, [{ code: 'US', name: 'États-Unis' }]);
      database.exec(`
        CREATE TRIGGER keep_countries BEFORE DELETE ON countries
        BEGIN SELECT RAISE(ABORT, 'countries are locked'); END;
      `);
      database.close();
      closeSpy.mockClear();

      await runCliWithArgs(['--path', databasePath, 'clean-countries']);

      expect(errorSpy).toHaveBeenCalledWith('error: countries are locked');
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(closeSpy).toHaveBeenCalledOnce();
    });
  });
});
