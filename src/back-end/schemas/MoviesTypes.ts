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

// TypeScript type for a single raw cast member, as returned by TMDB's credits.
export type TmdbCastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
};

// TypeScript type for a single raw crew member, as returned by TMDB's credits.
export type TmdbCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
};

// TypeScript type for a single raw video entry (trailer, teaser, ...), as
// returned by TMDB's videos.
export type TmdbVideo = {
  id: string;
  key: string;
  site: string;
  type: string;
  official?: boolean;
};

// TypeScript type for the raw response from the TMDB API for a single movie's
// full details, requested with append_to_response=credits,videos,similar.
export type TmdbMovieDetailsRawResponse = TmdbMovie & {
  runtime: number | null;
  tagline: string;
  credits: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos: { results: TmdbVideo[] };
  similar: { results: Array<TmdbMovie & { video?: boolean }> };
};

// TypeScript type for the reduced cast member shape exposed to the front-end.
export type CastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

// TypeScript type for the full movie details response exposed to the
// front-end: the base Movie fields plus runtime, tagline, director, cast,
// trailer and similar movies.
export type MovieDetails = Movie & {
  runtime: number | null;
  tagline: string;
  director: string | null;
  cast: CastMember[];
  trailerKey: string | null;
  similar: Movie[];
};
