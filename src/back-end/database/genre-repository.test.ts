import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findGenreById, listGenres, upsertGenres } from './genre-repository';
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
});
