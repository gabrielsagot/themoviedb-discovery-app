import type { Genre } from '../types/DatabaseTypes.ts';
import type { CatalogCsvFormat } from './catalog-csv.ts';
import {
  CatalogCsvError,
  parseCatalogCsv,
  readCatalogCsv,
} from './catalog-csv.ts';

/**
 * Thrown when a genres CSV document cannot be turned into genres: invalid
 * headers, invalid values or malformed CSV syntax.
 */
export class GenreCsvError extends CatalogCsvError {}

/**
 * Converts one CSV record into a genre, checking that the id is a positive
 * integer that JavaScript can represent exactly and that the name is not
 * empty.
 * @param record The record, keyed by lowercase column name.
 * @param line The line of the record in the document, for error messages.
 * @returns The genre.
 */
function toGenre(record: Record<string, string>, line: number): Genre {
  const id = Number(record.id);
  if (!/^\d+$/.test(record.id) || !Number.isSafeInteger(id) || id <= 0) {
    throw new GenreCsvError(
      `Invalid genre id "${record.id}" on line ${line}: expected a positive integer.`,
    );
  }

  if (record.name === '') {
    throw new GenreCsvError(`Missing genre name on line ${line}.`);
  }

  return { id, name: record.name };
}

/** The genres CSV format: exactly the columns `id` and `name`. */
const GENRES_CSV_FORMAT: CatalogCsvFormat<Genre> = {
  label: 'genres',
  columns: ['id', 'name'],
  createError: (message) => new GenreCsvError(message),
  toRecord: toGenre,
};

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
  return parseCatalogCsv(content, GENRES_CSV_FORMAT);
}

/**
 * Reads a genres CSV file as UTF-8 and parses it with `parseGenresCsv`.
 * @param filePath The path to the CSV file.
 * @returns The genres, in file order.
 * @throws {GenreCsvError} When the file cannot be read or its content is invalid.
 */
export function readGenresCsv(filePath: string): Genre[] {
  return readCatalogCsv(filePath, GENRES_CSV_FORMAT);
}
