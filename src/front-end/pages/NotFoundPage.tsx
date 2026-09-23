import { useEffect } from 'react';
import { Link } from 'react-router';
import EmptyStateIllustration from '../components/EmptyStateIllustration';

/**
 * Shown for any URL the router doesn't recognise. Reuses the empty-results
 * illustration: conceptually it's the same situation, we looked and there's
 * nothing here.
 */
export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page introuvable · TMDB Discovery';

    return () => {
      document.title = 'TMDB Discovery';
    };
  }, []);

  return (
    <main className="app-shell">
      <div className="not-found">
        <EmptyStateIllustration />
        <p className="not-found__eyebrow">Erreur 404</p>
        <h1 className="not-found__title">Page introuvable</h1>
        <p className="not-found__hint">
          Cette page n'existe pas, ou a été déplacée. Retourne à l'accueil pour
          repartir à la découverte des films.
        </p>
        <Link className="button button--primary" to="/movies">
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
