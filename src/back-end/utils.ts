import type {
  TmdbMoviesRawResponse,
  TmdbGenresRawResponse,
  TmdbMovieDetailsRawResponse,
  Movie,
  MovieDetails,
  MoviesApiResponse,
  GenresApiResponse,
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
 * Calls any TMDB API endpoint with the given query params, using our shared
 * bearer token, and returns the parsed JSON body. Shared by every route so
 * each one only has to build its own query params and shape the response.
 * @param endpoint The TMDB API endpoint path, relative to '/3/'.
 * @param params The query params to send to TMDB.
 * @returns The raw, parsed JSON response body.
 */
const tmdbFetch = async <T>(
  endpoint: string,
  params: URLSearchParams,
): Promise<T> => {
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

  return (await response.json()) as T;
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
  const rawData = await tmdbFetch<TmdbMoviesRawResponse>(endpoint, params);

  return {
    page: rawData.page,
    results: rawData.results.map(toSupportedMovie),
    total_pages: rawData.total_pages,
    total_results: rawData.total_results,
  };
};

/**
 * Fetches the list of official movie genres from TMDB, used to translate a
 * movie's genre_ids into display names on the front-end.
 * @param params The query params to send to TMDB (e.g. language).
 * @returns The genres response in our application's format.
 */
export const fetchGenresFromTmdb = async (
  params: URLSearchParams,
): Promise<GenresApiResponse> => {
  const rawData = await tmdbFetch<TmdbGenresRawResponse>(
    'genre/movie/list',
    params,
  );

  return { genres: rawData.genres };
};

/**
 * Transforms a raw TMDB movie details object into the detailed format used
 * by our application, omitting the properties we don't expose.
 * @param movie The raw movie details object returned by TMDB.
 * @returns The supported MovieDetails object.
 */
export const toSupportedMovieDetails = (
  movie: TmdbMovieDetailsRawResponse,
): MovieDetails => {
  return {
    backdrop_path: movie.backdrop_path,
    budget: movie.budget,
    genres: movie.genres,
    homepage: movie.homepage,
    id: movie.id,
    imdb_id: movie.imdb_id,
    original_language: movie.original_language,
    original_title: movie.original_title,
    overview: movie.overview,
    popularity: movie.popularity,
    poster_path: movie.poster_path,
    production_companies: movie.production_companies,
    release_date: movie.release_date,
    revenue: movie.revenue,
    runtime: movie.runtime,
    status: movie.status,
    tagline: movie.tagline,
    title: movie.title,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
  };
};

/**
 * Fetches the details of a single movie from TMDB by its identifier.
 * @param movieId The TMDB identifier of the movie.
 * @param params The query params to send to TMDB (e.g. language).
 * @returns The movie details in our application's supported format.
 */
export const fetchMovieDetailsFromTmdb = async (
  movieId: string,
  params: URLSearchParams,
): Promise<MovieDetails> => {
  const rawData = await tmdbFetch<TmdbMovieDetailsRawResponse>(
    `movie/${movieId}`,
    params,
  );

  return toSupportedMovieDetails(rawData);
};
