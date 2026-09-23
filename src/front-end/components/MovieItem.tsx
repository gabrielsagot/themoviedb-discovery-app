import { useState } from 'react';
import { Link } from 'react-router';
import type { Movie } from '../../back-end/schemas/MoviesTypes';
import RatingRing from './RatingRing';

type MovieItemProps = {
  movie: Movie;
};

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p';

export default function MovieItem({ movie }: MovieItemProps) {
  // Posters fade in once decoded, so a slow connection shows an empty
  // frame filling in rather than images popping into place.
  const [isPosterReady, setIsPosterReady] = useState(false);

  const year = movie.release_date ? movie.release_date.slice(0, 4) : '—';

  return (
    <Link className="movie" to={`/movies/${movie.id}`}>
      <span className="movie__frame">
        {movie.poster_path ? (
          <img
            className={`movie__poster${isPosterReady ? ' movie__poster--ready' : ''}`}
            src={`${POSTER_BASE_URL}/w342${movie.poster_path}`}
            srcSet={`${POSTER_BASE_URL}/w185${movie.poster_path} 185w, ${POSTER_BASE_URL}/w342${movie.poster_path} 342w`}
            sizes="(max-width: 640px) 45vw, 220px"
            alt={`Affiche de ${movie.title}`}
            loading="lazy"
            onLoad={() => setIsPosterReady(true)}
            onError={() => setIsPosterReady(true)}
          />
        ) : (
          <span
            className="movie__poster movie__poster--empty"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <rect
                x="3.5"
                y="3.5"
                width="17"
                height="17"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M3.5 15.5l4.2-4.2a2 2 0 0 1 2.8 0l6.2 6.2M14.5 13l1.6-1.6a2 2 0 0 1 2.8 0l1.6 1.6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}

        <span className="movie__badge">
          <RatingRing value={movie.vote_average} voteCount={movie.vote_count} />
        </span>
      </span>

      <span className="movie__title">{movie.title}</span>
      <span className="movie__meta">{year}</span>
      <span className="movie__overview">{movie.overview}</span>
    </Link>
  );
}
