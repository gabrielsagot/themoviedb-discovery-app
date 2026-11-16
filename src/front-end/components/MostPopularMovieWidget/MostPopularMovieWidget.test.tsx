// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MostPopularMovieWidget from './MostPopularMovieWidget';
import * as stories from './MostPopularMovieWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  MissingPoster,
  LongTitle,
  UnknownYear,
  SmallPopularity,
  UnknownPopularity,
  NoMovie,
  Loading,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Film le plus populaireAucune donnée disponible';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Film le plus populaire' });
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

describe('MostPopularMovieWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Film le plus populaire".
    expect(storyNames).toEqual([
      'Nominal',
      'MissingPoster',
      'LongTitle',
      'UnknownYear',
      'SmallPopularity',
      'UnknownPopularity',
      'NoMovie',
      'Loading',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      MissingPoster,
      LongTitle,
      UnknownYear,
      SmallPopularity,
      UnknownPopularity,
      NoMovie,
      Loading,
      ErrorState,
      Mobile,
      DarkTheme,
    ]) {
      const { unmount } = render(<Story />);
      expect(card()).toBeTruthy();
      unmount();
    }
  });

  it('shows the nominal state of the mock-up: 1 036,49 popularité', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the poster, the title, the year, the figure and its label.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Film le plus populaire' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: 'Affiche du film La Marche des lanternes',
      }),
    ).toBeTruthy();
    expect(visibleText()).toBe(
      'Film le plus populaireLa Marche des lanternes20241 036,49 popularité',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('labels the figure as a popularity, not as a rating or a number of votes', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the unit is the word "popularité", with no scale and no "votes".
    expect(screen.getByText('popularité').className).toBe('widget-value-unit');
    expect(card().textContent).not.toContain('/ 10');
    expect(card().textContent).not.toContain('vote');
  });

  it('replaces a missing poster with an explicit text', () => {
    // Arrange and act
    render(<MissingPoster />);

    // Assert: no broken image, and the rest of the movie is still there.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
    expect(card().textContent).toContain('1 036,49');
  });

  it('shows a long title in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongTitle />);

    // Assert
    expect(
      screen.getByText(
        "La Marche des lanternes ou le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse",
      ).className,
    ).toBe('widget-movie-title');
  });

  it('says that the year is unknown instead of writing one', () => {
    // Arrange and act
    render(<UnknownYear />);

    // Assert
    expect(screen.getByText('Année inconnue')).toBeTruthy();
    expect(card().textContent).not.toContain('null');
  });

  it('writes a small popularity with two decimals', () => {
    // Arrange and act
    render(<SmallPopularity />);

    // Assert
    expect(visibleText()).toContain('7,50 popularité');
  });

  it('shows no data for an unknown popularity instead of a popularity of 0', () => {
    // Arrange and act
    render(<UnknownPopularity />);

    // Assert: the movie is not shown with an invented 0,00.
    expect(visibleText()).toBe(emptyMessage);
    expect(card().textContent).not.toContain('0,00');
  });

  it('shows no data when there is no movie', () => {
    // Arrange and act
    render(<NoMovie />);

    // Assert
    expect(visibleText()).toBe(emptyMessage);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no movie is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('Marche');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('Marche');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(
      'Film le plus populaireLa Marche des lanternes20241 036,49 popularité',
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
    expect(stories.default.title).toBe('Widgets/Film le plus populaire');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('MostPopularMovieWidget', () => {
  const movie = {
    title: 'Le Phare',
    year: 2019,
    posterUrl: 'poster.jpg',
    popularity: 12.3,
  };

  it.each([
    [1036.49, '1 036,49'],
    [12.3, '12,30'],
    [7, '7,00'],
    [0, '0,00'],
    [999.999, '1 000,00'],
    [10.005, '10,01'],
    [1234567.891, '1 234 567,89'],
  ])('writes a popularity of %f as %s', (popularity, expected) => {
    // Arrange and act
    render(<MostPopularMovieWidget movie={{ ...movie, popularity }} />);

    // Assert: French grouping and decimal comma, two decimals, then the label.
    expect(visibleText()).toContain(`${expected} popularité`);
  });

  it('trims the title', () => {
    // Arrange and act
    render(
      <MostPopularMovieWidget movie={{ ...movie, title: '  Le Phare  ' }} />,
    );

    // Assert
    expect(screen.getByText('Le Phare').textContent).toBe('Le Phare');
  });

  it.each([
    ['a null movie', null],
    ['an undefined movie', undefined],
    ['an empty title', { ...movie, title: '' }],
    ['a blank title', { ...movie, title: '   ' }],
    ['a null popularity', { ...movie, popularity: null }],
    ['an undefined popularity', { ...movie, popularity: undefined }],
    ['a negative popularity', { ...movie, popularity: -0.01 }],
    ['a popularity that is not a number', { ...movie, popularity: Number.NaN }],
    [
      'an infinite popularity',
      { ...movie, popularity: Number.POSITIVE_INFINITY },
    ],
  ])('treats %s as missing data', (_label, value) => {
    // Arrange and act
    render(<MostPopularMovieWidget movie={value} />);

    // Assert: no half-filled movie, and no popularity of 0 made up.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the movie', () => {
    // Arrange and act
    const { unmount } = render(
      <MostPopularMovieWidget movie={movie} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Phare');
    unmount();
    render(<MostPopularMovieWidget movie={movie} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Phare');
  });
});
