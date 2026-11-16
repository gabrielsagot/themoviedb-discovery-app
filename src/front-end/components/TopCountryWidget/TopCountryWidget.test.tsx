// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TopCountryWidget from './TopCountryWidget';
import * as stories from './TopCountryWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  LongName,
  UnbreakableName,
  SingleMovie,
  Loading,
  NoKnownCountry,
  InvalidCount,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Pays le plus représenté' });
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

describe('TopCountryWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Pays le plus représenté".
    expect(storyNames).toEqual([
      'Nominal',
      'LongName',
      'UnbreakableName',
      'SingleMovie',
      'Loading',
      'NoKnownCountry',
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
      NoKnownCountry,
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

  it('shows the nominal state of the mock-up: United States of America, 725 films', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the name of the country, the count and its unit.
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Pays le plus représenté',
      }),
    ).toBeTruthy();
    expect(visibleText()).toBe(
      'Pays le plus représentéUnited States of America725 films',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a long name in full, so that it can wrap instead of being cut', () => {
    // Arrange and act
    render(<LongName />);

    // Assert: the whole name is in the page, with its count.
    expect(
      screen.getByText("Royaume-Uni de Grande-Bretagne et d'Irlande du Nord")
        .className,
    ).toBe('top-country-name');
    expect(visibleText()).toContain('1234 films');
  });

  it('keeps a name without spaces in full', () => {
    // Arrange and act
    render(<UnbreakableName />);

    // Assert
    expect(
      screen.getByText(
        'Saint-Vincent-et-les-Grenadines-Saint-Christophe-et-Niévès',
      ),
    ).toBeTruthy();
  });

  it('uses the singular unit for a single movie', () => {
    // Arrange and act
    render(<SingleMovie />);

    // Assert
    expect(visibleText()).toBe('Pays le plus représentéIslande1 film');
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no country is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('United States');
  });

  it('says that no country is known instead of inventing one or showing 0', () => {
    // Arrange and act
    render(<NoKnownCountry />);

    // Assert
    expect(visibleText()).toBe(
      'Pays le plus représentéAucune donnée disponible',
    );
    expect(card().textContent).not.toContain('0');
  });

  it('shows no data for an impossible count', () => {
    // Arrange and act
    render(<InvalidCount />);

    // Assert: a name with 0 movies is not shown as if it were valid.
    expect(visibleText()).toBe(
      'Pays le plus représentéAucune donnée disponible',
    );
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('725');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe(
      'Pays le plus représentéUnited States of America725 films',
    );
    expect(visibleText()).toBe(mobileText);
  });

  it('documents its three properties and only takes figures it does not compute', () => {
    // Assert: a name, a count and a status, and nothing to count from.
    expect(Object.keys(stories.default.argTypes ?? {})).toEqual([
      'countryName',
      'count',
      'status',
    ]);
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Pays le plus représenté');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('TopCountryWidget', () => {
  it.each([
    [725, '725 films'],
    [1000, '1000 films'],
    [12345, '12 345 films'],
    [2, '2 films'],
    [1, '1 film'],
  ])('shows a count of %i as %s', (count, expected) => {
    // Arrange and act
    render(<TopCountryWidget countryName="France" count={count} />);

    // Assert: French grouping, and the unit follows the count.
    expect(visibleText()).toBe(`Pays le plus représentéFrance${expected}`);
  });

  it('trims the spaces around the name', () => {
    // Arrange and act
    render(<TopCountryWidget countryName="  France  " count={3} />);

    // Assert
    expect(screen.getByText('France').textContent).toBe('France');
  });

  it.each([
    ['a null name', null, 5],
    ['an undefined name', undefined, 5],
    ['an empty name', '', 5],
    ['a blank name', '   ', 5],
    ['a null count', 'France', null],
    ['an undefined count', 'France', undefined],
    ['a count of 0', 'France', 0],
    ['a negative count', 'France', -3],
    ['a count with decimals', 'France', 2.5],
    ['a count that is not a number', 'France', Number.NaN],
    ['an infinite count', 'France', Number.POSITIVE_INFINITY],
  ])('treats %s as missing data', (_label, countryName, count) => {
    // Arrange and act
    render(<TopCountryWidget countryName={countryName} count={count} />);

    // Assert: neither an empty name nor a made-up count is shown.
    expect(visibleText()).toBe(
      'Pays le plus représentéAucune donnée disponible',
    );
  });

  it('shows the loading and error states whatever the data', () => {
    // Arrange and act
    const { unmount } = render(
      <TopCountryWidget countryName="France" count={5} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('France');
    unmount();
    render(<TopCountryWidget countryName="France" count={5} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('France');
  });
});
