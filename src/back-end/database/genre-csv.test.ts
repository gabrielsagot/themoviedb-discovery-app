import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GenreCsvError, parseGenresCsv, readGenresCsv } from './genre-csv';

// The UTF-8 byte order mark, written as an escape so it stays visible.
const BOM = String.fromCharCode(0xfeff);

describe('genre-csv.ts', () => {
  describe('parseGenresCsv', () => {
    describe('accepted formats', () => {
      it('parses the id and name columns', () => {
        expect(parseGenresCsv('id,name\n35,Comédie\n12,Aventure\n')).toEqual([
          { id: 35, name: 'Comédie' },
          { id: 12, name: 'Aventure' },
        ]);
      });

      it('accepts the columns in any order and any case', () => {
        expect(parseGenresCsv('NAME,Id\nComédie,35\n')).toEqual([
          { id: 35, name: 'Comédie' },
        ]);
      });

      it('accepts CRLF line endings and a UTF-8 BOM', () => {
        expect(
          parseGenresCsv(`${BOM}id,name\r\n35,Comédie\r\n12,Aventure\r\n`),
        ).toEqual([
          { id: 35, name: 'Comédie' },
          { id: 12, name: 'Aventure' },
        ]);
      });

      it('accepts commas inside quoted fields and escaped quotes', () => {
        expect(
          parseGenresCsv(
            'id,name\n10751,"Familial, jeunesse"\n99,"Le ""vrai"" documentaire"\n',
          ),
        ).toEqual([
          { id: 10751, name: 'Familial, jeunesse' },
          { id: 99, name: 'Le "vrai" documentaire' },
        ]);
      });

      it('ignores empty lines', () => {
        expect(
          parseGenresCsv('id,name\n\n35,Comédie\n\n\n12,Aventure\n\n'),
        ).toEqual([
          { id: 35, name: 'Comédie' },
          { id: 12, name: 'Aventure' },
        ]);
      });

      it('returns an empty list for a document with only the header', () => {
        expect(parseGenresCsv('id,name\n')).toEqual([]);
      });

      it('trims spaces around ids and names', () => {
        expect(parseGenresCsv('id,name\n 35 , Comédie \n')).toEqual([
          { id: 35, name: 'Comédie' },
        ]);
      });

      it('keeps every occurrence of a repeated id, in document order', () => {
        expect(parseGenresCsv('id,name\n35,Comedy\n35,Comédie\n')).toEqual([
          { id: 35, name: 'Comedy' },
          { id: 35, name: 'Comédie' },
        ]);
      });
    });

    describe('invalid headers', () => {
      it.each([
        ['an empty document', ''],
        ['a document with only a BOM', BOM],
        ['a wrong column', 'id,label\n35,Comédie\n'],
        ['a missing column', 'id\n35\n'],
        ['an extra column', 'id,name,extra\n35,Comédie,x\n'],
        ['a duplicated column', 'id,id\n35,12\n'],
      ])('rejects %s', (_label, content) => {
        expect(() => parseGenresCsv(content)).toThrow(GenreCsvError);
      });

      it('names the expected columns in the error', () => {
        expect(() => parseGenresCsv('id,label\n35,Comédie\n')).toThrow(
          'Invalid genres CSV header "id,label": expected exactly the columns id and name.',
        );
      });
    });

    describe('invalid values', () => {
      it.each([
        ['a decimal id', '1.5'],
        ['a zero id', '0'],
        ['a negative id', '-3'],
        ['a non numeric id', 'abc'],
        ['an empty id', ''],
        ['an exponent id', '1e3'],
        ['an id beyond the safe integer range', '9007199254740993'],
      ])('rejects %s', (_label, id) => {
        expect(() => parseGenresCsv(`id,name\n${id},Comédie\n`)).toThrow(
          `Invalid genre id "${id}" on line 2: expected a positive integer.`,
        );
      });

      it('accepts the largest safe integer id', () => {
        expect(parseGenresCsv('id,name\n9007199254740991,Comédie\n')).toEqual([
          { id: Number.MAX_SAFE_INTEGER, name: 'Comédie' },
        ]);
      });

      it.each([
        ['an empty name', ''],
        ['a blank name', '   '],
        ['an empty quoted name', '""'],
      ])('rejects %s', (_label, name) => {
        expect(() => parseGenresCsv(`id,name\n35,${name}\n`)).toThrow(
          'Missing genre name on line 2.',
        );
      });

      it('reports the line of the invalid record', () => {
        expect(() => parseGenresCsv('id,name\n35,Comédie\n\n12,\n')).toThrow(
          'Missing genre name on line 4.',
        );
      });
    });

    describe('invalid CSV syntax', () => {
      it('rejects an unclosed quote', () => {
        expect(() => parseGenresCsv('id,name\n35,"Comédie\n')).toThrow(
          /^Invalid genres CSV: Quote Not Closed/,
        );
      });

      it('rejects a quote inside an unquoted field', () => {
        expect(() => parseGenresCsv('id,name\n35,Com"édie\n')).toThrow(
          GenreCsvError,
        );
      });

      it('rejects a record with too many fields', () => {
        expect(() => parseGenresCsv('id,name\n35,Comédie,extra\n')).toThrow(
          /^Invalid genres CSV: Invalid Record Length/,
        );
      });

      it('rejects a record with too few fields', () => {
        expect(() => parseGenresCsv('id,name\n35\n')).toThrow(
          /^Invalid genres CSV: Invalid Record Length/,
        );
      });
    });
  });
  describe('readGenresCsv', () => {
    /**
     * Writes a CSV document to a new temporary file.
     * @param content The CSV document.
     * @returns The path to the file.
     */
    function writeCsvFile(content: string): string {
      const filePath = join(
        mkdtempSync(join(tmpdir(), 'genres-csv-')),
        'genres.csv',
      );
      writeFileSync(filePath, content, 'utf8');
      return filePath;
    }

    it('reads and parses a UTF-8 genres file', () => {
      const filePath = writeCsvFile(
        `${BOM}id,name\r\n35,Comédie\r\n878,Science-Fiction\r\n`,
      );

      expect(readGenresCsv(filePath)).toEqual([
        { id: 35, name: 'Comédie' },
        { id: 878, name: 'Science-Fiction' },
      ]);
    });

    it('propagates the validation errors of the file content', () => {
      const filePath = writeCsvFile('id,label\n35,Comédie\n');

      expect(() => readGenresCsv(filePath)).toThrow(GenreCsvError);
    });

    it('reports a file that cannot be read', () => {
      const filePath = join(
        tmpdir(),
        'missing-directory-for-genres',
        'genres.csv',
      );

      expect(() => readGenresCsv(filePath)).toThrow(GenreCsvError);
      expect(() => readGenresCsv(filePath)).toThrow(
        `Cannot read genres CSV "${filePath}": ENOENT`,
      );
    });
  });
});
