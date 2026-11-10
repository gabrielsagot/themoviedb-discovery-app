import type { DatabaseSync } from 'node:sqlite';
import type { MovieInput, StoredMovie } from '../types/DatabaseTypes.ts';

// The columns written by an upsert: all of them but the generated
// `release_year`. `id` identifies the movie, the others are updated.
const MOVIE_INPUT_COLUMNS = [
  'id',
  'title',
  'original_title',
  'original_language',
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

// Every column read back, including the generated `release_year`.
const MOVIE_COLUMNS = [...MOVIE_INPUT_COLUMNS, 'release_year'].join(', ');

/**
 * Converts a nullable SQLite number into a number or null.
 * @param value The raw SQLite value.
 * @returns The number, or null when the value is null.
 */
function toNullableNumber(value: unknown): number | null {
  return value === null ? null : Number(value);
}

/**
 * Converts a nullable SQLite text into a string or null.
 * @param value The raw SQLite value.
 * @returns The string, or null when the value is null.
 */
function toNullableString(value: unknown): string | null {
  return value === null ? null : String(value);
}

/**
 * Converts a row read from the `movies` table into a `StoredMovie`.
 * @param row The raw SQLite row.
 * @returns The movie, with null for every unknown value.
 */
function toStoredMovie(row: Record<string, unknown>): StoredMovie {
  return {
    id: Number(row.id),
    title: String(row.title),
    original_title: String(row.original_title),
    original_language: String(row.original_language),
    overview: String(row.overview),
    release_date: toNullableString(row.release_date),
    release_year: toNullableNumber(row.release_year),
    popularity: toNullableNumber(row.popularity),
    vote_average: toNullableNumber(row.vote_average),
    vote_count: toNullableNumber(row.vote_count),
    poster_path: toNullableString(row.poster_path),
    backdrop_path: toNullableString(row.backdrop_path),
    runtime_minutes: toNullableNumber(row.runtime_minutes),
    budget: toNullableNumber(row.budget),
    revenue: toNullableNumber(row.revenue),
    collected_at: String(row.collected_at),
  };
}

/**
 * Finds a movie by its TMDB identifier.
 * @param database The SQLite database to read from.
 * @param id The TMDB movie identifier.
 * @returns The matching movie, or `undefined` if no movie has this id.
 */
export function findMovieById(
  database: DatabaseSync,
  id: number,
): StoredMovie | undefined {
  const row = database
    .prepare(`SELECT ${MOVIE_COLUMNS} FROM movies WHERE id = ?`)
    .get(id);
  return row ? toStoredMovie(row) : undefined;
}

/**
 * Lists every movie stored in the database.
 * @param database The SQLite database to read from.
 * @returns The movies sorted by ascending identifier, or an empty list when
 * none is stored.
 */
export function listMovies(database: DatabaseSync): StoredMovie[] {
  return database
    .prepare(`SELECT ${MOVIE_COLUMNS} FROM movies ORDER BY id ASC`)
    .all()
    .map(toStoredMovie);
}

/**
 * Inserts new movies and updates existing ones, identified by their TMDB id,
 * without ever creating duplicates. Movies are written in the order given,
 * so when an id appears several times the last version wins. The other
 * movies are left untouched.
 *
 * An existing movie is updated in place (`ON CONFLICT DO UPDATE`) rather than
 * replaced: `INSERT OR REPLACE` would delete the row first, and the
 * `ON DELETE CASCADE` of `movie_genres` and `production_countries` would
 * silently erase the genres and countries of the movie.
 *
 * All writes happen in a savepoint: if one fails (a missing title, a
 * non-positive budget...), none of them is kept and the error is propagated.
 * A savepoint, unlike a plain transaction, also works when the caller has
 * already opened one.
 * @param database The SQLite database to write to.
 * @param movies The movies to insert or update; any iterable is accepted.
 */
export function upsertMovies(
  database: DatabaseSync,
  movies: Iterable<MovieInput>,
): void {
  const updatedColumns = MOVIE_INPUT_COLUMNS.filter(
    (column) => column !== 'id',
  );
  const statement = database.prepare(
    `INSERT INTO movies (${MOVIE_INPUT_COLUMNS.join(', ')})
     VALUES (${MOVIE_INPUT_COLUMNS.map(() => '?').join(', ')})
     ON CONFLICT (id) DO UPDATE SET
       ${updatedColumns.map((column) => `${column} = excluded.${column}`).join(',\n       ')}`,
  );

  database.exec('SAVEPOINT upsert_movies;');
  try {
    for (const movie of movies) {
      statement.run(...MOVIE_INPUT_COLUMNS.map((column) => movie[column]));
    }
    database.exec('RELEASE upsert_movies;');
  } catch (error) {
    database.exec('ROLLBACK TO upsert_movies; RELEASE upsert_movies;');
    throw error;
  }
}
