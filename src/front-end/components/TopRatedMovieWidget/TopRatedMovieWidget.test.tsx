// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TopRatedMovieWidget from './TopRatedMovieWidget';
import * as stories from './TopRatedMovieWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  MissingPoster,
  BrokenPoster,
  LongTitle,
  UnknownYear,
  WholeRating,
  Loading,
  NoRatedMovie,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Film le mieux notéAucune donnée disponible';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Film le mieux noté' });
}

/**
 * Reads what is written on screen in the widget, without the text that is
 * only meant for assistive technologies.
 * @returns The visible text of the card.
 */
function visibleText(): string {
  const clone = card().cloneNode(true) as HTMLElement;
  for (const hidden of clone.querySelectorAll('.visually-hidden')) {
    hidden.remove();
  }
  return clone.textContent;
}

describe('TopRatedMovieWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Film le mieux noté".
    expect(storyNames).toEqual([
      'Nominal',
      'MissingPoster',
      'BrokenPoster',
      'LongTitle',
      'UnknownYear',
      'WholeRating',
      'Loading',
      'NoRatedMovie',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      MissingPoster,
      BrokenPoster,
      LongTitle,
      UnknownYear,
      WholeRating,
      Loading,
      NoRatedMovie,
      ErrorState,
      Mobile,
      DarkTheme,
    ]) {
      const { unmount } = render(<Story />);
      expect(card()).toBeTruthy();
      unmount();
    }
  });

  it('shows the nominal state: poster, title, year and 9,1 / 10', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the poster with its text alternative, and the movie.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Film le mieux noté' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: 'Affiche du film Le Phare des horizons',
      }),
    ).toBeTruthy();
    expect(visibleText()).toBe(
      'Film le mieux notéLe Phare des horizons20199,1 / 10',
    );
    expect(screen.queryByText('Affiche indisponible')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads the scale as "sur 10" for assistive technologies', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the symbol "/ 10" is not read, "sur 10" is.
    expect(
      card().querySelector('.widget-value-unit')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(screen.getByText('sur 10').className).toBe('visually-hidden');
  });

  it('replaces a missing poster with an explicit text', () => {
    // Arrange and act
    render(<MissingPoster />);

    // Assert: no broken image, and the rest of the movie is still there.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
    expect(visibleText()).toBe(
      'Film le mieux notéAffiche indisponibleLe Phare des horizons20199,1 / 10',
    );
  });

  it('replaces a poster that cannot be loaded with the same text', () => {
    // Arrange: the poster is shown while it is not known to be broken.
    render(<BrokenPoster />);
    const poster = screen.getByRole('img', {
      name: 'Affiche du film Le Phare des horizons',
    });

    // Act: the browser reports that the image cannot be loaded.
    fireEvent.error(poster);

    // Assert
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
  });

  it('shows a long title in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongTitle />);

    // Assert
    expect(
      screen.getByText(
        "Le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse à travers les cinq continents",
      ).className,
    ).toBe('widget-movie-title');
  });

  it('says that the year is unknown instead of writing one', () => {
    // Arrange and act
    render(<UnknownYear />);

    // Assert
    expect(screen.getByText('Année inconnue').className).toBe(
      'widget-movie-year',
    );
    expect(card().textContent).not.toContain('null');
    expect(card().textContent).not.toContain('0000');
  });

  it('keeps one decimal for a whole rating', () => {
    // Arrange and act
    render(<WholeRating />);

    // Assert
    expect(visibleText()).toContain('9,0 / 10');
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no movie is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('Phare');
  });

  it('says that no movie is rated instead of showing a movie or a 0', () => {
    // Arrange and act
    render(<NoRatedMovie />);

    // Assert
    expect(visibleText()).toBe(emptyMessage);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('Phare');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(
      'Film le mieux notéLe Phare des horizons20199,1 / 10',
    );
    expect(visibleText()).toBe(mobileText);
  });

  it('documents its two properties and only takes a movie it does not rank', () => {
    // Assert: a movie and a status, and nothing to rank from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'movie',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Film le mieux noté');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('TopRatedMovieWidget', () => {
  const movie = {
    title: 'Le Phare',
    year: 2019,
    posterUrl: 'poster.jpg',
    rating: 9.1,
  };

  it.each([
    [9.1, '9,1'],
    [9, '9,0'],
    [10, '10,0'],
    [0, '0,0'],
    [8.96, '9,0'],
    [8.94, '8,9'],
  ])('shows a rating of %f as %s / 10', (rating, expected) => {
    // Arrange and act
    render(<TopRatedMovieWidget movie={{ ...movie, rating }} />);

    // Assert: decimal comma, one decimal, on a scale of 10.
    expect(visibleText()).toContain(`${expected} / 10`);
  });

  it('writes the year with four digits and no grouping', () => {
    // Arrange and act
    render(<TopRatedMovieWidget movie={{ ...movie, year: 1999 }} />);

    // Assert
    expect(screen.getByText('1999')).toBeTruthy();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['0', 0],
    ['a year with decimals', 2019.5],
    ['a year with three digits', 999],
    ['a year with five digits', 10000],
    ['a year that is not a number', Number.NaN],
  ])('says that the year is unknown for %s', (_label, year) => {
    // Arrange and act
    render(<TopRatedMovieWidget movie={{ ...movie, year }} />);

    // Assert
    expect(screen.getByText('Année inconnue')).toBeTruthy();
  });

  it('trims the title and the poster address', () => {
    // Arrange and act
    render(
      <TopRatedMovieWidget
        movie={{ ...movie, title: '  Le Phare  ', posterUrl: '  poster.jpg  ' }}
      />,
    );

    // Assert
    expect(screen.getByText('Le Phare').textContent).toBe('Le Phare');
    expect(screen.getByRole('img').getAttribute('src')).toBe('poster.jpg');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty address', ''],
    ['a blank address', '   '],
  ])('uses the placeholder for a poster that is %s', (_label, posterUrl) => {
    // Arrange and act
    render(<TopRatedMovieWidget movie={{ ...movie, posterUrl }} />);

    // Assert
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
  });

  it('tries a new poster after the previous one failed', () => {
    // Arrange: the first poster cannot be loaded.
    const { rerender } = render(
      <TopRatedMovieWidget movie={{ ...movie, posterUrl: 'broken.jpg' }} />,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();

    // Act: the widget receives another movie, with another poster.
    rerender(
      <TopRatedMovieWidget movie={{ ...movie, posterUrl: 'other.jpg' }} />,
    );

    // Assert: the new poster is shown, it is not the one that failed.
    expect(screen.getByRole('img').getAttribute('src')).toBe('other.jpg');
  });

  it.each([
    ['a null movie', null],
    ['an undefined movie', undefined],
    ['an empty title', { ...movie, title: '' }],
    ['a blank title', { ...movie, title: '   ' }],
    ['a negative rating', { ...movie, rating: -0.1 }],
    ['a rating above 10', { ...movie, rating: 10.1 }],
    ['a rating that is not a number', { ...movie, rating: Number.NaN }],
    ['an infinite rating', { ...movie, rating: Number.POSITIVE_INFINITY }],
  ])('treats %s as missing data', (_label, value) => {
    // Arrange and act
    render(<TopRatedMovieWidget movie={value} />);

    // Assert: no half-filled movie is shown.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the movie', () => {
    // Arrange and act
    const { unmount } = render(
      <TopRatedMovieWidget movie={movie} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Phare');
    unmount();
    render(<TopRatedMovieWidget movie={movie} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Phare');
  });
});
