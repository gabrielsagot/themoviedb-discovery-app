import type { Movie } from '../../back-end/schemas/MoviesTypes';

type MovieItemProps = {
  movie: Movie;
};

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w185';

export default function MovieItem({ movie }: MovieItemProps) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : '—';

  return (
    <div className="movie">
      {movie.poster_path ? (
        <img
          className="movie__poster"
          src={`${POSTER_BASE_URL}${movie.poster_path}`}
          alt={`Affiche de ${movie.title}`}
          loading="lazy"
        />
      ) : (
        <div className="movie__poster" aria-hidden="true" />
      )}
      <h2 className="movie__title">{movie.title}</h2>
      <p className="movie__meta">
        <span>{year}</span>
        <span>{movie.vote_average.toFixed(1)}</span>
      </p>
      <p className="movie__overview">{movie.overview}</p>
    </div>
  );
}
