import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CountryCsvError,
  parseCountriesCsv,
  readCountriesCsv,
} from './country-csv';

// The UTF-8 byte order mark, written as an escape so it stays visible.
const BOM = String.fromCharCode(0xfeff);

describe('country-csv.ts', () => {
  describe('parseCountriesCsv', () => {
    describe('accepted formats', () => {
      it('parses the code and name columns', () => {
        expect(
          parseCountriesCsv('code,name\nFR,France\nBE,Belgique\n'),
        ).toEqual([
          { code: 'FR', name: 'France' },
          { code: 'BE', name: 'Belgique' },
        ]);
      });

      it('accepts the columns in any order and any case', () => {
        expect(parseCountriesCsv('NAME,Code\nFrance,FR\n')).toEqual([
          { code: 'FR', name: 'France' },
        ]);
      });

      it('accepts CRLF line endings and a UTF-8 BOM', () => {
        expect(
          parseCountriesCsv(
            `${BOM}code,name\r\nFR,France\r\nGB,Royaume-Uni\r\n`,
          ),
        ).toEqual([
          { code: 'FR', name: 'France' },
          { code: 'GB', name: 'Royaume-Uni' },
        ]);
      });

      it('trims the spaces around values', () => {
        expect(
          parseCountriesCsv(' code , name \n  US  ,  États-Unis  \n'),
        ).toEqual([{ code: 'US', name: 'États-Unis' }]);
      });

      it('accepts commas inside quoted fields and escaped quotes', () => {
        expect(
          parseCountriesCsv(
            'code,name\nKR,"Corée, République de"\nCI,"Côte d\'Ivoire, dite ""CI"""\n',
          ),
        ).toEqual([
          { code: 'KR', name: 'Corée, République de' },
          { code: 'CI', name: 'Côte d\'Ivoire, dite "CI"' },
        ]);
      });

      it('accepts spaces before and after a quoted field', () => {
        expect(parseCountriesCsv('code,name\nFR, "France" \n')).toEqual([
          { code: 'FR', name: 'France' },
        ]);
      });

      it('ignores empty lines', () => {
        expect(
          parseCountriesCsv('code,name\n\nFR,France\n\n\nBE,Belgique\n\n'),
        ).toEqual([
          { code: 'FR', name: 'France' },
          { code: 'BE', name: 'Belgique' },
        ]);
      });

      it('returns an empty list for a document with only the header', () => {
        expect(parseCountriesCsv('code,name')).toEqual([]);
        expect(parseCountriesCsv('code,name\r\n\r\n')).toEqual([]);
      });

      it('keeps every occurrence of a repeated code, in document order', () => {
        expect(
          parseCountriesCsv('code,name\nUS,United States\nUS,États-Unis\n'),
        ).toEqual([
          { code: 'US', name: 'United States' },
          { code: 'US', name: 'États-Unis' },
        ]);
      });
    });

    describe('invalid headers', () => {
      it.each([
        ['an empty document', ''],
        ['a document with only a BOM', BOM],
        ['a wrong column', 'iso,name\nFR,France\n'],
        ['a missing column', 'code\nFR\n'],
        ['an extra column', 'code,name,region\nFR,France,Europe\n'],
        ['a duplicated column', 'code,code\nFR,BE\n'],
        ['the genres columns', 'id,name\n35,Comédie\n'],
      ])('rejects %s', (_label, content) => {
        expect(() => parseCountriesCsv(content)).toThrow(CountryCsvError);
      });

      it('names the expected columns in the error', () => {
        expect(() => parseCountriesCsv('iso,name\nFR,France\n')).toThrow(
          'Invalid countries CSV header "iso,name": expected exactly the columns code and name.',
        );
      });
    });

    describe('invalid values', () => {
      it.each([
        ['a lowercase code', 'fr'],
        ['a mixed case code', 'Fr'],
        ['a three-letter code', 'FRA'],
        ['a one-letter code', 'F'],
        ['a numeric code', '25'],
        ['a code with a digit', 'F1'],
        ['an accented code', 'ÉT'],
        ['a code with an inner space', 'F R'],
        ['an empty code', ''],
      ])('rejects %s', (_label, code) => {
        expect(() => parseCountriesCsv(`code,name\n${code},France\n`)).toThrow(
          `Invalid country code "${code}" on line 2: expected two uppercase letters, such as FR.`,
        );
      });

      it.each([
        ['an empty name', ''],
        ['a blank name', '   '],
        ['an empty quoted name', '""'],
      ])('rejects %s', (_label, name) => {
        expect(() => parseCountriesCsv(`code,name\nFR,${name}\n`)).toThrow(
          'Missing country name on line 2.',
        );
      });

      it('reports the line of the invalid record', () => {
        expect(() =>
          parseCountriesCsv('code,name\nFR,France\n\nbe,Belgique\n'),
        ).toThrow('Invalid country code "be" on line 4');
      });
    });

    describe('invalid CSV syntax', () => {
      it('rejects an unclosed quote', () => {
        expect(() => parseCountriesCsv('code,name\nFR,"France\n')).toThrow(
          /^Invalid countries CSV: Quote Not Closed/,
        );
      });

      it('rejects a quote inside an unquoted field', () => {
        expect(() => parseCountriesCsv('code,name\nFR,Fra"nce\n')).toThrow(
          CountryCsvError,
        );
      });

      it('rejects a record with too many fields', () => {
        expect(() => parseCountriesCsv('code,name\nFR,France,EU\n')).toThrow(
          /^Invalid countries CSV: Invalid Record Length/,
        );
      });

      it('rejects a record with too few fields', () => {
        expect(() => parseCountriesCsv('code,name\nFR\n')).toThrow(
          /^Invalid countries CSV: Invalid Record Length/,
        );
      });
    });
  });

  describe('readCountriesCsv', () => {
    /**
     * Writes a CSV document to a new temporary file.
     * @param content The CSV document.
     * @returns The path to the file.
     */
    function writeCsvFile(content: string): string {
      const filePath = join(
        mkdtempSync(join(tmpdir(), 'countries-csv-')),
        'countries.csv',
      );
      writeFileSync(filePath, content, 'utf8');
      return filePath;
    }

    it('reads and parses a UTF-8 countries file', () => {
      const filePath = writeCsvFile(
        `${BOM}code,name\r\nFR,France\r\nUS,États-Unis\r\n`,
      );

      expect(readCountriesCsv(filePath)).toEqual([
        { code: 'FR', name: 'France' },
        { code: 'US', name: 'États-Unis' },
      ]);
    });

    it('propagates the validation errors of the file content', () => {
      const filePath = writeCsvFile('code,name\nfr,France\n');

      expect(() => readCountriesCsv(filePath)).toThrow(CountryCsvError);
    });

    it('reports a file that cannot be read', () => {
      const filePath = join(
        tmpdir(),
        'missing-directory-for-countries',
        'countries.csv',
      );

      expect(() => readCountriesCsv(filePath)).toThrow(CountryCsvError);
      expect(() => readCountriesCsv(filePath)).toThrow(
        `Cannot read countries CSV "${filePath}": ENOENT`,
      );
    });
  });
});
