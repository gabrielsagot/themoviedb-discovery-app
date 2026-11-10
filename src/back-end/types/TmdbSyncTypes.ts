import type { Genre } from './DatabaseTypes.ts';

// TypeScript type for the raw response of the TMDB genre list endpoint
// (`GET /3/genre/movie/list`).
export type TmdbGenresRawResponse = {
  genres: Genre[];
};

// TypeScript type for one entry of the raw response of the TMDB countries
// endpoint (`GET /3/configuration/countries`).
export type TmdbCountryRaw = {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
};

// TypeScript type for the raw response of the TMDB discover endpoint
// (`GET /3/discover/movie`), reduced to what the synchronization reads.
export type TmdbDiscoverRawResponse = {
  page: number;
  results: Array<{ id: number }>;
  total_pages: number;
  total_results: number;
};

// TypeScript type for the raw response of the TMDB movie details endpoint
// (`GET /3/movie/{movie_id}`), reduced to what the synchronization reads.
// TMDB writes 0 for an unknown runtime, budget or revenue, and an empty
// string for an unknown release date.
export type TmdbMovieDetailsRaw = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string | null;
  release_date: string | null;
  popularity: number | null;
  vote_average: number | null;
  vote_count: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  budget: number | null;
  revenue: number | null;
  genres: Genre[];
  production_countries: Array<{ iso_3166_1: string; name: string }>;
};

// TypeScript type for one page of discovered movies: the ids of the movies
// of the page, and the paging information of TMDB.
export type DiscoverPage = {
  page: number;
  totalPages: number;
  movieIds: number[];
};
