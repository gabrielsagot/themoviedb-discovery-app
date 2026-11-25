import NameCountWidget from '../NameCountWidget/NameCountWidget';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';

export interface DominantGenreWidgetProps {
  /**
   * The name of the genre that appears in the most movies, as it must be
   * written (e.g. "Drame"). `null`, `undefined` or a blank name when no genre
   * is known: the widget then says that there is no data.
   */
  genreName?: string | null;
  /**
   * The number of movies of that genre. The widget does not count anything: a
   * movie with several genres is counted once for each of them upstream, and
   * the figure is shown as it is received, without counting the movies again.
   * It must be a whole number of at least 1, since the dominant genre appears
   * in at least one movie; anything else shows no data, never a misleading 0.
   */
  count?: number | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

/**
 * The "Genre dominant" widget of the dashboard: the genre that appears in the
 * most movies, with the number of movies. It shows the result it is given,
 * and a long name wraps on several lines instead of being cut.
 */
export default function DominantGenreWidget({
  genreName,
  count,
  status,
}: DominantGenreWidgetProps) {
  return (
    <NameCountWidget
      label="Genre dominant"
      name={genreName}
      count={count}
      status={status}
    />
  );
}
