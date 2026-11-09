import type { Country } from '../types/DatabaseTypes.ts';
import type { CatalogCsvFormat } from './catalog-csv.ts';
import {
  CatalogCsvError,
  parseCatalogCsv,
  readCatalogCsv,
} from './catalog-csv.ts';

// An ISO 3166-1 alpha-2 country code: exactly two uppercase letters.
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/**
 * Thrown when a countries CSV document cannot be turned into countries:
 * invalid headers, invalid values or malformed CSV syntax.
 */
export class CountryCsvError extends CatalogCsvError {}

/**
 * Converts one CSV record into a country, checking that the code is made of
 * exactly two uppercase letters and that the name is not empty.
 * @param record The record, keyed by lowercase column name.
 * @param line The line of the record in the document, for error messages.
 * @returns The country.
 */
function toCountry(record: Record<string, string>, line: number): Country {
  if (!COUNTRY_CODE_PATTERN.test(record.code)) {
    throw new CountryCsvError(
      `Invalid country code "${record.code}" on line ${line}: expected two uppercase letters, such as FR.`,
    );
  }

  if (record.name === '') {
    throw new CountryCsvError(`Missing country name on line ${line}.`);
  }

  return { code: record.code, name: record.name };
}

/** The countries CSV format: exactly the columns `code` and `name`. */
const COUNTRIES_CSV_FORMAT: CatalogCsvFormat<Country> = {
  label: 'countries',
  columns: ['code', 'name'],
  createError: (message) => new CountryCsvError(message),
  toRecord: toCountry,
};

/**
 * Parses a countries CSV document with exactly the columns `code` and
 * `name`, in any order and any case. LF and CRLF line endings, a UTF-8 BOM,
 * spaces around values, commas inside quoted fields and escaped quotes are
 * supported; empty lines are ignored. A document with only the header yields
 * an empty list.
 * @param content The CSV document.
 * @returns The countries, in document order.
 * @throws {CountryCsvError} When the header, a value or the CSV syntax is invalid.
 */
export function parseCountriesCsv(content: string): Country[] {
  return parseCatalogCsv(content, COUNTRIES_CSV_FORMAT);
}

/**
 * Reads a countries CSV file as UTF-8 and parses it with `parseCountriesCsv`.
 * @param filePath The path to the CSV file.
 * @returns The countries, in file order.
 * @throws {CountryCsvError} When the file cannot be read or its content is invalid.
 */
export function readCountriesCsv(filePath: string): Country[] {
  return readCatalogCsv(filePath, COUNTRIES_CSV_FORMAT);
}
