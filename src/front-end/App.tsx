import { useEffect } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router';
import MovieDetailPage from './pages/MovieDetailPage';
import MoviesListPage from './pages/MoviesListPage';
import NotFoundPage from './pages/NotFoundPage';
import ScrollToTopButton from './components/ScrollToTopButton';
import SearchBar from './components/SearchBar';
import './app.css';

// Timestamp of the first module evaluation: the splash screen stays up for
// at least a moment after it, so a fast boot doesn't make it flash past
// before anyone can read it.
const APP_STARTED_AT = Date.now();
const MIN_SPLASH_MS = 700;
const SPLASH_FADE_MS = 450;

export default function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Take down the splash screen once React has mounted. It's plain DOM work
  // because the splash lives in index.html, where it can be painted before
  // React even boots.
  useEffect(() => {
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
  }, []);

  // Searching puts the query in the URL and lands on the list, wherever the
  // search was started from — including the detail page. Replacing rather
  // than pushing keeps one history entry per search instead of one per
  // keystroke.
  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams);

    if (query) {
      params.set('query', query);
    } else {
      params.delete('query');
    }
    params.delete('page');

    const search = params.toString();
    navigate(`/movies${search ? `?${search}` : ''}`, { replace: true });
  };

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
          <SearchBar
            onSearch={handleSearch}
            initialQuery={searchParams.get('query') ?? ''}
          />
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/movies" replace />} />
        <Route path="/movies" element={<MoviesListPage />} />
        <Route path="/movies/:id" element={<MovieDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

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
    </>
  );
}
