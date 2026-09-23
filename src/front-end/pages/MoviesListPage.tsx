import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type {
  Movie,
  MoviesApiResponse,
} from '../../back-end/schemas/MoviesTypes';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
  DEFAULT_SORT_BY,
} from '../../back-end/constants';
import EmptyStateIllustration from '../components/EmptyStateIllustration';
import FilterBar from '../components/FilterBar';
import MovieItem from '../components/MovieItem';
import { useGenres } from '../hooks/useGenres';

type LoadState = 'loading' | 'loaded' | 'error';

type MoviesListPageProps = {
  /** Clears the search field, which lives in the top bar above the routes. */
  onClearSearch: () => void;
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

export default function MoviesListPage({ onClearSearch }: MoviesListPageProps) {
  // The search query, the filters and the TMDB parameters all live in the
  // URL, so a filtered or searched list can be shared and the browser's back
  // button steps back through them.
  const [searchParams, setSearchParams] = useSearchParams();

  const activeQuery = (searchParams.get('query') ?? '').trim();
  const language = searchParams.get('language') || DEFAULT_LANGUAGE;
  const region = searchParams.get('region') || DEFAULT_REGION;
  const sortBy = searchParams.get('sort') || DEFAULT_SORT_BY;

  const genreIds = (searchParams.get('genres') || '')
    .split(',')
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id));

  const rawYear = searchParams.get('year');
  const parsedYear = rawYear ? Number.parseInt(rawYear, 10) : null;
  const year =
    parsedYear !== null && Number.isFinite(parsedYear) ? parsedYear : null;

  const rawPage = searchParams.get('page') || DEFAULT_PAGE;
  const parsedPage = Number.parseInt(rawPage, 10);
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState<LoadState>('loading');

  // Which request the movies on screen belong to. Comparing it with what the
  // URL asks for now tells us the list is stale, without setting state
  // synchronously inside the effect that starts the fetch.
  const requestKey = `${activeQuery}|${genreIds.join(',')}|${sortBy}|${year ?? ''}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // "Load more" has its own loading and error state: a failed extra page
  // shouldn't wipe out the movies already on screen.
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const { genres } = useGenres(language);

  // Fetch the discover list (with its filters), or search results when a
  // query is active. Only touches state from the promise callbacks, never
  // synchronously, so it stays safe to call from an effect. 'append' adds
  // the page to what's already on screen, 'replace' starts over.
  const loadMovies = useCallback(
    (pageToLoad: number, mode: 'replace' | 'append') => {
      let endpoint: string;

      if (activeQuery) {
        endpoint = `/api/movies/search?query=${encodeURIComponent(activeQuery)}&language=${language}&page=${pageToLoad}&region=${region}`;
      } else {
        const queryParams = new URLSearchParams({
          language,
          page: String(pageToLoad),
          region,
        });
        if (genreIds.length > 0) {
          queryParams.set('genres', genreIds.join(','));
        }
        if (sortBy !== DEFAULT_SORT_BY) {
          queryParams.set('sort', sortBy);
        }
        if (year !== null) {
          queryParams.set('year', String(year));
        }
        endpoint = `/api/movies/popular?${queryParams.toString()}`;
      }

      fetch(endpoint)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch movies');
          }
          return response.json() as Promise<MoviesApiResponse>;
        })
        .then((data) => {
          setMovies((previous) => {
            if (mode !== 'append' || !previous) return data.results;

            // TMDB can repeat a movie across pages as popularity shifts
            // between requests, so drop anything already on screen.
            const seen = new Set(previous.map((movie) => movie.id));
            return [
              ...previous,
              ...data.results.filter((movie) => !seen.has(movie.id)),
            ];
          });
          setTotalResults(data.total_results);
          setTotalPages(data.total_pages);
          setCurrentPage(data.page);
          setLoadedKey(requestKey);
          setStatus('loaded');
          setIsLoadingMore(false);
        })
        .catch(() => {
          if (mode === 'append') {
            setIsLoadingMore(false);
            setLoadMoreFailed(true);
          } else {
            setLoadedKey(requestKey);
            setStatus('error');
          }
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeQuery, language, region, requestKey],
  );

  // Runs on mount, and again whenever the URL changes the query, the filters
  // or the TMDB parameters.
  useEffect(() => {
    loadMovies(requestedPage, 'replace');
  }, [loadMovies, requestedPage]);

  // Every filter change rewrites the URL, which is what triggers the reload
  // above. Page 1 is implied by a new set of filters.
  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams);
    mutate(params);
    params.delete('page');
    setSearchParams(params);
  };

  const handleToggleGenre = (id: number) => {
    updateParams((params) => {
      const next = genreIds.includes(id)
        ? genreIds.filter((genreId) => genreId !== id)
        : [...genreIds, id];

      if (next.length > 0) {
        params.set('genres', next.join(','));
      } else {
        params.delete('genres');
      }
    });
  };

  const handleSortChange = (nextSortBy: string) => {
    updateParams((params) => {
      if (nextSortBy !== DEFAULT_SORT_BY) {
        params.set('sort', nextSortBy);
      } else {
        params.delete('sort');
      }
    });
  };

  const handleYearChange = (nextYear: number | null) => {
    updateParams((params) => {
      if (nextYear !== null) {
        params.set('year', String(nextYear));
      } else {
        params.delete('year');
      }
    });
  };

  const handleClearFilters = () => {
    updateParams((params) => {
      params.delete('genres');
      params.delete('sort');
      params.delete('year');
    });
  };

  const handleRetry = () => {
    setStatus('loading');
    loadMovies(requestedPage, 'replace');
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    loadMovies(currentPage + 1, 'append');
  };

  // A new query or filter set is in the URL but its results haven't landed
  // yet: show the skeletons rather than the previous list.
  const isStale = loadedKey !== requestKey;
  const isLoading = status === 'loading' || (isStale && status !== 'error');
  const hasMorePages = currentPage < totalPages;

  return (
    <main className="app-shell">
      <header className="hero">
        <h1 className="hero__title">
          {activeQuery
            ? `Résultats pour « ${activeQuery} »`
            : 'Films populaires'}
        </h1>
        <h2 className="hero__subtitle" aria-live="polite">
          {activeQuery ? (
            !isLoading && totalResults !== null ? (
              `${numberFormatter.format(totalResults)} résultat${totalResults !== 1 ? 's' : ''}`
            ) : (
              'Recherche en cours…'
            )
          ) : (
            <>
              Films tendances en France, d'après les données de{' '}
              <b>The Movie Database</b>
            </>
          )}
        </h2>
      </header>

      {/* TMDB's search endpoint ignores discover's filters, so the filter bar
          only makes sense when no text search is active. */}
      {!activeQuery && (
        <FilterBar
          genres={genres}
          selectedGenreIds={genreIds}
          sortBy={sortBy}
          year={year}
          onToggleGenre={handleToggleGenre}
          onSortChange={handleSortChange}
          onYearChange={handleYearChange}
        />
      )}

      <section>
        {isLoading && (
          <ul
            className="movie-grid"
            aria-busy="true"
            aria-label="Chargement des films"
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <li className="movie-skeleton" key={index}>
                <div className="skeleton-poster" />
                <div className="skeleton-line" style={{ width: '80%' }} />
                <div className="skeleton-line" style={{ width: '40%' }} />
              </li>
            ))}
          </ul>
        )}

        {!isLoading && status === 'error' && (
          <div className="error-state">
            <EmptyStateIllustration />
            <h2 className="error-state__title">
              Les films n'ont pas pu être chargés
            </h2>
            <p className="error-state__message">
              Une erreur est survenue pendant la récupération des films. Vérifie
              que le serveur est démarré et réessaie.
            </p>
            <button className="button button--primary" onClick={handleRetry}>
              Réessayer
            </button>
          </div>
        )}

        {!isLoading && status === 'loaded' && movies && movies.length > 0 && (
          <>
            <ul className="movie-grid">
              {movies.map((movie) => (
                <li key={movie.id}>
                  <article>
                    <MovieItem movie={movie} />
                  </article>
                </li>
              ))}

              {isLoadingMore &&
                Array.from({ length: 5 }).map((_, index) => (
                  <li className="movie-skeleton" key={`skeleton-${index}`}>
                    <div className="skeleton-poster" />
                    <div className="skeleton-line" style={{ width: '80%' }} />
                    <div className="skeleton-line" style={{ width: '40%' }} />
                  </li>
                ))}
            </ul>

            <div className="load-more">
              {hasMorePages ? (
                <button
                  className="button button--outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Chargement…' : 'Voir plus de films'}
                </button>
              ) : (
                <p className="load-more__done">Fin de la liste</p>
              )}

              {loadMoreFailed && (
                <p className="load-more__error" role="alert">
                  Les films suivants n'ont pas pu être chargés.
                </p>
              )}

              <p className="load-more__count">
                {numberFormatter.format(movies.length)} film
                {movies.length !== 1 ? 's' : ''} affiché
                {movies.length !== 1 ? 's' : ''}
                {totalResults !== null &&
                  ` sur ${numberFormatter.format(totalResults)}`}
              </p>
            </div>
          </>
        )}

        {!isLoading && status === 'loaded' && movies && movies.length === 0 && (
          <div className="empty-state">
            <EmptyStateIllustration />
            {activeQuery ? (
              <>
                <p className="empty-state__title">
                  Aucun film ne correspond à « {activeQuery} »
                </p>
                <p className="empty-state__hint">
                  Vérifie l'orthographe, ou cherche avec le titre original.
                </p>
                <button
                  type="button"
                  className="button button--outline empty-state__action"
                  onClick={onClearSearch}
                >
                  Effacer la recherche
                </button>
              </>
            ) : (
              <>
                <p className="empty-state__title">
                  Aucun film ne correspond à ces filtres
                </p>
                <p className="empty-state__hint">
                  Essaie d'élargir tes critères : moins de genres, ou une autre
                  année.
                </p>
                <button
                  type="button"
                  className="button button--outline empty-state__action"
                  onClick={handleClearFilters}
                >
                  Supprimer les filtres
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
