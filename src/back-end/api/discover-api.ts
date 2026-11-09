import type { Express } from 'express';
import express from 'express';
import type {
  ApiErrorResponse,
  MoviesApiResponse,
  TmdbMoviesRawResponse,
} from '../types/MoviesTypes';
import { tmdbAccessToken } from '../utils/config';
import { toSupportedMovie } from '../utils/converter';
import { createDiscoverQueryParams } from '../utils/discover-query-params';

// The TMDB endpoint that lists movies matching filters, page by page.
const TMDB_DISCOVER_URL = 'https://api.themoviedb.org/3/discover/movie';

/**
 * Registers the discover route, which lists the movies released a given year
 * by querying the TMDB Discover API, one page per call. It neither collects
 * every page, nor fetches movie details, nor stores anything in SQLite.
 * @param app - The Express application instance to register the route on.
 */
export function registerDiscoverApi(app: Express): void {
  app.get(
    '/api/discover/movies',
    async (req: express.Request, res: express.Response) => {
      // Reject an invalid query before calling TMDB.
      const query = createDiscoverQueryParams(req.query);
      if (!query.ok) {
        const errorResponse: ApiErrorResponse = { error: query.error };
        res.status(400).json(errorResponse);
        return;
      }

      try {
        // The access token stays on the server: it is only sent to TMDB.
        const response = await fetch(
          `${TMDB_DISCOVER_URL}?${query.params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${tmdbAccessToken}`,
              'Content-Type': 'application/json;charset=utf-8',
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `TMDB API request failed with status ${response.status}`,
          );
        }

        const rawData = (await response.json()) as TmdbMoviesRawResponse;

        // Keep TMDB's pagination and drop the adult and video properties.
        const data: MoviesApiResponse = {
          page: rawData.page,
          results: rawData.results.map(toSupportedMovie),
          total_pages: rawData.total_pages,
          total_results: rawData.total_results,
        };

        res.json(data);
      } catch (error) {
        console.error('Error discovering movies:', error);
        const errorResponse: ApiErrorResponse = {
          error: 'Failed to discover movies',
        };
        res.status(500).json(errorResponse);
      }
    },
  );
}
