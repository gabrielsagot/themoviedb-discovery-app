#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { readGenresCsv } from './database/genre-csv.ts';
import {
  deleteUnusedGenres,
  upsertGenres,
} from './database/genre-repository.ts';
import { DEFAULT_DATABASE_PATH, getDatabase } from './database/schema.ts';

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

/**
 * Imports the genres of a CSV file into the database. The whole file is
 * validated before the database is opened, then every genre is written in a
 * single transaction: if one write fails, none is kept. The connection is
 * always closed.
 * @param csvFile The path to the genres CSV file.
 * @param path The path to the SQLite database file.
 */
function addGenres(csvFile: string, path: string): void {
  const genres = readGenresCsv(csvFile);

  const database = getDatabase(path);
  try {
    database.exec('BEGIN TRANSACTION;');
    try {
      upsertGenres(database, genres);
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  } finally {
    database.close();
  }

  // A genre repeated in the file is imported once, with its last name.
  const importedCount = new Set(genres.map((genre) => genre.id)).size;
  console.log(
    `Imported ${pluralize(importedCount, 'genre')} into ${resolve(path)}`,
  );
}

/**
 * Deletes the genres that no movie is associated with, then closes the
 * connection.
 * @param path The path to the SQLite database file.
 */
function cleanGenres(path: string): void {
  const database = getDatabase(path);
  let deletedCount: number;
  try {
    deletedCount = deleteUnusedGenres(database);
  } finally {
    database.close();
  }

  console.log(
    `Removed ${pluralize(deletedCount, 'unused genre')} from ${resolve(path)}`,
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
    runCommand(() => addGenres(csvFile, program.opts<GlobalOptions>().path));
  });

program
  .command('clean-genres')
  .description('Delete the genres that are not associated with any movie')
  .action(() => {
    runCommand(() => cleanGenres(program.opts<GlobalOptions>().path));
  });

program.parse();
