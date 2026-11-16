import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetMovie from '../WidgetMovie/WidgetMovie';
import WidgetValue from '../WidgetValue/WidgetValue';

/** The best rated movie, as the widget shows it. */
export interface TopRatedMovie {
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
  /** The average rating of the movie, on a scale of 0 to 10. */
  rating: number;
}

export interface TopRatedMovieWidgetProps {
  /**
   * The best rated movie of the catalog, already chosen: the widget does not
   * rank anything. `null` or `undefined` when no movie is rated, and so is a
   * movie without a title or whose rating is not on the scale of 0 to 10: the
   * widget then says that there is no data.
   */
  movie?: TopRatedMovie | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// French writes the decimal comma, and the rating has one decimal: 9,1.
const ratingFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * The "Film le mieux noté" widget of the dashboard: the best rated movie of
 * the catalog, with its poster, its title, its release year and its rating
 * out of 10. A movie without a poster, or whose poster cannot be loaded,
 * shows a placeholder that says so.
 */
export default function TopRatedMovieWidget({
  movie,
  status = 'ready',
}: TopRatedMovieWidgetProps) {
  const label = 'Film le mieux noté';
  const title = typeof movie?.title === 'string' ? movie.title.trim() : '';
  const hasRating =
    typeof movie?.rating === 'number' &&
    movie.rating >= 0 &&
    movie.rating <= 10;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!movie || title === '' || !hasRating) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetMovie title={title} year={movie.year} posterUrl={movie.posterUrl}>
        <WidgetValue
          value={ratingFormat.format(movie.rating)}
          unit="/ 10"
          unitLabel="sur 10"
        />
      </WidgetMovie>
    </WidgetCard>
  );
}
