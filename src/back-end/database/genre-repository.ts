import type { DatabaseSync } from 'node:sqlite';
import type { Genre } from '../types/DatabaseTypes.ts';

/**
 * Converts a row read from the `genres` table into a `Genre`.
 * @param row The raw SQLite row.
 * @returns The genre with its id and name.
 */
function toGenre(row: Record<string, unknown>): Genre {
  return { id: Number(row.id), name: String(row.name) };
}

/**
 * Finds a genre by its TMDB identifier.
 * @param database The SQLite database to read from.
 * @param id The TMDB genre identifier.
 * @returns The matching genre, or `undefined` if no genre has this id.
 */
export function findGenreById(
  database: DatabaseSync,
  id: number,
): Genre | undefined {
  const row = database
    .prepare('SELECT id, name FROM genres WHERE id = ?')
    .get(id);
  return row ? toGenre(row) : undefined;
}

/**
 * Lists every genre stored in the database.
 * @param database The SQLite database to read from.
 * @returns The genres, sorted by ascending identifier.
 */
export function listGenres(database: DatabaseSync): Genre[] {
  return database
    .prepare('SELECT id, name FROM genres ORDER BY id ASC')
    .all()
    .map(toGenre);
}

/**
 * Inserts new genres and updates the name of existing ones, identified by
 * their TMDB id, without ever creating duplicates. Genres are written in the
 * order given, so when an id appears several times the last name wins. All
 * writes happen in a savepoint: if one fails (e.g. a missing name), none of
 * them is kept and the error is propagated. A savepoint, unlike a plain
 * transaction, also works when the caller has already opened one.
 * @param database The SQLite database to write to.
 * @param genres The genres to insert or update; any iterable is accepted.
 */
export function upsertGenres(
  database: DatabaseSync,
  genres: Iterable<Genre>,
): void {
  const statement = database.prepare(
    `INSERT INTO genres (id, name) VALUES (?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name`,
  );

  database.exec('SAVEPOINT upsert_genres;');
  try {
    for (const genre of genres) {
      statement.run(genre.id, genre.name);
    }
    database.exec('RELEASE upsert_genres;');
  } catch (error) {
    database.exec('ROLLBACK TO upsert_genres; RELEASE upsert_genres;');
    throw error;
  }
}

/**
 * Deletes every genre that no movie references in `movie_genres`, keeping
 * the genres still associated with at least one movie.
 * @param database The SQLite database to write to.
 * @returns The number of genres deleted.
 */
export function deleteUnusedGenres(database: DatabaseSync): number {
  const result = database
    .prepare(
      `DELETE FROM genres
       WHERE NOT EXISTS (
         SELECT 1 FROM movie_genres WHERE movie_genres.genre_id = genres.id
       )`,
    )
    .run();
  return Number(result.changes);
}
