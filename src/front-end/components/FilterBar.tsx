import type { Genre } from '../../back-end/schemas/MoviesTypes';

type FilterBarProps = {
  genres: Genre[] | null;
  selectedGenreIds: number[];
  sortBy: string;
  year: number | null;
  onToggleGenre: (id: number) => void;
  onSortChange: (sortBy: string) => void;
  onYearChange: (year: number | null) => void;
};

// TMDB's discover/movie endpoint sorts strictly on the movie's own fields —
// there's no crew/cast index to sort by, so "director" isn't an option it
// can serve. Each field is combined with the direction toggle below (e.g.
// 'vote_average' + 'desc' -> 'vote_average.desc') to build the sort_by
// value the back-end expects.
const SORT_FIELDS = [
  { value: 'popularity', label: 'Popularité', defaultDirection: 'desc' },
  { value: 'vote_average', label: 'Note', defaultDirection: 'desc' },
  { value: 'vote_count', label: 'Nombre de votes', defaultDirection: 'desc' },
  {
    value: 'primary_release_date',
    label: 'Date de sortie',
    defaultDirection: 'desc',
  },
  { value: 'title', label: 'Titre', defaultDirection: 'asc' },
];

const EARLIEST_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();

// Most recent year first, so the default "Toutes les années" sits right
// above the years people are actually likely to pick.
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - EARLIEST_YEAR + 1 },
  (_, index) => CURRENT_YEAR - index,
);

// A small chevron drawn as its own element (rather than a CSS background
// image) so it can pick up var(--text-secondary) via currentColor and stay
// correct in both themes, matching how the search field's icon is done.
const SelectChevron = () => (
  <svg className="filter-bar__chevron" viewBox="0 0 12 8" aria-hidden="true">
    <path
      d="M1 1.5 6 6.5 11 1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DirectionArrow = ({ direction }: { direction: 'asc' | 'desc' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d={
        direction === 'desc'
          ? 'M8 3v9M4 8.5 8 12.5 12 8.5'
          : 'M8 13V4M4 8.5 8 4.5 12 8.5'
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Filter controls for the movie grid: genre pills (multi-select, OR logic),
 * a sort field + direction, and a release year. Hidden by the caller while
 * a text search is active, since TMDB's search endpoint doesn't support
 * these filters.
 */
export default function FilterBar({
  genres,
  selectedGenreIds,
  sortBy,
  year,
  onToggleGenre,
  onSortChange,
  onYearChange,
}: FilterBarProps) {
  if (!genres || genres.length === 0) return null;

  // Split into two balanced rows (rather than let the list wrap on its
  // own), so the genre pills always read as two full lines — each one
  // stretched edge to edge by the row's CSS — instead of one packed row
  // followed by a short, ragged one.
  const half = Math.ceil(genres.length / 2);
  const genreRows = [genres.slice(0, half), genres.slice(half)];

  // sortBy is always "<field>.<direction>" (e.g. "vote_average.desc"), the
  // exact shape TMDB expects, so it doubles as the wire format — no
  // separate parsing step needed on the back-end.
  const [activeField, activeDirection] = sortBy.split('.');

  const handleFieldClick = (field: string, defaultDirection: string) => {
    if (field === activeField) return;
    onSortChange(`${field}.${defaultDirection}`);
  };

  const handleDirectionClick = (direction: string) => {
    if (direction === activeDirection) return;
    onSortChange(`${activeField}.${direction}`);
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__genres">
        {genreRows.map((row, rowIndex) => (
          <ul className="filter-bar__pill-row" key={rowIndex}>
            {row.map((genre) => {
              const isActive = selectedGenreIds.includes(genre.id);
              return (
                <li key={genre.id}>
                  <button
                    type="button"
                    className={`genre-pill${isActive ? ' genre-pill--active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => onToggleGenre(genre.id)}
                  >
                    {genre.name}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
      </div>

      <div className="filter-bar__controls">
        <div className="filter-bar__sort">
          <span className="filter-bar__label">Trier par</span>
          <ul className="filter-bar__pill-row">
            {SORT_FIELDS.map((field) => (
              <li key={field.value}>
                <button
                  type="button"
                  className={`genre-pill${activeField === field.value ? ' genre-pill--active' : ''}`}
                  aria-pressed={activeField === field.value}
                  onClick={() =>
                    handleFieldClick(field.value, field.defaultDirection)
                  }
                >
                  {field.label}
                </button>
              </li>
            ))}
          </ul>

          <div
            className="filter-bar__direction"
            role="group"
            aria-label="Ordre de tri"
          >
            <button
              type="button"
              className={`filter-bar__direction-btn${activeDirection === 'desc' ? ' filter-bar__direction-btn--active' : ''}`}
              aria-pressed={activeDirection === 'desc'}
              title="Ordre décroissant"
              aria-label="Ordre décroissant"
              onClick={() => handleDirectionClick('desc')}
            >
              <DirectionArrow direction="desc" />
            </button>
            <button
              type="button"
              className={`filter-bar__direction-btn${activeDirection === 'asc' ? ' filter-bar__direction-btn--active' : ''}`}
              aria-pressed={activeDirection === 'asc'}
              title="Ordre croissant"
              aria-label="Ordre croissant"
              onClick={() => handleDirectionClick('asc')}
            >
              <DirectionArrow direction="asc" />
            </button>
          </div>
        </div>

        <label className="filter-bar__field">
          <span className="filter-bar__label">Année</span>
          <span className="filter-bar__select-wrap">
            <select
              className="filter-bar__select"
              value={year ?? ''}
              onChange={(event) =>
                onYearChange(
                  event.target.value === '' ? null : Number(event.target.value),
                )
              }
            >
              <option value="">Toutes les années</option>
              {YEAR_OPTIONS.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
            <SelectChevron />
          </span>
        </label>
      </div>
    </div>
  );
}
