import WidgetCard from '../WidgetCard/WidgetCard';
import './MoviesCountWidget.css';

/** The first and the last release year of the movies of the database. */
export interface MoviesPeriod {
  from: number;
  to: number;
}

export interface MoviesCountWidgetProps {
  /**
   * The number of movies in the database. `null` or `undefined` when it is
   * unknown: the widget then says that there is no data, instead of showing
   * a misleading 0. A real 0, an empty database, is shown as 0.
   */
  count?: number | null;
  /** The release years the movies cover; the period is hidden when omitted. */
  period?: MoviesPeriod;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: 'ready' | 'loading' | 'error';
}

// French writes numbers with a space between groups of three digits, but
// leaves four-digit numbers alone: 1000, then 10 000.
const countFormat = new Intl.NumberFormat('fr-FR', { useGrouping: 'min2' });

/**
 * Formats the period of the movies: a range of years, or a single year.
 * @param period The first and last release year.
 * @returns The period as written in the widget, e.g. "2023–2027".
 */
function formatPeriod({ from, to }: MoviesPeriod): string {
  const first = Math.min(from, to);
  const last = Math.max(from, to);
  return first === last ? String(first) : `${first}–${last}`;
}

/**
 * The "Films en base" widget of the dashboard: how many movies the database
 * holds, with the period of their release years.
 */
export default function MoviesCountWidget({
  count,
  period,
  status = 'ready',
}: MoviesCountWidgetProps) {
  const label = 'Films en base';
  const hasCount =
    typeof count === 'number' && Number.isFinite(count) && count >= 0;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!hasCount) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <p className="movies-count-value">
        <span className="movies-count-number">{countFormat.format(count)}</span>{' '}
        {/* In French, 0 and 1 are singular. */}
        <span className="movies-count-unit">
          {count < 2 ? 'film' : 'films'}
        </span>
      </p>
      {period && (
        <p className="movies-count-period">
          <span className="movies-count-sr-only">Période : </span>
          {formatPeriod(period)}
        </p>
      )}
    </WidgetCard>
  );
}
