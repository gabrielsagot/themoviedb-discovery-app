import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Genre,
  Movie,
  MoviesApiResponse,
} from '../back-end/schemas/MoviesTypes';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
} from '../back-end/constants';
import MovieDetailModal from './components/MovieDetailModal';
import MovieItem from './components/MovieItem';
import ScrollToTopButton from './components/ScrollToTopButton';
import SearchBar from './components/SearchBar';
import './app.css';

type LoadState = 'loading' | 'loaded' | 'error';

// Timestamp of the first module evaluation: the splash screen stays up for
// at least a moment after it, so a fast API response doesn't make it flash
// past before anyone can read it.
const APP_STARTED_AT = Date.now();
const MIN_SPLASH_MS = 700;
const SPLASH_FADE_MS = 450;

const numberFormatter = new Intl.NumberFormat('fr-FR');

// Read the language / page / region query params, falling back to the
// application defaults when they're missing or malformed.
const readUrlParams = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const rawPage = queryParams.get('page') || DEFAULT_PAGE;
  const parsedPage = Number.parseInt(rawPage, 10);

  return {
    language: queryParams.get('language') || DEFAULT_LANGUAGE,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    region: queryParams.get('region') || DEFAULT_REGION,
  };
};

export default function App() {
  // State to hold the fetched movies data, initialized to null
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState<LoadState>('loading');
  const [activeQuery, setActiveQuery] = useState('');

  // "Load more" has its own loading and error state: a failed extra page
  // shouldn't wipe out the movies already on screen.
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // The genre list is fetched once and reused to label every movie card's
  // modal, so it lives independently of the movies-loading state above.
  const [genres, setGenres] = useState<Genre[] | null>(null);

  // The movie currently shown in the detail modal, and the element that
  // opened it, so focus can be returned there once the modal closes.
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const genreMap = useMemo(() => {
    if (!genres) return null;
    return new Map(genres.map((genre) => [genre.id, genre.name]));
  }, [genres]);

  // Fetch popular movies, or search results when a query is active. Only
  // touches state from the promise callbacks, never synchronously, so it
  // stays safe to call from an effect. 'append' adds the page to what's
  // already on screen (the "voir plus" button), 'replace' starts over.
  const loadMovies = useCallback(
    (pageToLoad: number, mode: 'replace' | 'append') => {
      const { language, region } = readUrlParams();

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
          setStatus('loaded');
          setIsLoadingMore(false);
        })
        .catch(() => {
          if (mode === 'append') {
            setIsLoadingMore(false);
            setLoadMoreFailed(true);
          } else {
            setStatus('error');
          }
        });
    },
    [activeQuery],
  );

  // useEffect hook to fetch data from an API when the component mounts,
  // and again whenever loadMovies changes (i.e. when activeQuery changes).
  useEffect(() => {
    loadMovies(readUrlParams().page, 'replace');
  }, [loadMovies]);

  // Fetch the genre list once, independently of the movies themselves, and
  // silently give up on failure: genre chips are a nice-to-have in the
  // modal, not something worth surfacing an error state over.
  useEffect(() => {
    const { language } = readUrlParams();

    fetch(`/api/genres?language=${language}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.genres) setGenres(data.genres);
      })
      .catch(() => {
        /* genre chips are optional; the modal still works without them */
      });
  }, []);

  // Take down the splash screen once the first load has settled, one way
  // or the other. It's plain DOM work because the splash lives in
  // index.html, where it can be painted before React even boots.
  useEffect(() => {
    if (status === 'loading') return;

    const splash = document.getElementById('splash');
    if (!splash || splash.dataset.hiding === '1') return;

    const remaining = Math.max(
      0,
      MIN_SPLASH_MS - (Date.now() - APP_STARTED_AT),
    );
    const timer = window.setTimeout(() => {
      splash.dataset.hiding = '1';
      window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [status]);

  // Return focus to whichever card opened the modal once it closes again,
  // so keyboard and screen reader users land back where they started.
  useEffect(() => {
    if (selectedMovie === null) lastTriggerRef.current?.focus();
  }, [selectedMovie]);

  // Every handler below is triggered by a user action (a click, or the
  // debounced search callback), never from inside an effect, so resetting
  // to "loading" here synchronously is safe.
  const handleRetry = () => {
    setStatus('loading');
    loadMovies(readUrlParams().page, 'replace');
  };

  const handleSearch = (query: string) => {
    setActiveQuery(query);
    setStatus('loading');
    setLoadMoreFailed(false);
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    loadMovies(currentPage + 1, 'append');
  };

  const handleSelectMovie = (movie: Movie, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger;
    setSelectedMovie(movie);
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  const hasMorePages = currentPage < totalPages;

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__brand">
            <svg
              className="topbar__mark"
              viewBox="0 0 64 64"
              aria-hidden="true"
              focusable="false"
            >
              <rect width="64" height="64" rx="15" fill="currentColor" />
              <path
                d="M25 20.5 L44.5 32 L25 43.5 Z"
                fill="var(--bg)"
                stroke="var(--bg)"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
            </svg>
            TMDB Discovery
          </span>
          <SearchBar onSearch={handleSearch} />
        </div>
      </header>

      <main>
        <header className="hero">
          <h1 className="hero__title">
            {activeQuery
              ? `Résultats pour « ${activeQuery} »`
              : 'Films populaires'}
          </h1>
          <h2 className="hero__subtitle" aria-live="polite">
            {activeQuery ? (
              status === 'loaded' && totalResults !== null ? (
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
          {status === 'loading' && (
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

          {status === 'error' && (
            <div className="error-state">
              <h2 className="error-state__title">
                Les films n'ont pas pu être chargés
              </h2>
              <p className="error-state__message">
                Une erreur est survenue pendant la récupération des films.
                Vérifie que le serveur est démarré et réessaie.
              </p>
              <button className="button button--primary" onClick={handleRetry}>
                Réessayer
              </button>
            </div>
          )}

          {status === 'loaded' && movies && movies.length > 0 && (
            <>
              <ul className="movie-grid">
                {movies.map((movie) => (
                  <li key={movie.id}>
                    <article>
                      <MovieItem movie={movie} onSelect={handleSelectMovie} />
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

          {status === 'loaded' && movies && movies.length === 0 && (
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

      <footer className="footer">
        <p className="footer__text">
          Données fournies par{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer noopener"
          >
            The Movie Database
          </a>
          . Ce projet utilise l'API TMDB sans être approuvé ni certifié par
          TMDB.
        </p>
      </footer>

      <ScrollToTopButton />

      {selectedMovie && (
        <MovieDetailModal
          movie={selectedMovie}
          genreMap={genreMap}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
