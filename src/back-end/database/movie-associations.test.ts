import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  replaceMovieCountries,
  replaceMovieGenres,
} from './movie-associations';
import { initializeSchema } from './schema';

describe('movie-associations.ts', () => {
  let database: DatabaseSync;

  /**
   * Lists the genres attached to a movie.
   * @param movieId The TMDB identifier of the movie.
   * @returns The genre ids, sorted.
   */
  function genresOf(movieId: number): number[] {
    return database
      .prepare(
        'SELECT genre_id FROM movie_genres WHERE movie_id = ? ORDER BY genre_id',
      )
      .all(movieId)
      .map((row) => Number(row.genre_id));
  }

  /**
   * Lists the countries attached to a movie.
   * @param movieId The TMDB identifier of the movie.
   * @returns The country codes, sorted.
   */
  function countriesOf(movieId: number): string[] {
    return database
      .prepare(
        'SELECT country_code FROM production_countries WHERE movie_id = ? ORDER BY country_code',
      )
      .all(movieId)
      .map((row) => String(row.country_code));
  }

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(database);
    database.exec(`
      INSERT INTO genres (id, name) VALUES (12, 'Aventure'), (18, 'Drame'), (35, 'Comédie');
      INSERT INTO countries (code, name) VALUES ('BE', 'Belgium'), ('FR', 'France'), ('US', 'United States');
      INSERT INTO movies (id, title, original_title, original_language, overview, collected_at)
      VALUES (1, 'Un', 'One', 'fr', '', 't'), (2, 'Deux', 'Two', 'fr', '', 't');
    `);
  });

  afterEach(() => {
    database.close();
  });

  describe('replaceMovieGenres', () => {
    it('attaches the genres of a movie that had none', () => {
      replaceMovieGenres(database, 1, [35, 12]);

      expect(genresOf(1)).toEqual([12, 35]);
    });

    it('detaches the genres that are no longer listed and attaches the new ones', () => {
      replaceMovieGenres(database, 1, [35, 12]);

      replaceMovieGenres(database, 1, [12, 18]);

      expect(genresOf(1)).toEqual([12, 18]);
    });

    it('detaches every genre when given an empty iterable', () => {
      replaceMovieGenres(database, 1, [35, 12]);

      replaceMovieGenres(database, 1, []);

      expect(genresOf(1)).toEqual([]);
    });

    it('attaches a genre listed several times once', () => {
      replaceMovieGenres(database, 1, [35, 35, 12, 35]);

      expect(genresOf(1)).toEqual([12, 35]);
    });

    it('accepts any iterable', () => {
      replaceMovieGenres(database, 1, new Set([35, 18]));

      expect(genresOf(1)).toEqual([18, 35]);
    });

    it('leaves the other movies and the genres themselves untouched', () => {
      replaceMovieGenres(database, 2, [35]);

      replaceMovieGenres(database, 1, [12]);
      replaceMovieGenres(database, 1, []);

      expect(genresOf(2)).toEqual([35]);
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM genres').get(),
      ).toEqual({ count: 3 });
    });

    it('rejects an unknown genre and keeps the previous genres', () => {
      replaceMovieGenres(database, 1, [35]);

      expect(() => replaceMovieGenres(database, 1, [12, 999])).toThrow(
        /FOREIGN KEY constraint failed/,
      );

      expect(genresOf(1)).toEqual([35]);
    });

    it('works inside a transaction opened by the caller', () => {
      database.exec('BEGIN TRANSACTION;');
      replaceMovieGenres(database, 1, [35]);
      expect(() => replaceMovieGenres(database, 2, [12, 999])).toThrow(
        /FOREIGN KEY constraint failed/,
      );
      database.exec('COMMIT;');

      expect(genresOf(1)).toEqual([35]);
      expect(genresOf(2)).toEqual([]);
    });
  });

  describe('replaceMovieCountries', () => {
    it('attaches the countries of a movie that had none', () => {
      replaceMovieCountries(database, 1, ['FR', 'BE']);

      expect(countriesOf(1)).toEqual(['BE', 'FR']);
    });

    it('detaches the countries that are no longer listed and attaches the new ones', () => {
      replaceMovieCountries(database, 1, ['FR', 'BE']);

      replaceMovieCountries(database, 1, ['BE', 'US']);

      expect(countriesOf(1)).toEqual(['BE', 'US']);
    });

    it('detaches every country when given an empty iterable', () => {
      replaceMovieCountries(database, 1, ['FR', 'BE']);

      replaceMovieCountries(database, 1, []);

      expect(countriesOf(1)).toEqual([]);
    });

    it('attaches a country listed several times once', () => {
      replaceMovieCountries(database, 1, ['FR', 'FR', 'BE']);

      expect(countriesOf(1)).toEqual(['BE', 'FR']);
    });

    it('accepts any iterable', () => {
      replaceMovieCountries(database, 1, new Set(['US', 'FR']));

      expect(countriesOf(1)).toEqual(['FR', 'US']);
    });

    it('leaves the other movies and the countries themselves untouched', () => {
      replaceMovieCountries(database, 2, ['US']);

      replaceMovieCountries(database, 1, ['FR']);
      replaceMovieCountries(database, 1, []);

      expect(countriesOf(2)).toEqual(['US']);
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM countries').get(),
      ).toEqual({ count: 3 });
    });

    it('rejects an unknown country and keeps the previous countries', () => {
      replaceMovieCountries(database, 1, ['FR']);

      expect(() => replaceMovieCountries(database, 1, ['BE', 'ZZ'])).toThrow(
        /FOREIGN KEY constraint failed/,
      );

      expect(countriesOf(1)).toEqual(['FR']);
    });

    it('works inside a transaction opened by the caller', () => {
      database.exec('BEGIN TRANSACTION;');
      replaceMovieCountries(database, 1, ['FR']);
      expect(() => replaceMovieCountries(database, 2, ['BE', 'ZZ'])).toThrow(
        /FOREIGN KEY constraint failed/,
      );
      database.exec('COMMIT;');

      expect(countriesOf(1)).toEqual(['FR']);
      expect(countriesOf(2)).toEqual([]);
    });
  });
});
