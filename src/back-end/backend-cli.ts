#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { readCountriesCsv } from './database/country-csv.ts';
import {
  deleteUnusedCountries,
  upsertCountries,
} from './database/country-repository.ts';
import { readGenresCsv } from './database/genre-csv.ts';
import {
  deleteUnusedGenres,
  upsertGenres,
} from './database/genre-repository.ts';
import { DEFAULT_DATABASE_PATH, getDatabase } from './database/schema.ts';
import type { Country, Genre } from './types/DatabaseTypes.ts';

/** Options shared by every command of the CLI. */
type GlobalOptions = {
  path: string;
};

/**
 * Formats a count followed by a noun, singular for exactly 1, plural otherwise
 * (English uses the plural for 0).
 * @param count The number of items.
 * @param singular The singular form, e.g. "country".
 * @param plural The plural form, e.g. "countries".
 * @returns The count and the noun, e.g. "1 country" or "0 countries".
 */
function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
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
  /** Singular name of a record, used in messages (e.g. "country"). */
  noun: string;
  /** Plural name of the records, used in messages (e.g. "countries"). */
  pluralNoun: string;
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
  pluralNoun: 'genres',
  readCsv: readGenresCsv,
  upsert: upsertGenres,
  deleteUnused: deleteUnusedGenres,
  keyOf: (genre) => genre.id,
};

/** The production country catalog: identified by ISO 3166-1 alpha-2 code. */
const COUNTRY_COMMANDS: CatalogCommands<Country> = {
  noun: 'country',
  pluralNoun: 'countries',
  readCsv: readCountriesCsv,
  upsert: upsertCountries,
  deleteUnused: deleteUnusedCountries,
  keyOf: (country) => country.code,
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
    `Imported ${pluralize(importedCount, catalog.noun, catalog.pluralNoun)} into ${resolve(path)}`,
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
    `Removed ${pluralize(
      deletedCount,
      `unused ${catalog.noun}`,
      `unused ${catalog.pluralNoun}`,
    )} from ${resolve(path)}`,
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

program
  .command('add-countries')
  .description(
    'Insert or update the countries listed in a CSV file (code,name)',
  )
  .argument('<csv-file>', 'path to the countries CSV file')
  .action((csvFile: string) => {
    runCommand(() =>
      importCatalog(
        COUNTRY_COMMANDS,
        csvFile,
        program.opts<GlobalOptions>().path,
      ),
    );
  });

program
  .command('clean-countries')
  .description('Delete the countries that are not associated with any movie')
  .action(() => {
    runCommand(() =>
      cleanCatalog(COUNTRY_COMMANDS, program.opts<GlobalOptions>().path),
    );
  });

program.parse();
