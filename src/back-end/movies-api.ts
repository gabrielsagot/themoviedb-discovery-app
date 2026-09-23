import type { Express } from 'express';
import express from 'express';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
  DEFAULT_SORT_BY,
  MIN_VOTE_COUNT_FOR_RATING_SORT,
  MOVIES_CACHE_TTL_MS,
} from './constants';
import { setCacheControl } from './http';
import type { ApiErrorResponse } from './schemas/MoviesTypes';
import {
  fetchMovieDetailsFromTmdb,
  fetchMoviesFromTmdb,
  TmdbApiError,
} from './utils';

/**
 * Registers the movie routes: the discover/popular list with its filters,
 * the search endpoint and the details of a single movie.
 * @param app The express application to register the routes on.
 */
export function registerMoviesApi(app: Express): void {
  // Define a route handler for fetching/discovering movies from TMDB API.
  // Uses discover/movie rather than movie/popular so the same route supports
  // real filtering: sorted by popularity by default (equivalent to "popular"),
  // it also accepts genres/sort/year to narrow the results.
  app.get(
    '/api/movies/popular',
    async (_req: express.Request, res: express.Response) => {
      try {
        // Create a URLSearchParams object to build the query string for the TMDB API request
        const queryParams = new URLSearchParams();

        // Extract query parameters from the request and append them to the query string
        const { language, page, region, genres, sort, year } = _req.query;

        queryParams.append(
          'language',
          (language as string) || DEFAULT_LANGUAGE,
        );
        queryParams.append('page', (page as string) || DEFAULT_PAGE);
        queryParams.append('region', (region as string) || DEFAULT_REGION);

        const sortBy = (sort as string) || DEFAULT_SORT_BY;
        queryParams.append('sort_by', sortBy);

        if (typeof genres === 'string' && genres.trim() !== '') {
          // TMDB reads a '|' between ids as OR, a ',' as AND.
          queryParams.append('with_genres', genres.split(',').join('|'));
        }

        if (typeof year === 'string' && year.trim() !== '') {
          queryParams.append('primary_release_year', year);
        }

        // Sorting by rating alone lets a film with 10/10 from 3 votes outrank
        // established films, so a minimum vote count is enforced whenever that
        // sort is active.
        if (sortBy.startsWith('vote_average')) {
          queryParams.append(
            'vote_count.gte',
            String(MIN_VOTE_COUNT_FOR_RATING_SORT),
          );
        }

        const data = await fetchMoviesFromTmdb('discover/movie', queryParams);

        setCacheControl(res, MOVIES_CACHE_TTL_MS);
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

        setCacheControl(res, MOVIES_CACHE_TTL_MS);
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

  // The dynamic ':id' route is registered last on purpose: express matches
  // routes in registration order, so declaring it before '/api/movies/search'
  // would make it swallow '/search' as an id.
  // Define a route handler for fetching the full details of a single movie —
  // runtime, director, cast, trailer and similar movies — for the detail modal.
  app.get(
    '/api/movies/:id',
    async (req: express.Request, res: express.Response) => {
      const id = req.params.id as string;

      if (!/^\d+$/.test(id)) {
        const errorResponse: ApiErrorResponse = { error: 'Invalid movie id' };
        res.status(400).json(errorResponse);
        return;
      }

      try {
        const queryParams = new URLSearchParams();
        const { language } = req.query;
        queryParams.append(
          'language',
          (language as string) || DEFAULT_LANGUAGE,
        );

        const data = await fetchMovieDetailsFromTmdb(id, queryParams);

        setCacheControl(res, MOVIES_CACHE_TTL_MS);
        res.json(data);
      } catch (error) {
        console.error(`Error fetching details for movie ${id}:`, error);

        if (error instanceof TmdbApiError && error.status === 404) {
          const errorResponse: ApiErrorResponse = { error: 'Movie not found' };
          res.status(404).json(errorResponse);
          return;
        }

        const errorResponse: ApiErrorResponse = {
          error: 'Failed to fetch movie details',
        };
        res.status(500).json(errorResponse);
      }
    },
  );
}
