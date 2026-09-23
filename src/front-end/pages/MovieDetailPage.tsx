import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { MovieDetails } from '../../back-end/schemas/MoviesTypes';
import { DEFAULT_LANGUAGE } from '../../back-end/constants';
import MovieItem from '../components/MovieItem';
import RatingRing from '../components/RatingRing';
import { useGenres } from '../hooks/useGenres';

type LoadState = 'loading' | 'loaded' | 'notfound' | 'error';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const voteCountFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

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
 * The page for a single movie: backdrop with its trailer, poster, rating,
 * genres, overview, cast and similar movies. Everything comes from the
 * details endpoint, so the page works when opened directly from its URL
 * rather than only by clicking a card.
 */
export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const language = searchParams.get('language') || DEFAULT_LANGUAGE;

  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');
  // The trailer is tied to the movie it belongs to rather than to a boolean:
  // opening another film from the "similar" row then hides it on its own,
  // with no effect resetting state behind the scenes.
  const [trailerForId, setTrailerForId] = useState<string | null>(null);
  const showTrailer = trailerForId === id;

  const { genreMap } = useGenres(language);

  // State is only ever set from the promise callbacks, never synchronously
  // inside the effect below.
  const loadMovie = useCallback(() => {
    fetch(`/api/movies/${id}?language=${language}`)
      .then(async (response) => {
        if (response.status === 404) {
          setStatus('notfound');
          return null;
        }
        if (!response.ok) {
          throw new Error('Failed to fetch movie details');
        }
        return response.json() as Promise<MovieDetails>;
      })
      .then((data) => {
        if (!data) return;
        setMovie(data);
        setStatus('loaded');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [id, language]);

  useEffect(() => {
    loadMovie();
  }, [loadMovie]);

  // Opening another movie from the "similar" row starts at the top of it.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  const handleRetry = () => {
    setStatus('loading');
    loadMovie();
  };

  const releaseDate = movie ? formatReleaseDate(movie.release_date) : null;
  const genres = (movie?.genre_ids ?? [])
    .map((genreId) => genreMap?.get(genreId))
    .filter((name): name is string => Boolean(name));

  const runtime = movie ? formatRuntime(movie.runtime) : null;
  const metaLine = [runtime, movie?.director && `Réalisé par ${movie.director}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="app-shell">
      <Link className="back-link" to="/movies">
        <span aria-hidden="true">‹</span> Retour aux films
      </Link>

      {status === 'loading' && (
        <div
          className="detail"
          aria-busy="true"
          aria-label="Chargement du film"
        >
          <div className="detail__backdrop skeleton-block" />
          <div className="detail__content">
            <div className="detail__head">
              <div className="detail__poster skeleton-block" />
              <div className="detail__headline">
                <div
                  className="skeleton-line"
                  style={{ width: '60%', height: 22 }}
                />
                <div className="skeleton-line" style={{ width: '35%' }} />
              </div>
            </div>
            <div className="skeleton-line" style={{ width: '90%' }} />
            <div className="skeleton-line" style={{ width: '80%' }} />
          </div>
        </div>
      )}

      {status === 'notfound' && (
        <div className="error-state">
          <h1 className="error-state__title">Ce film est introuvable</h1>
          <p className="error-state__message">
            Aucun film ne correspond à cet identifiant dans le catalogue TMDB.
          </p>
          <Link className="button button--primary" to="/movies">
            Voir les films populaires
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="error-state">
          <h1 className="error-state__title">Ce film n'a pas pu être chargé</h1>
          <p className="error-state__message">
            Le serveur n'a pas répondu. Vérifie qu'il est démarré et réessaie.
          </p>
          <button className="button button--primary" onClick={handleRetry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loaded' && movie && (
        <article className="detail">
          <div className="detail__media">
            {showTrailer && movie.trailerKey ? (
              <iframe
                className="detail__backdrop detail__trailer"
                src={`https://www.youtube-nocookie.com/embed/${movie.trailerKey}?autoplay=1&rel=0`}
                title={`Bande-annonce de ${movie.title}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : movie.backdrop_path ? (
              <img
                className="detail__backdrop"
                src={`${IMAGE_BASE_URL}/w1280${movie.backdrop_path}`}
                alt=""
                aria-hidden="true"
              />
            ) : (
              <div className="detail__backdrop detail__backdrop--empty" />
            )}

            {!showTrailer && (
              <>
                <div className="detail__scrim" aria-hidden="true" />
                {movie.trailerKey && (
                  <button
                    type="button"
                    className="detail__play"
                    onClick={() => setTrailerForId(id ?? null)}
                    aria-label="Lire la bande-annonce"
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M7.5 5.2v9.6l7.5-4.8z" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="detail__content">
            <div className="detail__head">
              {movie.poster_path && (
                <img
                  className="detail__poster"
                  src={`${IMAGE_BASE_URL}/w342${movie.poster_path}`}
                  alt=""
                  aria-hidden="true"
                />
              )}

              <div className="detail__headline">
                <h1 className="detail__title">{movie.title}</h1>
                <p className="detail__subline">
                  {releaseDate ?? 'Date de sortie inconnue'}
                  {movie.vote_count > 0 && (
                    <>
                      {' · '}
                      {voteCountFormatter.format(movie.vote_count)} vote
                      {movie.vote_count !== 1 ? 's' : ''}
                    </>
                  )}
                </p>
                {metaLine && <p className="detail__meta">{metaLine}</p>}
              </div>

              <RatingRing
                value={movie.vote_average}
                voteCount={movie.vote_count}
                size={54}
                strokeWidth={4}
              />
            </div>

            {movie.original_title !== movie.title && (
              <p className="detail__original">
                Titre original : {movie.original_title}
              </p>
            )}

            {movie.tagline && (
              <p className="detail__tagline">{movie.tagline}</p>
            )}

            {genres.length > 0 && (
              <ul className="detail__genres">
                {genres.map((genre) => (
                  <li key={genre} className="genre-chip">
                    {genre}
                  </li>
                ))}
              </ul>
            )}

            <p className="detail__overview">
              {movie.overview || "Aucun résumé n'est disponible pour ce film."}
            </p>

            {movie.cast.length > 0 && (
              <ul className="cast-row">
                {movie.cast.map((member) => (
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

            {movie.similar.length > 0 && (
              <div className="detail__similar">
                <h2 className="detail__similar-title">Films similaires</h2>
                <ul className="detail__similar-grid">
                  {movie.similar.map((similarMovie) => (
                    <li key={similarMovie.id}>
                      <MovieItem movie={similarMovie} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>
      )}
    </main>
  );
}
