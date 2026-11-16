import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetMovie from '../WidgetMovie/WidgetMovie';
import WidgetValue from '../WidgetValue/WidgetValue';

/** The most profitable movie, as the widget shows it. */
export interface MostProfitableMovie {
  /** The title of the movie. */
  title: string;
  /**
   * The release year of the movie, with four digits. `null` or `undefined`
   * when it is unknown: the widget then says so instead of writing a year.
   */
  year?: number | null;
  /**
   * The address of the poster. `null`, `undefined` or blank when the movie has
   * no poster; an address whose image cannot be loaded is handled the same
   * way. Either way, a placeholder says that the poster is not available.
   */
  posterUrl?: string | null;
  /**
   * The return on investment of the movie, as a percentage: 100 means that the
   * movie earned back twice its budget. It is computed upstream, with a
   * formula and eligibility rules that are still to be validated (see the
   * README): the widget does not compute it and does not know how it was
   * computed. A negative value is a loss. `null` or `undefined` when it is
   * unknown, which is not the same as a return of 0 %.
   */
  roi?: number | null;
}

export interface MostProfitableMovieWidgetProps {
  /**
   * The movie with the best return on investment, already chosen among the
   * eligible movies: the widget neither ranks the movies nor decides which of
   * them are eligible. `null` or `undefined` when no movie is eligible, and so
   * is a movie without a title or whose return is unknown or not a number:
   * the widget then says that there is no data, instead of showing a return
   * of 0 %.
   */
  movie?: MostProfitableMovie | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// Two decimals and the French decimal comma, with a separator for the
// thousands: 69 667,36.
const roiFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The "Film le plus rentable" widget of the dashboard: the movie with the
 * best return on investment, with its poster, its title, its release year and
 * its return as a percentage with two decimals. The widget shows the result
 * it is given: how the return is computed, and which movies are eligible, is
 * decided upstream.
 */
export default function MostProfitableMovieWidget({
  movie,
  status = 'ready',
}: MostProfitableMovieWidgetProps) {
  const label = 'Film le plus rentable';
  const title = typeof movie?.title === 'string' ? movie.title.trim() : '';
  const roi = movie?.roi;
  const hasRoi = typeof roi === 'number' && Number.isFinite(roi);

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!movie || title === '' || !hasRoi) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetMovie title={title} year={movie.year} posterUrl={movie.posterUrl}>
        <WidgetValue
          value={roiFormat.format(roi)}
          unit="% ROI"
          unitLabel="pour cent de retour sur investissement"
        />
      </WidgetMovie>
    </WidgetCard>
  );
}
