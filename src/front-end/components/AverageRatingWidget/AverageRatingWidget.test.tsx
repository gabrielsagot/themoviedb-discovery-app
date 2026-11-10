// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AverageRatingWidget from './AverageRatingWidget';
import * as stories from './AverageRatingWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  WholeNumber,
  RoundedValue,
  ZeroIsARealRating,
  Loading,
  NoRatings,
  OutOfScale,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Note moyenne' });
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

describe('AverageRatingWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Note moyenne" without error.
    expect(storyNames).toEqual([
      'Nominal',
      'WholeNumber',
      'RoundedValue',
      'ZeroIsARealRating',
      'Loading',
      'NoRatings',
      'OutOfScale',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      WholeNumber,
      RoundedValue,
      ZeroIsARealRating,
      Loading,
      NoRatings,
      OutOfScale,
      ErrorState,
      Mobile,
      DarkTheme,
    ]) {
      const { unmount } = render(<Story />);
      expect(card()).toBeTruthy();
      unmount();
    }
  });

  it('shows the nominal state of the mock-up: 6,78 / 10', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the value with its decimal comma, and the scale.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Note moyenne' }),
    ).toBeTruthy();
    expect(visibleText()).toBe('Note moyenne6,78 / 10');
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

  it('says that the average is a simple one, not a weighted rating', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the distinction is read by assistive technologies.
    expect(
      screen.getByText(
        'Moyenne simple des notes, sans pondération par le nombre de votes',
      ).className,
    ).toBe('visually-hidden');
  });

  it('always shows two decimals', () => {
    // Arrange and act
    render(<WholeNumber />);

    // Assert
    expect(visibleText()).toBe('Note moyenne7,00 / 10');
  });

  it('rounds an average with more than two decimals', () => {
    // Arrange and act
    render(<RoundedValue />);

    // Assert
    expect(visibleText()).toBe('Note moyenne6,78 / 10');
  });

  it('shows an average of 0 as a real rating, not as missing data', () => {
    // Arrange and act
    render(<ZeroIsARealRating />);

    // Assert
    expect(visibleText()).toBe('Note moyenne0,00 / 10');
    expect(screen.queryByText('Aucune donnée disponible')).toBeNull();
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no rating is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('10');
  });

  it('says there are no ratings instead of showing 0', () => {
    // Arrange and act
    render(<NoRatings />);

    // Assert: the missing average does not become an arbitrary 0,00.
    expect(visibleText()).toBe('Note moyenneAucune donnée disponible');
    expect(card().textContent).not.toContain('0');
  });

  it('says there is no data for a value outside the scale', () => {
    // Arrange and act
    render(<OutOfScale />);

    // Assert
    expect(visibleText()).toBe('Note moyenneAucune donnée disponible');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('6,78');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe('Note moyenne6,78 / 10');
    expect(visibleText()).toBe(mobileText);
  });

  it('only takes an average to show, never a list of movies to average', () => {
    // Assert: the widget is documented with its two props and nothing to compute from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'average',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Note moyenne');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('AverageRatingWidget', () => {
  it.each([
    [6.78, '6,78'],
    [7, '7,00'],
    [0, '0,00'],
    [10, '10,00'],
    [6.7849, '6,78'],
    [6.7851, '6,79'],
    [9.999, '10,00'],
    [0.004, '0,00'],
  ])('shows an average of %f as %s', (average, expected) => {
    // Arrange and act
    render(<AverageRatingWidget average={average} />);

    // Assert: decimal comma, two decimals, on a scale of 10.
    expect(visibleText()).toBe(`Note moyenne${expected} / 10`);
  });

  it.each([
    ['a negative average', -0.1],
    ['an average above 10', 10.01],
    ['an average that is not a number', Number.NaN],
    ['an infinite average', Number.POSITIVE_INFINITY],
  ])('treats %s as missing data', (_label, average) => {
    // Arrange and act
    render(<AverageRatingWidget average={average} />);

    // Assert
    expect(visibleText()).toBe('Note moyenneAucune donnée disponible');
  });

  it('treats an undefined average as missing data', () => {
    // Arrange and act
    render(<AverageRatingWidget />);

    // Assert
    expect(visibleText()).toBe('Note moyenneAucune donnée disponible');
  });

  it('shows the loading and error states whatever the average', () => {
    // Arrange and act
    const { unmount } = render(
      <AverageRatingWidget average={6.78} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('6,78');
    unmount();
    render(<AverageRatingWidget average={6.78} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('6,78');
  });
});
