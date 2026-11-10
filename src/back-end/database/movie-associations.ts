import type { DatabaseSync } from 'node:sqlite';

/**
 * Replaces the genres of a movie by the given ones: the genres it had and
 * that are no longer listed are detached, the new ones are attached. This
 * keeps the movie consistent with TMDB when it is refreshed. A genre listed
 * several times is attached once. The genres themselves are never deleted.
 *
 * Every genre must already exist in the `genres` table, otherwise the
 * foreign key refuses it. All writes happen in a savepoint: if one fails,
 * the movie keeps its previous genres and the error is propagated.
 * @param database The SQLite database to write to.
 * @param movieId The TMDB identifier of the movie, which must exist.
 * @param genreIds The identifiers of the genres of the movie.
 */
export function replaceMovieGenres(
  database: DatabaseSync,
  movieId: number,
  genreIds: Iterable<number>,
): void {
  const detach = database.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?',
  );
  const attach = database.prepare(
    'INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)',
  );

  database.exec('SAVEPOINT replace_movie_genres;');
  try {
    detach.run(movieId);
    for (const genreId of new Set(genreIds)) {
      attach.run(movieId, genreId);
    }
    database.exec('RELEASE replace_movie_genres;');
  } catch (error) {
    database.exec(
      'ROLLBACK TO replace_movie_genres; RELEASE replace_movie_genres;',
    );
    throw error;
  }
}

/**
 * Replaces the production countries of a movie by the given ones: the
 * countries it had and that are no longer listed are detached, the new ones
 * are attached. A country listed several times is attached once. The
 * countries themselves are never deleted.
 *
 * Every country must already exist in the `countries` table, otherwise the
 * foreign key refuses it. All writes happen in a savepoint: if one fails,
 * the movie keeps its previous countries and the error is propagated.
 * @param database The SQLite database to write to.
 * @param movieId The TMDB identifier of the movie, which must exist.
 * @param countryCodes The ISO 3166-1 codes of the countries of the movie.
 */
export function replaceMovieCountries(
  database: DatabaseSync,
  movieId: number,
  countryCodes: Iterable<string>,
): void {
  const detach = database.prepare(
    'DELETE FROM production_countries WHERE movie_id = ?',
  );
  const attach = database.prepare(
    'INSERT INTO production_countries (movie_id, country_code) VALUES (?, ?)',
  );

  database.exec('SAVEPOINT replace_movie_countries;');
  try {
    detach.run(movieId);
    for (const countryCode of new Set(countryCodes)) {
      attach.run(movieId, countryCode);
    }
    database.exec('RELEASE replace_movie_countries;');
  } catch (error) {
    database.exec(
      'ROLLBACK TO replace_movie_countries; RELEASE replace_movie_countries;',
    );
    throw error;
  }
}
