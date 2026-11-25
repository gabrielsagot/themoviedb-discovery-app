import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetName from '../WidgetName/WidgetName';
import WidgetValue from '../WidgetValue/WidgetValue';
import './BestRatedGenreWidget.css';

export interface BestRatedGenreWidgetProps {
  /**
   * The name of the genre with the best average rating, as it must be written
   * (e.g. "Animation"). `null`, `undefined` or a blank name when no genre is
   * known: the widget then says that there is no data.
   */
  genreName?: string | null;
  /**
   * The average rating of the movies of that genre, on a scale of 0 to 10. It
   * is the **simple** average: every rated movie of the genre counts once,
   * whatever its number of votes. It is not the weighted rating, which gives
   * more weight to the movies with more votes, and the widget says so.
   *
   * The widget does not compute it: it is computed upstream over the valid
   * ratings of the genre. `null` or `undefined` when the genre has no valid
   * rating: the widget then shows no data, and never a rating of 0. A real
   * average of 0 is a rating, and is shown as 0,00; a value outside 0 to 10 is
   * not a rating of that scale and shows no data.
   */
  average?: number | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// French writes the decimal comma, and the widget always shows two decimals:
// 7,41, and 8,00 rather than 8.
const ratingFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The "Meilleure note" widget of the dashboard: the genre with the best
 * average rating, with that average out of 10. The average is a simple one,
 * and the widget says so under the rating, so that it is not taken for a
 * weighted rating.
 */
export default function BestRatedGenreWidget({
  genreName,
  average,
  status = 'ready',
}: BestRatedGenreWidgetProps) {
  const label = 'Meilleure note';
  const name = typeof genreName === 'string' ? genreName.trim() : '';
  // NaN and the infinities fail the range comparison, so they are rejected too.
  const hasAverage =
    typeof average === 'number' && average >= 0 && average <= 10;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (name === '' || !hasAverage) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetName>{name}</WidgetName>
      <WidgetValue
        value={ratingFormat.format(average)}
        unit="/ 10"
        unitLabel="sur 10"
      />
      <p className="best-rated-genre-caption">
        Moyenne simple, non pondérée par les votes
      </p>
    </WidgetCard>
  );
}
