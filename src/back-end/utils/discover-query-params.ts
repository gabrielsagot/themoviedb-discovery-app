import type { Request } from 'express';
import { DEFAULT_LANGUAGE, DEFAULT_PAGE, DEFAULT_REGION } from './constants';

// Bounds of the release year accepted by the discover route.
export const MIN_RELEASE_YEAR = 1000;
export const MAX_RELEASE_YEAR = 9999;

/** Result of validating the query of the discover route. */
export type DiscoverQueryValidation =
  | { ok: true; params: URLSearchParams }
  | { ok: false; error: string };

/**
 * Returns a query value when it is a single, non-empty string, and the
 * fallback otherwise: a missing value, an empty string, a repeated parameter
 * (`?page=1&page=2`, parsed as an array) or a structured one (`?page[a]=1`,
 * parsed as an object) all fall back to the default.
 * @param value The raw query value from Express.
 * @param fallback The value to use when `value` is not a non-empty string.
 * @returns The value to send to TMDB.
 */
function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

/**
 * Checks the `year` query value of the discover route: it must be a single
 * string of exactly four digits, between 1000 and 9999.
 * @param year The raw `year` query value from Express.
 * @returns An explicit error message, or `undefined` when the year is valid.
 */
export function validateReleaseYear(year: unknown): string | undefined {
  if (year === undefined || year === '') {
    return 'The year query parameter is required, e.g. ?year=2020.';
  }

  if (typeof year !== 'string') {
    return 'The year query parameter must be given once, as a four-digit year.';
  }

  const value = Number(year);
  if (
    !/^\d{4}$/.test(year) ||
    value < MIN_RELEASE_YEAR ||
    value > MAX_RELEASE_YEAR
  ) {
    return `Invalid year "${year}": expected a four-digit year between ${MIN_RELEASE_YEAR} and ${MAX_RELEASE_YEAR}.`;
  }

  return undefined;
}

/**
 * Validates the query of the discover route and builds the query parameters
 * of the TMDB `discover/movie` request: the release year as
 * `primary_release_year`, then `language`, `page` and `region`, which fall
 * back to `fr-FR`, `1` and `FR` unless given as non-empty strings.
 * @param query The query parameters from the Express request.
 * @returns The TMDB query parameters, or the error to send back to the client.
 */
export function createDiscoverQueryParams(
  query: Request['query'],
): DiscoverQueryValidation {
  const { year, language, page, region } = query;

  const error = validateReleaseYear(year);
  if (error) {
    return { ok: false, error };
  }

  const params = new URLSearchParams({
    primary_release_year: year as string,
    language: stringOrDefault(language, DEFAULT_LANGUAGE),
    page: stringOrDefault(page, String(DEFAULT_PAGE)),
    region: stringOrDefault(region, DEFAULT_REGION),
  });
  return { ok: true, params };
}
