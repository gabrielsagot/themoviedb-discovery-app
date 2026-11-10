import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { MovieInput } from '../types/DatabaseTypes.ts';
import { upsertMovies } from './movie-repository.ts';

// The columns a movies CSV must contain, exactly once each, in any order.
const REQUIRED_COLUMNS = [
  'id',
  'title',
  'original_title',
  'original_language',
] as const;

// The columns a movies CSV may contain. A missing column leaves the value
// unknown (null), except `overview` (empty) and `collected_at` (the time of
// the import).
const OPTIONAL_COLUMNS = [
  'overview',
  'release_date',
  'popularity',
  'vote_average',
  'vote_count',
  'poster_path',
  'backdrop_path',
  'runtime_minutes',
  'budget',
  'revenue',
  'collected_at',
] as const;

const KNOWN_COLUMNS: readonly string[] = [
  ...REQUIRED_COLUMNS,
  ...OPTIONAL_COLUMNS,
];

// A calendar date as written by TMDB, e.g. 2019-05-30.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// An ISO 8601 date, or date and time with a time zone (Z or an offset). The
// time zone is required: without it JavaScript would read the time in the
// local time zone of the machine, and the import would depend on it.
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

// A plain decimal number: no exponent, no sign other than a leading minus,
// and none of the special values JavaScript's Number() would accept
// ('Infinity', '0x10', '1e3', ...).
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Thrown when a movies CSV document cannot be turned into movies: invalid
 * headers, invalid values, malformed CSV syntax or an unreadable file.
 */
export class MovieCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MovieCsvError';
  }
}

/**
 * Checks the header row and normalizes it to lowercase, so `ID,Title` and
 * `title,id` are both accepted. The header must contain every required
 * column, may contain optional ones, and must not repeat or invent any.
 * @param header The raw header cells.
 * @returns The lowercase column names, in the order they appear.
 */
function normalizeHeader(header: string[]): string[] {
  const columns = header.map((cell) => cell.trim().toLowerCase());

  const missing = REQUIRED_COLUMNS.filter(
    (column) => !columns.includes(column),
  );
  const unknown = columns.filter((column) => !KNOWN_COLUMNS.includes(column));
  const duplicated = columns.filter(
    (column, index) => columns.indexOf(column) !== index,
  );

  const problems = [
    missing.length > 0 && `missing required column(s) ${missing.join(', ')}`,
    unknown.length > 0 && `unknown column(s) ${unknown.join(', ')}`,
    duplicated.length > 0 && `duplicated column(s) ${duplicated.join(', ')}`,
  ].filter(Boolean);

  if (problems.length > 0) {
    throw new MovieCsvError(
      `Invalid movies CSV header "${header.join(',')}": ${problems.join('; ')}.`,
    );
  }
  return columns;
}

/**
 * Checks that a string is a real calendar date. JavaScript silently rolls an
 * impossible date over (2023-02-29 becomes 2023-03-01), so the date read back
 * must be the one written.
 * @param value A string shaped as YYYY-MM-DD.
 * @returns Whether the date exists.
 */
function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Builds the error for an invalid value.
 * @param column The column of the value.
 * @param raw The value as written in the CSV.
 * @param line The line of the record in the document.
 * @param expected What the column expects.
 * @returns The error to throw.
 */
function invalidValue(
  column: string,
  raw: string,
  line: number,
  expected: string,
): MovieCsvError {
  return new MovieCsvError(
    `Invalid ${column} "${raw}" on line ${line}: expected ${expected}.`,
  );
}

/**
 * Reads a required text value, which cannot be blank.
 * @param record The record, keyed by lowercase column name.
 * @param column The column to read.
 * @param line The line of the record in the document.
 * @returns The trimmed text.
 */
function requiredText(
  record: Record<string, string>,
  column: string,
  line: number,
): string {
  const value = record[column].trim();
  if (value === '') {
    throw new MovieCsvError(`Missing ${column} on line ${line}.`);
  }
  return value;
}

/**
 * Reads an optional text value.
 * @param raw The value as written in the CSV, or undefined when the column
 * is absent.
 * @returns The text, or null when it is absent or empty.
 */
function optionalText(raw: string | undefined): string | null {
  return raw === undefined || raw === '' ? null : raw;
}

/**
 * Reads an optional number, rejecting anything but a plain decimal number
 * within the given bounds.
 * @param raw The value as written in the CSV, or undefined when the column
 * is absent.
 * @param column The column of the value.
 * @param line The line of the record in the document.
 * @param rule The kind of number expected.
 * @param rule.integer Whether the number must be an integer.
 * @param rule.min The smallest accepted value.
 * @param rule.max The largest accepted value, if any.
 * @param rule.expected What the column expects, for the error message.
 * @returns The number, or null when it is absent or empty.
 */
function optionalNumber(
  raw: string | undefined,
  column: string,
  line: number,
  rule: { integer: boolean; min: number; max?: number; expected: string },
): number | null {
  if (raw === undefined || raw === '') return null;

  const value = Number(raw);
  const isValid =
    DECIMAL_PATTERN.test(raw) &&
    Number.isFinite(value) &&
    (!rule.integer || Number.isSafeInteger(value)) &&
    value >= rule.min &&
    (rule.max === undefined || value <= rule.max);

  if (!isValid) throw invalidValue(column, raw, line, rule.expected);
  return value;
}

/**
 * Reads a runtime, budget or revenue: a positive integer, or unknown. TMDB
 * writes 0 for an unknown value, and the data model (DASHBOARD-01) treats an
 * absent or zero value as unknown, so 0 becomes null.
 * @param raw The value as written in the CSV, or undefined when the column
 * is absent.
 * @param column The column of the value.
 * @param line The line of the record in the document.
 * @returns The positive integer, or null when it is absent, empty or 0.
 */
function positiveIntegerOrUnknown(
  raw: string | undefined,
  column: string,
  line: number,
): number | null {
  const value = optionalNumber(raw, column, line, {
    integer: true,
    min: 0,
    expected: 'a positive integer, or an empty value when unknown',
  });
  return value === 0 ? null : value;
}

/**
 * Reads the release date: empty when unknown, otherwise a real calendar date.
 * @param raw The value as written in the CSV, or undefined when the column
 * is absent.
 * @param line The line of the record in the document.
 * @returns The date as YYYY-MM-DD, or null when it is absent or empty.
 */
function releaseDate(raw: string | undefined, line: number): string | null {
  if (raw === undefined || raw === '') return null;
  if (!DATE_PATTERN.test(raw) || !isCalendarDate(raw)) {
    throw invalidValue('release_date', raw, line, 'a date as YYYY-MM-DD');
  }
  return raw;
}

/**
 * Reads the time of the observation. A missing or empty value means the
 * movie is observed at the time of the import.
 * @param raw The value as written in the CSV, or undefined when the column
 * is absent.
 * @param line The line of the record in the document.
 * @param importedAt The time of the import, as an ISO 8601 timestamp.
 * @returns The time as an ISO 8601 UTC timestamp.
 */
function collectedAt(
  raw: string | undefined,
  line: number,
  importedAt: string,
): string {
  if (raw === undefined || raw === '') return importedAt;

  const isValid =
    TIMESTAMP_PATTERN.test(raw) &&
    isCalendarDate(raw.slice(0, 10)) &&
    !Number.isNaN(new Date(raw).getTime());
  if (!isValid) {
    throw invalidValue(
      'collected_at',
      raw,
      line,
      'an ISO 8601 date, or a date and time with a time zone (e.g. 2026-11-03T10:00:00Z)',
    );
  }
  return new Date(raw).toISOString();
}

/**
 * Converts one CSV record into a movie, checking every value.
 * @param record The record, keyed by lowercase column name.
 * @param line The line of the record in the document, for error messages.
 * @param importedAt The time of the import, for movies without `collected_at`.
 * @returns The movie to insert or update.
 */
function toMovie(
  record: Record<string, string>,
  line: number,
  importedAt: string,
): MovieInput {
  const id = Number(record.id);
  if (!/^\d+$/.test(record.id) || !Number.isSafeInteger(id) || id <= 0) {
    throw invalidValue('id', record.id, line, 'a positive integer');
  }

  return {
    id,
    title: requiredText(record, 'title', line),
    original_title: requiredText(record, 'original_title', line),
    original_language: requiredText(record, 'original_language', line),
    overview: record.overview ?? '',
    release_date: releaseDate(record.release_date, line),
    popularity: optionalNumber(record.popularity, 'popularity', line, {
      integer: false,
      min: 0,
      expected: 'a number greater than or equal to 0',
    }),
    vote_average: optionalNumber(record.vote_average, 'vote_average', line, {
      integer: false,
      min: 0,
      max: 10,
      expected: 'a number between 0 and 10',
    }),
    vote_count: optionalNumber(record.vote_count, 'vote_count', line, {
      integer: true,
      min: 0,
      expected: 'a non-negative integer',
    }),
    poster_path: optionalText(record.poster_path),
    backdrop_path: optionalText(record.backdrop_path),
    runtime_minutes: positiveIntegerOrUnknown(
      record.runtime_minutes,
      'runtime_minutes',
      line,
    ),
    budget: positiveIntegerOrUnknown(record.budget, 'budget', line),
    revenue: positiveIntegerOrUnknown(record.revenue, 'revenue', line),
    collected_at: collectedAt(record.collected_at, line, importedAt),
  };
}

/**
 * Parses a movies CSV document. The header must contain the columns `id`,
 * `title`, `original_title` and `original_language`, and may contain any of
 * the optional columns (`overview`, `release_date`, `popularity`,
 * `vote_average`, `vote_count`, `poster_path`, `backdrop_path`,
 * `runtime_minutes`, `budget`, `revenue`, `collected_at`), in any order and
 * any case. LF and CRLF line endings, a UTF-8 BOM, spaces around values,
 * commas inside quoted fields and escaped quotes are supported; empty lines
 * are ignored and a document with only the header yields an empty list. An
 * empty value is unknown (null), and so is 0 for a runtime, budget or revenue.
 * The whole document is validated before any movie is returned.
 * @param content The CSV document.
 * @param importedAt The ISO 8601 timestamp given to the movies that have no
 * `collected_at` value; the current time by default.
 * @returns The movies, in document order.
 * @throws {MovieCsvError} When the header, a value or the CSV syntax is invalid.
 */
export function parseMoviesCsv(
  content: string,
  importedAt: string = new Date().toISOString(),
): MovieInput[] {
  let rows: Array<{ record: Record<string, string>; info: { lines: number } }>;
  try {
    rows = parse(content, {
      bom: true,
      columns: normalizeHeader,
      skip_empty_lines: true,
      trim: true,
      info: true,
    });
  } catch (error) {
    if (error instanceof MovieCsvError) throw error;
    throw new MovieCsvError(`Invalid movies CSV: ${(error as Error).message}`);
  }

  // String.prototype.trim also removes a UTF-8 BOM (U+FEFF).
  if (rows.length === 0 && content.trim() === '') {
    throw new MovieCsvError(
      `Invalid movies CSV: the document is empty, expected a header with at least the columns ${REQUIRED_COLUMNS.join(', ')}.`,
    );
  }

  return rows.map(({ record, info }) =>
    toMovie(record, info.lines, importedAt),
  );
}

/**
 * Reads a movies CSV file as UTF-8 and parses it with `parseMoviesCsv`.
 * @param filePath The path to the CSV file.
 * @param importedAt The ISO 8601 timestamp given to the movies that have no
 * `collected_at` value; the current time by default.
 * @returns The movies, in file order.
 * @throws {MovieCsvError} When the file cannot be read or its content is invalid.
 */
export function readMoviesCsv(
  filePath: string,
  importedAt: string = new Date().toISOString(),
): MovieInput[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new MovieCsvError(
      `Cannot read movies CSV "${filePath}": ${(error as Error).message}`,
    );
  }
  return parseMoviesCsv(content, importedAt);
}

/**
 * Imports the movies of a CSV file into the database: new movies are
 * inserted and existing ones, identified by their TMDB id, are updated. The
 * whole file is validated before anything is written, then every movie is
 * written in a single savepoint: if one write fails, none is kept.
 *
 * An imported movie replaces the stored one as a whole, so a column missing
 * from the CSV resets the matching value to unknown. The genres and
 * countries of an updated movie are kept.
 * @param database The SQLite database to write to.
 * @param filePath The path to the CSV file.
 * @param importedAt The ISO 8601 timestamp given to the movies that have no
 * `collected_at` value; the current time by default.
 * @returns The number of distinct movies imported (a movie repeated in the
 * file counts once, with its last version).
 * @throws {MovieCsvError} When the file cannot be read or is invalid.
 */
export function importMoviesCsv(
  database: DatabaseSync,
  filePath: string,
  importedAt: string = new Date().toISOString(),
): number {
  const movies = readMoviesCsv(filePath, importedAt);
  upsertMovies(database, movies);
  return new Set(movies.map((movie) => movie.id)).size;
}
