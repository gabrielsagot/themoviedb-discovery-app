import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteUnusedGenres,
  findGenreById,
  listGenres,
  upsertGenres,
} from './genre-repository';
import { initializeSchema } from './schema';

describe('genre-repository.ts', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(database);
  });

  afterEach(() => {
    database.close();
  });

  describe('findGenreById', () => {
    it('returns the genre with the given id', () => {
      upsertGenres(database, [
        { id: 35, name: 'Comédie' },
        { id: 12, name: 'Aventure' },
      ]);

      expect(findGenreById(database, 35)).toEqual({ id: 35, name: 'Comédie' });
    });

    it('returns undefined when no genre has the given id', () => {
      upsertGenres(database, [{ id: 35, name: 'Comédie' }]);

      expect(findGenreById(database, 99)).toBeUndefined();
    });
  });

  describe('listGenres', () => {
    it('returns an empty list when no genre is stored', () => {
      expect(listGenres(database)).toEqual([]);
    });

    it('returns the genres sorted by ascending id', () => {
      upsertGenres(database, [
        { id: 35, name: 'Comédie' },
        { id: 12, name: 'Aventure' },
        { id: 18, name: 'Drame' },
      ]);

      expect(listGenres(database)).toEqual([
        { id: 12, name: 'Aventure' },
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
      ]);
    });
  });

  describe('upsertGenres', () => {
    it('inserts new genres', () => {
      upsertGenres(database, [
        { id: 28, name: 'Action' },
        { id: 16, name: 'Animation' },
      ]);

      expect(listGenres(database)).toEqual([
        { id: 16, name: 'Animation' },
        { id: 28, name: 'Action' },
      ]);
    });

    it('updates the name of an existing genre without creating a duplicate', () => {
      upsertGenres(database, [{ id: 35, name: 'Comedy' }]);
      upsertGenres(database, [{ id: 35, name: 'Comédie' }]);

      expect(listGenres(database)).toEqual([{ id: 35, name: 'Comédie' }]);
    });

    it('accepts a Set of genres', () => {
      upsertGenres(
        database,
        new Set([
          { id: 28, name: 'Action' },
          { id: 16, name: 'Animation' },
        ]),
      );

      expect(listGenres(database)).toEqual([
        { id: 16, name: 'Animation' },
        { id: 28, name: 'Action' },
      ]);
    });

    it('accepts the values of a Map', () => {
      const genresById = new Map([
        [35, { id: 35, name: 'Comédie' }],
        [18, { id: 18, name: 'Drame' }],
      ]);

      upsertGenres(database, genresById.values());

      expect(listGenres(database)).toEqual([
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
      ]);
    });

    it('accepts a generator of genres', () => {
      function* tmdbGenres() {
        yield { id: 12, name: 'Aventure' };
        yield { id: 14, name: 'Fantastique' };
      }

      upsertGenres(database, tmdbGenres());

      expect(listGenres(database)).toEqual([
        { id: 12, name: 'Aventure' },
        { id: 14, name: 'Fantastique' },
      ]);
    });

    it('leaves the data unchanged when given an empty iterable', () => {
      upsertGenres(database, [{ id: 18, name: 'Drame' }]);

      upsertGenres(database, []);
      upsertGenres(database, new Set());

      expect(listGenres(database)).toEqual([{ id: 18, name: 'Drame' }]);
    });

    it('keeps the last name given when an id appears several times', () => {
      upsertGenres(database, [
        { id: 35, name: 'Comedy' },
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
      ]);

      expect(listGenres(database)).toEqual([
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
      ]);
    });

    it('rejects a genre without a name and keeps none of the batch', () => {
      upsertGenres(database, [{ id: 18, name: 'Drame' }]);

      expect(() =>
        upsertGenres(database, [
          { id: 35, name: 'Comédie' },
          { id: 12, name: null as unknown as string },
        ]),
      ).toThrow(/NOT NULL constraint failed: genres.name/);
      expect(listGenres(database)).toEqual([{ id: 18, name: 'Drame' }]);
    });
  });
  describe('deleteUnusedGenres', () => {
    /**
     * Stores a movie and associates it with the given genres.
     * @param movieId The TMDB identifier of the movie.
     * @param genreIds The genres to associate with the movie.
     */
    function insertMovieWithGenres(movieId: number, genreIds: number[]): void {
      database
        .prepare(
          `INSERT INTO movies (id, title, original_title, original_language, overview, collected_at)
           VALUES (?, 'Titre', 'Title', 'fr', '', '2026-11-03T00:00:00Z')`,
        )
        .run(movieId);
      const associate = database.prepare(
        'INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)',
      );
      for (const genreId of genreIds) {
        associate.run(movieId, genreId);
      }
    }

    it('deletes only the genres no movie is associated with', () => {
      upsertGenres(database, [
        { id: 12, name: 'Aventure' },
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
        { id: 99, name: 'Documentaire' },
      ]);
      insertMovieWithGenres(1, [35, 12]);
      insertMovieWithGenres(2, [35]);

      expect(deleteUnusedGenres(database)).toBe(2);
      expect(listGenres(database)).toEqual([
        { id: 12, name: 'Aventure' },
        { id: 35, name: 'Comédie' },
      ]);
    });

    it('keeps the movie associations untouched', () => {
      upsertGenres(database, [
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
      ]);
      insertMovieWithGenres(1, [35]);

      deleteUnusedGenres(database);

      expect(
        database.prepare('SELECT movie_id, genre_id FROM movie_genres').all(),
      ).toEqual([{ movie_id: 1, genre_id: 35 }]);
    });

    it('deletes every genre when no movie is stored', () => {
      upsertGenres(database, [
        { id: 18, name: 'Drame' },
        { id: 35, name: 'Comédie' },
      ]);

      expect(deleteUnusedGenres(database)).toBe(2);
      expect(listGenres(database)).toEqual([]);
    });

    it('returns 0 when every genre is used or none is stored', () => {
      expect(deleteUnusedGenres(database)).toBe(0);

      upsertGenres(database, [{ id: 35, name: 'Comédie' }]);
      insertMovieWithGenres(1, [35]);

      expect(deleteUnusedGenres(database)).toBe(0);
      expect(listGenres(database)).toEqual([{ id: 35, name: 'Comédie' }]);
    });
  });
});
