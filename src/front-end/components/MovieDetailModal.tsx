import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Movie, MovieDetails } from '../../back-end/schemas/MoviesTypes';
import MovieItem from './MovieItem';
import RatingRing from './RatingRing';

type MovieDetailModalProps = {
  movie: Movie;
  genreMap: Map<number, string> | null;
  onClose: () => void;
  onSelectSimilar: (movie: Movie, trigger: HTMLElement) => void;
};

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const CLOSE_ANIMATION_MS = 180;

const voteCountFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const formatReleaseDate = (releaseDate: string) => {
  if (!releaseDate) return null;

  const parsed = new Date(releaseDate);
  return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
};

// Turns a TMDB runtime in minutes into "2h 22min", dropping whichever unit
// would be zero. Movies with an unknown runtime (0 or null) show nothing.
const formatRuntime = (minutes: number | null) => {
  if (!minutes) return null;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
};

/**
 * A modal dialog showing full details for a single movie. It opens instantly
 * with whatever the caller already knows (poster, title, rating, genres,
 * overview), then fetches the rest — runtime, director, cast, trailer and
 * similar movies — from the details endpoint, so a slow connection never
 * blocks the modal from opening. Handles the accessibility basics a dialog
 * needs on its own: it traps focus while open, closes on Escape or an
 * overlay click, and locks page scroll for as long as it's shown. Returning
 * focus to whatever opened it is the caller's job, since only the caller
 * knows which element that was.
 */
export default function MovieDetailModal({
  movie,
  genreMap,
  onClose,
  onSelectSimilar,
}: MovieDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<
    'loading' | 'loaded' | 'error'
  >('loading');
  const [showTrailer, setShowTrailer] = useState(false);

  // Tracks which movie the state above belongs to. When a similar movie is
  // clicked, `movie` changes without the modal closing, and the stale
  // details/trailer state needs clearing — done here, during render, rather
  // than from an effect, so it takes effect in the same render pass instead
  // of committing once with stale data and re-rendering a moment later.
  const [loadedForMovieId, setLoadedForMovieId] = useState(movie.id);
  if (movie.id !== loadedForMovieId) {
    setLoadedForMovieId(movie.id);
    setDetailsStatus('loading');
    setDetails(null);
    setShowTrailer(false);
  }

  // Closing plays a short exit animation first, so the dialog leaves the
  // way it arrived instead of blinking out.
  const requestClose = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(onClose, CLOSE_ANIMATION_MS);
  }, [onClose]);

  // Move focus into the dialog as soon as it mounts, and lock page scroll
  // for as long as it stays open.
  useEffect(() => {
    dialogRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Scroll back to the top when a similar movie is clicked, so the new
  // movie starts from the same clean slate the first one did.
  useEffect(() => {
    dialogRef.current?.scrollTo({ top: 0 });
  }, [movie.id]);

  // Fetch the full details for whichever movie is currently shown. Re-runs
  // when a similar movie is clicked and swaps `movie` without the modal
  // closing.
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/movies/${movie.id}`)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch movie details');
        return response.json() as Promise<MovieDetails>;
      })
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setDetailsStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setDetailsStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [movie.id]);

  // Close on Escape, and keep Tab from moving focus outside the dialog.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  const releaseDate = formatReleaseDate(movie.release_date);
  const genres = movie.genre_ids
    .map((id) => genreMap?.get(id))
    .filter((name): name is string => Boolean(name));

  const runtime = details ? formatRuntime(details.runtime) : null;
  const metaLine = [
    runtime,
    details?.director && `Réalisé par ${details.director}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return createPortal(
    <div
      className={`modal-overlay${isClosing ? ' modal-overlay--closing' : ''}`}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={dialogRef}
        className={`modal${isClosing ? ' modal--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="modal__media">
          {showTrailer && details?.trailerKey ? (
            <iframe
              className="modal__backdrop modal__trailer"
              src={`https://www.youtube-nocookie.com/embed/${details.trailerKey}?autoplay=1&rel=0`}
              title={`Bande-annonce de ${movie.title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : movie.backdrop_path ? (
            <img
              className="modal__backdrop"
              src={`${IMAGE_BASE_URL}/w1280${movie.backdrop_path}`}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <div className="modal__backdrop modal__backdrop--empty" />
          )}

          {!showTrailer && (
            <>
              <div className="modal__scrim" aria-hidden="true" />
              {details?.trailerKey && (
                <button
                  type="button"
                  className="modal__play"
                  onClick={() => setShowTrailer(true)}
                  aria-label="Lire la bande-annonce"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M7.5 5.2v9.6l7.5-4.8z" fill="currentColor" />
                  </svg>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="modal__close"
            onClick={requestClose}
            aria-label="Fermer"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M6 6l8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="modal__content">
          <div className="modal__head">
            {movie.poster_path && (
              <img
                className="modal__poster"
                src={`${IMAGE_BASE_URL}/w342${movie.poster_path}`}
                alt=""
                aria-hidden="true"
              />
            )}

            <div className="modal__headline">
              <h2 id="modal-title" className="modal__title">
                {movie.title}
              </h2>
              <p className="modal__subline">
                {releaseDate ?? 'Date de sortie inconnue'}
                {movie.vote_count > 0 && (
                  <>
                    {' · '}
                    {voteCountFormatter.format(movie.vote_count)} vote
                    {movie.vote_count !== 1 ? 's' : ''}
                  </>
                )}
              </p>
              {metaLine && <p className="modal__meta">{metaLine}</p>}
            </div>

            <RatingRing
              value={movie.vote_average}
              voteCount={movie.vote_count}
              size={54}
              strokeWidth={4}
            />
          </div>

          {movie.original_title !== movie.title && (
            <p className="modal__original">
              Titre original : {movie.original_title}
            </p>
          )}

          {details?.tagline && (
            <p className="modal__tagline">{details.tagline}</p>
          )}

          {genres.length > 0 && (
            <ul className="modal__genres">
              {genres.map((genre) => (
                <li key={genre} className="genre-chip">
                  {genre}
                </li>
              ))}
            </ul>
          )}

          <p className="modal__overview">
            {movie.overview || "Aucun résumé n'est disponible pour ce film."}
          </p>

          {detailsStatus === 'loading' && (
            <ul className="cast-row" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <li
                  className="cast-row__item cast-row__item--skeleton"
                  key={index}
                >
                  <div className="cast-row__photo cast-row__photo--skeleton" />
                  <div className="skeleton-line" style={{ width: '70%' }} />
                </li>
              ))}
            </ul>
          )}

          {detailsStatus === 'loaded' && details && details.cast.length > 0 && (
            <ul className="cast-row">
              {details.cast.map((member) => (
                <li className="cast-row__item" key={member.id}>
                  {member.profile_path ? (
                    <img
                      className="cast-row__photo"
                      src={`${IMAGE_BASE_URL}/w185${member.profile_path}`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="cast-row__photo cast-row__photo--empty"
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <circle
                          cx="12"
                          cy="8.5"
                          r="3.5"
                          stroke="currentColor"
                          strokeWidth="1.3"
                        />
                        <path
                          d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span className="cast-row__name">{member.name}</span>
                  {member.character && (
                    <span className="cast-row__character">
                      {member.character}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {detailsStatus === 'loaded' &&
            details &&
            details.similar.length > 0 && (
              <div className="modal__similar">
                <h3 className="modal__similar-title">Films similaires</h3>
                <ul className="modal__similar-grid">
                  {details.similar.map((similarMovie) => (
                    <li key={similarMovie.id}>
                      <MovieItem
                        movie={similarMovie}
                        onSelect={onSelectSimilar}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
