import { describe, expect, it } from 'vitest';
import {
  createDiscoverQueryParams,
  validateReleaseYear,
} from './discover-query-params';

describe('discover-query-params.ts', () => {
  describe('validateReleaseYear', () => {
    it.each(['1000', '1999', '2020', '9999'])('accepts the year %s', (year) => {
      expect(validateReleaseYear(year)).toBeUndefined();
    });

    it.each([undefined, ''])('requires a year (%j)', (year) => {
      expect(validateReleaseYear(year)).toBe(
        'The year query parameter is required, e.g. ?year=2020.',
      );
    });

    it.each([
      ['a number below 1000', '0999'],
      ['a three-digit year', '999'],
      ['a five-digit year', '20201'],
      ['a negative year', '-202'],
      ['a decimal year', '2020.5'],
      ['a year with spaces', ' 2020'],
      ['a year with a sign', '+2020'],
      ['a non numeric year', 'abcd'],
      ['an exponent', '2e03'],
    ])('rejects %s', (_label, year) => {
      expect(validateReleaseYear(year)).toBe(
        `Invalid year "${year}": expected a four-digit year between 1000 and 9999.`,
      );
    });

    it.each([
      ['a repeated parameter', ['2020', '2021']],
      ['a structured parameter', { from: '2020' }],
    ])('rejects %s', (_label, year) => {
      expect(validateReleaseYear(year)).toBe(
        'The year query parameter must be given once, as a four-digit year.',
      );
    });
  });

  describe('createDiscoverQueryParams', () => {
    it('sends the year as primary_release_year with the default options', () => {
      const result = createDiscoverQueryParams({ year: '2020' });

      expect(result.ok).toBe(true);
      expect(result.ok && result.params.toString()).toBe(
        'primary_release_year=2020&language=fr-FR&page=1&region=FR',
      );
    });

    it('sends the language, page and region given as strings', () => {
      const result = createDiscoverQueryParams({
        year: '2020',
        language: 'en-US',
        page: '2',
        region: 'US',
      });

      expect(result.ok && result.params.toString()).toBe(
        'primary_release_year=2020&language=en-US&page=2&region=US',
      );
    });

    it('falls back to the defaults for empty, repeated or structured options', () => {
      const result = createDiscoverQueryParams({
        year: '2020',
        language: '',
        page: ['2', '3'],
        region: { code: 'US' },
      });

      expect(result.ok && result.params.toString()).toBe(
        'primary_release_year=2020&language=fr-FR&page=1&region=FR',
      );
    });

    it('returns the error of an invalid year without building parameters', () => {
      expect(createDiscoverQueryParams({ year: '20' })).toEqual({
        ok: false,
        error:
          'Invalid year "20": expected a four-digit year between 1000 and 9999.',
      });
    });

    it('returns an error when the year is missing', () => {
      expect(createDiscoverQueryParams({ language: 'en-US' })).toEqual({
        ok: false,
        error: 'The year query parameter is required, e.g. ?year=2020.',
      });
    });
  });
});
