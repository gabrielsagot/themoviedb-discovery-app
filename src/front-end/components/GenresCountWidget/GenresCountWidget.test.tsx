// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import GenresCountWidget from './GenresCountWidget';
import * as stories from './GenresCountWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  SingleGenre,
  ZeroGenres,
  UnknownCount,
  Loading,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Genres représentésAucune donnée disponible';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Genres représentés' });
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

describe('GenresCountWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Genres représentés".
    expect(storyNames).toEqual([
      'Nominal',
      'SingleGenre',
      'ZeroGenres',
      'UnknownCount',
      'Loading',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      SingleGenre,
      ZeroGenres,
      UnknownCount,
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

  it('shows the nominal state of the mock-up: the labels and 19 genres', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the count with its unit, and the caption.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Genres représentés' }),
    ).toBeTruthy();
    expect(visibleText()).toBe(
      'Genres représentés19 genresDiversité du catalogue',
    );
    expect(screen.getByText('Diversité du catalogue')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uses the singular unit for a single genre', () => {
    // Arrange and act
    render(<SingleGenre />);

    // Assert
    expect(visibleText()).toBe(
      'Genres représentés1 genreDiversité du catalogue',
    );
  });

  it('tells a count of zero from an unknown count', () => {
    // Arrange and act: the two stories show the two cases.
    const { unmount } = render(<ZeroGenres />);
    const zero = visibleText();
    unmount();
    render(<UnknownCount />);
    const unknown = visibleText();

    // Assert: zero is a real value, with its unit and its caption; an unknown
    // count shows no data, and never a made-up 0.
    expect(zero).toBe('Genres représentés0 genreDiversité du catalogue');
    expect(unknown).toBe(emptyMessage);
    expect(unknown).not.toContain('0');
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no count is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('19');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('19');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(
      'Genres représentés19 genresDiversité du catalogue',
    );
    expect(visibleText()).toBe(mobileText);
  });

  it('documents its two properties and only takes a count it does not compute', () => {
    // Assert: a count and a status, and nothing to count from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'count',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Genres représentés');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('GenresCountWidget', () => {
  it.each([
    [19, '19 genres'],
    [2, '2 genres'],
    [1, '1 genre'],
    [0, '0 genre'],
    [1000, '1000 genres'],
    [12345, '12 345 genres'],
  ])('shows a count of %i as %s', (count, expected) => {
    // Arrange and act
    render(<GenresCountWidget count={count} />);

    // Assert: French grouping, and the unit follows the count.
    expect(visibleText()).toBe(
      `Genres représentés${expected}Diversité du catalogue`,
    );
  });

  it.each([
    ['a null count', null],
    ['an undefined count', undefined],
    ['a negative count', -1],
    ['a count with decimals', 2.5],
    ['a count that is not a number', Number.NaN],
    ['an infinite count', Number.POSITIVE_INFINITY],
  ])('treats %s as missing data', (_label, count) => {
    // Arrange and act
    render(<GenresCountWidget count={count} />);

    // Assert: no made-up count, and no caption without a figure.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the count', () => {
    // Arrange and act
    const { unmount } = render(
      <GenresCountWidget count={19} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('19');
    unmount();
    render(<GenresCountWidget count={19} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('19');
  });
});
