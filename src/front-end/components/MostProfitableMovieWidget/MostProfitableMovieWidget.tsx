import MovieRoiWidget from '../MovieRoiWidget/MovieRoiWidget';
import type {
  MovieRoiWidgetProps,
  RoiMovie,
} from '../MovieRoiWidget/MovieRoiWidget';

/** The most profitable movie, as the widget shows it. */
export type MostProfitableMovie = RoiMovie;

/**
 * The properties of the widget: the most profitable movie, already chosen
 * among the eligible movies (`null` or `undefined` when none is eligible), and
 * whether its data is still being fetched (`loading`) or could not be fetched
 * (`error`). See `RoiMovie` for the movie and its return.
 */
export type MostProfitableMovieWidgetProps = Omit<MovieRoiWidgetProps, 'label'>;

/**
 * The "Film le plus rentable" widget of the dashboard: the movie with the
 * best return on investment, with its poster, its title, its release year and
 * its return as a percentage with two decimals. The widget shows the result
 * it is given: how the return is computed, and which movies are eligible, is
 * decided upstream.
 */
export default function MostProfitableMovieWidget(
  props: MostProfitableMovieWidgetProps,
) {
  return <MovieRoiWidget label="Film le plus rentable" {...props} />;
}
