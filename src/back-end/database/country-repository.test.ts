import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteUnusedCountries,
  findCountryByCode,
  listCountries,
  upsertCountries,
} from './country-repository';
import { initializeSchema } from './schema';

describe('country-repository.ts', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(database);
  });

  afterEach(() => {
    database.close();
  });

  describe('findCountryByCode', () => {
    it('returns the country with the given code', () => {
      upsertCountries(database, [
        { code: 'FR', name: 'France' },
        { code: 'BE', name: 'Belgique' },
      ]);

      expect(findCountryByCode(database, 'FR')).toEqual({
        code: 'FR',
        name: 'France',
      });
    });

    it('returns undefined when no country has the given code', () => {
      upsertCountries(database, [{ code: 'FR', name: 'France' }]);

      expect(findCountryByCode(database, 'US')).toBeUndefined();
    });

    it('returns undefined when no country is stored', () => {
      expect(findCountryByCode(database, 'FR')).toBeUndefined();
    });
  });

  describe('listCountries', () => {
    it('returns an empty list when no country is stored', () => {
      expect(listCountries(database)).toEqual([]);
    });

    it('returns the countries sorted by ascending code', () => {
      upsertCountries(database, [
        { code: 'US', name: 'États-Unis' },
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
        { code: 'GB', name: 'Royaume-Uni' },
      ]);

      expect(listCountries(database).map((country) => country.code)).toEqual([
        'BE',
        'FR',
        'GB',
        'US',
      ]);
    });
  });

  describe('upsertCountries', () => {
    it('inserts new countries', () => {
      upsertCountries(database, [
        { code: 'FR', name: 'France' },
        { code: 'BE', name: 'Belgique' },
      ]);

      expect(listCountries(database)).toEqual([
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
      ]);
    });

    it('updates the name of an existing country without creating a duplicate', () => {
      upsertCountries(database, [
        { code: 'US', name: 'United States of America' },
      ]);
      upsertCountries(database, [{ code: 'US', name: 'États-Unis' }]);

      expect(listCountries(database)).toEqual([
        { code: 'US', name: 'États-Unis' },
      ]);
    });

    it('accepts a Set of countries', () => {
      upsertCountries(
        database,
        new Set([
          { code: 'FR', name: 'France' },
          { code: 'BE', name: 'Belgique' },
        ]),
      );

      expect(listCountries(database)).toEqual([
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
      ]);
    });

    it('accepts the values of a Map', () => {
      const countriesByCode = new Map([
        ['GB', { code: 'GB', name: 'Royaume-Uni' }],
        ['DE', { code: 'DE', name: 'Allemagne' }],
      ]);

      upsertCountries(database, countriesByCode.values());

      expect(listCountries(database)).toEqual([
        { code: 'DE', name: 'Allemagne' },
        { code: 'GB', name: 'Royaume-Uni' },
      ]);
    });

    it('accepts a generator of countries', () => {
      function* productionCountries() {
        yield { code: 'JP', name: 'Japon' };
        yield { code: 'KR', name: 'Corée du Sud' };
      }

      upsertCountries(database, productionCountries());

      expect(listCountries(database)).toEqual([
        { code: 'JP', name: 'Japon' },
        { code: 'KR', name: 'Corée du Sud' },
      ]);
    });

    it('leaves the data unchanged when given an empty iterable', () => {
      upsertCountries(database, [{ code: 'FR', name: 'France' }]);

      upsertCountries(database, []);
      upsertCountries(database, new Set());

      expect(listCountries(database)).toEqual([{ code: 'FR', name: 'France' }]);
    });

    it('keeps the last name given when a code appears several times', () => {
      upsertCountries(database, [
        { code: 'US', name: 'United States of America' },
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'États-Unis' },
      ]);

      expect(listCountries(database)).toEqual([
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'États-Unis' },
      ]);
    });

    it('rejects a country without a name and keeps none of the batch', () => {
      upsertCountries(database, [{ code: 'FR', name: 'France' }]);

      expect(() =>
        upsertCountries(database, [
          { code: 'BE', name: 'Belgique' },
          { code: 'US', name: null as unknown as string },
        ]),
      ).toThrow(/NOT NULL constraint failed: countries.name/);
      expect(listCountries(database)).toEqual([{ code: 'FR', name: 'France' }]);
    });
  });
  describe('deleteUnusedCountries', () => {
    /**
     * Stores a movie and associates it with the given production countries.
     * @param movieId The TMDB identifier of the movie.
     * @param countryCodes The countries to associate with the movie.
     */
    function insertMovieWithCountries(
      movieId: number,
      countryCodes: string[],
    ): void {
      database
        .prepare(
          `INSERT INTO movies (id, title, original_title, original_language, overview, collected_at)
           VALUES (?, 'Titre', 'Title', 'fr', '', '2026-11-09T00:00:00Z')`,
        )
        .run(movieId);
      const associate = database.prepare(
        'INSERT INTO production_countries (movie_id, country_code) VALUES (?, ?)',
      );
      for (const countryCode of countryCodes) {
        associate.run(movieId, countryCode);
      }
    }

    it('deletes only the countries no movie is associated with', () => {
      upsertCountries(database, [
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
        { code: 'GB', name: 'Royaume-Uni' },
        { code: 'US', name: 'États-Unis' },
      ]);
      insertMovieWithCountries(1, ['FR', 'BE']);
      insertMovieWithCountries(2, ['FR']);

      expect(deleteUnusedCountries(database)).toBe(2);
      expect(listCountries(database)).toEqual([
        { code: 'BE', name: 'Belgique' },
        { code: 'FR', name: 'France' },
      ]);
    });

    it('keeps the movie associations untouched', () => {
      upsertCountries(database, [
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'États-Unis' },
      ]);
      insertMovieWithCountries(1, ['FR']);

      deleteUnusedCountries(database);

      expect(
        database
          .prepare('SELECT movie_id, country_code FROM production_countries')
          .all(),
      ).toEqual([{ movie_id: 1, country_code: 'FR' }]);
    });

    it('deletes every country when no movie is stored', () => {
      upsertCountries(database, [
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'États-Unis' },
      ]);

      expect(deleteUnusedCountries(database)).toBe(2);
      expect(listCountries(database)).toEqual([]);
    });

    it('returns 0 when every country is used or none is stored', () => {
      expect(deleteUnusedCountries(database)).toBe(0);

      upsertCountries(database, [{ code: 'FR', name: 'France' }]);
      insertMovieWithCountries(1, ['FR']);

      expect(deleteUnusedCountries(database)).toBe(0);
      expect(listCountries(database)).toEqual([{ code: 'FR', name: 'France' }]);
    });
  });
});
