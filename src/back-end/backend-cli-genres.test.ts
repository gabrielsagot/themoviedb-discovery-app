import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listGenres, upsertGenres } from './database/genre-repository';
import { getDatabase } from './database/schema';

/**
 * Integration tests of the genre commands: unlike backend-cli.test.ts, the
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
 * Reads the genres stored in a database file, then closes it.
 * @param databasePath The path to the SQLite database file.
 * @returns The stored genres, sorted by id.
 */
function readStoredGenres(databasePath: string) {
  const database = getDatabase(databasePath);
  try {
    return listGenres(database);
  } finally {
    database.close();
  }
}

describe('backend-cli.ts genre commands', () => {
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
    directory = mkdtempSync(join(tmpdir(), 'backend-cli-genres-'));
    databasePath = join(directory, 'movies.sqlite');
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  describe('add-genres', () => {
    it('imports the genres into the database selected by --path', async () => {
      const csvFile = writeCsv(
        'genres.csv',
        'id,name\n35,Comédie\n12,Aventure\n',
      );

      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      expect(readStoredGenres(databasePath)).toEqual([
        { id: 12, name: 'Aventure' },
        { id: 35, name: 'Comédie' },
      ]);
      expect(logSpy).toHaveBeenCalledWith(
        `Imported 2 genres into ${resolve(databasePath)}`,
      );
      expect(process.exitCode).toBeUndefined();
    });

    it('accepts --path after the command and its argument', async () => {
      const csvFile = writeCsv('genres.csv', 'id,name\n35,Comédie\n');

      await runCliWithArgs(['add-genres', csvFile, '--path', databasePath]);

      expect(readStoredGenres(databasePath)).toEqual([
        { id: 35, name: 'Comédie' },
      ]);
      expect(logSpy).toHaveBeenCalledWith(
        `Imported 1 genre into ${resolve(databasePath)}`,
      );
    });

    it('imports into the default database when --path is omitted', async () => {
      const originalCwd = process.cwd();
      process.chdir(directory);
      try {
        const csvFile = writeCsv('genres.csv', 'id,name\n35,Comédie\n');

        await runCliWithArgs(['add-genres', csvFile]);

        const defaultPath = join(directory, 'data', 'movies.sqlite');
        expect(readStoredGenres(defaultPath)).toEqual([
          { id: 35, name: 'Comédie' },
        ]);
        expect(logSpy).toHaveBeenCalledWith(
          `Imported 1 genre into ${resolve(defaultPath)}`,
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('updates existing genres without creating duplicates', async () => {
      const csvFile = writeCsv('genres.csv', 'id,name\n35,Comedy\n18,Drame\n');
      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      const updatedCsvFile = writeCsv(
        'genres-fr.csv',
        'id,name\n35,Comédie\n35,Comédie romantique\n',
      );
      await runCliWithArgs([
        '--path',
        databasePath,
        'add-genres',
        updatedCsvFile,
      ]);

      expect(readStoredGenres(databasePath)).toEqual([
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie romantique' },
      ]);
      // A repeated id counts as one imported genre
      expect(logSpy).toHaveBeenLastCalledWith(
        `Imported 1 genre into ${resolve(databasePath)}`,
      );
    });

    it('reports 0 genres for a CSV with only the header', async () => {
      const csvFile = writeCsv('genres.csv', 'id,name\n');

      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      expect(readStoredGenres(databasePath)).toEqual([]);
      expect(logSpy).toHaveBeenCalledWith(
        `Imported 0 genres into ${resolve(databasePath)}`,
      );
    });

    it('validates the CSV before opening the database', async () => {
      const csvFile = writeCsv('genres.csv', 'id,label\n35,Comédie\n');

      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      expect(existsSync(databasePath)).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'error: Invalid genres CSV header "id,label": expected exactly the columns id and name.',
      );
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it('reports a CSV file that cannot be read', async () => {
      const csvFile = join(directory, 'missing.csv');

      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      expect(existsSync(databasePath)).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`error: Cannot read genres CSV "${csvFile}"`),
      );
      expect(process.exitCode).toBe(1);
    });

    it('rolls back the whole import when a write fails', async () => {
      // Seed the database with an existing genre and a trigger that makes
      // SQLite refuse the genre 999, so the import fails halfway through.
      const database = getDatabase(databasePath);
      upsertGenres(database, [{ id: 18, name: 'Drame' }]);
      database.exec(`
        CREATE TRIGGER reject_genre_999 BEFORE INSERT ON genres
        WHEN NEW.id = 999
        BEGIN SELECT RAISE(ABORT, 'genre 999 rejected'); END;
      `);
      database.close();
      closeSpy.mockClear();

      const csvFile = writeCsv(
        'genres.csv',
        'id,name\n35,Comédie\n18,Drama\n999,Rejeté\n',
      );
      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      expect(readStoredGenres(databasePath)).toEqual([
        { id: 18, name: 'Drame' },
      ]);
      expect(errorSpy).toHaveBeenCalledWith('error: genre 999 rejected');
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      // The CLI's own connection is closed despite the failure (the second
      // close comes from readStoredGenres)
      expect(closeSpy).toHaveBeenCalledTimes(2);
    });

    it('closes the database connection after a successful import', async () => {
      const csvFile = writeCsv('genres.csv', 'id,name\n35,Comédie\n');

      await runCliWithArgs(['--path', databasePath, 'add-genres', csvFile]);

      expect(closeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('clean-genres', () => {
    /**
     * Seeds the database with four genres, two of them associated with a
     * movie, then closes it.
     */
    function seedGenresAndMovie(): void {
      const database = getDatabase(databasePath);
      upsertGenres(database, [
        { id: 12, name: 'Aventure' },
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
        { id: 99, name: 'Documentaire' },
      ]);
      database.exec(`
        INSERT INTO movies (id, title, original_title, original_language, overview, collected_at)
        VALUES (1, 'Titre', 'Title', 'fr', '', '2026-11-03T00:00:00Z');
        INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 12), (1, 35);
      `);
      database.close();
      closeSpy.mockClear();
    }

    it('removes only the genres not associated with a movie', async () => {
      seedGenresAndMovie();

      await runCliWithArgs(['--path', databasePath, 'clean-genres']);

      expect(readStoredGenres(databasePath)).toEqual([
        { id: 12, name: 'Aventure' },
        { id: 35, name: 'Comédie' },
      ]);
      expect(logSpy).toHaveBeenCalledWith(
        `Removed 2 unused genres from ${resolve(databasePath)}`,
      );
      expect(process.exitCode).toBeUndefined();
    });

    it('accepts --path after the command', async () => {
      seedGenresAndMovie();

      await runCliWithArgs(['clean-genres', '--path', databasePath]);

      expect(readStoredGenres(databasePath)).toHaveLength(2);
    });

    it('reports when there is nothing to remove', async () => {
      await runCliWithArgs(['--path', databasePath, 'clean-genres']);

      expect(logSpy).toHaveBeenCalledWith(
        `Removed 0 unused genres from ${resolve(databasePath)}`,
      );
    });

    it('closes the database connection', async () => {
      seedGenresAndMovie();

      await runCliWithArgs(['--path', databasePath, 'clean-genres']);

      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('closes the connection and reports the error when the deletion fails', async () => {
      // A trigger makes SQLite refuse any genre deletion
      const database = getDatabase(databasePath);
      upsertGenres(database, [{ id: 99, name: 'Documentaire' }]);
      database.exec(`
        CREATE TRIGGER keep_genres BEFORE DELETE ON genres
        BEGIN SELECT RAISE(ABORT, 'genres are locked'); END;
      `);
      database.close();
      closeSpy.mockClear();

      await runCliWithArgs(['--path', databasePath, 'clean-genres']);

      expect(errorSpy).toHaveBeenCalledWith('error: genres are locked');
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(closeSpy).toHaveBeenCalledOnce();
    });
  });
});
