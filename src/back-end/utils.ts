import type {
  TmdbMoviesRawResponse,
  Movie,
  MoviesApiResponse,
} from './schemas/MoviesTypes';
import { tmdbAccessToken } from './config';

/**
 * Transforms a TmdbMovie object into a supported Movie object by omitting the 'adult' and 'video' properties.
 * @param movie The raw TmdbMovie object.
 * @returns The supported Movie object.
 */
export const toSupportedMovie = (
  movie: TmdbMoviesRawResponse['results'][number],
): Movie => {
  return {
    backdrop_path: movie.backdrop_path,
    genre_ids: movie.genre_ids,
    id: movie.id,
    original_language: movie.original_language,
    original_title: movie.original_title,
    overview: movie.overview,
    popularity: movie.popularity,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    title: movie.title,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
  };
};

/**
 * Calls a TMDB movies endpoint (e.g. 'movie/popular', 'search/movie') with the
 * given query params and returns the response in our application's format.
 * Shared by every route that returns a list of movies, so each route only
 * has to build its own query params.
 * @param endpoint The TMDB API endpoint path, relative to '/3/'.
 * @param params The query params to send to TMDB.
 * @returns The movies response in our application's supported format.
 */
export const fetchMoviesFromTmdb = async (
  endpoint: string,
  params: URLSearchParams,
): Promise<MoviesApiResponse> => {
  const response = await fetch(
    `https://api.themoviedb.org/3/${endpoint}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${tmdbAccessToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`TMDB API request failed with status ${response.status}`);
  }

  const rawData = (await response.json()) as TmdbMoviesRawResponse;

  return {
    page: rawData.page,
    results: rawData.results.map(toSupportedMovie),
    total_pages: rawData.total_pages,
    total_results: rawData.total_results,
  };
};
