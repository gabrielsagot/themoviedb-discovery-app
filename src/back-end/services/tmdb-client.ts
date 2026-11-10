import type { Country, Genre } from '../types/DatabaseTypes.ts';
import type {
  DiscoverPage,
  TmdbCountryRaw,
  TmdbDiscoverRawResponse,
  TmdbGenresRawResponse,
  TmdbMovieDetailsRaw,
} from '../types/TmdbSyncTypes.ts';

// The base URL of the TMDB API, version 3.
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Thrown when a TMDB request does not come back with a 2xx status. It keeps
 * the HTTP status, so that callers can tell a movie that does not exist (404)
 * from a refused access token (401) or a transient failure (429, 5xx).
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
 * The TMDB data the database synchronization reads. It is an interface, not
 * the HTTP client itself, so that the synchronization can be tested with a
 * fake source and never needs the network.
 */
export type TmdbSource = {
  /** The movie genres, named in the given language. */
  getGenres: (language: string) => Promise<Genre[]>;
  /** The countries, named in English whatever the language. */
  getCountries: () => Promise<Country[]>;
  /** One page of the movies released a given year, most popular first. */
  discoverMovies: (
    year: number,
    page: number,
    language: string,
  ) => Promise<DiscoverPage>;
  /** The full details of one movie. */
  getMovieDetails: (
    id: number,
    language: string,
  ) => Promise<TmdbMovieDetailsRaw>;
};

/**
 * Creates the TMDB source that queries the real TMDB API with an access
 * token, which is only ever sent to TMDB.
 * @param accessToken The TMDB API read access token.
 * @param fetchImpl The function used to send requests; `fetch` by default.
 * @returns The TMDB source.
 */
export function createTmdbClient(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): TmdbSource {
  /**
   * Calls a TMDB endpoint and parses its JSON body.
   * @param endpoint The endpoint path, relative to the TMDB base URL.
   * @param params The query parameters to send.
   * @returns The parsed JSON body.
   * @throws {TmdbApiError} When TMDB does not answer with a 2xx status.
   */
  async function getJson<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetchImpl(
      `${TMDB_BASE_URL}/${endpoint}?${new URLSearchParams(params).toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json;charset=utf-8',
        },
      },
    );

    if (!response.ok) {
      throw new TmdbApiError(
        response.status,
        `TMDB API request to ${endpoint} failed with status ${response.status}`,
      );
    }
    return (await response.json()) as T;
  }

  return {
    async getGenres(language) {
      const data = await getJson<TmdbGenresRawResponse>('genre/movie/list', {
        language,
      });
      return data.genres.map(({ id, name }) => ({ id, name }));
    },

    async getCountries() {
      const data = await getJson<TmdbCountryRaw[]>('configuration/countries');
      return data.map((country) => ({
        code: country.iso_3166_1,
        name: country.english_name,
      }));
    },

    async discoverMovies(year, page, language) {
      const data = await getJson<TmdbDiscoverRawResponse>('discover/movie', {
        primary_release_year: String(year),
        sort_by: 'popularity.desc',
        language,
        page: String(page),
      });
      return {
        page: data.page,
        totalPages: data.total_pages,
        movieIds: data.results.map((movie) => movie.id),
      };
    },

    getMovieDetails(id, language) {
      return getJson<TmdbMovieDetailsRaw>(`movie/${id}`, { language });
    },
  };
}
