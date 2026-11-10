import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listCountries } from '../database/country-repository';
import { listGenres, upsertGenres } from '../database/genre-repository';
import { findMovieById, listMovies } from '../database/movie-repository';
import { initializeSchema } from '../database/schema';
import type { Country, Genre } from '../types/DatabaseTypes';
import type { TmdbMovieDetailsRaw } from '../types/TmdbSyncTypes';
import type { TmdbSource } from './tmdb-client';
import { createTmdbClient, TmdbApiError } from './tmdb-client';
import {
  DEFAULT_MOVIES_PER_YEAR,
  syncCountries,
  syncGenres,
  syncMoviesOfYear,
  toMovieInput,
  updateDatabaseFromTmdb,
} from './tmdb-sync-service';

const COLLECTED_AT = '2026-11-10T10:00:00.000Z';
const NOW = () => new Date(COLLECTED_AT);

/**
 * Builds the details of a TMDB movie, overriding any property.
 * @param id The TMDB movie id.
 * @param overrides The properties to change from the default details.
 * @returns The details, as TMDB returns them.
 */
function createDetails(
  id: number,
  overrides: Partial<TmdbMovieDetailsRaw> = {},
): TmdbMovieDetailsRaw {
  return {
    id,
    title: `Film ${id}`,
    original_title: `Movie ${id}`,
    original_language: 'en',
    overview: `Résumé du film ${id}.`,
    release_date: '2020-05-01',
    popularity: 50.5,
    vote_average: 7.5,
    vote_count: 1200,
    poster_path: `/poster-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    runtime: 120,
    budget: 5000000,
    revenue: 20000000,
    genres: [{ id: 35, name: 'Comédie' }],
    production_countries: [{ iso_3166_1: 'FR', name: 'France' }],
    ...overrides,
  };
}

/** What a fake TMDB source answers. */
type FakeData = {
  genres?: Genre[];
  countries?: Country[];
  // The movie ids of each page of each year.
  pages?: Record<number, number[][]>;
  // The details of each movie; an Error is thrown instead of returned.
  details?: Record<number, TmdbMovieDetailsRaw | Error>;
};

/**
 * Builds a fake TMDB source whose every method is a spy.
 * @param data What the source answers.
 * @returns The fake source.
 */
function createFakeSource(data: FakeData = {}) {
  return {
    getGenres: vi.fn(async () => data.genres ?? []),
    getCountries: vi.fn(async () => data.countries ?? []),
    discoverMovies: vi.fn(async (year: number, page: number) => {
      const pages = data.pages?.[year] ?? [];
      return {
        page,
        totalPages: pages.length,
        movieIds: pages[page - 1] ?? [],
      };
    }),
    getMovieDetails: vi.fn(async (id: number) => {
      const details = data.details?.[id] ?? createDetails(id);
      if (details instanceof Error) throw details;
      return details;
    }),
  } satisfies TmdbSource;
}

describe('tmdb-sync-service.ts', () => {
  let database: DatabaseSync;

  /**
   * Lists the genres attached to a movie.
   * @param movieId The TMDB identifier of the movie.
   * @returns The genre ids, sorted.
   */
  function genresOf(movieId: number): number[] {
    return database
      .prepare(
        'SELECT genre_id FROM movie_genres WHERE movie_id = ? ORDER BY genre_id',
      )
      .all(movieId)
      .map((row) => Number(row.genre_id));
  }

  /**
   * Lists the countries attached to a movie.
   * @param movieId The TMDB identifier of the movie.
   * @returns The country codes, sorted.
   */
  function countriesOf(movieId: number): string[] {
    return database
      .prepare(
        'SELECT country_code FROM production_countries WHERE movie_id = ? ORDER BY country_code',
      )
      .all(movieId)
      .map((row) => String(row.country_code));
  }

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(database);
  });

  afterEach(() => {
    database.close();
    vi.useRealTimers();
  });

  describe('toMovieInput', () => {
    it('converts the details of a movie', () => {
      expect(toMovieInput(createDetails(7), COLLECTED_AT)).toEqual({
        id: 7,
        title: 'Film 7',
        original_title: 'Movie 7',
        original_language: 'en',
        overview: 'Résumé du film 7.',
        release_date: '2020-05-01',
        popularity: 50.5,
        vote_average: 7.5,
        vote_count: 1200,
        poster_path: '/poster-7.jpg',
        backdrop_path: '/backdrop-7.jpg',
        runtime_minutes: 120,
        budget: 5000000,
        revenue: 20000000,
        collected_at: COLLECTED_AT,
      });
    });

    it.each([
      ['an empty date', ''],
      ['a missing date', null],
      ['a year only', '2020'],
      ['an impossible day', '2023-02-29'],
      ['text', 'soon'],
    ])('reads %s as an unknown release date', (_label, releaseDate) => {
      expect(
        toMovieInput(
          createDetails(7, { release_date: releaseDate }),
          COLLECTED_AT,
        ).release_date,
      ).toBeNull();
    });

    it.each([
      ['runtime_minutes', 'runtime'],
      ['budget', 'budget'],
      ['revenue', 'revenue'],
    ] as const)(
      'reads a %s of 0 or a missing one as unknown',
      (column, key) => {
        for (const value of [0, null]) {
          expect(
            toMovieInput(createDetails(7, { [key]: value }), COLLECTED_AT)[
              column
            ],
          ).toBeNull();
        }
      },
    );

    it('keeps a popularity, vote average and vote count of 0', () => {
      const movie = toMovieInput(
        createDetails(7, { popularity: 0, vote_average: 0, vote_count: 0 }),
        COLLECTED_AT,
      );

      expect([movie.popularity, movie.vote_average, movie.vote_count]).toEqual([
        0, 0, 0,
      ]);
    });

    it('leaves a missing popularity, vote average and vote count unknown', () => {
      const movie = toMovieInput(
        createDetails(7, {
          popularity: null,
          vote_average: null,
          vote_count: null,
        }),
        COLLECTED_AT,
      );

      expect([movie.popularity, movie.vote_average, movie.vote_count]).toEqual([
        null,
        null,
        null,
      ]);
    });

    it('reads a missing overview as an empty text and missing images as unknown', () => {
      const movie = toMovieInput(
        createDetails(7, {
          overview: null,
          poster_path: null,
          backdrop_path: null,
        }),
        COLLECTED_AT,
      );

      expect(movie.overview).toBe('');
      expect(movie.poster_path).toBeNull();
      expect(movie.backdrop_path).toBeNull();
    });
  });

  describe('syncGenres', () => {
    it('inserts the genres of TMDB and returns their number', async () => {
      const source = createFakeSource({
        genres: [
          { id: 35, name: 'Comédie' },
          { id: 12, name: 'Aventure' },
        ],
      });

      expect(await syncGenres(database, source, 'fr-FR')).toBe(2);

      expect(listGenres(database)).toEqual([
        { id: 12, name: 'Aventure' },
        { id: 35, name: 'Comédie' },
      ]);
      expect(source.getGenres).toHaveBeenCalledWith('fr-FR');
    });

    it('renames the existing genres without creating duplicates', async () => {
      upsertGenres(database, [{ id: 35, name: 'Comedy' }]);

      await syncGenres(
        database,
        createFakeSource({ genres: [{ id: 35, name: 'Comédie' }] }),
      );

      expect(listGenres(database)).toEqual([{ id: 35, name: 'Comédie' }]);
    });

    it('asks for French names by default', async () => {
      const source = createFakeSource();

      await syncGenres(database, source);

      expect(source.getGenres).toHaveBeenCalledWith('fr-FR');
    });

    it('returns 0 and changes nothing when TMDB has no genre', async () => {
      upsertGenres(database, [{ id: 35, name: 'Comédie' }]);

      expect(await syncGenres(database, createFakeSource())).toBe(0);
      expect(listGenres(database)).toEqual([{ id: 35, name: 'Comédie' }]);
    });

    it('propagates a failure of TMDB', async () => {
      const source = createFakeSource();
      const failure = new TmdbApiError(500, 'TMDB is down');
      source.getGenres.mockRejectedValueOnce(failure);

      await expect(syncGenres(database, source)).rejects.toBe(failure);
    });
  });

  describe('syncCountries', () => {
    it('inserts the countries of TMDB and returns their number', async () => {
      const source = createFakeSource({
        countries: [
          { code: 'FR', name: 'France' },
          { code: 'BE', name: 'Belgium' },
        ],
      });

      expect(await syncCountries(database, source)).toBe(2);

      expect(listCountries(database)).toEqual([
        { code: 'BE', name: 'Belgium' },
        { code: 'FR', name: 'France' },
      ]);
    });

    it('renames the existing countries without creating duplicates', async () => {
      database.exec("INSERT INTO countries (code, name) VALUES ('US', 'USA')");

      await syncCountries(
        database,
        createFakeSource({
          countries: [{ code: 'US', name: 'United States' }],
        }),
      );

      expect(listCountries(database)).toEqual([
        { code: 'US', name: 'United States' },
      ]);
    });

    it('propagates a failure of TMDB', async () => {
      const source = createFakeSource();
      const failure = new TypeError('fetch failed');
      source.getCountries.mockRejectedValueOnce(failure);

      await expect(syncCountries(database, source)).rejects.toBe(failure);
    });
  });

  describe('syncMoviesOfYear', () => {
    const options = { moviesPerYear: 100, language: 'fr-FR', now: NOW };

    it('stores each movie with its genres and countries', async () => {
      const source = createFakeSource({
        pages: { 2020: [[1, 2]] },
        details: {
          1: createDetails(1, {
            genres: [
              { id: 35, name: 'Comédie' },
              { id: 12, name: 'Aventure' },
            ],
            production_countries: [
              { iso_3166_1: 'FR', name: 'France' },
              { iso_3166_1: 'BE', name: 'Belgium' },
            ],
          }),
        },
      });

      const result = await syncMoviesOfYear(database, source, 2020, options);

      expect(result).toEqual({ movies: 2, failures: [] });
      expect(listMovies(database).map((movie) => movie.id)).toEqual([1, 2]);
      expect(findMovieById(database, 1)).toEqual({
        ...toMovieInput(createDetails(1), COLLECTED_AT),
        release_year: 2020,
      });
      expect(genresOf(1)).toEqual([12, 35]);
      expect(countriesOf(1)).toEqual(['BE', 'FR']);
      // The genres and countries of the movies are created on the way
      expect(listGenres(database).map((genre) => genre.id)).toEqual([12, 35]);
      expect(listCountries(database).map((country) => country.code)).toEqual([
        'BE',
        'FR',
      ]);
    });

    it('applies the rules of the data model to the movies it stores', async () => {
      const source = createFakeSource({
        pages: { 2020: [[1]] },
        details: {
          1: createDetails(1, {
            release_date: '',
            runtime: 0,
            budget: 0,
            revenue: 0,
          }),
        },
      });

      await syncMoviesOfYear(database, source, 2020, options);

      expect(findMovieById(database, 1)).toMatchObject({
        release_date: null,
        release_year: null,
        runtime_minutes: null,
        budget: null,
        revenue: null,
      });
    });

    it('reads the pages until enough movies are collected', async () => {
      const source = createFakeSource({
        pages: {
          2020: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
        },
      });

      const result = await syncMoviesOfYear(database, source, 2020, {
        ...options,
        moviesPerYear: 5,
      });

      expect(result.movies).toBe(5);
      expect(source.discoverMovies).toHaveBeenCalledTimes(2);
      expect(listMovies(database).map((movie) => movie.id)).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it('stops at the last page when TMDB has fewer movies than asked', async () => {
      const source = createFakeSource({ pages: { 2020: [[1, 2], [3]] } });

      const result = await syncMoviesOfYear(database, source, 2020, options);

      expect(result.movies).toBe(3);
      expect(source.discoverMovies).toHaveBeenCalledTimes(2);
    });

    it('never asks for a page beyond the 500th', async () => {
      const source = createFakeSource();
      source.discoverMovies.mockImplementation(async (_year, page) => ({
        page,
        totalPages: 10000,
        movieIds: [],
      }));

      await syncMoviesOfYear(database, source, 2020, {
        ...options,
        moviesPerYear: 100,
      });

      expect(source.discoverMovies).toHaveBeenCalledTimes(500);
      expect(source.discoverMovies).toHaveBeenLastCalledWith(
        2020,
        500,
        'fr-FR',
      );
    });

    it('stores a movie once when it shows up on two pages', async () => {
      const source = createFakeSource({
        pages: {
          2020: [
            [1, 2],
            [2, 3],
          ],
        },
      });

      const result = await syncMoviesOfYear(database, source, 2020, options);

      expect(result.movies).toBe(3);
      expect(source.getMovieDetails).toHaveBeenCalledTimes(3);
    });

    it('does nothing for a year without movies', async () => {
      const source = createFakeSource();

      const result = await syncMoviesOfYear(database, source, 2020, options);

      expect(result).toEqual({ movies: 0, failures: [] });
      expect(source.discoverMovies).toHaveBeenCalledOnce();
      expect(source.getMovieDetails).not.toHaveBeenCalled();
    });

    it('sends the language and stamps the movies with the clock', async () => {
      const source = createFakeSource({ pages: { 2020: [[1]] } });

      await syncMoviesOfYear(database, source, 2020, {
        ...options,
        language: 'en-US',
        now: () => new Date('2027-01-02T03:04:05.000Z'),
      });

      expect(source.discoverMovies).toHaveBeenCalledWith(2020, 1, 'en-US');
      expect(source.getMovieDetails).toHaveBeenCalledWith(1, 'en-US');
      expect(findMovieById(database, 1)?.collected_at).toBe(
        '2027-01-02T03:04:05.000Z',
      );
    });

    describe('refreshing', () => {
      it('updates a stored movie, replaces its genres and countries, and leaves the other years alone', async () => {
        await syncMoviesOfYear(
          database,
          createFakeSource({
            pages: { 2019: [[10]], 2020: [[1]] },
            details: {
              10: createDetails(10, { release_date: '2019-03-03' }),
              1: createDetails(1, {
                title: 'Ancien titre',
                genres: [
                  { id: 35, name: 'Comédie' },
                  { id: 12, name: 'Aventure' },
                ],
                production_countries: [
                  { iso_3166_1: 'FR', name: 'France' },
                  { iso_3166_1: 'BE', name: 'Belgium' },
                ],
              }),
            },
          }),
          2019,
          options,
        );
        await syncMoviesOfYear(
          database,
          createFakeSource({
            pages: { 2020: [[1]] },
            details: {
              1: createDetails(1, {
                title: 'Ancien titre',
                genres: [
                  { id: 35, name: 'Comédie' },
                  { id: 12, name: 'Aventure' },
                ],
                production_countries: [
                  { iso_3166_1: 'FR', name: 'France' },
                  { iso_3166_1: 'BE', name: 'Belgium' },
                ],
              }),
            },
          }),
          2020,
          options,
        );
        const otherYearBefore = findMovieById(database, 10);

        await syncMoviesOfYear(
          database,
          createFakeSource({
            pages: { 2020: [[1]] },
            details: {
              1: createDetails(1, {
                title: 'Nouveau titre',
                popularity: 99,
                genres: [
                  { id: 12, name: 'Aventure' },
                  { id: 18, name: 'Drame' },
                ],
                production_countries: [
                  { iso_3166_1: 'US', name: 'United States' },
                ],
              }),
            },
          }),
          2020,
          { ...options, now: () => new Date('2027-05-05T05:05:05.000Z') },
        );

        expect(findMovieById(database, 1)).toMatchObject({
          title: 'Nouveau titre',
          popularity: 99,
          collected_at: '2027-05-05T05:05:05.000Z',
        });
        expect(genresOf(1)).toEqual([12, 18]);
        expect(countriesOf(1)).toEqual(['US']);
        expect(findMovieById(database, 10)).toEqual(otherYearBefore);
        expect(listMovies(database)).toHaveLength(2);
      });

      it('creates no duplicate when run again', async () => {
        const source = createFakeSource({ pages: { 2020: [[1, 2, 3]] } });

        await syncMoviesOfYear(database, source, 2020, options);
        await syncMoviesOfYear(database, source, 2020, options);

        expect(listMovies(database)).toHaveLength(3);
        expect(genresOf(1)).toEqual([35]);
        expect(listGenres(database)).toHaveLength(1);
      });
    });

    describe('failures', () => {
      it('reports the movies that cannot be read and stores the others', async () => {
        const source = createFakeSource({
          pages: { 2020: [[1, 2, 3, 4]] },
          details: {
            2: new TmdbApiError(
              404,
              'TMDB API request to movie/2 failed with status 404',
            ),
            4: new TypeError('fetch failed'),
          },
        });

        const result = await syncMoviesOfYear(database, source, 2020, options);

        expect(result).toEqual({
          movies: 2,
          failures: [
            {
              movieId: 2,
              message: 'TMDB API request to movie/2 failed with status 404',
            },
            { movieId: 4, message: 'fetch failed' },
          ],
        });
        expect(listMovies(database).map((movie) => movie.id)).toEqual([1, 3]);
      });

      it('reports a movie the database refuses and keeps nothing of it', async () => {
        const source = createFakeSource({
          pages: { 2020: [[1, 2]] },
          details: {
            1: createDetails(1, {
              genres: [{ id: 99, name: 'Genre du film refusé' }],
              production_countries: [{ iso_3166_1: 'ZZ', name: 'Zedland' }],
              // The database refuses a movie without a title
              title: null as unknown as string,
            }),
          },
        });

        const result = await syncMoviesOfYear(database, source, 2020, options);

        expect(result.movies).toBe(1);
        expect(result.failures).toEqual([
          {
            movieId: 1,
            message: expect.stringContaining(
              'NOT NULL constraint failed: movies.title',
            ),
          },
        ]);
        expect(listMovies(database).map((movie) => movie.id)).toEqual([2]);
        // Its genre and country were rolled back with it
        expect(listGenres(database).map((genre) => genre.id)).toEqual([35]);
        expect(listCountries(database).map((country) => country.code)).toEqual([
          'FR',
        ]);
      });

      it('stops when TMDB refuses the access token', async () => {
        const refused = new TmdbApiError(
          401,
          'TMDB API request failed with status 401',
        );
        const source = createFakeSource({
          pages: { 2020: [[1, 2, 3]] },
          details: { 2: refused },
        });

        await expect(
          syncMoviesOfYear(database, source, 2020, options),
        ).rejects.toBe(refused);

        // The movie before it is kept, and none of the next ones is requested
        expect(listMovies(database).map((movie) => movie.id)).toEqual([1]);
        expect(source.getMovieDetails).toHaveBeenCalledTimes(2);
      });

      it('propagates a failure of TMDB Discover', async () => {
        const source = createFakeSource();
        const failure = new TmdbApiError(500, 'TMDB is down');
        source.discoverMovies.mockRejectedValueOnce(failure);

        await expect(
          syncMoviesOfYear(database, source, 2020, options),
        ).rejects.toBe(failure);
      });
    });
  });

  describe('updateDatabaseFromTmdb', () => {
    it('updates the genres, the countries and the movies of every year', async () => {
      const source = createFakeSource({
        genres: [
          { id: 35, name: 'Comédie' },
          { id: 12, name: 'Aventure' },
        ],
        countries: [
          { code: 'FR', name: 'France' },
          { code: 'BE', name: 'Belgium' },
        ],
        pages: { 2019: [[10, 11]], 2020: [[1, 2, 3]] },
        details: {
          10: createDetails(10, { release_date: '2019-01-01' }),
          11: createDetails(11, { release_date: '2019-02-02' }),
        },
      });

      const summary = await updateDatabaseFromTmdb(database, source, {
        years: [2019, 2020],
        now: NOW,
      });

      expect(summary).toEqual({
        genres: 2,
        countries: 2,
        movies: 5,
        failures: [],
      });
      expect(listMovies(database).map((movie) => movie.release_year)).toEqual([
        2020, 2020, 2020, 2019, 2019,
      ]);
      expect(listGenres(database)).toHaveLength(2);
      expect(listCountries(database)).toHaveLength(2);
    });

    it('reads the catalogs before the movies', async () => {
      const calls: string[] = [];
      const source = createFakeSource({ pages: { 2020: [[1]] } });
      source.getGenres.mockImplementation(async () => {
        calls.push('genres');
        return [];
      });
      source.getCountries.mockImplementation(async () => {
        calls.push('countries');
        return [];
      });
      source.discoverMovies.mockImplementation(async (year, page) => {
        calls.push(`discover ${year}`);
        return { page, totalPages: 1, movieIds: [1] };
      });

      await updateDatabaseFromTmdb(database, source, { years: [2020] });

      expect(calls).toEqual(['genres', 'countries', 'discover 2020']);
    });

    it('collects 100 movies per year in French by default', async () => {
      const source = createFakeSource();

      await updateDatabaseFromTmdb(database, source, { years: [2020] });

      expect(DEFAULT_MOVIES_PER_YEAR).toBe(100);
      expect(source.getGenres).toHaveBeenCalledWith('fr-FR');
      expect(source.discoverMovies).toHaveBeenCalledWith(2020, 1, 'fr-FR');
    });

    it('stamps the movies with the system clock by default', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-25T08:00:00.000Z'));
      const source = createFakeSource({ pages: { 2020: [[1]] } });

      await updateDatabaseFromTmdb(database, source, { years: [2020] });

      expect(findMovieById(database, 1)?.collected_at).toBe(
        '2026-12-25T08:00:00.000Z',
      );
    });

    it('limits the movies per year and uses the language asked', async () => {
      const source = createFakeSource({ pages: { 2020: [[1, 2, 3, 4]] } });

      const summary = await updateDatabaseFromTmdb(database, source, {
        years: [2020],
        moviesPerYear: 2,
        language: 'en-US',
      });

      expect(summary.movies).toBe(2);
      expect(source.getGenres).toHaveBeenCalledWith('en-US');
      expect(source.getMovieDetails).toHaveBeenCalledWith(1, 'en-US');
    });

    it('collects a year given twice once', async () => {
      const source = createFakeSource({ pages: { 2020: [[1]] } });

      const summary = await updateDatabaseFromTmdb(database, source, {
        years: [2020, 2020],
      });

      expect(summary.movies).toBe(1);
      expect(source.discoverMovies).toHaveBeenCalledTimes(1);
    });

    it('reports the failures of every year and carries on', async () => {
      const source = createFakeSource({
        pages: { 2019: [[10, 11]], 2020: [[1, 2]] },
        details: {
          11: new Error('movie 11 unavailable'),
          1: new Error('movie 1 unavailable'),
        },
      });

      const summary = await updateDatabaseFromTmdb(database, source, {
        years: [2019, 2020],
      });

      expect(summary.movies).toBe(2);
      expect(summary.failures).toEqual([
        { movieId: 11, message: 'movie 11 unavailable' },
        { movieId: 1, message: 'movie 1 unavailable' },
      ]);
    });

    it('runs again without duplicates and refreshes what is there', async () => {
      const source = createFakeSource({
        genres: [{ id: 35, name: 'Comédie' }],
        countries: [{ code: 'FR', name: 'France' }],
        pages: { 2020: [[1, 2]] },
      });

      await updateDatabaseFromTmdb(database, source, { years: [2020] });
      const summary = await updateDatabaseFromTmdb(database, source, {
        years: [2020],
      });

      expect(summary.movies).toBe(2);
      expect(listMovies(database)).toHaveLength(2);
      expect(listGenres(database)).toHaveLength(1);
      expect(listCountries(database)).toHaveLength(1);
    });

    it.each([
      ['no year', { years: [] }, 'At least one release year is required.'],
      [
        'a year below 1000',
        { years: [999] },
        'Invalid year 999: expected an integer between 1000 and 9999.',
      ],
      [
        'a year above 9999',
        { years: [10000] },
        'Invalid year 10000: expected an integer between 1000 and 9999.',
      ],
      [
        'a decimal year',
        { years: [2020.5] },
        'Invalid year 2020.5: expected an integer between 1000 and 9999.',
      ],
      [
        'one invalid year among valid ones',
        { years: [2020, Number.NaN] },
        'Invalid year NaN: expected an integer between 1000 and 9999.',
      ],
      [
        'zero movies per year',
        { years: [2020], moviesPerYear: 0 },
        'Invalid moviesPerYear 0: expected a positive integer.',
      ],
      [
        'a negative number of movies per year',
        { years: [2020], moviesPerYear: -3 },
        'Invalid moviesPerYear -3: expected a positive integer.',
      ],
      [
        'a decimal number of movies per year',
        { years: [2020], moviesPerYear: 1.5 },
        'Invalid moviesPerYear 1.5: expected a positive integer.',
      ],
      [
        'a blank language',
        { years: [2020], language: '  ' },
        'Invalid language: expected a non-empty string.',
      ],
    ])(
      'rejects %s before requesting anything',
      async (_label, options, message) => {
        const source = createFakeSource();

        await expect(
          updateDatabaseFromTmdb(database, source, options),
        ).rejects.toThrow(new RangeError(message));

        expect(source.getGenres).not.toHaveBeenCalled();
        expect(source.getCountries).not.toHaveBeenCalled();
        expect(source.discoverMovies).not.toHaveBeenCalled();
      },
    );

    it('stops when the genre catalog cannot be read', async () => {
      const source = createFakeSource({ pages: { 2020: [[1]] } });
      const failure = new TmdbApiError(500, 'TMDB is down');
      source.getGenres.mockRejectedValueOnce(failure);

      await expect(
        updateDatabaseFromTmdb(database, source, { years: [2020] }),
      ).rejects.toBe(failure);

      expect(source.getCountries).not.toHaveBeenCalled();
      expect(source.discoverMovies).not.toHaveBeenCalled();
    });

    it('stops when the country catalog cannot be read', async () => {
      const source = createFakeSource({ pages: { 2020: [[1]] } });
      const failure = new TmdbApiError(500, 'TMDB is down');
      source.getCountries.mockRejectedValueOnce(failure);

      await expect(
        updateDatabaseFromTmdb(database, source, { years: [2020] }),
      ).rejects.toBe(failure);

      expect(source.discoverMovies).not.toHaveBeenCalled();
    });
  });
  describe('with the TMDB client', () => {
    /**
     * Builds a fake fetch that answers like TMDB, according to the URL.
     * @returns The fake fetch.
     */
    function createFakeTmdbFetch() {
      const answers: Record<string, unknown> = {
        '/3/genre/movie/list': { genres: [{ id: 35, name: 'Comédie' }] },
        '/3/configuration/countries': [
          { iso_3166_1: 'FR', english_name: 'France', native_name: 'France' },
        ],
        '/3/discover/movie': {
          page: 1,
          results: [{ id: 1, title: 'ignoré' }, { id: 2 }],
          total_pages: 1,
          total_results: 2,
        },
        '/3/movie/1': createDetails(1),
        '/3/movie/2': createDetails(2, { budget: 0, release_date: '' }),
      };
      return vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => answers[new URL(url).pathname],
      }));
    }

    it('updates the database from what the TMDB API answers', async () => {
      const fetchMock = createFakeTmdbFetch();
      const source = createTmdbClient('token', fetchMock as never);

      const summary = await updateDatabaseFromTmdb(database, source, {
        years: [2020],
        now: NOW,
      });

      expect(summary).toEqual({
        genres: 1,
        countries: 1,
        movies: 2,
        failures: [],
      });
      expect(findMovieById(database, 1)).toMatchObject({
        title: 'Film 1',
        release_year: 2020,
        budget: 5000000,
      });
      expect(findMovieById(database, 2)).toMatchObject({
        release_year: null,
        budget: null,
      });
      expect(genresOf(1)).toEqual([35]);
      expect(countriesOf(1)).toEqual(['FR']);
      // The requests TMDB received, in order, without ever leaking the token
      expect(
        fetchMock.mock.calls.map(([url]) => new URL(url).pathname),
      ).toEqual([
        '/3/genre/movie/list',
        '/3/configuration/countries',
        '/3/discover/movie',
        '/3/movie/1',
        '/3/movie/2',
      ]);
      expect(
        fetchMock.mock.calls.every(([url]) => !url.includes('token')),
      ).toBe(true);
    });

    it('stops with the status of TMDB when it refuses the access token', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({}),
      }));
      const source = createTmdbClient('wrong-token', fetchMock as never);

      await expect(
        updateDatabaseFromTmdb(database, source, { years: [2020] }),
      ).rejects.toMatchObject({
        name: 'TmdbApiError',
        status: 401,
        message: 'TMDB API request to genre/movie/list failed with status 401',
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});
