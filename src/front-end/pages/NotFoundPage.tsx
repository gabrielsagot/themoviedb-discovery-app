import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="app-shell">
      <div className="not-found">
        <p className="not-found__code">404</p>
        <h1 className="not-found__title">Cette page n'existe pas</h1>
        <p className="not-found__text">
          Le lien est peut-être incorrect, ou la page a été déplacée.
        </p>
        <Link className="button button--primary" to="/movies">
          Voir les films populaires
        </Link>
      </div>
    </main>
  );
}
