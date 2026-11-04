import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';

/**
 * Base class of the errors raised when a catalog CSV document (genres,
 * countries, ...) cannot be read or turned into records: invalid headers,
 * invalid values or malformed CSV syntax.
 */
export class CatalogCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Describes one kind of catalog CSV document and how to read its records. */
export type CatalogCsvFormat<T> = {
  /** Plural name of the records, used in error messages (e.g. "genres"). */
  label: string;
  /** The columns the document must contain, exactly once each, in any order. */
  columns: readonly string[];
  /** Builds the error raised for this format. */
  createError: (message: string) => CatalogCsvError;
  /**
   * Validates one record and converts it; throws an error built with
   * `createError` when a value is invalid.
   * @param record The record, keyed by lowercase column name, values trimmed.
   * @param line The line of the record in the document, for error messages.
   */
  toRecord: (record: Record<string, string>, line: number) => T;
};

/**
 * Formats a list of column names for a message, e.g. "id and name" or
 * "code, name and region".
 * @param columns The column names.
 * @returns The names joined with commas and a final "and".
 */
function describeColumns(columns: readonly string[]): string {
  return columns.length <= 1
    ? columns.join('')
    : `${columns.slice(0, -1).join(', ')} and ${columns.at(-1)}`;
}

/**
 * Parses a catalog CSV document. The header must contain exactly the columns
 * of the format, in any order and any case. LF and CRLF line endings, a
 * UTF-8 BOM, spaces around values, commas inside quoted fields and escaped
 * quotes are supported; empty lines are ignored and a document with only the
 * header yields an empty list. The whole document is validated before any
 * record is returned.
 * @param content The CSV document.
 * @param format The kind of catalog the document describes.
 * @returns The converted records, in document order.
 * @throws {CatalogCsvError} When the header, a value or the CSV syntax is invalid.
 */
export function parseCatalogCsv<T>(
  content: string,
  format: CatalogCsvFormat<T>,
): T[] {
  const { label, columns, createError, toRecord } = format;

  const normalizeHeader = (header: string[]): string[] => {
    const names = header.map((cell) => cell.trim().toLowerCase());
    const isExpected =
      names.length === columns.length &&
      columns.every((column) => names.includes(column));

    if (!isExpected) {
      throw createError(
        `Invalid ${label} CSV header "${header.join(',')}": expected exactly the columns ${describeColumns(columns)}.`,
      );
    }
    return names;
  };

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
    if (error instanceof CatalogCsvError) throw error;
    throw createError(`Invalid ${label} CSV: ${(error as Error).message}`);
  }

  // String.prototype.trim also removes a UTF-8 BOM (U+FEFF).
  if (rows.length === 0 && content.trim() === '') {
    throw createError(
      `Invalid ${label} CSV: the document is empty, expected the header ${columns.join(',')}.`,
    );
  }

  return rows.map(({ record, info }) => toRecord(record, info.lines));
}

/**
 * Reads a catalog CSV file as UTF-8 and parses it with `parseCatalogCsv`.
 * @param filePath The path to the CSV file.
 * @param format The kind of catalog the file describes.
 * @returns The converted records, in file order.
 * @throws {CatalogCsvError} When the file cannot be read or its content is invalid.
 */
export function readCatalogCsv<T>(
  filePath: string,
  format: CatalogCsvFormat<T>,
): T[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw format.createError(
      `Cannot read ${format.label} CSV "${filePath}": ${(error as Error).message}`,
    );
  }
  return parseCatalogCsv(content, format);
}
