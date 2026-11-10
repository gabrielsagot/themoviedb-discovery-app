import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MovieInput } from '../types/DatabaseTypes';
import { findMovieById, listMovies, upsertMovies } from './movie-repository';
import { initializeSchema } from './schema';

/**
 * Builds a complete movie, overriding any property.
 * @param overrides The properties to change from the default movie.
 * @returns The movie to insert.
 */
function createMovie(overrides: Partial<MovieInput> = {}): MovieInput {
  return {
    id: 496243,
    title: 'Le Voyage imaginaire',
    original_title: 'The Imaginary Journey',
    original_language: 'en',
    overview: 'Un film fictif pour les tests.',
    release_date: '2019-05-30',
    popularity: 87.5,
    vote_average: 8.5,
    vote_count: 18000,
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    runtime_minutes: 133,
    budget: 11000000,
    revenue: 262000000,
    collected_at: '2026-11-03T10:00:00.000Z',
    ...overrides,
  };
}

describe('movie-repository.ts', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(database);
  });

  afterEach(() => {
    database.close();
  });

  describe('findMovieById', () => {
    it('returns the movie with the given id, with its release year', () => {
      upsertMovies(database, [createMovie()]);

      expect(findMovieById(database, 496243)).toEqual({
        ...createMovie(),
        release_year: 2019,
      });
    });

    it('returns undefined when no movie has the given id', () => {
      upsertMovies(database, [createMovie()]);

      expect(findMovieById(database, 1)).toBeUndefined();
    });

    it('returns undefined when no movie is stored', () => {
      expect(findMovieById(database, 496243)).toBeUndefined();
    });

    it('returns null for every unknown value', () => {
      upsertMovies(database, [
        createMovie({
          release_date: null,
          popularity: null,
          vote_average: null,
          vote_count: null,
          poster_path: null,
          backdrop_path: null,
          runtime_minutes: null,
          budget: null,
          revenue: null,
        }),
      ]);

      expect(findMovieById(database, 496243)).toEqual({
        ...createMovie(),
        release_date: null,
        release_year: null,
        popularity: null,
        vote_average: null,
        vote_count: null,
        poster_path: null,
        backdrop_path: null,
        runtime_minutes: null,
        budget: null,
        revenue: null,
      });
    });
  });

  describe('listMovies', () => {
    it('returns an empty list when no movie is stored', () => {
      expect(listMovies(database)).toEqual([]);
    });

    it('returns the movies sorted by ascending id', () => {
      upsertMovies(database, [
        createMovie({ id: 300 }),
        createMovie({ id: 12 }),
        createMovie({ id: 4500 }),
      ]);

      expect(listMovies(database).map((movie) => movie.id)).toEqual([
        12, 300, 4500,
      ]);
    });
  });

  describe('upsertMovies', () => {
    it('inserts new movies', () => {
      upsertMovies(database, [
        createMovie({ id: 2, title: 'Second' }),
        createMovie({ id: 1, title: 'Premier' }),
      ]);

      expect(listMovies(database).map((movie) => movie.title)).toEqual([
        'Premier',
        'Second',
      ]);
    });

    it('updates an existing movie without creating a duplicate', () => {
      upsertMovies(database, [createMovie()]);

      upsertMovies(database, [
        createMovie({
          title: 'Le Voyage imaginaire (version longue)',
          overview: 'Un résumé actualisé.',
          release_date: '2020-01-15',
          popularity: 99.9,
          vote_average: 9,
          vote_count: 20000,
          poster_path: null,
          runtime_minutes: 150,
          budget: null,
          revenue: 300000000,
          collected_at: '2026-11-10T09:30:00.000Z',
        }),
      ]);

      expect(listMovies(database)).toEqual([
        {
          ...createMovie(),
          title: 'Le Voyage imaginaire (version longue)',
          overview: 'Un résumé actualisé.',
          release_date: '2020-01-15',
          release_year: 2020,
          popularity: 99.9,
          vote_average: 9,
          vote_count: 20000,
          poster_path: null,
          runtime_minutes: 150,
          budget: null,
          revenue: 300000000,
          collected_at: '2026-11-10T09:30:00.000Z',
        },
      ]);
    });

    it('leaves the other movies untouched when updating one', () => {
      upsertMovies(database, [
        createMovie({ id: 1, release_date: '2018-01-01' }),
        createMovie({ id: 2, release_date: '2019-01-01' }),
        createMovie({ id: 3, release_date: '2020-01-01' }),
      ]);

      upsertMovies(database, [createMovie({ id: 2, title: 'Actualisé' })]);

      expect(
        listMovies(database).map((movie) => [movie.id, movie.title]),
      ).toEqual([
        [1, 'Le Voyage imaginaire'],
        [2, 'Actualisé'],
        [3, 'Le Voyage imaginaire'],
      ]);
    });

    it('keeps the genres and countries of a movie when updating it', () => {
      database.exec(`
        INSERT INTO genres (id, name) VALUES (35, 'Comédie'), (12, 'Aventure');
        INSERT INTO countries (code, name) VALUES ('FR', 'France'), ('BE', 'Belgique');
      `);
      upsertMovies(database, [createMovie()]);
      database.exec(`
        INSERT INTO movie_genres (movie_id, genre_id) VALUES (496243, 35), (496243, 12);
        INSERT INTO production_countries (movie_id, country_code) VALUES (496243, 'FR'), (496243, 'BE');
      `);

      upsertMovies(database, [createMovie({ title: 'Actualisé' })]);

      expect(
        database
          .prepare('SELECT genre_id FROM movie_genres ORDER BY genre_id')
          .all()
          .map((row) => row.genre_id),
      ).toEqual([12, 35]);
      expect(
        database
          .prepare(
            'SELECT country_code FROM production_countries ORDER BY country_code',
          )
          .all()
          .map((row) => row.country_code),
      ).toEqual(['BE', 'FR']);
    });

    it('recomputes the release year when the release date changes', () => {
      upsertMovies(database, [createMovie({ release_date: '2019-05-30' })]);
      expect(findMovieById(database, 496243)?.release_year).toBe(2019);

      upsertMovies(database, [createMovie({ release_date: '2021-12-01' })]);
      expect(findMovieById(database, 496243)?.release_year).toBe(2021);

      upsertMovies(database, [createMovie({ release_date: null })]);
      expect(findMovieById(database, 496243)?.release_year).toBeNull();
    });

    it('accepts a Set of movies', () => {
      upsertMovies(
        database,
        new Set([createMovie({ id: 2 }), createMovie({ id: 1 })]),
      );

      expect(listMovies(database).map((movie) => movie.id)).toEqual([1, 2]);
    });

    it('accepts the values of a Map', () => {
      const moviesById = new Map([
        [7, createMovie({ id: 7 })],
        [5, createMovie({ id: 5 })],
      ]);

      upsertMovies(database, moviesById.values());

      expect(listMovies(database).map((movie) => movie.id)).toEqual([5, 7]);
    });

    it('accepts a generator of movies', () => {
      function* collectedMovies() {
        yield createMovie({ id: 20 });
        yield createMovie({ id: 10 });
      }

      upsertMovies(database, collectedMovies());

      expect(listMovies(database).map((movie) => movie.id)).toEqual([10, 20]);
    });

    it('leaves the data unchanged when given an empty iterable', () => {
      upsertMovies(database, [createMovie()]);

      upsertMovies(database, []);
      upsertMovies(database, new Set());

      expect(listMovies(database)).toEqual([
        { ...createMovie(), release_year: 2019 },
      ]);
    });

    it('keeps the last version given when an id appears several times', () => {
      upsertMovies(database, [
        createMovie({ title: 'Première version' }),
        createMovie({ id: 1 }),
        createMovie({ title: 'Dernière version' }),
      ]);

      expect(
        listMovies(database).map((movie) => [movie.id, movie.title]),
      ).toEqual([
        [1, 'Le Voyage imaginaire'],
        [496243, 'Dernière version'],
      ]);
    });

    it('rejects a movie without a title and keeps none of the batch', () => {
      upsertMovies(database, [createMovie({ id: 1, title: 'Déjà là' })]);

      expect(() =>
        upsertMovies(database, [
          createMovie({ id: 2 }),
          createMovie({ id: 1, title: 'Modifié avant l’échec' }),
          createMovie({ id: 3, title: null as unknown as string }),
        ]),
      ).toThrow(/NOT NULL constraint failed: movies.title/);

      expect(
        listMovies(database).map((movie) => [movie.id, movie.title]),
      ).toEqual([[1, 'Déjà là']]);
    });

    it.each(['runtime_minutes', 'budget', 'revenue'] as const)(
      'rejects a non-positive %s and keeps none of the batch',
      (column) => {
        expect(() =>
          upsertMovies(database, [
            createMovie({ id: 1 }),
            createMovie({ id: 2, [column]: 0 }),
          ]),
        ).toThrow(new RegExp(`CHECK constraint failed: ${column}`));

        expect(listMovies(database)).toEqual([]);
      },
    );

    it('works inside a transaction opened by the caller', () => {
      database.exec('BEGIN TRANSACTION;');
      upsertMovies(database, [createMovie({ id: 1 })]);
      expect(() =>
        upsertMovies(database, [
          createMovie({ id: 2 }),
          createMovie({ id: 3, budget: -5 }),
        ]),
      ).toThrow(/CHECK constraint failed: budget/);
      database.exec('COMMIT;');

      // The failed batch is cancelled, the caller's earlier write is kept
      expect(listMovies(database).map((movie) => movie.id)).toEqual([1]);
    });
  });
});
