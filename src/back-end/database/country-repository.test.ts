import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
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
});
