import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetValue from '../WidgetValue/WidgetValue';

export interface AverageRuntimeWidgetProps {
  /**
   * The average runtime of the movies, in minutes. It is computed upstream,
   * over the valid runtimes only: a movie whose runtime is unknown is left
   * out of the average, it does not count as 0 minutes. The value is shown
   * rounded to the minute.
   *
   * `null` or `undefined` when there is no valid runtime. A valid runtime is
   * at least one minute, so an average below 1, such as 0, cannot come from
   * valid runtimes: the widget shows no data instead of "0 min".
   */
  minutes?: number | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// French writes numbers with a space between groups of three digits, but
// leaves four-digit numbers alone.
const minutesFormat = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
  useGrouping: 'min2',
});

/**
 * The "Durée moyenne" widget of the dashboard: the average runtime of the
 * movies of the catalog, in minutes.
 */
export default function AverageRuntimeWidget({
  minutes,
  status = 'ready',
}: AverageRuntimeWidgetProps) {
  const label = 'Durée moyenne';
  const hasMinutes =
    typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 1;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!hasMinutes) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetValue
        value={minutesFormat.format(minutes)}
        unit="min"
        unitLabel={Math.round(minutes) < 2 ? 'minute' : 'minutes'}
      />
    </WidgetCard>
  );
}
