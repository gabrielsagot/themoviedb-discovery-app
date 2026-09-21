import type { Movie } from '../../back-end/schemas/MoviesTypes';
import RatingRing from './RatingRing';

type MovieItemProps = {
  movie: Movie;
  onSelect: (movie: Movie, trigger: HTMLElement) => void;
};

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p';

export default function MovieItem({ movie, onSelect }: MovieItemProps) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : '—';

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onSelect(movie, event.currentTarget);
  };

  return (
    <button
      type="button"
      className="movie"
      onClick={handleClick}
      aria-haspopup="dialog"
    >
      <div className="movie__poster-wrap">
        {movie.poster_path ? (
          <img
            className="movie__poster"
            src={`${POSTER_BASE_URL}/w342${movie.poster_path}`}
            srcSet={`${POSTER_BASE_URL}/w185${movie.poster_path} 185w, ${POSTER_BASE_URL}/w342${movie.poster_path} 342w`}
            sizes="(max-width: 640px) 45vw, 220px"
            alt={`Affiche de ${movie.title}`}
            loading="lazy"
          />
        ) : (
          <div className="movie__poster" aria-hidden="true" />
        )}
        <div className="movie__badge">
          <RatingRing value={movie.vote_average} voteCount={movie.vote_count} />
        </div>
      </div>
      <p className="movie__title">{movie.title}</p>
      <p className="movie__meta">
        <span>{year}</span>
      </p>
      <p className="movie__overview">{movie.overview}</p>
    </button>
  );
}
