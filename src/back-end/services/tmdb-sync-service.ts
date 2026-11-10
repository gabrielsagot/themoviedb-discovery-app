import type { DatabaseSync } from 'node:sqlite';
import { upsertCountries } from '../database/country-repository.ts';
import { upsertGenres } from '../database/genre-repository.ts';
import {
  replaceMovieCountries,
  replaceMovieGenres,
} from '../database/movie-associations.ts';
import { upsertMovies } from '../database/movie-repository.ts';
import type { MovieInput } from '../types/DatabaseTypes.ts';
import type { TmdbMovieDetailsRaw } from '../types/TmdbSyncTypes.ts';
import type { TmdbSource } from './tmdb-client.ts';
import { TmdbApiError } from './tmdb-client.ts';

// The language of the titles, overviews and genre names by default.
export const DEFAULT_SYNC_LANGUAGE = 'fr-FR';

// The number of movies collected per year by default. The database holds a
// sample of TMDB, not all of it: the more movies, the more representative.
export const DEFAULT_MOVIES_PER_YEAR = 100;

// TMDB refuses to page past its 500th page of results.
const TMDB_MAX_PAGE = 500;

// The range of the release years accepted, as in the discover route.
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

/** The options of a database update from TMDB. */
export type SyncOptions = {
  /** The release years whose movies are collected. */
  years: readonly number[];
  /** The most movies collected per year; 100 by default. */
  moviesPerYear?: number;
  /** The language of the titles and genre names; fr-FR by default. */
  language?: string;
  /** The clock giving the time of each observation; the system clock by default. */
  now?: () => Date;
};

/** A movie that could not be updated, and why. */
export type SyncFailure = {
  movieId: number;
  message: string;
};

/** What a database update did. */
export type SyncSummary = {
  /** The number of genres received from TMDB. */
  genres: number;
  /** The number of countries received from TMDB. */
  countries: number;
  /** The number of movies inserted or updated. */
  movies: number;
  /** The movies that could not be updated; the others were. */
  failures: SyncFailure[];
};

/**
 * Checks that a string is a real calendar date. JavaScript silently rolls an
 * impossible date over (2023-02-29 becomes 2023-03-01), so the date read back
 * must be the one written.
 * @param value The string to check.
 * @returns Whether it is a real date written as YYYY-MM-DD.
 */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Keeps a strictly positive number and turns anything else into unknown.
 * TMDB writes 0 for an unknown runtime, budget or revenue, and the data
 * model (DASHBOARD-01) treats an absent or zero value as unknown.
 * @param value The value read from TMDB.
 * @returns The value if it is a positive number, otherwise null.
 */
function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

/**
 * Keeps a number as it is, including 0, and turns an absent value into
 * unknown. A popularity, vote average or vote count that TMDB leaves out
 * stays unknown instead of being replaced by 0.
 * @param value The value read from TMDB.
 * @returns The number, or null when it is absent.
 */
function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Converts the details of a TMDB movie into the movie to store, applying the
 * rules of the data model: an unknown or invalid release date, and a runtime,
 * budget or revenue of 0, become null.
 * @param details The details read from TMDB.
 * @param collectedAt The ISO 8601 time of the observation.
 * @returns The movie to insert or update.
 */
export function toMovieInput(
  details: TmdbMovieDetailsRaw,
  collectedAt: string,
): MovieInput {
  return {
    id: details.id,
    title: details.title,
    original_title: details.original_title,
    original_language: details.original_language,
    overview: details.overview ?? '',
    release_date:
      details.release_date && isCalendarDate(details.release_date)
        ? details.release_date
        : null,
    popularity: numberOrNull(details.popularity),
    vote_average: numberOrNull(details.vote_average),
    vote_count: numberOrNull(details.vote_count),
    poster_path: details.poster_path ?? null,
    backdrop_path: details.backdrop_path ?? null,
    runtime_minutes: positiveOrNull(details.runtime),
    budget: positiveOrNull(details.budget),
    revenue: positiveOrNull(details.revenue),
    collected_at: collectedAt,
  };
}

/**
 * Updates the genre catalog from TMDB: new genres are inserted and the name
 * of existing ones is refreshed.
 * @param database The SQLite database to write to.
 * @param source The TMDB data source.
 * @param language The language of the genre names.
 * @returns The number of genres received from TMDB.
 */
export async function syncGenres(
  database: DatabaseSync,
  source: TmdbSource,
  language: string = DEFAULT_SYNC_LANGUAGE,
): Promise<number> {
  const genres = await source.getGenres(language);
  upsertGenres(database, genres);
  return genres.length;
}

/**
 * Updates the country catalog from TMDB: new countries are inserted and the
 * name of existing ones is refreshed.
 * @param database The SQLite database to write to.
 * @param source The TMDB data source.
 * @returns The number of countries received from TMDB.
 */
export async function syncCountries(
  database: DatabaseSync,
  source: TmdbSource,
): Promise<number> {
  const countries = await source.getCountries();
  upsertCountries(database, countries);
  return countries.length;
}

/**
 * Collects the ids of the most popular movies released a year, reading the
 * pages of TMDB Discover until enough are found or the pages run out.
 * @param source The TMDB data source.
 * @param year The release year.
 * @param limit The most movie ids to collect.
 * @param language The language of the request.
 * @returns The distinct movie ids, most popular first.
 */
async function collectMovieIds(
  source: TmdbSource,
  year: number,
  limit: number,
  language: string,
): Promise<number[]> {
  // A movie can show up on two pages when popularity moves while paging.
  const movieIds = new Set<number>();
  let page = 1;
  let totalPages = 1;

  while (movieIds.size < limit && page <= totalPages) {
    const result = await source.discoverMovies(year, page, language);
    totalPages = Math.min(result.totalPages, TMDB_MAX_PAGE);
    for (const id of result.movieIds) {
      if (movieIds.size < limit) movieIds.add(id);
    }
    page += 1;
  }

  return [...movieIds];
}

/**
 * Stores a movie with its genres and countries. The genres and countries
 * listed by the movie are inserted first, since the associations need them,
 * then the movie is inserted or updated in place, and its associations
 * replace the previous ones, so that it stays consistent with TMDB.
 * Everything is written in a savepoint: if a write fails, nothing of this
 * movie is kept, not even its genres and countries.
 * @param database The SQLite database to write to.
 * @param details The details read from TMDB.
 * @param collectedAt The ISO 8601 time of the observation.
 */
function persistMovie(
  database: DatabaseSync,
  details: TmdbMovieDetailsRaw,
  collectedAt: string,
): void {
  const countries = details.production_countries.map((country) => ({
    code: country.iso_3166_1,
    name: country.name,
  }));

  database.exec('SAVEPOINT sync_movie;');
  try {
    upsertGenres(database, details.genres);
    upsertCountries(database, countries);
    upsertMovies(database, [toMovieInput(details, collectedAt)]);
    replaceMovieGenres(
      database,
      details.id,
      details.genres.map((genre) => genre.id),
    );
    replaceMovieCountries(
      database,
      details.id,
      countries.map((country) => country.code),
    );
    database.exec('RELEASE sync_movie;');
  } catch (error) {
    database.exec('ROLLBACK TO sync_movie; RELEASE sync_movie;');
    throw error;
  }
}

/**
 * Updates the movies released a year from TMDB: the most popular ones are
 * found with TMDB Discover, then the details of each are read and stored with
 * its genres and countries. A movie that cannot be read or stored is reported
 * and the others carry on, except when TMDB refuses the access token (401),
 * which would make every other movie fail too.
 * @param database The SQLite database to write to.
 * @param source The TMDB data source.
 * @param year The release year.
 * @param options The sampling and language options.
 * @param options.moviesPerYear The most movies collected.
 * @param options.language The language of the requests.
 * @param options.now The clock giving the time of each observation.
 * @returns The number of movies updated and the movies that failed.
 */
export async function syncMoviesOfYear(
  database: DatabaseSync,
  source: TmdbSource,
  year: number,
  options: {
    moviesPerYear: number;
    language: string;
    now: () => Date;
  },
): Promise<{ movies: number; failures: SyncFailure[] }> {
  const { moviesPerYear, language, now } = options;
  const movieIds = await collectMovieIds(source, year, moviesPerYear, language);

  let movies = 0;
  const failures: SyncFailure[] = [];

  for (const movieId of movieIds) {
    try {
      const details = await source.getMovieDetails(movieId, language);
      persistMovie(database, details, now().toISOString());
      movies += 1;
    } catch (error) {
      if (error instanceof TmdbApiError && error.status === 401) throw error;
      failures.push({ movieId, message: (error as Error).message });
    }
  }

  return { movies, failures };
}

/**
 * Checks the options of an update.
 * @param options The options to check.
 * @throws {RangeError} When a year, the number of movies or the language is invalid.
 */
function assertValidOptions(options: SyncOptions): void {
  const { years, moviesPerYear = DEFAULT_MOVIES_PER_YEAR, language } = options;

  if (years.length === 0) {
    throw new RangeError('At least one release year is required.');
  }
  for (const year of years) {
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
      throw new RangeError(
        `Invalid year ${year}: expected an integer between ${MIN_YEAR} and ${MAX_YEAR}.`,
      );
    }
  }
  if (!Number.isInteger(moviesPerYear) || moviesPerYear < 1) {
    throw new RangeError(
      `Invalid moviesPerYear ${moviesPerYear}: expected a positive integer.`,
    );
  }
  if (language !== undefined && language.trim() === '') {
    throw new RangeError('Invalid language: expected a non-empty string.');
  }
}

/**
 * Updates the database from TMDB, so that it stays consistent and up to
 * date: the genre catalog, the country catalog, then a sample of the movies
 * of each release year with their genres and countries. Running it again
 * refreshes what is already there, without duplicates, and never touches the
 * movies of the other years.
 *
 * The options are checked before anything is requested. A failure of the
 * genre or country catalog, or of TMDB Discover, stops the update, since
 * nothing meaningful can follow; a failure on a single movie does not, and
 * is reported in the summary.
 * @param database The SQLite database to write to.
 * @param source The TMDB data source.
 * @param options The years to collect, and the sampling and language options.
 * @returns What the update did.
 * @throws {RangeError} When the options are invalid.
 */
export async function updateDatabaseFromTmdb(
  database: DatabaseSync,
  source: TmdbSource,
  options: SyncOptions,
): Promise<SyncSummary> {
  assertValidOptions(options);
  const {
    years,
    moviesPerYear = DEFAULT_MOVIES_PER_YEAR,
    language = DEFAULT_SYNC_LANGUAGE,
    now = () => new Date(),
  } = options;

  const summary: SyncSummary = {
    genres: await syncGenres(database, source, language),
    countries: await syncCountries(database, source),
    movies: 0,
    failures: [],
  };

  for (const year of new Set(years)) {
    const result = await syncMoviesOfYear(database, source, year, {
      moviesPerYear,
      language,
      now,
    });
    summary.movies += result.movies;
    summary.failures.push(...result.failures);
  }

  return summary;
}
