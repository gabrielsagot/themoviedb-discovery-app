import { describe, expect, it } from 'vitest';
import type { CatalogCsvFormat } from './catalog-csv';
import { CatalogCsvError, parseCatalogCsv } from './catalog-csv';

/** A test error class, to check that each format raises its own errors. */
class TestCsvError extends CatalogCsvError {}

/**
 * Builds a test format that keeps the records as they are.
 * @param columns The columns the format expects.
 * @returns The test format.
 */
function testFormat(
  columns: readonly string[],
): CatalogCsvFormat<Record<string, string>> {
  return {
    label: 'tests',
    columns,
    createError: (message) => new TestCsvError(message),
    toRecord: (record) => ({ ...record }),
  };
}

describe('catalog-csv.ts', () => {
  describe('CatalogCsvError', () => {
    it('is named after the concrete error class', () => {
      const error = new TestCsvError('message');

      expect(error).toBeInstanceOf(CatalogCsvError);
      expect(error.name).toBe('TestCsvError');
      expect(error.message).toBe('message');
    });
  });

  describe('parseCatalogCsv', () => {
    it('supports formats with any number of columns', () => {
      expect(
        parseCatalogCsv(
          'Region,code,NAME\nEurope,FR,France\n',
          testFormat(['code', 'name', 'region']),
        ),
      ).toEqual([{ code: 'FR', name: 'France', region: 'Europe' }]);
    });

    it('trims the spaces around unquoted values and keeps quoted ones', () => {
      expect(
        parseCatalogCsv(
          'code,name\n FR , "  France  " \n',
          testFormat(['code', 'name']),
        ),
      ).toEqual([{ code: 'FR', name: '  France  ' }]);
    });

    it.each([
      [['name'], 'name'],
      [['code', 'name'], 'code and name'],
      [['code', 'name', 'region'], 'code, name and region'],
    ])('lists the expected columns %j as "%s"', (columns, description) => {
      expect(() => parseCatalogCsv('other\nx\n', testFormat(columns))).toThrow(
        `Invalid tests CSV header "other": expected exactly the columns ${description}.`,
      );
    });

    it('raises the error class of the format for every failure', () => {
      const format = testFormat(['code', 'name']);

      for (const content of ['', 'code\nFR\n', 'code,name\n"FR,France\n']) {
        expect(() => parseCatalogCsv(content, format)).toThrow(TestCsvError);
      }
    });

    it('names the expected header when the document is empty', () => {
      expect(() =>
        parseCatalogCsv('', testFormat(['code', 'name', 'region'])),
      ).toThrow(
        'Invalid tests CSV: the document is empty, expected the header code,name,region.',
      );
    });
  });
});
