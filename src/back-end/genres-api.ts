import type { Express } from 'express';
import express from 'express';
import { DEFAULT_LANGUAGE } from './constants';
import type { ApiErrorResponse } from './schemas/MoviesTypes';
import { fetchGenresFromTmdb } from './utils';

/**
 * Registers the genre routes, which expose the official TMDB genre list so
 * the front-end can turn a movie's genre_ids into display names.
 * @param app The express application to register the routes on.
 */
export function registerGenresApi(app: Express): void {
  // Define a route handler for fetching the list of official movie genres
  app.get(
    '/api/genres',
    async (_req: express.Request, res: express.Response) => {
      try {
        const queryParams = new URLSearchParams();
        const { language } = _req.query;
        queryParams.append(
          'language',
          (language as string) || DEFAULT_LANGUAGE,
        );

        const data = await fetchGenresFromTmdb(queryParams);

        res.json(data);
      } catch (error) {
        console.error('Error fetching genres:', error);
        const errorResponse: ApiErrorResponse = {
          error: 'Failed to fetch genres',
        };
        res.status(500).json(errorResponse);
      }
    },
  );
}
