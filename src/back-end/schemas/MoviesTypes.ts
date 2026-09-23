// TypeScript type for the raw response from the TMDB API for popular movies.
export type TmdbMoviesRawResponse = {
  page: number;
  results: Array<TmdbMovie & { video?: boolean }>;
  total_pages: number;
  total_results: number;
};

// TypeScript type for a single raw movie object returned by the TMDB API.
export type TmdbMovie = {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
};

// TypeScript type for the API response when fetching movies, containing an array of supported Movie objects.
export type MoviesApiResponse = {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
};

// TypeScript type for the supported movie format used in our application, omitting 'adult' and 'video' properties from the TmdbMovie type.
export type Movie = Omit<TmdbMovie, 'adult' | 'video'>;

// TypeScript type for the API error response format.
export type ApiErrorResponse = {
  error: string;
};

// TypeScript type for a single movie genre, as returned by TMDB's genre list endpoint.
export type Genre = {
  id: number;
  name: string;
};

// TypeScript type for the raw response from the TMDB API for the movie genre list.
export type TmdbGenresRawResponse = {
  genres: Genre[];
};

// TypeScript type for the API response when fetching the genre list.
export type GenresApiResponse = {
  genres: Genre[];
};

// TypeScript type for a production company attached to a movie.
export type ProductionCompany = {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
};

// TypeScript type for the raw response from the TMDB API for a single movie's details.
export type TmdbMovieDetailsRawResponse = TmdbMovie & {
  belongs_to_collection: unknown | null;
  budget: number;
  genres: Genre[];
  homepage: string | null;
  imdb_id: string | null;
  production_companies: ProductionCompany[];
  revenue: number;
  runtime: number | null;
  status: string;
  tagline: string | null;
};

// TypeScript type for the detailed movie format used in our application. It
// extends the list format with the fields only the details endpoint returns,
// and replaces genre_ids with the full genre objects TMDB provides here.
export type MovieDetails = Omit<Movie, 'genre_ids'> & {
  budget: number;
  genres: Genre[];
  homepage: string | null;
  imdb_id: string | null;
  production_companies: ProductionCompany[];
  revenue: number;
  runtime: number | null;
  status: string;
  tagline: string | null;
};
