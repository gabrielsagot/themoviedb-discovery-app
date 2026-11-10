import './DashboardPage.css';

// The sections of the dashboard, as in the mock-up: each groups the widgets
// of one theme of the catalog. No widget exists yet, so each one shows an
// empty state; the widgets are added to the sections by later tickets.
const SECTIONS = [
  {
    id: 'films',
    title: 'Films',
    description: 'Les films qui se distinguent dans notre catalogue',
  },
  {
    id: 'genres',
    title: 'Genres',
    description: 'Les tendances de notre catalogue',
  },
];

export default function DashboardPage() {
  return (
    <main className="app-shell dashboard-page">
      <header className="dashboard-hero">
        <p className="dashboard-eyebrow">TMDB Discovery</p>
        <h1>Tableau de bord des films</h1>
        <p className="dashboard-intro">
          Explorez les données du catalogue : les films, leurs genres et leurs
          pays de production, à partir de la base de données locale.
        </p>
      </header>

      {SECTIONS.map(({ id, title, description }) => (
        <section
          key={id}
          className="dashboard-section"
          aria-labelledby={`dashboard-${id}-title`}
        >
          <div className="dashboard-section-heading">
            <h2 id={`dashboard-${id}-title`}>{title}</h2>
            <p>{description}</p>
          </div>
          <p className="dashboard-empty">
            Aucun widget n'est encore configuré pour cette section.
          </p>
        </section>
      ))}
    </main>
  );
}
