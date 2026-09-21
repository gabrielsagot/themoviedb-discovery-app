import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Genre, Movie } from '../back-end/schemas/MoviesTypes';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PAGE,
  DEFAULT_REGION,
} from '../back-end/constants';
import MovieDetailModal from './components/MovieDetailModal';
import MovieItem from './components/MovieItem';
import SearchBar from './components/SearchBar';
import './app.css';

type LoadState = 'loading' | 'loaded' | 'error';

export default function App() {
  // State to hold the fetched movies data, initialized to null
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');
  const [activeQuery, setActiveQuery] = useState('');

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
  // stays safe to call from an effect.
  const loadMovies = useCallback(() => {
    // read parameters from the URL query string
    const queryParams = new URLSearchParams(window.location.search);
    const language = queryParams.get('language') || DEFAULT_LANGUAGE;
    const page = queryParams.get('page') || DEFAULT_PAGE;
    const region = queryParams.get('region') || DEFAULT_REGION;

    const endpoint = activeQuery
      ? `/api/movies/search?query=${encodeURIComponent(activeQuery)}&language=${language}&page=${page}&region=${region}`
      : `/api/movies/popular?language=${language}&page=${page}&region=${region}`;

    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch movies');
        }
        return response.json();
      })
      .then((data) => {
        setMovies(data.results);
        setTotalResults(data.total_results);
        setStatus('loaded');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [activeQuery]);

  // useEffect hook to fetch data from an API when the component mounts,
  // and again whenever loadMovies changes (i.e. when activeQuery changes).
  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  // Fetch the genre list once, independently of the movies themselves, and
  // silently give up on failure: genre chips are a nice-to-have in the
  // modal, not something worth surfacing an error state over.
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const language = queryParams.get('language') || DEFAULT_LANGUAGE;

    fetch(`/api/genres?language=${language}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.genres) setGenres(data.genres);
      })
      .catch(() => {
        /* genre chips are optional; the modal still works without them */
      });
  }, []);

  // Return focus to whichever card opened the modal once it closes again,
  // so keyboard and screen reader users land back where they started.
  useEffect(() => {
    if (selectedMovie === null) lastTriggerRef.current?.focus();
  }, [selectedMovie]);

  // Both handlers below are triggered by a user action (a click, or the
  // debounced search callback), never from inside an effect, so resetting
  // to "loading" here synchronously is safe.
  const handleRetry = () => {
    setStatus('loading');
    loadMovies();
  };

  const handleSearch = (query: string) => {
    setActiveQuery(query);
    setStatus('loading');
  };

  const handleSelectMovie = (movie: Movie, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger;
    setSelectedMovie(movie);
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__brand">TMDB Discovery</span>
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
          <h2 className="hero__subtitle">
            {activeQuery ? (
              status === 'loaded' && totalResults !== null ? (
                `${totalResults} résultat${totalResults !== 1 ? 's' : ''}`
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
                <li className="movie" key={index}>
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
              <button className="error-state__retry" onClick={handleRetry}>
                Réessayer
              </button>
            </div>
          )}

          {status === 'loaded' && movies && movies.length > 0 && (
            <ul className="movie-grid">
              {movies.map((movie) => (
                <li key={movie.id}>
                  <article>
                    <MovieItem movie={movie} onSelect={handleSelectMovie} />
                  </article>
                </li>
              ))}
            </ul>
          )}

          {status === 'loaded' && movies && movies.length === 0 && (
            <p className="empty-state">
              Aucun film ne correspond à « {activeQuery} ».
            </p>
          )}
        </section>
      </main>

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
