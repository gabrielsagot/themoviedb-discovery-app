// TypeScript type for a movie genre stored in the local database, identified
// by its TMDB genre id (e.g. 35 for "Comédie").
export type Genre = {
  id: number;
  name: string;
};

// TypeScript type for a production country stored in the local database,
// identified by its ISO 3166-1 alpha-2 code (e.g. "FR" for "France").
export type Country = {
  code: string;
  name: string;
};

// TypeScript type for a movie stored in the local database, as read from the
// `movies` table. It is distinct from the `Movie` type of the TMDB API
// responses. Unknown values (absent or zero in TMDB) are `null`.
export type StoredMovie = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  // Release date as 'YYYY-MM-DD', or null when unknown.
  release_date: string | null;
  // Release year derived by the database from release_date; read-only.
  release_year: number | null;
  popularity: number | null;
  vote_average: number | null;
  vote_count: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime_minutes: number | null;
  budget: number | null;
  revenue: number | null;
  // ISO 8601 timestamp of the last observation of the movie.
  collected_at: string;
};

// TypeScript type for a movie to insert or update: every stored property
// except `release_year`, which the database computes from `release_date`
// and does not accept as input.
export type MovieInput = Omit<StoredMovie, 'release_year'>;
