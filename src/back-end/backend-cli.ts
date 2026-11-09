#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { readGenresCsv } from './database/genre-csv.ts';
import {
  deleteUnusedGenres,
  upsertGenres,
} from './database/genre-repository.ts';
import { DEFAULT_DATABASE_PATH, getDatabase } from './database/schema.ts';
import type { Genre } from './types/DatabaseTypes.ts';

/** Options shared by every command of the CLI. */
type GlobalOptions = {
  path: string;
};

/**
 * Formats a count followed by a noun, singular for exactly 1, plural otherwise
 * (English uses the plural for 0).
 * @param count The number of items.
 * @param noun The singular noun.
 * @returns The count and the noun, e.g. "1 genre" or "19 genres".
 */
function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Runs a command action and turns any error into a readable message on
 * stderr and a non-zero exit code, instead of an uncaught stack trace.
 * @param action The command action to run.
 */
function runCommand(action: () => void): void {
  try {
    action();
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

/**
 * Creates the SQLite database if needed, initializes its schema without
 * removing existing data, then closes the connection.
 * @param path The path to the SQLite database file.
 */
function createDatabase(path: string): void {
  const database = getDatabase(path);
  database.close();
  console.log(`Database available at ${resolve(path)}`);
}

/** Describes how to import and clean one catalog of the database. */
type CatalogCommands<T> = {
  /** Singular name of a record, used in messages (e.g. "genre"). */
  noun: string;
  /** Reads and validates the whole CSV file. */
  readCsv: (csvFile: string) => T[];
  /** Inserts or updates the records in the database. */
  upsert: (database: DatabaseSync, records: Iterable<T>) => void;
  /** Deletes the records no movie uses and returns how many were deleted. */
  deleteUnused: (database: DatabaseSync) => number;
  /** Identifies a record, to count each repeated record once. */
  keyOf: (record: T) => unknown;
};

/** The genre catalog: identified by TMDB id. */
const GENRE_COMMANDS: CatalogCommands<Genre> = {
  noun: 'genre',
  readCsv: readGenresCsv,
  upsert: upsertGenres,
  deleteUnused: deleteUnusedGenres,
  keyOf: (genre) => genre.id,
};

/**
 * Imports the records of a CSV file into the database. The whole file is
 * validated before the database is opened, then every record is written in a
 * single transaction: if one write fails, none is kept. The connection is
 * always closed.
 * @param catalog The catalog to import into.
 * @param csvFile The path to the CSV file.
 * @param path The path to the SQLite database file.
 */
function importCatalog<T>(
  catalog: CatalogCommands<T>,
  csvFile: string,
  path: string,
): void {
  const records = catalog.readCsv(csvFile);

  const database = getDatabase(path);
  try {
    database.exec('BEGIN TRANSACTION;');
    try {
      catalog.upsert(database, records);
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  } finally {
    database.close();
  }

  // A record repeated in the file is imported once, with its last name.
  const importedCount = new Set(records.map(catalog.keyOf)).size;
  console.log(
    `Imported ${pluralize(importedCount, catalog.noun)} into ${resolve(path)}`,
  );
}

/**
 * Deletes the records of a catalog that no movie is associated with, then
 * closes the connection.
 * @param catalog The catalog to clean.
 * @param path The path to the SQLite database file.
 */
function cleanCatalog<T>(catalog: CatalogCommands<T>, path: string): void {
  const database = getDatabase(path);
  let deletedCount: number;
  try {
    deletedCount = catalog.deleteUnused(database);
  } finally {
    database.close();
  }

  console.log(
    `Removed ${pluralize(deletedCount, `unused ${catalog.noun}`)} from ${resolve(path)}`,
  );
}

/**
 * Command-line interface for movie database operations. The `--path` option
 * is global, so it selects the database for every command and can be given
 * before or after the command name. Without a command, the CLI creates and
 * initializes the database.
 */
const program = new Command()
  .description('CLI for movie database operations')
  .option(
    '-p, --path <path>',
    'path to the SQLite database file',
    DEFAULT_DATABASE_PATH,
  )
  .action(() => {
    runCommand(() => createDatabase(program.opts<GlobalOptions>().path));
  });

program
  .command('create-database')
  .description('Create and initialize the movies database schema')
  .action(() => {
    runCommand(() => createDatabase(program.opts<GlobalOptions>().path));
  });

program
  .command('add-genres')
  .description('Insert or update the genres listed in a CSV file (id,name)')
  .argument('<csv-file>', 'path to the genres CSV file')
  .action((csvFile: string) => {
    runCommand(() =>
      importCatalog(
        GENRE_COMMANDS,
        csvFile,
        program.opts<GlobalOptions>().path,
      ),
    );
  });

program
  .command('clean-genres')
  .description('Delete the genres that are not associated with any movie')
  .action(() => {
    runCommand(() =>
      cleanCatalog(GENRE_COMMANDS, program.opts<GlobalOptions>().path),
    );
  });

program.parse();
