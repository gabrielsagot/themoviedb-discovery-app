import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetValue from '../WidgetValue/WidgetValue';

export interface AverageRatingWidgetProps {
  /**
   * The average rating of the movies, on a scale of 0 to 10. It is the
   * **simple** average: every rated movie counts once, whatever its number of
   * votes. A weighted rating, which gives more weight to the movies with more
   * votes, is another figure and has its own widget.
   *
   * The widget does not compute it: it must be computed upstream over all the
   * rated movies of the catalog, never over a single page of movies, which
   * would give a different average. `null` or `undefined` when no movie is
   * rated: the widget then shows no data. A real average of 0 is a rating,
   * and is shown as 0,00; a value outside 0 to 10 is not a rating of that
   * scale and shows no data.
   */
  average?: number | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// French writes the decimal comma, and the widget always shows two decimals:
// 6,78, and 7,00 rather than 7.
const ratingFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The "Note moyenne" widget of the dashboard: the simple average rating of
 * the movies of the catalog, out of 10.
 */
export default function AverageRatingWidget({
  average,
  status = 'ready',
}: AverageRatingWidgetProps) {
  const label = 'Note moyenne';
  // NaN and the infinities fail the range comparison, so they are rejected too.
  const hasAverage =
    typeof average === 'number' && average >= 0 && average <= 10;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!hasAverage) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetValue
        value={ratingFormat.format(average)}
        unit="/ 10"
        unitLabel="sur 10"
      />
      <span className="visually-hidden">
        Moyenne simple des notes, sans pondération par le nombre de votes
      </span>
    </WidgetCard>
  );
}
