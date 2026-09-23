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
} from '../../back-end/constants';
import MovieItem from '../components/MovieItem';

type LoadState = 'loading' | 'loaded' | 'error';

const numberFormatter = new Intl.NumberFormat('fr-FR');

// Read a page number from the URL, falling back to the first page when it's
// missing or malformed.
const parsePage = (rawPage: string | null): number => {
  const parsed = Number.parseInt(rawPage || DEFAULT_PAGE, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export default function MoviesListPage() {
  // The search query and the TMDB parameters all live in the URL, so a
  // result list can be shared, bookmarked and walked back through.
  const [searchParams] = useSearchParams();
  const activeQuery = (searchParams.get('query') ?? '').trim();
  const language = searchParams.get('language') || DEFAULT_LANGUAGE;
  const region = searchParams.get('region') || DEFAULT_REGION;
  const requestedPage = parsePage(searchParams.get('page'));

  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState<LoadState>('loading');

  // Which query the movies on screen belong to. Comparing it with the query
  // in the URL tells us the list is stale without setting state from inside
  // the effect that starts the fetch.
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);

  // "Load more" has its own loading and error state: a failed extra page
  // shouldn't wipe out the movies already on screen.
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // Fetch popular movies, or search results when a query is active. Only
  // touches state from the promise callbacks, never synchronously, so it
  // stays safe to call from an effect. 'append' adds the page to what's
  // already on screen (the "voir plus" button), 'replace' starts over.
  const loadMovies = useCallback(
    (pageToLoad: number, mode: 'replace' | 'append') => {
      const endpoint = activeQuery
        ? `/api/movies/search?query=${encodeURIComponent(activeQuery)}&language=${language}&page=${pageToLoad}&region=${region}`
        : `/api/movies/popular?language=${language}&page=${pageToLoad}&region=${region}`;

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
          setLoadedQuery(activeQuery);
          setStatus('loaded');
          setIsLoadingMore(false);
        })
        .catch(() => {
          if (mode === 'append') {
            setIsLoadingMore(false);
            setLoadMoreFailed(true);
          } else {
            setLoadedQuery(activeQuery);
            setStatus('error');
          }
        });
    },
    [activeQuery, language, region],
  );

  // Runs on mount and again whenever the URL changes the query, the page or
  // the TMDB parameters.
  useEffect(() => {
    loadMovies(requestedPage, 'replace');
  }, [loadMovies, requestedPage]);

  const handleRetry = () => {
    setStatus('loading');
    loadMovies(requestedPage, 'replace');
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    loadMovies(currentPage + 1, 'append');
  };

  // A new query is in the URL but its results haven't landed yet: show the
  // skeletons rather than the previous search's movies.
  const isStale = loadedQuery !== activeQuery;
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
            <p className="empty-state__title">
              Aucun film ne correspond à « {activeQuery} »
            </p>
            <p className="empty-state__hint">
              Vérifie l'orthographe, ou cherche avec le titre original.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
