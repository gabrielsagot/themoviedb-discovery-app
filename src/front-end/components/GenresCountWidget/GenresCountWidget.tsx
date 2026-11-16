import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetValue from '../WidgetValue/WidgetValue';
import './GenresCountWidget.css';

export interface GenresCountWidgetProps {
  /**
   * The number of distinct genres represented in the catalog, already counted:
   * a movie with several genres adds each of them once, and the widget does not
   * count the links between movies and genres itself. It must be a whole number
   * of at least 0. A real 0, a catalog without any genre, is shown as 0.
   * `null`, `undefined` or any other value, when it is unknown: the widget then
   * says that there is no data, which is not the same as 0.
   */
  count?: number | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// French writes numbers with a space between groups of three digits, but
// leaves four-digit numbers alone: 1000, then 10 000.
const countFormat = new Intl.NumberFormat('fr-FR', { useGrouping: 'min2' });

/**
 * The "Genres représentés" widget of the dashboard: how many distinct genres
 * the movies of the catalog have, as a measure of its diversity.
 */
export default function GenresCountWidget({
  count,
  status = 'ready',
}: GenresCountWidgetProps) {
  const label = 'Genres représentés';
  const hasCount =
    typeof count === 'number' && Number.isInteger(count) && count >= 0;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!hasCount) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      {/* In French, 0 and 1 are singular. */}
      <WidgetValue
        value={countFormat.format(count)}
        unit={count < 2 ? 'genre' : 'genres'}
      />
      <p className="genres-count-caption">Diversité du catalogue</p>
    </WidgetCard>
  );
}
