import { useCallback, useEffect, useState } from 'react';
import type { Movie } from '../back-end/schemas/MoviesTypes';
import MovieItem from './components/MovieItem';
import './app.css';

type LoadState = 'loading' | 'loaded' | 'error';

export default function App() {
  // State to hold the fetched movies data, initialized to null
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');

  // Fetch popular movies. Only touches state from the promise callbacks,
  // never synchronously, so it stays safe to call from an effect.
  const loadMovies = useCallback(() => {
    fetch('/api/movies/popular')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch popular movies');
        }
        return response.json();
      })
      .then((data) => {
        setMovies(data.results);
        setStatus('loaded');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  // useEffect hook to fetch data from an API when the component mounts
  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  // Retry is triggered by a click, so resetting to "loading" here is safe.
  const handleRetry = () => {
    setStatus('loading');
    loadMovies();
  };

  return (
    <main>
      <header className="hero">
        <h1 className="hero__title">Films populaires</h1>
        <h2 className="hero__subtitle">
          Films tendances en France, d'après les données de{' '}
          <b>The Movie Database</b>
        </h2>
      </header>

      <section>
        {status === 'loading' && (
          <ul
            className="movie-grid"
            aria-busy="true"
            aria-label="Chargement des films populaires"
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
              Une erreur est survenue pendant la récupération des films
              populaires. Vérifie que le serveur est démarré et réessaie.
            </p>
            <button className="error-state__retry" onClick={handleRetry}>
              Réessayer
            </button>
          </div>
        )}

        {status === 'loaded' && movies && (
          <ul className="movie-grid">
            {movies.map((movie) => (
              <li key={movie.id}>
                <article>
                  <MovieItem movie={movie} />
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
