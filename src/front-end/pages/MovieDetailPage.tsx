import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { MovieDetails } from '../../back-end/schemas/MoviesTypes';
import { DEFAULT_LANGUAGE } from '../../back-end/constants';
import RatingRing from '../components/RatingRing';

type LoadState = 'loading' | 'loaded' | 'error';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const numberFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const moneyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const languageNames = new Intl.DisplayNames(['fr'], { type: 'language' });

// TMDB reports the production status in English; these are the values it
// actually returns.
const STATUS_LABELS: Record<string, string> = {
  Released: 'Sorti',
  'Post Production': 'Post-production',
  'In Production': 'En production',
  Planned: 'Prévu',
  Canceled: 'Annulé',
  Rumored: 'Rumeur',
};

const formatReleaseDate = (releaseDate: string): string | null => {
  if (!releaseDate) return null;
  const parsed = new Date(releaseDate);
  return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
};

const formatRuntime = (runtime: number | null): string | null => {
  if (!runtime) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours > 0
    ? `${hours} h ${String(minutes).padStart(2, '0')}`
    : `${minutes} min`;
};

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const language = searchParams.get('language') || DEFAULT_LANGUAGE;

  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');

  // Same rule as everywhere else in the app: state is only ever set from the
  // promise callbacks, never synchronously inside the effect.
  const loadMovie = useCallback(() => {
    fetch(`/api/movies/${id}?language=${language}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch movie details');
        }
        return response.json() as Promise<MovieDetails>;
      })
      .then((data) => {
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

  const handleRetry = () => {
    setStatus('loading');
    loadMovie();
  };

  // Every page scrolls back to the top when a different movie is opened.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  const releaseDate = movie ? formatReleaseDate(movie.release_date) : null;
  const runtime = movie ? formatRuntime(movie.runtime) : null;

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
      )}

      {status === 'error' && (
        <div className="error-state">
          <h1 className="error-state__title">Ce film n'a pas pu être chargé</h1>
          <p className="error-state__message">
            L'identifiant est peut-être incorrect, ou le serveur n'a pas
            répondu.
          </p>
          <button className="button button--primary" onClick={handleRetry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loaded' && movie && (
        <article className="detail">
          <div className="detail__media">
            {movie.backdrop_path ? (
              <img
                className="detail__backdrop"
                src={`${IMAGE_BASE_URL}/w1280${movie.backdrop_path}`}
                alt=""
                aria-hidden="true"
              />
            ) : (
              <div className="detail__backdrop detail__backdrop--empty" />
            )}
            <div className="detail__scrim" aria-hidden="true" />
          </div>

          <div className="detail__head">
            {movie.poster_path && (
              <img
                className="detail__poster"
                src={`${IMAGE_BASE_URL}/w342${movie.poster_path}`}
                alt={`Affiche de ${movie.title}`}
              />
            )}

            <div className="detail__headline">
              <h1 className="detail__title">{movie.title}</h1>
              {movie.tagline && (
                <p className="detail__tagline">{movie.tagline}</p>
              )}
              <p className="detail__meta">
                {[
                  releaseDate ?? 'Date inconnue',
                  runtime,
                  movie.vote_count > 0
                    ? `${numberFormatter.format(movie.vote_count)} vote${movie.vote_count !== 1 ? 's' : ''}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            <RatingRing
              value={movie.vote_average}
              voteCount={movie.vote_count}
              size={64}
              strokeWidth={4}
            />
          </div>

          {movie.genres.length > 0 && (
            <ul className="detail__genres">
              {movie.genres.map((genre) => (
                <li key={genre.id} className="genre-chip">
                  {genre.name}
                </li>
              ))}
            </ul>
          )}

          <section className="detail__section">
            <h2 className="detail__section-title">Résumé</h2>
            <p className="detail__overview">
              {movie.overview || "Aucun résumé n'est disponible pour ce film."}
            </p>
          </section>

          <section className="detail__section">
            <h2 className="detail__section-title">Fiche technique</h2>
            <dl className="detail__facts">
              <div className="detail__fact">
                <dt>Statut</dt>
                <dd>{STATUS_LABELS[movie.status] ?? movie.status}</dd>
              </div>

              <div className="detail__fact">
                <dt>Titre original</dt>
                <dd>{movie.original_title}</dd>
              </div>

              <div className="detail__fact">
                <dt>Langue originale</dt>
                <dd>{languageNames.of(movie.original_language)}</dd>
              </div>

              {movie.budget > 0 && (
                <div className="detail__fact">
                  <dt>Budget</dt>
                  <dd>{moneyFormatter.format(movie.budget)}</dd>
                </div>
              )}

              {movie.revenue > 0 && (
                <div className="detail__fact">
                  <dt>Recettes</dt>
                  <dd>{moneyFormatter.format(movie.revenue)}</dd>
                </div>
              )}

              {movie.production_companies.length > 0 && (
                <div className="detail__fact">
                  <dt>Production</dt>
                  <dd>
                    {movie.production_companies
                      .map((company) => company.name)
                      .join(', ')}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {movie.homepage && (
            <a
              className="button button--outline"
              href={movie.homepage}
              target="_blank"
              rel="noreferrer noopener"
            >
              Site officiel
            </a>
          )}
        </article>
      )}
    </main>
  );
}
