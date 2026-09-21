import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Movie } from '../../back-end/schemas/MoviesTypes';
import RatingRing from './RatingRing';

type MovieDetailModalProps = {
  movie: Movie;
  genreMap: Map<number, string> | null;
  onClose: () => void;
};

const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

const voteCountFormatter = new Intl.NumberFormat('fr-FR');

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog showing full details for a single movie: backdrop image,
 * rating, genres and the complete overview. Handles the accessibility
 * basics a dialog needs on its own: it traps focus while open, closes on
 * Escape or an overlay click, and locks page scroll for as long as it's
 * shown. Returning focus to whatever opened it is the caller's job, since
 * only the caller knows which element that was.
 */
export default function MovieDetailModal({
  movie,
  genreMap,
  onClose,
}: MovieDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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
        onClose();
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
  }, [onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;
  const genres = movie.genre_ids
    .map((id) => genreMap?.get(id))
    .filter((name): name is string => Boolean(name));

  return createPortal(
    <div className="modal-overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="modal__media">
          {movie.backdrop_path ? (
            <img
              className="modal__backdrop"
              src={`${BACKDROP_BASE_URL}${movie.backdrop_path}`}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <div className="modal__backdrop modal__backdrop--placeholder" />
          )}
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="modal__content">
          <div className="modal__heading">
            <h2 id="modal-title" className="modal__title">
              {movie.title}
            </h2>
            <RatingRing
              value={movie.vote_average}
              voteCount={movie.vote_count}
              size={56}
              strokeWidth={4}
            />
          </div>

          <p className="modal__subline">
            {year ?? 'Date inconnue'}
            {movie.vote_count > 0 && (
              <>
                {' · '}
                {voteCountFormatter.format(movie.vote_count)} vote
                {movie.vote_count !== 1 ? 's' : ''}
              </>
            )}
            {movie.original_title !== movie.title && (
              <>
                {' · '}Titre original : {movie.original_title}
              </>
            )}
          </p>

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
