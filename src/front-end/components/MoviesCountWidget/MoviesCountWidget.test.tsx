// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MoviesCountWidget from './MoviesCountWidget';
import * as stories from './MoviesCountWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  WithoutPeriod,
  SingleYear,
  SingleMovie,
  EmptyDatabase,
  LargeCount,
  Loading,
  NoData,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

// French groups digits with a narrow no-break space (U+202F).
const NARROW_SPACE = String.fromCharCode(0x202f);

/**
 * Reads the text of the widget in the page.
 * @returns The text of the card.
 */
function widgetText(): string {
  return screen.getByRole('article', { name: 'Films en base' }).textContent;
}

describe('MoviesCountWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Films en base" without error.
    expect(storyNames).toEqual([
      'Nominal',
      'WithoutPeriod',
      'SingleYear',
      'SingleMovie',
      'EmptyDatabase',
      'LargeCount',
      'Loading',
      'NoData',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      WithoutPeriod,
      SingleYear,
      SingleMovie,
      EmptyDatabase,
      LargeCount,
      Loading,
      NoData,
      ErrorState,
      Mobile,
      DarkTheme,
    ]) {
      const { unmount } = render(<Story />);
      expect(
        screen.getByRole('article', { name: 'Films en base' }),
      ).toBeTruthy();
      unmount();
    }
  });

  it('shows the nominal state of the mock-up: 1000 films from 2023 to 2027', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the number without a group space, the unit and the period.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Films en base' }),
    ).toBeTruthy();
    expect(widgetText()).toBe('Films en base1000 filmsPériode : 2023–2027');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides the period when there is none', () => {
    // Arrange and act
    render(<WithoutPeriod />);

    // Assert
    expect(widgetText()).toBe('Films en base1000 films');
  });

  it('writes a single year when the movies all come out the same year', () => {
    // Arrange and act
    render(<SingleYear />);

    // Assert
    expect(widgetText()).toBe('Films en base1000 filmsPériode : 2024');
  });

  it('writes a single movie in the singular', () => {
    // Arrange and act
    render(<SingleMovie />);

    // Assert
    expect(widgetText()).toContain('1 film');
    expect(widgetText()).not.toContain('films');
  });

  it('shows an empty database as a real 0, not as missing data', () => {
    // Arrange and act
    render(<EmptyDatabase />);

    // Assert: 0 is shown, in the singular, and no "no data" message.
    expect(widgetText()).toBe('Films en base0 film');
    expect(screen.queryByText('Aucune donnée disponible')).toBeNull();
  });

  it('groups the digits of a large number by three', () => {
    // Arrange and act
    render(<LargeCount />);

    // Assert
    expect(widgetText()).toContain(
      `1${NARROW_SPACE}234${NARROW_SPACE}567 films`,
    );
    expect(widgetText()).toContain('1990–2027');
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no number is shown while loading.
    const card = screen.getByRole('article', { name: 'Films en base' });
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card.textContent).not.toContain('film');
  });

  it('says there is no data instead of showing 0', () => {
    // Arrange and act
    render(<NoData />);

    // Assert: the missing value does not become an arbitrary 0.
    expect(widgetText()).toBe('Films en baseAucune donnée disponible');
    expect(widgetText()).not.toContain('0');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(widgetText()).not.toContain('film ');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = widgetText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe('Films en base1000 filmsPériode : 2023–2027');
    expect(widgetText()).toBe(mobileText);
  });

  it('gives the stories their accessibility and documentation settings', () => {
    // Assert: Storybook builds the documentation of the props from the component.
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Films en base');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('MoviesCountWidget', () => {
  it('shows 2 movies in the plural', () => {
    // Arrange and act
    render(<MoviesCountWidget count={2} />);

    // Assert: in French, the plural starts at 2.
    expect(widgetText()).toBe('Films en base2 films');
  });

  it('groups the digits from 5 digits only', () => {
    // Arrange and act
    const { unmount } = render(<MoviesCountWidget count={9999} />);
    const fourDigits = widgetText();
    unmount();
    render(<MoviesCountWidget count={10000} />);

    // Assert
    expect(fourDigits).toBe('Films en base9999 films');
    expect(widgetText()).toBe(`Films en base10${NARROW_SPACE}000 films`);
  });

  it.each([
    ['a negative count', -5],
    ['a count that is not a number', Number.NaN],
    ['an infinite count', Number.POSITIVE_INFINITY],
  ])('treats %s as missing data', (_label, count) => {
    // Arrange and act
    render(<MoviesCountWidget count={count} />);

    // Assert
    expect(widgetText()).toBe('Films en baseAucune donnée disponible');
  });

  it('treats an undefined count as missing data', () => {
    // Arrange and act
    render(<MoviesCountWidget />);

    // Assert
    expect(widgetText()).toBe('Films en baseAucune donnée disponible');
  });

  it('writes a period given backwards from the earliest year', () => {
    // Arrange and act
    render(<MoviesCountWidget count={10} period={{ from: 2027, to: 2023 }} />);

    // Assert
    expect(widgetText()).toContain('2023–2027');
  });

  it('shows the loading and error states whatever the count', () => {
    // Arrange and act
    const { unmount } = render(
      <MoviesCountWidget count={1000} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(widgetText()).not.toContain('1000');
    unmount();
    render(<MoviesCountWidget count={1000} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(widgetText()).not.toContain('1000');
  });
});
