import { mkdtempSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovieInput } from '../types/DatabaseTypes';
import {
  importMoviesCsv,
  MovieCsvError,
  parseMoviesCsv,
  readMoviesCsv,
} from './movie-csv';
import { findMovieById, listMovies, upsertMovies } from './movie-repository';
import { initializeSchema } from './schema';

// The UTF-8 byte order mark, written as an escape so it stays visible.
const BOM = String.fromCharCode(0xfeff);

// The time given to the movies without a collected_at value.
const IMPORTED_AT = '2026-11-10T09:30:00.000Z';

// Every column of a movies CSV, in the order of the full header below.
const FULL_HEADER = [
  'id',
  'title',
  'original_title',
  'original_language',
  'overview',
  'release_date',
  'popularity',
  'vote_average',
  'vote_count',
  'poster_path',
  'backdrop_path',
  'runtime_minutes',
  'budget',
  'revenue',
  'collected_at',
];

// A valid value for every column of the full header.
const VALID_VALUES: Record<string, string> = {
  id: '496243',
  title: 'Le Voyage imaginaire',
  original_title: 'The Imaginary Journey',
  original_language: 'en',
  overview: 'Un film fictif.',
  release_date: '2019-05-30',
  popularity: '87.5',
  vote_average: '8.5',
  vote_count: '18000',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  runtime_minutes: '133',
  budget: '11000000',
  revenue: '262000000',
  collected_at: '2026-11-03T10:00:00Z',
};

// The movie the valid values above describe.
const VALID_MOVIE: MovieInput = {
  id: 496243,
  title: 'Le Voyage imaginaire',
  original_title: 'The Imaginary Journey',
  original_language: 'en',
  overview: 'Un film fictif.',
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
};

/**
 * Builds a one-movie CSV with the full header, overriding some values.
 * @param overrides The values to change, keyed by column.
 * @returns The CSV document.
 */
function movieCsv(overrides: Record<string, string> = {}): string {
  const values = { ...VALID_VALUES, ...overrides };
  return `${FULL_HEADER.join(',')}\n${FULL_HEADER.map((column) => values[column]).join(',')}\n`;
}

describe('movie-csv.ts', () => {
  describe('parseMoviesCsv', () => {
    describe('accepted formats', () => {
      it('parses every column', () => {
        expect(parseMoviesCsv(movieCsv(), IMPORTED_AT)).toEqual([VALID_MOVIE]);
      });

      it('accepts a header with only the required columns', () => {
        expect(
          parseMoviesCsv(
            'id,title,original_title,original_language\n7,Titre,Title,fr\n',
            IMPORTED_AT,
          ),
        ).toEqual([
          {
            id: 7,
            title: 'Titre',
            original_title: 'Title',
            original_language: 'fr',
            overview: '',
            release_date: null,
            popularity: null,
            vote_average: null,
            vote_count: null,
            poster_path: null,
            backdrop_path: null,
            runtime_minutes: null,
            budget: null,
            revenue: null,
            collected_at: IMPORTED_AT,
          },
        ]);
      });

      it('accepts the columns in any order and any case', () => {
        expect(
          parseMoviesCsv(
            'Original_Language,TITLE,Id,original_title\nfr,Titre,7,Title\n',
            IMPORTED_AT,
          ),
        ).toEqual([
          expect.objectContaining({
            id: 7,
            title: 'Titre',
            original_title: 'Title',
            original_language: 'fr',
          }),
        ]);
      });

      it('accepts CRLF line endings and a UTF-8 BOM', () => {
        const content = movieCsv().replaceAll('\n', '\r\n');

        expect(parseMoviesCsv(`${BOM}${content}`, IMPORTED_AT)).toEqual([
          VALID_MOVIE,
        ]);
      });

      it('trims the spaces around values', () => {
        expect(
          parseMoviesCsv(
            movieCsv({ id: ' 496243 ', title: '  Le Voyage imaginaire  ' }),
            IMPORTED_AT,
          ),
        ).toEqual([VALID_MOVIE]);
      });

      it('accepts commas inside quoted fields and escaped quotes', () => {
        expect(
          parseMoviesCsv(
            movieCsv({
              title: '"Le Voyage, imaginaire"',
              overview: '"Un film ""fictif"", pour les tests."',
            }),
            IMPORTED_AT,
          ),
        ).toEqual([
          {
            ...VALID_MOVIE,
            title: 'Le Voyage, imaginaire',
            overview: 'Un film "fictif", pour les tests.',
          },
        ]);
      });

      it('ignores empty lines', () => {
        const [header, row] = movieCsv().trimEnd().split('\n');

        expect(
          parseMoviesCsv(`${header}\n\n${row}\n\n\n`, IMPORTED_AT),
        ).toEqual([VALID_MOVIE]);
      });

      it('returns an empty list for a document with only the header', () => {
        expect(parseMoviesCsv(FULL_HEADER.join(','), IMPORTED_AT)).toEqual([]);
        expect(
          parseMoviesCsv(`${FULL_HEADER.join(',')}\r\n\r\n`, IMPORTED_AT),
        ).toEqual([]);
      });

      it('keeps every occurrence of a repeated id, in document order', () => {
        const [header, row] = movieCsv().trimEnd().split('\n');
        const renamed = row.replace('Le Voyage imaginaire', 'Autre version');

        expect(
          parseMoviesCsv(`${header}\n${row}\n${renamed}\n`, IMPORTED_AT).map(
            (movie) => movie.title,
          ),
        ).toEqual(['Le Voyage imaginaire', 'Autre version']);
      });

      it('uses the current time for a movie without collected_at by default', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-12-25T08:00:00.000Z'));
        try {
          expect(
            parseMoviesCsv(
              'id,title,original_title,original_language\n7,Titre,Title,fr\n',
            )[0].collected_at,
          ).toBe('2026-12-25T08:00:00.000Z');
        } finally {
          vi.useRealTimers();
        }
      });
    });

    describe('unknown values', () => {
      it('reads an empty value as unknown', () => {
        expect(
          parseMoviesCsv(
            movieCsv({
              release_date: '',
              popularity: '',
              vote_average: '',
              vote_count: '',
              poster_path: '',
              backdrop_path: '',
              runtime_minutes: '',
              budget: '',
              revenue: '',
              collected_at: '',
            }),
            IMPORTED_AT,
          ),
        ).toEqual([
          {
            ...VALID_MOVIE,
            release_date: null,
            popularity: null,
            vote_average: null,
            vote_count: null,
            poster_path: null,
            backdrop_path: null,
            runtime_minutes: null,
            budget: null,
            revenue: null,
            collected_at: IMPORTED_AT,
          },
        ]);
      });

      it('keeps an empty overview as an empty text', () => {
        expect(
          parseMoviesCsv(movieCsv({ overview: '' }), IMPORTED_AT)[0].overview,
        ).toBe('');
      });

      it('reads 0 as unknown for the runtime, budget and revenue', () => {
        expect(
          parseMoviesCsv(
            movieCsv({ runtime_minutes: '0', budget: '0', revenue: '0' }),
            IMPORTED_AT,
          ),
        ).toEqual([
          {
            ...VALID_MOVIE,
            runtime_minutes: null,
            budget: null,
            revenue: null,
          },
        ]);
      });

      it('keeps 0 as a real value for the popularity, votes and average', () => {
        expect(
          parseMoviesCsv(
            movieCsv({ popularity: '0', vote_average: '0', vote_count: '0' }),
            IMPORTED_AT,
          ),
        ).toEqual([
          { ...VALID_MOVIE, popularity: 0, vote_average: 0, vote_count: 0 },
        ]);
      });

      it('accepts a vote average of 10', () => {
        expect(
          parseMoviesCsv(movieCsv({ vote_average: '10' }), IMPORTED_AT)[0]
            .vote_average,
        ).toBe(10);
      });
    });

    describe('collected_at', () => {
      it.each([
        ['a date', '2026-11-03', '2026-11-03T00:00:00.000Z'],
        [
          'a date and time in UTC',
          '2026-11-03T10:00:00Z',
          '2026-11-03T10:00:00.000Z',
        ],
        [
          'a time without seconds',
          '2026-11-03T10:00Z',
          '2026-11-03T10:00:00.000Z',
        ],
        [
          'milliseconds',
          '2026-11-03T10:00:00.123Z',
          '2026-11-03T10:00:00.123Z',
        ],
        [
          'a positive offset',
          '2026-11-03T10:00:00+01:00',
          '2026-11-03T09:00:00.000Z',
        ],
        [
          'a negative offset',
          '2026-11-03T10:00:00-05:00',
          '2026-11-03T15:00:00.000Z',
        ],
      ])('accepts %s and stores it in UTC', (_label, value, expected) => {
        expect(
          parseMoviesCsv(movieCsv({ collected_at: value }), IMPORTED_AT)[0]
            .collected_at,
        ).toBe(expected);
      });
    });

    describe('invalid headers', () => {
      it.each([
        ['an empty document', ''],
        ['a blank document', '  \n'],
        ['a document with only a BOM', BOM],
      ])('rejects %s', (_label, content) => {
        expect(() => parseMoviesCsv(content, IMPORTED_AT)).toThrow(
          'Invalid movies CSV: the document is empty, expected a header with at least the columns id, title, original_title, original_language.',
        );
      });

      it.each(['id', 'title', 'original_title', 'original_language'])(
        'rejects a header without the required column %s',
        (column) => {
          const header = ['id', 'title', 'original_title', 'original_language']
            .filter((name) => name !== column)
            .join(',');

          expect(() => parseMoviesCsv(`${header}\n`, IMPORTED_AT)).toThrow(
            `Invalid movies CSV header "${header}": missing required column(s) ${column}.`,
          );
        },
      );

      it('rejects an unknown column', () => {
        expect(() =>
          parseMoviesCsv(
            'id,title,original_title,original_language,genres\n',
            IMPORTED_AT,
          ),
        ).toThrow(
          'Invalid movies CSV header "id,title,original_title,original_language,genres": unknown column(s) genres.',
        );
      });

      it('rejects a duplicated column', () => {
        expect(() =>
          parseMoviesCsv(
            'id,title,title,original_title,original_language\n',
            IMPORTED_AT,
          ),
        ).toThrow(
          'Invalid movies CSV header "id,title,title,original_title,original_language": duplicated column(s) title.',
        );
      });

      it('reports every problem of the header at once', () => {
        expect(() =>
          parseMoviesCsv('id,id,name,original_language\n', IMPORTED_AT),
        ).toThrow(
          'Invalid movies CSV header "id,id,name,original_language": missing required column(s) title, original_title; unknown column(s) name; duplicated column(s) id.',
        );
      });
    });

    describe('invalid values', () => {
      it.each([
        ['id', 'a zero id', '0', 'a positive integer'],
        ['id', 'a negative id', '-3', 'a positive integer'],
        ['id', 'a decimal id', '1.5', 'a positive integer'],
        ['id', 'a non numeric id', 'abc', 'a positive integer'],
        ['id', 'an empty id', '', 'a positive integer'],
        ['id', 'an exponent id', '1e3', 'a positive integer'],
        [
          'id',
          'an id beyond the safe integer range',
          '9007199254740993',
          'a positive integer',
        ],
        ['release_date', 'a year only', '2019', 'a date as YYYY-MM-DD'],
        [
          'release_date',
          'a date with slashes',
          '2019/05/30',
          'a date as YYYY-MM-DD',
        ],
        [
          'release_date',
          'a day first date',
          '30-05-2019',
          'a date as YYYY-MM-DD',
        ],
        [
          'release_date',
          'a date without zero padding',
          '2019-5-3',
          'a date as YYYY-MM-DD',
        ],
        [
          'release_date',
          'a non existent day',
          '2023-02-29',
          'a date as YYYY-MM-DD',
        ],
        [
          'release_date',
          'a non existent month',
          '2023-13-01',
          'a date as YYYY-MM-DD',
        ],
        [
          'release_date',
          'a date and time',
          '2019-05-30T10:00:00Z',
          'a date as YYYY-MM-DD',
        ],
        [
          'popularity',
          'a negative popularity',
          '-1',
          'a number greater than or equal to 0',
        ],
        [
          'popularity',
          'a non numeric popularity',
          'abc',
          'a number greater than or equal to 0',
        ],
        [
          'popularity',
          'an exponent popularity',
          '1e3',
          'a number greater than or equal to 0',
        ],
        [
          'popularity',
          'an infinite popularity',
          'Infinity',
          'a number greater than or equal to 0',
        ],
        [
          'popularity',
          'a hexadecimal popularity',
          '0x10',
          'a number greater than or equal to 0',
        ],
        [
          'vote_average',
          'an average above 10',
          '10.1',
          'a number between 0 and 10',
        ],
        [
          'vote_average',
          'a negative average',
          '-0.5',
          'a number between 0 and 10',
        ],
        ['vote_count', 'a decimal vote count', '1.5', 'a non-negative integer'],
        ['vote_count', 'a negative vote count', '-1', 'a non-negative integer'],
        [
          'runtime_minutes',
          'a negative runtime',
          '-90',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'runtime_minutes',
          'a decimal runtime',
          '90.5',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'runtime_minutes',
          'a non numeric runtime',
          'long',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'budget',
          'a negative budget',
          '-5',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'budget',
          'an exponent budget',
          '1e6',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'revenue',
          'a negative revenue',
          '-1',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'revenue',
          'a decimal revenue',
          '10.5',
          'a positive integer, or an empty value when unknown',
        ],
        [
          'collected_at',
          'a time without a time zone',
          '2026-11-03T10:00:00',
          'an ISO 8601 date',
        ],
        [
          'collected_at',
          'a non existent day',
          '2026-02-30T10:00:00Z',
          'an ISO 8601 date',
        ],
        ['collected_at', 'a day first date', '03/11/2026', 'an ISO 8601 date'],
        ['collected_at', 'text', 'yesterday', 'an ISO 8601 date'],
      ])('rejects %s (%s = %s)', (column, _label, value, expected) => {
        expect(() =>
          parseMoviesCsv(movieCsv({ [column]: value }), IMPORTED_AT),
        ).toThrow(
          `Invalid ${column} "${value}" on line 2: expected ${expected}`,
        );
      });

      it.each([
        ['an empty title', 'title', ''],
        ['a blank title', 'title', '   '],
        ['an empty quoted title', 'title', '""'],
        ['a blank quoted title', 'title', '"   "'],
        ['an empty original title', 'original_title', ''],
        ['an empty original language', 'original_language', ''],
      ])('rejects %s', (_label, column, value) => {
        expect(() =>
          parseMoviesCsv(movieCsv({ [column]: value }), IMPORTED_AT),
        ).toThrow(`Missing ${column} on line 2.`);
      });

      it('reports the line of the invalid record', () => {
        const [header, row] = movieCsv().trimEnd().split('\n');
        const invalid = row.replace('2019-05-30', '2019-02-30');

        expect(() =>
          parseMoviesCsv(`${header}\n${row}\n\n${invalid}\n`, IMPORTED_AT),
        ).toThrow('Invalid release_date "2019-02-30" on line 4');
      });
    });

    describe('invalid CSV syntax', () => {
      it('rejects an unclosed quote', () => {
        expect(() =>
          parseMoviesCsv(
            'id,title,original_title,original_language\n7,"Titre,Title,fr\n',
            IMPORTED_AT,
          ),
        ).toThrow(/^Invalid movies CSV: Quote Not Closed/);
      });

      it('rejects a quote inside an unquoted field', () => {
        expect(() =>
          parseMoviesCsv(
            'id,title,original_title,original_language\n7,Ti"tre,Title,fr\n',
            IMPORTED_AT,
          ),
        ).toThrow(MovieCsvError);
      });

      it('rejects a record with too many fields', () => {
        expect(() =>
          parseMoviesCsv(
            'id,title,original_title,original_language\n7,Titre,Title,fr,extra\n',
            IMPORTED_AT,
          ),
        ).toThrow(/^Invalid movies CSV: Invalid Record Length/);
      });

      it('rejects a record with too few fields', () => {
        expect(() =>
          parseMoviesCsv(
            'id,title,original_title,original_language\n7,Titre\n',
            IMPORTED_AT,
          ),
        ).toThrow(/^Invalid movies CSV: Invalid Record Length/);
      });
    });
  });

  describe('readMoviesCsv', () => {
    /**
     * Writes a CSV document to a new temporary file.
     * @param content The CSV document.
     * @returns The path to the file.
     */
    function writeCsvFile(content: string): string {
      const filePath = join(
        mkdtempSync(join(tmpdir(), 'movies-csv-')),
        'movies.csv',
      );
      writeFileSync(filePath, content, 'utf8');
      return filePath;
    }

    it('reads and parses a UTF-8 movies file', () => {
      const filePath = writeCsvFile(`${BOM}${movieCsv()}`);

      expect(readMoviesCsv(filePath, IMPORTED_AT)).toEqual([VALID_MOVIE]);
    });

    it('uses the current time for a movie without collected_at by default', () => {
      const filePath = writeCsvFile(
        'id,title,original_title,original_language\n7,Titre,Title,fr\n',
      );
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-25T08:00:00.000Z'));
      try {
        expect(readMoviesCsv(filePath)[0].collected_at).toBe(
          '2026-12-25T08:00:00.000Z',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('propagates the validation errors of the file content', () => {
      const filePath = writeCsvFile(movieCsv({ id: '0' }));

      expect(() => readMoviesCsv(filePath, IMPORTED_AT)).toThrow(MovieCsvError);
    });

    it('reports a file that cannot be read', () => {
      const filePath = join(tmpdir(), 'missing-directory-for-movies', 'a.csv');

      expect(() => readMoviesCsv(filePath, IMPORTED_AT)).toThrow(MovieCsvError);
      expect(() => readMoviesCsv(filePath, IMPORTED_AT)).toThrow(
        `Cannot read movies CSV "${filePath}": ENOENT`,
      );
    });
  });

  describe('importMoviesCsv', () => {
    let database: DatabaseSync;
    let directory: string;

    /**
     * Writes a CSV document in the temporary directory.
     * @param content The CSV document.
     * @returns The path to the file.
     */
    function writeCsv(content: string): string {
      const filePath = join(directory, 'movies.csv');
      writeFileSync(filePath, content, 'utf8');
      return filePath;
    }

    /**
     * Builds a CSV with several movies, from the first valid row.
     * @param ids The ids of the movies; each row copies the valid movie.
     * @returns The CSV document.
     */
    function moviesCsv(...ids: number[]): string {
      const [header, row] = movieCsv().trimEnd().split('\n');
      return `${header}\n${ids.map((id) => row.replace('496243', String(id))).join('\n')}\n`;
    }

    beforeEach(() => {
      database = new DatabaseSync(':memory:');
      database.exec('PRAGMA foreign_keys = ON;');
      initializeSchema(database);
      directory = mkdtempSync(join(tmpdir(), 'import-movies-'));
    });

    afterEach(() => {
      database.close();
    });

    it('imports the movies of the file and returns their number', () => {
      const filePath = writeCsv(moviesCsv(30, 10, 20));

      expect(importMoviesCsv(database, filePath, IMPORTED_AT)).toBe(3);
      expect(listMovies(database).map((movie) => movie.id)).toEqual([
        10, 20, 30,
      ]);
      expect(findMovieById(database, 10)).toEqual({
        ...VALID_MOVIE,
        id: 10,
        release_year: 2019,
      });
    });

    it('updates the existing movies without creating duplicates', () => {
      upsertMovies(database, [
        { ...VALID_MOVIE, id: 1, title: 'Ancien titre' },
        { ...VALID_MOVIE, id: 2, title: 'Intact' },
      ]);
      const filePath = writeCsv(
        movieCsv({ id: '1', title: 'Nouveau titre', popularity: '12' }),
      );

      expect(importMoviesCsv(database, filePath, IMPORTED_AT)).toBe(1);

      expect(
        listMovies(database).map((movie) => [
          movie.id,
          movie.title,
          movie.popularity,
        ]),
      ).toEqual([
        [1, 'Nouveau titre', 12],
        [2, 'Intact', 87.5],
      ]);
    });

    it('keeps the genres and countries of an updated movie', () => {
      database.exec(`
        INSERT INTO genres (id, name) VALUES (35, 'Comédie');
        INSERT INTO countries (code, name) VALUES ('FR', 'France');
      `);
      upsertMovies(database, [{ ...VALID_MOVIE, id: 1 }]);
      database.exec(`
        INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 35);
        INSERT INTO production_countries (movie_id, country_code) VALUES (1, 'FR');
      `);

      importMoviesCsv(
        database,
        writeCsv(movieCsv({ id: '1', title: 'Actualisé' })),
        IMPORTED_AT,
      );

      expect(
        database.prepare('SELECT COUNT(*) AS count FROM movie_genres').get(),
      ).toEqual({ count: 1 });
      expect(
        database
          .prepare('SELECT COUNT(*) AS count FROM production_countries')
          .get(),
      ).toEqual({ count: 1 });
    });

    it('replaces the stored movie as a whole: a missing column becomes unknown', () => {
      upsertMovies(database, [{ ...VALID_MOVIE, id: 1 }]);
      const filePath = writeCsv(
        'id,title,original_title,original_language\n1,Titre,Title,fr\n',
      );

      importMoviesCsv(database, filePath, IMPORTED_AT);

      expect(findMovieById(database, 1)).toEqual({
        id: 1,
        title: 'Titre',
        original_title: 'Title',
        original_language: 'fr',
        overview: '',
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
        collected_at: IMPORTED_AT,
      });
    });

    it('counts a movie repeated in the file once and keeps its last version', () => {
      const [header, row] = movieCsv().trimEnd().split('\n');
      const filePath = writeCsv(
        `${header}\n${row}\n${row.replace('Le Voyage imaginaire', 'Dernière version')}\n`,
      );

      expect(importMoviesCsv(database, filePath, IMPORTED_AT)).toBe(1);
      expect(findMovieById(database, 496243)?.title).toBe('Dernière version');
    });

    it('imports 0 movies for a file with only the header', () => {
      upsertMovies(database, [VALID_MOVIE]);

      expect(
        importMoviesCsv(database, writeCsv(FULL_HEADER.join(',')), IMPORTED_AT),
      ).toBe(0);
      expect(listMovies(database)).toHaveLength(1);
    });

    it('writes nothing when a value of the file is invalid', () => {
      // The invalid value is on the last line: nothing may be written
      // before the whole file has been checked.
      const [header, row] = movieCsv().trimEnd().split('\n');
      const invalid = row.replace('2019-05-30', '2019-02-30');
      const filePath = writeCsv(`${header}\n${row}\n${invalid}\n`);

      expect(() => importMoviesCsv(database, filePath, IMPORTED_AT)).toThrow(
        'Invalid release_date "2019-02-30" on line 3',
      );
      expect(listMovies(database)).toEqual([]);
    });

    it('reports a file that cannot be read and writes nothing', () => {
      const filePath = join(directory, 'missing.csv');

      expect(() => importMoviesCsv(database, filePath, IMPORTED_AT)).toThrow(
        MovieCsvError,
      );
      expect(listMovies(database)).toEqual([]);
    });

    it('cancels the whole import when a write fails', () => {
      // A trigger makes SQLite refuse the movie 999, so the import fails
      // halfway through, after the first movies have been written.
      upsertMovies(database, [
        { ...VALID_MOVIE, id: 1, title: 'Titre d’origine' },
      ]);
      database.exec(`
        CREATE TRIGGER reject_movie_999 BEFORE INSERT ON movies
        WHEN NEW.id = 999
        BEGIN SELECT RAISE(ABORT, 'movie 999 rejected'); END;
      `);
      const [header, row] = movieCsv().trimEnd().split('\n');
      const filePath = writeCsv(
        `${header}\n${row.replace('496243', '2')}\n${row.replace('496243', '1')}\n${row.replace('496243', '999')}\n`,
      );

      expect(() => importMoviesCsv(database, filePath, IMPORTED_AT)).toThrow(
        'movie 999 rejected',
      );
      expect(
        listMovies(database).map((movie) => [movie.id, movie.title]),
      ).toEqual([[1, 'Titre d’origine']]);
    });

    it('uses the current time for the movies without collected_at by default', () => {
      const filePath = writeCsv(
        'id,title,original_title,original_language\n7,Titre,Title,fr\n',
      );
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-25T08:00:00.000Z'));
      try {
        importMoviesCsv(database, filePath);
      } finally {
        vi.useRealTimers();
      }

      expect(findMovieById(database, 7)?.collected_at).toBe(
        '2026-12-25T08:00:00.000Z',
      );
    });
  });
});
