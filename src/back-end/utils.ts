import type {
  TmdbMoviesRawResponse,
  TmdbGenresRawResponse,
  TmdbMovieDetailsRawResponse,
  TmdbVideo,
  Movie,
  MoviesApiResponse,
  GenresApiResponse,
  MovieDetails,
} from './schemas/MoviesTypes';
import { tmdbAccessToken } from './config';
import { getOrFetch } from './cache';
import {
  CAST_LIMIT,
  GENRES_CACHE_TTL_MS,
  MOVIES_CACHE_TTL_MS,
  SIMILAR_LIMIT,
} from './constants';

/**
 * Thrown when a TMDB API request doesn't come back with a 2xx status. Carries
 * the original HTTP status so callers can tell a genuine 404 apart from a
 * transient failure (429, 5xx) worth falling back to cached data for.
 */
export class TmdbApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TmdbApiError';
    this.status = status;
  }
}

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
    throw new TmdbApiError(
      response.status,
      `TMDB API request failed with status ${response.status}`,
    );
  }

  return (await response.json()) as T;
};

/**
 * Calls a TMDB movies endpoint (e.g. 'discover/movie', 'search/movie') with
 * the given query params and returns the response in our application's
 * format. Shared by every route that returns a list of movies, so each route
 * only has to build its own query params. Results are cached for a few
 * minutes and, if TMDB is unreachable or rate-limiting us, the last known
 * good response for the same query is served instead of failing outright.
 * @param endpoint The TMDB API endpoint path, relative to '/3/'.
 * @param params The query params to send to TMDB.
 * @returns The movies response in our application's supported format.
 */
export const fetchMoviesFromTmdb = async (
  endpoint: string,
  params: URLSearchParams,
): Promise<MoviesApiResponse> => {
  return getOrFetch(
    `${endpoint}?${params.toString()}`,
    MOVIES_CACHE_TTL_MS,
    async () => {
      const rawData = await tmdbFetch<TmdbMoviesRawResponse>(endpoint, params);

      return {
        page: rawData.page,
        results: rawData.results.map(toSupportedMovie),
        total_pages: rawData.total_pages,
        total_results: rawData.total_results,
      };
    },
  );
};

/**
 * Fetches the list of official movie genres from TMDB, used to translate a
 * movie's genre_ids into display names on the front-end. Cached for a full
 * day, since the genre list essentially never changes, with the same
 * stale-on-failure fallback as the other TMDB calls.
 * @param params The query params to send to TMDB (e.g. language).
 * @returns The genres response in our application's format.
 */
export const fetchGenresFromTmdb = async (
  params: URLSearchParams,
): Promise<GenresApiResponse> => {
  return getOrFetch(
    `genre/movie/list?${params.toString()}`,
    GENRES_CACHE_TTL_MS,
    async () => {
      const rawData = await tmdbFetch<TmdbGenresRawResponse>(
        'genre/movie/list',
        params,
      );

      return { genres: rawData.genres };
    },
  );
};

/**
 * Picks the best trailer to feature for a movie from its TMDB videos list:
 * an official YouTube trailer if there is one, falling back to any YouTube
 * trailer, then any YouTube teaser, and finally giving up.
 * @param videos The raw video entries from TMDB's videos.results.
 * @returns The YouTube video key to embed, or null if none is suitable.
 */
const pickTrailerKey = (videos: TmdbVideo[]): string | null => {
  const youtubeTrailers = videos.filter(
    (video) => video.site === 'YouTube' && video.type === 'Trailer',
  );
  const officialTrailer = youtubeTrailers.find((video) => video.official);
  if (officialTrailer) return officialTrailer.key;
  if (youtubeTrailers.length > 0) return youtubeTrailers[0].key;

  const youtubeTeaser = videos.find(
    (video) => video.site === 'YouTube' && video.type === 'Teaser',
  );
  return youtubeTeaser?.key ?? null;
};

/**
 * Fetches the full details for a single movie from TMDB in one call —
 * runtime, tagline, director, cast, trailer and similar movies — using
 * append_to_response so the front-end's detail modal only needs one request.
 * Cached and resilient to TMDB outages like the other movie calls.
 * @param id The TMDB movie id.
 * @param params The query params to send to TMDB (e.g. language).
 * @returns The movie's full details in our application's supported format.
 */
export const fetchMovieDetailsFromTmdb = async (
  id: string,
  params: URLSearchParams,
): Promise<MovieDetails> => {
  const requestParams = new URLSearchParams(params);
  requestParams.set('append_to_response', 'credits,videos,similar');

  return getOrFetch(
    `movie/${id}?${requestParams.toString()}`,
    MOVIES_CACHE_TTL_MS,
    async () => {
      const rawData = await tmdbFetch<TmdbMovieDetailsRawResponse>(
        `movie/${id}`,
        requestParams,
      );

      const director =
        rawData.credits.crew.find((member) => member.job === 'Director')
          ?.name ?? null;

      const cast = [...rawData.credits.cast]
        .sort((a, b) => a.order - b.order)
        .slice(0, CAST_LIMIT)
        .map((member) => ({
          id: member.id,
          name: member.name,
          character: member.character,
          profile_path: member.profile_path,
        }));

      return {
        ...toSupportedMovie(rawData),
        runtime: rawData.runtime,
        tagline: rawData.tagline,
        director,
        cast,
        trailerKey: pickTrailerKey(rawData.videos.results),
        similar: rawData.similar.results
          .slice(0, SIMILAR_LIMIT)
          .map(toSupportedMovie),
      };
    },
  );
};
