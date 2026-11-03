#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { DEFAULT_DATABASE_PATH, getDatabase } from './database/schema.ts';

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
    createDatabase(program.opts<{ path: string }>().path);
  });

program
  .command('create-database')
  .description('Create and initialize the movies database schema')
  .action(() => {
    createDatabase(program.opts<{ path: string }>().path);
  });

program.parse();
