import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Movie } from '../../back-end/schemas/MoviesTypes';
import RatingRing from './RatingRing';

type MovieDetailModalProps = {
  movie: Movie;
  genreMap: Map<number, string> | null;
  onClose: () => void;
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

/**
 * A modal dialog showing full details for a single movie: backdrop image,
 * poster, rating, genres and the complete overview. Handles the
 * accessibility basics a dialog needs on its own: it traps focus while
 * open, closes on Escape or an overlay click, and locks page scroll for as
 * long as it's shown. Returning focus to whatever opened it is the
 * caller's job, since only the caller knows which element that was.
 */
export default function MovieDetailModal({
  movie,
  genreMap,
  onClose,
}: MovieDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

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
          {movie.backdrop_path ? (
            <img
              className="modal__backdrop"
              src={`${IMAGE_BASE_URL}/w1280${movie.backdrop_path}`}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <div className="modal__backdrop modal__backdrop--empty" />
          )}
          <div className="modal__scrim" aria-hidden="true" />

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
        </div>
      </div>
    </div>,
    document.body,
  );
}
