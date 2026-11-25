import NameCountWidget from '../NameCountWidget/NameCountWidget';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';

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

/**
 * The "Pays le plus représenté" widget of the dashboard: the country that
 * appears in the most movies, with the number of movies. A long name wraps
 * on several lines instead of being cut.
 */
export default function TopCountryWidget({
  countryName,
  count,
  status,
}: TopCountryWidgetProps) {
  return (
    <NameCountWidget
      label="Pays le plus représenté"
      name={countryName}
      count={count}
      status={status}
    />
  );
}
