// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MostProfitableMovieWidget from './MostProfitableMovieWidget';
import * as stories from './MostProfitableMovieWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  MissingPoster,
  LongTitle,
  UnknownYear,
  SmallRoi,
  UnknownRoi,
  NoEligibleMovie,
  Loading,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Film le plus rentableAucune donnée disponible';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Film le plus rentable' });
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

describe('MostProfitableMovieWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Film le plus rentable".
    expect(storyNames).toEqual([
      'Nominal',
      'MissingPoster',
      'LongTitle',
      'UnknownYear',
      'SmallRoi',
      'UnknownRoi',
      'NoEligibleMovie',
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
      SmallRoi,
      UnknownRoi,
      NoEligibleMovie,
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

  it('shows the nominal state of the mock-up: 69 667,36 % ROI', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the poster, the title, the year and the percentage.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Film le plus rentable' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: 'Affiche du film Le Trésor du vieux moulin',
      }),
    ).toBeTruthy();
    expect(visibleText()).toBe(
      'Film le plus rentableLe Trésor du vieux moulin201669 667,36 % ROI',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads the unit as "pour cent de retour sur investissement" for assistive technologies', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the abbreviation "% ROI" is not read, its meaning is.
    expect(
      card().querySelector('.widget-value-unit')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      screen.getByText('pour cent de retour sur investissement').className,
    ).toBe('visually-hidden');
  });

  it('replaces a missing poster with an explicit text', () => {
    // Arrange and act
    render(<MissingPoster />);

    // Assert: no broken image, and the rest of the movie is still there.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
    expect(card().textContent).toContain('69 667,36');
  });

  it('shows a long title in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongTitle />);

    // Assert
    expect(
      screen.getByText(
        "Le Trésor du vieux moulin ou le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse",
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

  it('writes a small return with two decimals', () => {
    // Arrange and act
    render(<SmallRoi />);

    // Assert
    expect(visibleText()).toContain('12,50 % ROI');
  });

  it('shows no data for an unknown return instead of 0 %', () => {
    // Arrange and act
    render(<UnknownRoi />);

    // Assert: the movie is not shown with an invented 0,00 %.
    expect(visibleText()).toBe(emptyMessage);
    expect(card().textContent).not.toContain('0,00');
  });

  it('shows no data when no movie is eligible', () => {
    // Arrange and act
    render(<NoEligibleMovie />);

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
    expect(card().textContent).not.toContain('moulin');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('moulin');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(
      'Film le plus rentableLe Trésor du vieux moulin201669 667,36 % ROI',
    );
    expect(visibleText()).toBe(mobileText);
  });

  it('documents its two properties and only takes a result it does not compute', () => {
    // Assert: a movie with its return and a status, and nothing to compute from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'movie',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Film le plus rentable');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('MostProfitableMovieWidget', () => {
  const movie = {
    title: 'Le Moulin',
    year: 2016,
    posterUrl: 'poster.jpg',
    roi: 150,
  };

  it.each([
    [69667.36, '69 667,36'],
    [12.5, '12,50'],
    [150, '150,00'],
    [0, '0,00'],
    [999.999, '1 000,00'],
    [1234567.891, '1 234 567,89'],
    [-12.5, '-12,50'],
  ])('writes a return of %f as %s %% ROI', (roi, expected) => {
    // Arrange and act
    render(<MostProfitableMovieWidget movie={{ ...movie, roi }} />);

    // Assert: French grouping and decimal comma, two decimals, then the unit.
    expect(visibleText()).toContain(`${expected} % ROI`);
  });

  it('shows a return of 0 % as a real value, not as missing data', () => {
    // Arrange and act
    render(<MostProfitableMovieWidget movie={{ ...movie, roi: 0 }} />);

    // Assert: a movie that earned back exactly its budget has a return of 0 %.
    expect(screen.queryByText('Aucune donnée disponible')).toBeNull();
    expect(visibleText()).toContain('0,00 % ROI');
  });

  it('trims the title', () => {
    // Arrange and act
    render(
      <MostProfitableMovieWidget
        movie={{ ...movie, title: '  Le Moulin  ' }}
      />,
    );

    // Assert
    expect(screen.getByText('Le Moulin').textContent).toBe('Le Moulin');
  });

  it.each([
    ['a null movie', null],
    ['an undefined movie', undefined],
    ['an empty title', { ...movie, title: '' }],
    ['a blank title', { ...movie, title: '   ' }],
    ['a null return', { ...movie, roi: null }],
    ['an undefined return', { ...movie, roi: undefined }],
    ['a return that is not a number', { ...movie, roi: Number.NaN }],
    ['an infinite return', { ...movie, roi: Number.POSITIVE_INFINITY }],
    ['a minus infinite return', { ...movie, roi: Number.NEGATIVE_INFINITY }],
  ])('treats %s as missing data', (_label, value) => {
    // Arrange and act
    render(<MostProfitableMovieWidget movie={value} />);

    // Assert: no half-filled movie, and no return of 0 % made up.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the movie', () => {
    // Arrange and act
    const { unmount } = render(
      <MostProfitableMovieWidget movie={movie} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Moulin');
    unmount();
    render(<MostProfitableMovieWidget movie={movie} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Moulin');
  });
});
