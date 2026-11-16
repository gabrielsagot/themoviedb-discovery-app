// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MostProfitableMovieWidget from '../MostProfitableMovieWidget/MostProfitableMovieWidget';
import LeastProfitableMovieWidget from './LeastProfitableMovieWidget';
import * as stories from './LeastProfitableMovieWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  PartialLoss,
  ZeroRoi,
  UnknownRoi,
  MissingPoster,
  LongTitle,
  NoEligibleMovie,
  Loading,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Film le moins rentableAucune donnée disponible';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Film le moins rentable' });
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

/**
 * Makes the markup of two widgets comparable: their label is replaced, and so
 * are the identifiers that React generates, which differ from one render to
 * the next.
 * @param html The markup of a widget.
 * @param label The label of the widget.
 * @returns The markup without the label and the generated identifiers.
 */
function normalize(html: string, label: string): string {
  return html.replace(label, 'X').replace(/_r_[0-9a-z]+_/g, 'ID');
}

describe('LeastProfitableMovieWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Film le moins rentable".
    expect(storyNames).toEqual([
      'Nominal',
      'PartialLoss',
      'ZeroRoi',
      'UnknownRoi',
      'MissingPoster',
      'LongTitle',
      'NoEligibleMovie',
      'Loading',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      PartialLoss,
      ZeroRoi,
      UnknownRoi,
      MissingPoster,
      LongTitle,
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

  it('shows the nominal state: a return of -100 % with its negative sign', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the poster, the title, the year and the signed percentage.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Film le moins rentable' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Affiche du film Le Dernier Rideau' }),
    ).toBeTruthy();
    expect(visibleText()).toBe(
      'Film le moins rentableLe Dernier Rideau2012-100,00 % ROI',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the sign of a partial loss', () => {
    // Arrange and act
    render(<PartialLoss />);

    // Assert
    expect(visibleText()).toContain('-42,50 % ROI');
  });

  it('tells a negative return, a return of 0 and a missing return apart', () => {
    // Arrange and act: the three stories show the three cases.
    const { unmount: unmountNegative } = render(<Nominal />);
    const negative = visibleText();
    unmountNegative();
    const { unmount: unmountZero } = render(<ZeroRoi />);
    const zero = visibleText();
    unmountZero();
    render(<UnknownRoi />);
    const unknown = visibleText();

    // Assert: a loss keeps its sign, a return of 0 is a real value, and a
    // missing return is neither of them.
    expect(negative).toContain('-100,00 % ROI');
    expect(zero).toContain('0,00 % ROI');
    expect(zero).not.toContain('-');
    expect(unknown).toBe(emptyMessage);
    expect(unknown).not.toContain('0,00');
  });

  it('reads the unit as "pour cent de retour sur investissement" for assistive technologies', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert
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

    // Assert
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
    expect(card().textContent).toContain('-100,00');
  });

  it('shows a long title in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongTitle />);

    // Assert
    expect(
      screen.getByText(
        "Le Dernier Rideau ou le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse",
      ).className,
    ).toBe('widget-movie-title');
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
    expect(card().textContent).not.toContain('Rideau');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('Rideau');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(
      'Film le moins rentableLe Dernier Rideau2012-100,00 % ROI',
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
    expect(stories.default.title).toBe('Widgets/Film le moins rentable');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('LeastProfitableMovieWidget', () => {
  const movie = {
    title: 'Le Rideau',
    year: 2012,
    posterUrl: 'poster.jpg',
    roi: -100,
  };

  it.each([
    [-100, '-100,00'],
    [-42.5, '-42,50'],
    [-0.004, '-0,00'],
    [0, '0,00'],
    [12.5, '12,50'],
    [-1234.567, '-1 234,57'],
  ])('writes a return of %f as %s %% ROI', (roi, expected) => {
    // Arrange and act
    render(<LeastProfitableMovieWidget movie={{ ...movie, roi }} />);

    // Assert: the sign is kept, with two decimals and the French separators.
    expect(visibleText()).toContain(`${expected} % ROI`);
  });

  it.each([
    ['a null movie', null],
    ['an undefined movie', undefined],
    ['a blank title', { ...movie, title: '   ' }],
    ['a null return', { ...movie, roi: null }],
    ['an undefined return', { ...movie, roi: undefined }],
    ['a return that is not a number', { ...movie, roi: Number.NaN }],
    ['an infinite return', { ...movie, roi: Number.NEGATIVE_INFINITY }],
  ])('treats %s as missing data', (_label, value) => {
    // Arrange and act
    render(<LeastProfitableMovieWidget movie={value} />);

    // Assert: no half-filled movie, and no return of 0 % made up.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the movie', () => {
    // Arrange and act
    const { unmount } = render(
      <LeastProfitableMovieWidget movie={movie} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Rideau');
    unmount();
    render(<LeastProfitableMovieWidget movie={movie} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('Le Rideau');
  });

  it('follows exactly the same rules as the most profitable movie widget', () => {
    // Arrange: the same movie and the same states in both widgets.
    const cases = [
      { movie: { ...movie, roi: 69667.36 } },
      { movie: { ...movie, roi: -100 } },
      { movie: { ...movie, roi: 0 } },
      { movie: { ...movie, roi: null } },
      { movie: null },
      { movie, status: 'loading' as const },
      { movie, status: 'error' as const },
    ];

    for (const props of cases) {
      // Act
      const { container, unmount } = render(
        <LeastProfitableMovieWidget {...props} />,
      );
      const least = normalize(container.innerHTML, 'Film le moins rentable');
      unmount();
      const { container: other, unmount: unmountOther } = render(
        <MostProfitableMovieWidget {...props} />,
      );
      const most = normalize(other.innerHTML, 'Film le plus rentable');
      unmountOther();

      // Assert: only the label differs.
      expect(least).toBe(most);
    }
  });
});
