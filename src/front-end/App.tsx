import { useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router';
import BrandMark from './components/BrandMark';
import ScrollToTopButton from './components/ScrollToTopButton';
import SearchBar from './components/SearchBar';
import { useDismissSplash } from './hooks/useDismissSplash';
import MovieDetailPage from './pages/MovieDetailPage';
import MoviesListPage from './pages/MoviesListPage';
import NotFoundPage from './pages/NotFoundPage';
import './app.css';

export default function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Bumped to force-remount SearchBar (see its `key` below), which clears
  // its own internal input value. SearchBar owns that value itself — the
  // only way to reset it from here is to give it a fresh instance.
  const [searchResetKey, setSearchResetKey] = useState(0);

  // The shell is up as soon as React mounts; each page shows its own
  // skeletons while its data loads.
  useDismissSplash(true);

  // Searching puts the query in the URL and lands on the list, wherever the
  // search was started from — including a detail page. Replacing rather than
  // pushing keeps one history entry per search instead of one per keystroke.
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

  // Clearing from the empty state also has to empty the field itself, which
  // lives up here in the top bar.
  const handleClearSearch = () => {
    setSearchResetKey((key) => key + 1);
    handleSearch('');
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__brand">
            <BrandMark className="topbar__mark" />
            TMDB Discovery
          </span>
          <SearchBar
            key={searchResetKey}
            onSearch={handleSearch}
            initialQuery={searchParams.get('query') ?? ''}
          />
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/movies" replace />} />
        <Route
          path="/movies"
          element={<MoviesListPage onClearSearch={handleClearSearch} />}
        />
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
