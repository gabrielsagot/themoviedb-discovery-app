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
