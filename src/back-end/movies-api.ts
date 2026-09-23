import type { Express } from 'express';
import express from 'express';
import { DEFAULT_LANGUAGE, DEFAULT_PAGE, DEFAULT_REGION } from './constants';
import type { ApiErrorResponse } from './schemas/MoviesTypes';
import { fetchMoviesFromTmdb } from './utils';

/**
 * Registers the movie routes: the popular list and the search endpoint.
 * @param app The express application to register the routes on.
 */
export function registerMoviesApi(app: Express): void {
  // Define a route handler for fetching popular movies from TMDB API
  app.get(
    '/api/movies/popular',
    async (_req: express.Request, res: express.Response) => {
      try {
        // Create a URLSearchParams object to build the query string for the TMDB API request
        const queryParams = new URLSearchParams();

        // Extract query parameters from the request and append them to the query string
        const { language, page, region } = _req.query;

        queryParams.append(
          'language',
          (language as string) || DEFAULT_LANGUAGE,
        );
        queryParams.append('page', (page as string) || DEFAULT_PAGE);
        queryParams.append('region', (region as string) || DEFAULT_REGION);

        const data = await fetchMoviesFromTmdb('movie/popular', queryParams);

        // Send the transformed data as a JSON response
        res.json(data);
      } catch (error) {
        console.error('Error fetching popular movies:', error);
        const errorResponse: ApiErrorResponse = {
          error: 'Failed to fetch popular movies',
        };
        res.status(500).json(errorResponse);
      }
    },
  );

  // Define a route handler for searching movies by title from TMDB API
  app.get(
    '/api/movies/search',
    async (_req: express.Request, res: express.Response) => {
      const { query, language, page, region } = _req.query;

      if (typeof query !== 'string' || query.trim() === '') {
        const errorResponse: ApiErrorResponse = {
          error: 'A search query is required',
        };
        res.status(400).json(errorResponse);
        return;
      }

      try {
        const queryParams = new URLSearchParams();
        queryParams.append('query', query);
        queryParams.append(
          'language',
          (language as string) || DEFAULT_LANGUAGE,
        );
        queryParams.append('page', (page as string) || DEFAULT_PAGE);
        queryParams.append('region', (region as string) || DEFAULT_REGION);

        const data = await fetchMoviesFromTmdb('search/movie', queryParams);

        res.json(data);
      } catch (error) {
        console.error('Error searching movies:', error);
        const errorResponse: ApiErrorResponse = {
          error: 'Failed to search movies',
        };
        res.status(500).json(errorResponse);
      }
    },
  );
}
