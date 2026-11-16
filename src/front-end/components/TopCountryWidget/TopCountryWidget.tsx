import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetValue from '../WidgetValue/WidgetValue';
import './TopCountryWidget.css';

export interface TopCountryWidgetProps {
  /**
   * The name of the country that appears in the most movies, as it must be
   * written (e.g. "United States of America"). `null`, `undefined` or a blank
   * name when no country is known: the widget then says that there is no
   * data.
   */
  countryName?: string | null;
  /**
   * The number of movies produced in that country. The widget does not count
   * anything: a movie made in several countries is counted once for each of
   * them upstream, and the figure is shown as it is received. It must be a
   * whole number of at least 1, since a country that is the most represented
   * appears in at least one movie; anything else shows no data, never a
   * misleading 0.
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
 * The "Pays le plus représenté" widget of the dashboard: the country that
 * appears in the most movies, with the number of movies. A long name wraps
 * on several lines instead of being cut off.
 */
export default function TopCountryWidget({
  countryName,
  count,
  status = 'ready',
}: TopCountryWidgetProps) {
  const label = 'Pays le plus représenté';
  const name = typeof countryName === 'string' ? countryName.trim() : '';
  const hasCount =
    typeof count === 'number' && Number.isInteger(count) && count >= 1;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (name === '' || !hasCount) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <p className="top-country-name">{name}</p>
      {/* In French, 1 is singular. */}
      <WidgetValue
        value={countFormat.format(count)}
        unit={count === 1 ? 'film' : 'films'}
      />
    </WidgetCard>
  );
}
