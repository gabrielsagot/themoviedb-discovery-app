// @vitest-environment jsdom

import { composeStories } from '@storybook/react-vite';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AverageRuntimeWidget from './AverageRuntimeWidget';
import * as stories from './AverageRuntimeWidget.stories';

afterEach(cleanup);

// The stories of the widget, as Storybook shows them.
const {
  Nominal,
  RoundedValue,
  Loading,
  NoData,
  ZeroIsNoData,
  ErrorState,
  Mobile,
  DarkTheme,
} = composeStories(stories);

/**
 * Reads the card of the widget in the page.
 * @returns The article of the widget.
 */
function card(): HTMLElement {
  return screen.getByRole('article', { name: 'Durée moyenne' });
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

describe('AverageRuntimeWidget stories', () => {
  it('shows every story of the widget in Storybook', () => {
    // Arrange: every story is exported by the stories file.
    const storyNames = Object.keys(stories).filter(
      (name) => name !== 'default',
    );

    // Assert: each one renders a widget named "Durée moyenne" without error.
    expect(storyNames).toEqual([
      'Nominal',
      'RoundedValue',
      'Loading',
      'NoData',
      'ZeroIsNoData',
      'ErrorState',
      'Mobile',
      'DarkTheme',
    ]);
    for (const Story of [
      Nominal,
      RoundedValue,
      Loading,
      NoData,
      ZeroIsNoData,
      ErrorState,
      Mobile,
      DarkTheme,
    ]) {
      const { unmount } = render(<Story />);
      expect(card()).toBeTruthy();
      unmount();
    }
  });

  it('shows the nominal state of the mock-up: 107 min', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the label, the value and the unit, as the mock-up writes them.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Durée moyenne' }),
    ).toBeTruthy();
    expect(visibleText()).toBe('Durée moyenne107 min');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads the unit as minutes for assistive technologies', () => {
    // Arrange and act
    render(<Nominal />);

    // Assert: the abbreviation "min" is not read, "minutes" is.
    expect(
      card().querySelector('.widget-value-unit')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(screen.getByText('minutes').className).toBe('visually-hidden');
  });

  it('rounds an average that is not a whole number to the minute', () => {
    // Arrange and act
    render(<RoundedValue />);

    // Assert
    expect(visibleText()).toBe('Durée moyenne107 min');
  });

  it('shows a loading placeholder, announced and marked busy', () => {
    // Arrange and act
    render(<Loading />);

    // Assert: no value is shown while loading.
    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Chargement en cours');
    expect(card().textContent).not.toContain('min');
  });

  it('says there is no data instead of showing 0', () => {
    // Arrange and act
    render(<NoData />);

    // Assert: the missing average does not become an arbitrary 0.
    expect(visibleText()).toBe('Durée moyenneAucune donnée disponible');
    expect(card().textContent).not.toContain('0');
  });

  it('says there is no data for an average of 0 minutes, which no valid runtime gives', () => {
    // Arrange and act
    render(<ZeroIsNoData />);

    // Assert
    expect(visibleText()).toBe('Durée moyenneAucune donnée disponible');
  });

  it('announces an error as an alert', () => {
    // Arrange and act
    render(<ErrorState />);

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'Les données sont indisponibles',
    );
    expect(card().textContent).not.toContain('107');
  });

  it('shows the same content on mobile and in the dark theme', () => {
    // Arrange and act: both stories only change how Storybook displays the widget.
    const { unmount } = render(<Mobile />);
    const mobileText = visibleText();
    unmount();
    render(<DarkTheme />);

    // Assert
    expect(mobileText).toBe('Durée moyenne107 min');
    expect(visibleText()).toBe(mobileText);
  });

  it('gives the stories their documentation and display settings', () => {
    // Assert: Storybook builds the documentation of the props from the component.
    expect(stories.default.tags).toContain('autodocs');
    expect(stories.default.title).toBe('Widgets/Durée moyenne');
    expect(Mobile.globals).toEqual({
      viewport: { value: 'mobile1', isRotated: false },
    });
    expect(DarkTheme.globals).toEqual({ theme: 'dark' });
  });
});

describe('AverageRuntimeWidget', () => {
  it.each([
    [107, '107'],
    [106.4, '106'],
    [106.5, '107'],
    [1, '1'],
    [1234.4, '1234'],
    [12345, `12${String.fromCharCode(0x202f)}345`],
  ])('shows an average of %f minutes as %s', (minutes, expected) => {
    // Arrange and act
    render(<AverageRuntimeWidget minutes={minutes} />);

    // Assert: whole minutes, with the French grouping from five digits.
    expect(visibleText()).toBe(`Durée moyenne${expected} min`);
  });

  it('reads one minute in the singular', () => {
    // Arrange and act
    render(<AverageRuntimeWidget minutes={1} />);

    // Assert
    expect(screen.getByText('minute').className).toBe('visually-hidden');
  });

  it.each([
    ['a negative average', -90],
    ['an average between 0 and 1', 0.4],
    ['an average that is not a number', Number.NaN],
    ['an infinite average', Number.POSITIVE_INFINITY],
  ])('treats %s as missing data', (_label, minutes) => {
    // Arrange and act
    render(<AverageRuntimeWidget minutes={minutes} />);

    // Assert
    expect(visibleText()).toBe('Durée moyenneAucune donnée disponible');
  });

  it('treats an undefined average as missing data', () => {
    // Arrange and act
    render(<AverageRuntimeWidget />);

    // Assert
    expect(visibleText()).toBe('Durée moyenneAucune donnée disponible');
  });

  it('shows the loading and error states whatever the average', () => {
    // Arrange and act
    const { unmount } = render(
      <AverageRuntimeWidget minutes={107} status="loading" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(card().textContent).not.toContain('107');
    unmount();
    render(<AverageRuntimeWidget minutes={107} status="error" />);

    // Assert
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(card().textContent).not.toContain('107');
  });
});
