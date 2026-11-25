// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TopCountryWidget from '../TopCountryWidget/TopCountryWidget';
import DominantGenreWidget from './DominantGenreWidget';
import * as stories from './DominantGenreWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  LongName,
  UnbreakableName,
  SingleMovie,
  Loading,
  NoKnownGenre,
  InvalidCount,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

const emptyMessage = 'Genre dominantAucune donnée disponible';

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Genre dominant' });
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

describe('DominantGenreWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Genre dominant".
    expect(storyNames).toEqual([
      'Nominal',
      'LongName',
      'UnbreakableName',
      'SingleMovie',
      'Loading',
      'NoKnownGenre',
      'InvalidCount',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      LongName,
      UnbreakableName,
      SingleMovie,
      Loading,
      NoKnownGenre,
      InvalidCount,
      ErrorState,
      Mobile,
      DarkTheme,
    ]) {
      const { unmount } = render(<Story />);
      expect(card()).toBeTruthy();
      unmount();
    }
  });

  it('shows the nominal state of the mock-up: Drame, 322 films', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the name of the genre, the count and its unit.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Genre dominant' }),
    ).toBeTruthy();
    expect(visibleText()).toBe('Genre dominantDrame322 films');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a long name in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongName />);

    // Assert: the whole name is in the page, with its count.
    expect(
      screen.getByText(
        'Film de science-fiction, de fantasy et d’aventures spatiales',
      ).className,
    ).toBe('widget-name');
    expect(visibleText()).toContain('1234 films');
  });

  it('keeps a name without spaces in full', () => {
    // Arrange and act
    render(<UnbreakableName />);

    // Assert
    expect(
      screen.getByText(
        'Science-Fiction-Fantastique-Anticipation-Dystopique-Spatiale',
      ),
    ).toBeTruthy();
  });

  it('uses the singular unit for a single movie', () => {
    // Arrange and act
    render(<SingleMovie />);

    // Assert
    expect(visibleText()).toBe('Genre dominantWestern1 film');
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no genre is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('Drame');
  });

  it('says that no genre is known instead of inventing one or showing 0', () => {
    // Arrange and act
    render(<NoKnownGenre />);

    // Assert
    expect(visibleText()).toBe(emptyMessage);
    expect(card().textContent).not.toContain('0');
  });

  it('shows no data for an impossible count', () => {
    // Arrange and act
    render(<InvalidCount />);

    // Assert: a genre with 0 movies is not shown as if it were valid.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('322');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe('Genre dominantDrame322 films');
    expect(visibleText()).toBe(mobileText);
  });

  it('documents its three properties and only takes figures it does not compute', () => {
    // Assert: a name, a count and a status, and nothing to count from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'genreName',
      'count',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Genre dominant');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('DominantGenreWidget', () => {
  it.each([
    [322, '322 films'],
    [1000, '1000 films'],
    [12345, '12 345 films'],
    [2, '2 films'],
    [1, '1 film'],
  ])('shows a count of %i as %s', (count, expected) => {
    // Arrange and act
    render(<DominantGenreWidget genreName="Drame" count={count} />);

    // Assert: French grouping, and the unit follows the count.
    expect(visibleText()).toBe(`Genre dominantDrame${expected}`);
  });

  it.each([
    ['a null name', null, 5],
    ['an undefined name', undefined, 5],
    ['a blank name', '   ', 5],
    ['a null count', 'Drame', null],
    ['a count of 0', 'Drame', 0],
    ['a negative count', 'Drame', -3],
    ['a count with decimals', 'Drame', 2.5],
    ['a count that is not a number', 'Drame', Number.NaN],
  ])('treats %s as missing data', (_label, genreName, count) => {
    // Arrange and act
    render(<DominantGenreWidget genreName={genreName} count={count} />);

    // Assert: neither an empty name nor a made-up count is shown.
    expect(visibleText()).toBe(emptyMessage);
  });

  it('shows the loading and error states whatever the data', () => {
    // Arrange and act
    const { unmount } = render(
      <DominantGenreWidget genreName="Drame" count={5} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('Drame');
    unmount();
    render(<DominantGenreWidget genreName="Drame" count={5} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('Drame');
  });

  it('follows the same rules as the most represented country widget', () => {
    // Arrange: the same name, the same counts and the same states in both widgets.
    const cases = [
      { name: 'X', count: 322 },
      { name: 'X', count: 1 },
      { name: 'X', count: 12345 },
      { name: 'X', count: 0 },
      { name: null, count: 5 },
      { name: 'X', count: 5, status: 'loading' as const },
      { name: 'X', count: 5, status: 'error' as const },
    ];

    for (const { name, count, status } of cases) {
      // Act
      const { container, unmount } = render(
        <DominantGenreWidget genreName={name} count={count} status={status} />,
      );
      const genre = normalize(container.innerHTML, 'Genre dominant');
      unmount();
      const { container: other, unmount: unmountOther } = render(
        <TopCountryWidget countryName={name} count={count} status={status} />,
      );
      const country = normalize(other.innerHTML, 'Pays le plus représenté');
      unmountOther();

      // Assert: only the label differs.
      expect(genre).toBe(country);
    }
  });
});

/**
 * Makes the markup of two widgets comparable: their label is replaced, and so
 * are the identifiers that React generates, which differ from one render to
 * the next.
 * @param html The markup of a widget.
 * @param label The label of the widget.
 * @returns The markup without the label and the generated identifiers.
 */
function normalize(html: string, label: string): string {
  return html.replace(label, 'LABEL').replace(/_r_[0-9a-z]+_/g, 'ID');
}
