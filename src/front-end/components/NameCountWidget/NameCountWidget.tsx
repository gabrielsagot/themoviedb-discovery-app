import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetName from '../WidgetName/WidgetName';
import WidgetValue from '../WidgetValue/WidgetValue';

export interface NameCountWidgetProps {
  /** The name of the widget, shown as its heading. */
  label: string;
  /**
   * The name of the item that comes first, as it must be written (e.g. the
   * name of a country or of a genre). `null`, `undefined` or a blank name when
   * none is known: the widget then says that there is no data.
   */
  name?: string | null;
  /**
   * The number of movies of that item, already counted: a movie that belongs
   * to several items is counted once for each of them upstream, and the figure
   * is shown as it is received. It must be a whole number of at least 1, since
   * an item that comes first appears in at least one movie; anything else shows
   * no data, never a misleading 0.
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
 * The widget shared by the dashboard widgets that show the item with the most
 * movies, such as "Pays le plus représenté" and "Genre dominant": a name, then
 * its number of movies. They only differ by their label and by what the name
 * is, and share the rules of the name and of the count, so that these rules
 * cannot differ between them. The widget shows the result it is given: it
 * counts nothing, and a long name wraps instead of being cut.
 */
export default function NameCountWidget({
  label,
  name,
  count,
  status = 'ready',
}: NameCountWidgetProps) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const hasCount =
    typeof count === 'number' && Number.isInteger(count) && count >= 1;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (trimmedName === '' || !hasCount) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetName>{trimmedName}</WidgetName>
      {/* In French, 1 is singular. */}
      <WidgetValue
        value={countFormat.format(count)}
        unit={count === 1 ? 'film' : 'films'}
      />
    </WidgetCard>
  );
}
