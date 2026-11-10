import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TmdbMovieDetailsRaw } from '../types/TmdbSyncTypes';
import { createTmdbClient, TmdbApiError } from './tmdb-client';

const BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Creates a fake fetch response.
 * @param body The JSON body of the response.
 * @param status The HTTP status of the response.
 * @returns The fake response.
 */
function fakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('tmdb-client.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('createTmdbClient', () => {
    describe('requests', () => {
      it('sends the access token as a bearer token, never in the URL', async () => {
        const fetchMock = vi
          .fn()
          .mockResolvedValue(fakeResponse({ genres: [] }));

        await createTmdbClient('secret-token', fetchMock).getGenres('fr-FR');

        expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
          headers: {
            Authorization: 'Bearer secret-token',
            'Content-Type': 'application/json;charset=utf-8',
          },
        });
        expect(fetchMock.mock.calls[0][0]).not.toContain('secret-token');
      });

      it('uses the global fetch by default', async () => {
        const fetchMock = vi
          .fn()
          .mockResolvedValue(fakeResponse({ genres: [] }));
        vi.stubGlobal('fetch', fetchMock);

        await createTmdbClient('token').getGenres('fr-FR');

        expect(fetchMock).toHaveBeenCalledOnce();
      });
    });

    describe('getGenres', () => {
      it('reads the genre list in the given language', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
          fakeResponse({
            genres: [
              { id: 28, name: 'Action' },
              { id: 35, name: 'Comédie', unexpected: true },
            ],
          }),
        );

        const genres = await createTmdbClient('token', fetchMock).getGenres(
          'fr-FR',
        );

        expect(fetchMock.mock.calls[0][0]).toBe(
          `${BASE_URL}/genre/movie/list?language=fr-FR`,
        );
        // Only the id and the name are kept
        expect(genres).toEqual([
          { id: 28, name: 'Action' },
          { id: 35, name: 'Comédie' },
        ]);
      });
    });

    describe('getCountries', () => {
      it('reads the countries with their English names', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
          fakeResponse([
            { iso_3166_1: 'FR', english_name: 'France', native_name: 'France' },
            {
              iso_3166_1: 'DE',
              english_name: 'Germany',
              native_name: 'Deutschland',
            },
          ]),
        );

        const countries = await createTmdbClient(
          'token',
          fetchMock,
        ).getCountries();

        expect(fetchMock.mock.calls[0][0]).toBe(
          `${BASE_URL}/configuration/countries?`,
        );
        expect(countries).toEqual([
          { code: 'FR', name: 'France' },
          { code: 'DE', name: 'Germany' },
        ]);
      });
    });

    describe('discoverMovies', () => {
      it('reads one page of the movies of a year, most popular first', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
          fakeResponse({
            page: 2,
            results: [{ id: 11, title: 'Un' }, { id: 22 }],
            total_pages: 40,
            total_results: 800,
          }),
        );

        const page = await createTmdbClient('token', fetchMock).discoverMovies(
          2020,
          2,
          'fr-FR',
        );

        expect(fetchMock.mock.calls[0][0]).toBe(
          `${BASE_URL}/discover/movie?primary_release_year=2020&sort_by=popularity.desc&language=fr-FR&page=2`,
        );
        expect(page).toEqual({ page: 2, totalPages: 40, movieIds: [11, 22] });
      });
    });

    describe('getMovieDetails', () => {
      it('reads the details of a movie in the given language', async () => {
        const details = { id: 496243, title: 'Titre' } as TmdbMovieDetailsRaw;
        const fetchMock = vi.fn().mockResolvedValue(fakeResponse(details));

        const result = await createTmdbClient(
          'token',
          fetchMock,
        ).getMovieDetails(496243, 'en-US');

        expect(fetchMock.mock.calls[0][0]).toBe(
          `${BASE_URL}/movie/496243?language=en-US`,
        );
        expect(result).toBe(details);
      });
    });

    describe('failures', () => {
      it.each([401, 404, 429, 500, 503])(
        'throws a TmdbApiError carrying the status %i',
        async (status) => {
          const fetchMock = vi.fn().mockResolvedValue(fakeResponse({}, status));

          const request = createTmdbClient('token', fetchMock).getMovieDetails(
            7,
            'fr-FR',
          );

          await expect(request).rejects.toThrow(TmdbApiError);
          await expect(request).rejects.toMatchObject({
            name: 'TmdbApiError',
            status,
            message: `TMDB API request to movie/7 failed with status ${status}`,
          });
        },
      );

      it('propagates a network failure', async () => {
        const networkError = new TypeError('fetch failed');
        const fetchMock = vi.fn().mockRejectedValue(networkError);

        await expect(
          createTmdbClient('token', fetchMock).getGenres('fr-FR'),
        ).rejects.toBe(networkError);
      });

      it('propagates a JSON that cannot be read', async () => {
        const jsonError = new SyntaxError('Unexpected token < in JSON');
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: vi.fn().mockRejectedValue(jsonError),
        });

        await expect(
          createTmdbClient('token', fetchMock).getGenres('fr-FR'),
        ).rejects.toBe(jsonError);
      });
    });
  });
});
