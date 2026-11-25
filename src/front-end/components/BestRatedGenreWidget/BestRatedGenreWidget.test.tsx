// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BestRatedGenreWidget from './BestRatedGenreWidget';
import * as stories from './BestRatedGenreWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  LongName,
  WholeRating,
  ZeroAverage,
  GenreWithoutRatings,
  NoKnownGenre,
  Loading,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Meilleure noteAucune donnée disponible';
const caption = 'Moyenne simple, non pondérée par les votes';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Meilleure note' });
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

describe('BestRatedGenreWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Meilleure note".
    expect(storyNames).toEqual([
      'Nominal',
      'LongName',
      'WholeRating',
      'ZeroAverage',
      'GenreWithoutRatings',
      'NoKnownGenre',
      'Loading',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      LongName,
      WholeRating,
      ZeroAverage,
      GenreWithoutRatings,
      NoKnownGenre,
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

  it('shows the nominal state of the mock-up: Animation, 7,41 / 10', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the genre, the rating on its scale, and the caption.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Meilleure note' }),
    ).toBeTruthy();
    expect(visibleText()).toBe(`Meilleure noteAnimation7,41 / 10${caption}`);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says in plain sight that the average is a simple one, not a weighted rating', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the caption is visible on screen, not only read by assistive technologies.
    const note = screen.getByText(caption);
    expect(note.className).toBe('best-rated-genre-caption');
    expect(note.closest('.visually-hidden')).toBeNull();
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

  it('shows a long name in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongName />);

    // Assert
    expect(
      screen.getByText(
        'Film de science-fiction, de fantasy et d’aventures spatiales',
      ).className,
    ).toBe('widget-name');
  });

  it('always shows two decimals', () => {
    // Arrange and act
    render(<WholeRating />);

    // Assert
    expect(visibleText()).toContain('8,00 / 10');
  });

  it('tells an average of 0 from a genre without ratings', () => {
    // Arrange and act: the two stories show the two cases.
    const { unmount } = render(<ZeroAverage />);
    const zero = visibleText();
    unmount();
    render(<GenreWithoutRatings />);
    const unrated = visibleText();

    // Assert: 0 is a real rating, with its caption; a genre without a valid
    // rating shows no data, and is never shown as rated 0.
    expect(zero).toBe(`Meilleure noteAnimation0,00 / 10${caption}`);
    expect(unrated).toBe(emptyMessage);
    expect(unrated).not.toContain('0,00');
  });

  it('shows no data when no genre is known', () => {
    // Arrange and act
    render(<NoKnownGenre />);

    // Assert: a rating without a genre is not shown.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no genre is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('Animation');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('7,41');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(`Meilleure noteAnimation7,41 / 10${caption}`);
    expect(visibleText()).toBe(mobileText);
  });

  it('documents its three properties and only takes an average it does not compute', () => {
    // Assert: a genre, an average and a status, and nothing to average from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'genreName',
      'average',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Meilleure note');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('BestRatedGenreWidget', () => {
  it.each([
    [7.41, '7,41'],
    [8, '8,00'],
    [0, '0,00'],
    [10, '10,00'],
    [7.4149, '7,41'],
    [7.4151, '7,42'],
    [9.999, '10,00'],
  ])('shows an average of %f as %s / 10', (average, expected) => {
    // Arrange and act
    render(<BestRatedGenreWidget genreName="Animation" average={average} />);

    // Assert: decimal comma, two decimals, on a scale of 10.
    expect(visibleText()).toBe(
      `Meilleure noteAnimation${expected} / 10${caption}`,
    );
  });

  it('trims the name of the genre', () => {
    // Arrange and act
    render(<BestRatedGenreWidget genreName="  Animation  " average={7} />);

    // Assert
    expect(screen.getByText('Animation').textContent).toBe('Animation');
  });

  it.each([
    ['a null name', null, 7],
    ['an undefined name', undefined, 7],
    ['an empty name', '', 7],
    ['a blank name', '   ', 7],
    ['a null average', 'Animation', null],
    ['an undefined average', 'Animation', undefined],
    ['a negative average', 'Animation', -0.1],
    ['an average above 10', 'Animation', 10.01],
    ['an average that is not a number', 'Animation', Number.NaN],
    ['an infinite average', 'Animation', Number.POSITIVE_INFINITY],
  ])('treats %s as missing data', (_label, genreName, average) => {
    // Arrange and act
    render(<BestRatedGenreWidget genreName={genreName} average={average} />);

    // Assert: no half-filled card, and no caption without a rating.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the data', () => {
    // Arrange and act
    const { unmount } = render(
      <BestRatedGenreWidget
        genreName="Animation"
        average={7}
        status="loading"
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('Animation');
    unmount();
    render(
      <BestRatedGenreWidget genreName="Animation" average={7} status="error" />,
    );

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('Animation');
  });
});
