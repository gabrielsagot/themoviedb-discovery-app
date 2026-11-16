import { useState } from 'react';
import type { ReactNode } from 'react';
import './WidgetMovie.css';

export interface WidgetMovieProps {
  /** The title of the movie, already checked by the widget: it is not empty. */
  title: string;
  /**
   * The release year of the movie, with four digits. `null` or `undefined`
   * when it is unknown, and so is a number that is not a four-digit year: the
   * widget then says "Année inconnue" instead of writing a year.
   */
  year?: number | null;
  /**
   * The address of the poster. `null`, `undefined` or blank when the movie has
   * no poster; an address whose image cannot be loaded is handled the same
   * way. Either way, a placeholder says that the poster is not available.
   */
  posterUrl?: string | null;
  /** What goes under the year: the figure the widget is about. */
  children?: ReactNode;
}

/**
 * Tells whether a release year can be written: a year with four digits, as
 * the data model only derives a year from a complete date.
 * @param year The release year, if any.
 * @returns Whether the year is a valid four-digit year.
 */
function isValidYear(year: number | null | undefined): year is number {
  return (
    typeof year === 'number' &&
    Number.isInteger(year) &&
    year >= 1000 &&
    year <= 9999
  );
}

/**
 * A movie as the widgets of the dashboard show it: its poster on the left,
 * then its title, its release year and the figure of the widget. A movie
 * without a poster, or whose poster cannot be loaded, shows a placeholder
 * that says so; a long title wraps instead of being cut.
 */
export default function WidgetMovie({
  title,
  year,
  posterUrl,
  children,
}: WidgetMovieProps) {
  // The address of the poster that failed to load: a new address is tried
  // again, since it is not the one that failed.
  const [failedPosterUrl, setFailedPosterUrl] = useState<string | null>(null);

  const poster = posterUrl?.trim() ?? '';
  const showPoster = poster !== '' && poster !== failedPosterUrl;

  return (
    <div className="widget-movie">
      {showPoster ? (
        <img
          className="widget-movie-poster"
          src={poster}
          alt={`Affiche du film ${title}`}
          onError={() => setFailedPosterUrl(poster)}
        />
      ) : (
        <div className="widget-movie-poster widget-movie-poster-missing">
          Affiche indisponible
        </div>
      )}
      <div className="widget-movie-info">
        <p className="widget-movie-title">{title}</p>
        <p className="widget-movie-year">
          {isValidYear(year) ? year : 'Année inconnue'}
        </p>
        {children}
      </div>
    </div>
  );
}
