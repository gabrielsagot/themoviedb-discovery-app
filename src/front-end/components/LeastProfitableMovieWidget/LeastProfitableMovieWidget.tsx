import MovieRoiWidget from '../MovieRoiWidget/MovieRoiWidget';
import type {
  MovieRoiWidgetProps,
  RoiMovie,
} from '../MovieRoiWidget/MovieRoiWidget';

/** The least profitable movie, as the widget shows it. */
export type LeastProfitableMovie = RoiMovie;

/**
 * The properties of the widget: the least profitable movie, already chosen
 * among the eligible movies (`null` or `undefined` when none is eligible), and
 * whether its data is still being fetched (`loading`) or could not be fetched
 * (`error`). See `RoiMovie` for the movie and its return. The formula of the
 * return and the eligibility rules are the ones of the most profitable movie
 * widget, and are still to be validated (see the README).
 */
export type LeastProfitableMovieWidgetProps = Omit<
  MovieRoiWidgetProps,
  'label'
>;

/**
 * The "Film le moins rentable" widget of the dashboard: the movie with the
 * lowest return on investment, with its poster, its title, its release year
 * and its return as a percentage with two decimals, with its sign: a loss is
 * negative. It follows exactly the same rules as the most profitable movie
 * widget, because both are the same widget with a different label.
 */
export default function LeastProfitableMovieWidget(
  props: LeastProfitableMovieWidgetProps,
) {
  return <MovieRoiWidget label="Film le moins rentable" {...props} />;
}
