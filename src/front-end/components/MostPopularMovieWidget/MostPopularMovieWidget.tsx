import WidgetCard from '../WidgetCard/WidgetCard';
import type { WidgetDataStatus } from '../WidgetCard/WidgetCard';
import WidgetMovie from '../WidgetMovie/WidgetMovie';
import WidgetValue from '../WidgetValue/WidgetValue';

/** The most popular movie, as the widget shows it. */
export interface MostPopularMovie {
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
   * The popularity index of the movie, as TMDB computes it: a number of at
   * least 0 with no upper limit. It is neither a rating out of 10 nor a number
   * of votes, and the widget writes it as such. `null` or `undefined` when it
   * is unknown, which is not the same as a popularity of 0.
   */
  popularity?: number | null;
}

export interface MostPopularMovieWidgetProps {
  /**
   * The most popular movie of the catalog, already chosen: the widget does not
   * rank anything. `null` or `undefined` when there is none, and so is a movie
   * without a title or whose popularity is unknown or not a number of at least
   * 0: the widget then says that there is no data, instead of showing a
   * popularity of 0.
   */
  movie?: MostPopularMovie | null;
  /**
   * Whether the data is still being fetched (`loading`) or could not be
   * fetched (`error`). Defaults to `ready`.
   */
  status?: WidgetDataStatus;
}

// Two decimals and the French decimal comma. The groups of three digits are
// separated as in French, including for four digits: 1 036,49.
const popularityFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The "Film le plus populaire" widget of the dashboard: the most popular
 * movie of the catalog, with its poster, its title, its release year and its
 * popularity index. The index is labelled "popularité", so that it is not
 * taken for a rating out of 10 or for a number of votes.
 */
export default function MostPopularMovieWidget({
  movie,
  status = 'ready',
}: MostPopularMovieWidgetProps) {
  const label = 'Film le plus populaire';
  const title = typeof movie?.title === 'string' ? movie.title.trim() : '';
  const popularity = movie?.popularity;
  const hasPopularity =
    typeof popularity === 'number' &&
    Number.isFinite(popularity) &&
    popularity >= 0;

  if (status !== 'ready') {
    return <WidgetCard label={label} status={status} />;
  }
  if (!movie || title === '' || !hasPopularity) {
    return <WidgetCard label={label} status="empty" />;
  }

  return (
    <WidgetCard label={label}>
      <WidgetMovie title={title} year={movie.year} posterUrl={movie.posterUrl}>
        <WidgetValue
          value={popularityFormat.format(popularity)}
          unit="popularité"
        />
      </WidgetMovie>
    </WidgetCard>
  );
}
