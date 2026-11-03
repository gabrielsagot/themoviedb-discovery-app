import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import type { Genre } from '../types/DatabaseTypes.ts';

// The columns a genres CSV must contain, exactly once each, in any order.
const GENRE_CSV_COLUMNS = ['id', 'name'] as const;

/**
 * Thrown when a genres CSV document cannot be turned into genres: invalid
 * headers, invalid values or malformed CSV syntax.
 */
export class GenreCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenreCsvError';
  }
}

/**
 * Checks the header row and normalizes it to lowercase, so `ID,Name` and
 * `name,id` are both accepted.
 * @param header The raw header cells.
 * @returns The lowercase column names, in the order they appear.
 */
function normalizeHeader(header: string[]): string[] {
  const columns = header.map((cell) => cell.trim().toLowerCase());
  const isExpected =
    columns.length === GENRE_CSV_COLUMNS.length &&
    GENRE_CSV_COLUMNS.every((column) => columns.includes(column));

  if (!isExpected) {
    throw new GenreCsvError(
      `Invalid genres CSV header "${header.join(',')}": expected exactly the columns id and name.`,
    );
  }
  return columns;
}

/**
 * Converts one CSV record into a genre, checking that the id is a positive
 * integer that JavaScript can represent exactly and that the name is not
 * empty.
 * @param record The record, keyed by lowercase column name.
 * @param line The line of the record in the document, for error messages.
 * @returns The genre.
 */
function toGenre(record: Record<string, string>, line: number): Genre {
  const rawId = record.id.trim();
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) {
    throw new GenreCsvError(
      `Invalid genre id "${record.id}" on line ${line}: expected a positive integer.`,
    );
  }

  const name = record.name.trim();
  if (name === '') {
    throw new GenreCsvError(`Missing genre name on line ${line}.`);
  }

  return { id, name };
}

/**
 * Parses a genres CSV document with exactly the columns `id` and `name`, in
 * any order and any case. LF and CRLF line endings, a UTF-8 BOM, commas
 * inside quoted fields and escaped quotes are supported; empty lines are
 * ignored. A document with only the header yields an empty list.
 * @param content The CSV document.
 * @returns The genres, in document order.
 * @throws {GenreCsvError} When the header, a value or the CSV syntax is invalid.
 */
export function parseGenresCsv(content: string): Genre[] {
  let rows: Array<{ record: Record<string, string>; info: { lines: number } }>;
  try {
    rows = parse(content, {
      bom: true,
      columns: normalizeHeader,
      skip_empty_lines: true,
      info: true,
    });
  } catch (error) {
    if (error instanceof GenreCsvError) throw error;
    throw new GenreCsvError(`Invalid genres CSV: ${(error as Error).message}`);
  }

  // String.prototype.trim also removes a UTF-8 BOM (U+FEFF).
  if (rows.length === 0 && content.trim() === '') {
    throw new GenreCsvError(
      'Invalid genres CSV: the document is empty, expected the header id,name.',
    );
  }

  return rows.map(({ record, info }) => toGenre(record, info.lines));
}

/**
 * Reads a genres CSV file as UTF-8 and parses it with `parseGenresCsv`.
 * @param filePath The path to the CSV file.
 * @returns The genres, in file order.
 * @throws {GenreCsvError} When the file cannot be read or its content is invalid.
 */
export function readGenresCsv(filePath: string): Genre[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new GenreCsvError(
      `Cannot read genres CSV "${filePath}": ${(error as Error).message}`,
    );
  }
  return parseGenresCsv(content);
}
