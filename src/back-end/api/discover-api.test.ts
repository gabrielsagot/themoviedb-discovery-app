import type { Express, Request, RequestHandler, Response } from 'express';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TmdbMovie, TmdbMoviesRawResponse } from '../types/MoviesTypes';
import { registerDiscoverApi } from './discover-api';

vi.mock('../utils/config', () => ({
  tmdbAccessToken: 'test-access-token',
}));

const ROUTE = '/api/discover/movies';
const TMDB_DISCOVER_URL = 'https://api.themoviedb.org/3/discover/movie';

type RouteHandler = (
  req: Request,
  res: Response,
  next: (error?: unknown) => void,
) => void | Promise<void>;

type MockResponse = Response & {
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
};

/** A raw TMDB movie, including the adult and video properties. */
const rawMovie: TmdbMovie = {
  adult: false,
  backdrop_path: '/backdrop.jpg',
  genre_ids: [35, 18],
  id: 496243,
  original_language: 'ko',
  original_title: '기생충',
  overview: 'Toute la famille de Ki-taek est au chômage.',
  popularity: 87.5,
  poster_path: '/poster.jpg',
  release_date: '2019-05-30',
  title: 'Parasite',
  video: false,
  vote_average: 8.5,
  vote_count: 18000,
};

/**
 * Registers the discover route on a fake Express app and returns its handler.
 * @returns The handler of GET /api/discover/movies.
 */
function getDiscoverHandler(): RouteHandler {
  const handlers = new Map<string, RequestHandler>();
  const app = {
    get: (path: string, handler: RequestHandler) => handlers.set(path, handler),
  } as unknown as Express;

  registerDiscoverApi(app);

  const handler = handlers.get(ROUTE);
  if (!handler) throw new Error(`No handler registered for ${ROUTE}`);
  return handler as RouteHandler;
}

/**
 * Creates a fake Express response whose status and json calls are recorded.
 * @returns The fake response.
 */
function createResponse(): MockResponse {
  const response = { json: vi.fn(), status: vi.fn() };
  response.status.mockReturnValue(response);
  return response as unknown as MockResponse;
}

/**
 * Creates a fake fetch response from TMDB.
 * @param data The JSON body returned by TMDB.
 * @param status The HTTP status of the response.
 * @returns The fake response.
 */
function tmdbResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

/**
 * Calls the discover route with the given query parameters.
 * @param query The query parameters of the request.
 * @returns The fake response, to check what the route sent back.
 */
async function callDiscover(query: Request['query']): Promise<MockResponse> {
  const response = createResponse();
  await getDiscoverHandler()({ query } as Request, response, vi.fn());
  return response;
}

describe('discover API', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('GET /api/discover/movies', () => {
    describe('successful requests', () => {
      it('filters TMDB Discover on the release year with the default options', async () => {
        fetchMock.mockResolvedValueOnce(
          tmdbResponse({
            page: 1,
            results: [],
            total_pages: 0,
            total_results: 0,
          }),
        );

        await callDiscover({ year: '2020' });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
          `${TMDB_DISCOVER_URL}?primary_release_year=2020&language=fr-FR&page=1&region=FR`,
          {
            headers: {
              Authorization: 'Bearer test-access-token',
              'Content-Type': 'application/json;charset=utf-8',
            },
          },
        );
      });

      it('sends the language, page and region given in the query', async () => {
        fetchMock.mockResolvedValueOnce(
          tmdbResponse({
            page: 2,
            results: [],
            total_pages: 2,
            total_results: 0,
          }),
        );

        await callDiscover({
          year: '2020',
          language: 'en-US',
          page: '2',
          region: 'US',
        });

        expect(fetchMock).toHaveBeenCalledWith(
          `${TMDB_DISCOVER_URL}?primary_release_year=2020&language=en-US&page=2&region=US`,
          expect.anything(),
        );
      });

      it('keeps the pagination and converts each movie without adult and video', async () => {
        fetchMock.mockResolvedValueOnce(
          tmdbResponse({
            page: 3,
            results: [rawMovie],
            total_pages: 12,
            total_results: 231,
          } satisfies TmdbMoviesRawResponse),
        );

        const response = await callDiscover({ year: '2019', page: '3' });

        const { adult: _adult, video: _video, ...supportedMovie } = rawMovie;
        expect(response.status).not.toHaveBeenCalled();
        expect(response.json).toHaveBeenCalledWith({
          page: 3,
          results: [supportedMovie],
          total_pages: 12,
          total_results: 231,
        });
        const [body] = response.json.mock.calls[0];
        expect(body.results[0]).not.toHaveProperty('adult');
        expect(body.results[0]).not.toHaveProperty('video');
      });

      it('returns an empty results list with the pagination of TMDB', async () => {
        fetchMock.mockResolvedValueOnce(
          tmdbResponse({
            page: 1,
            results: [],
            total_pages: 1,
            total_results: 0,
          }),
        );

        const response = await callDiscover({ year: '1000' });

        expect(response.json).toHaveBeenCalledWith({
          page: 1,
          results: [],
          total_pages: 1,
          total_results: 0,
        });
      });

      it('never exposes the access token in the response', async () => {
        fetchMock.mockResolvedValueOnce(
          tmdbResponse({
            page: 1,
            results: [rawMovie],
            total_pages: 1,
            total_results: 1,
          }),
        );

        const response = await callDiscover({ year: '2019' });

        expect(JSON.stringify(response.json.mock.calls)).not.toContain(
          'test-access-token',
        );
      });
    });

    describe('invalid years', () => {
      it.each([
        [
          'a missing year',
          {},
          'The year query parameter is required, e.g. ?year=2020.',
        ],
        [
          'an empty year',
          { year: '' },
          'The year query parameter is required, e.g. ?year=2020.',
        ],
        [
          'a two-digit year',
          { year: '20' },
          'Invalid year "20": expected a four-digit year between 1000 and 9999.',
        ],
        [
          'a year below 1000',
          { year: '0999' },
          'Invalid year "0999": expected a four-digit year between 1000 and 9999.',
        ],
        [
          'a non numeric year',
          { year: 'abcd' },
          'Invalid year "abcd": expected a four-digit year between 1000 and 9999.',
        ],
        [
          'a repeated year',
          { year: ['2020', '2021'] },
          'The year query parameter must be given once, as a four-digit year.',
        ],
        [
          'a structured year',
          { year: { gte: '2020' } },
          'The year query parameter must be given once, as a four-digit year.',
        ],
      ])(
        'rejects %s with HTTP 400 without calling TMDB',
        async (_label, query, message) => {
          const response = await callDiscover(query);

          expect(response.status).toHaveBeenCalledWith(400);
          expect(response.json).toHaveBeenCalledWith({ error: message });
          expect(fetchMock).not.toHaveBeenCalled();
        },
      );
    });

    describe('TMDB failures', () => {
      it.each([401, 404, 429, 500, 503])(
        'answers HTTP 500 and logs the error when TMDB responds %i',
        async (status) => {
          fetchMock.mockResolvedValueOnce(tmdbResponse({}, status));

          const response = await callDiscover({ year: '2020' });

          expect(response.status).toHaveBeenCalledWith(500);
          expect(response.json).toHaveBeenCalledWith({
            error: 'Failed to discover movies',
          });
          expect(errorSpy).toHaveBeenCalledWith(
            'Error discovering movies:',
            new Error(`TMDB API request failed with status ${status}`),
          );
        },
      );

      it('answers HTTP 500 and logs the error on a network failure', async () => {
        const networkError = new TypeError('fetch failed');
        fetchMock.mockRejectedValueOnce(networkError);

        const response = await callDiscover({ year: '2020' });

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
          error: 'Failed to discover movies',
        });
        expect(errorSpy).toHaveBeenCalledWith(
          'Error discovering movies:',
          networkError,
        );
      });

      it('answers HTTP 500 and logs the error when the JSON cannot be read', async () => {
        const jsonError = new SyntaxError('Unexpected token < in JSON');
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockRejectedValue(jsonError),
        });

        const response = await callDiscover({ year: '2020' });

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith({
          error: 'Failed to discover movies',
        });
        expect(errorSpy).toHaveBeenCalledWith(
          'Error discovering movies:',
          jsonError,
        );
      });
    });
  });
});
