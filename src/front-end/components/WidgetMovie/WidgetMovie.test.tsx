// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import WidgetMovie from './WidgetMovie';

afterEach(cleanup);

describe('WidgetMovie', () => {
  it('shows the poster with a text alternative, the title and the year', () => {
    // Arrange and act
    render(<WidgetMovie title="Le Phare" year={2019} posterUrl="poster.jpg" />);

    // Assert
    const poster = screen.getByRole('img', {
      name: 'Affiche du film Le Phare',
    });
    expect(poster.getAttribute('src')).toBe('poster.jpg');
    expect(screen.getByText('Le Phare').className).toBe('widget-movie-title');
    expect(screen.getByText('2019').className).toBe('widget-movie-year');
    expect(screen.queryByText('Affiche indisponible')).toBeNull();
  });

  it('shows what the widget puts under the year', () => {
    // Arrange and act
    render(
      <WidgetMovie title="Le Phare" year={2019} posterUrl="poster.jpg">
        <p>9,1 / 10</p>
      </WidgetMovie>,
    );

    // Assert
    expect(screen.getByText('9,1 / 10')).toBeTruthy();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty address', ''],
    ['a blank address', '   '],
  ])('shows the placeholder for a poster that is %s', (_label, posterUrl) => {
    // Arrange and act
    render(<WidgetMovie title="Le Phare" year={2019} posterUrl={posterUrl} />);

    // Assert: no broken image, an explicit text instead.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
  });

  it('trims the address of the poster', () => {
    // Arrange and act
    render(<WidgetMovie title="Le Phare" posterUrl="  poster.jpg  " />);

    // Assert
    expect(screen.getByRole('img').getAttribute('src')).toBe('poster.jpg');
  });

  it('replaces a poster that cannot be loaded with the placeholder', () => {
    // Arrange
    render(<WidgetMovie title="Le Phare" posterUrl="broken.jpg" />);

    // Act: the browser reports that the image cannot be loaded.
    fireEvent.error(screen.getByRole('img'));

    // Assert
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Affiche indisponible')).toBeTruthy();
  });

  it('tries a new poster after the previous one failed', () => {
    // Arrange: the first poster cannot be loaded.
    const { rerender } = render(
      <WidgetMovie title="Le Phare" posterUrl="broken.jpg" />,
    );
    fireEvent.error(screen.getByRole('img'));

    // Act: another poster is received.
    rerender(<WidgetMovie title="Le Phare" posterUrl="other.jpg" />);

    // Assert: it is not the one that failed, so it is shown.
    expect(screen.getByRole('img').getAttribute('src')).toBe('other.jpg');
  });

  it.each([
    [1000, '1000'],
    [1999, '1999'],
    [9999, '9999'],
  ])(
    'writes the year %i with four digits and no grouping',
    (year, expected) => {
      // Arrange and act
      render(<WidgetMovie title="Le Phare" year={year} />);

      // Assert
      expect(screen.getByText(expected)).toBeTruthy();
      expect(screen.queryByText('Année inconnue')).toBeNull();
    },
  );

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['0', 0],
    ['a year with decimals', 2019.5],
    ['a year with three digits', 999],
    ['a year with five digits', 10000],
    ['a year that is not a number', Number.NaN],
  ])('says that the year is unknown for %s', (_label, year) => {
    // Arrange and act
    render(<WidgetMovie title="Le Phare" year={year} />);

    // Assert: neither "null" nor an invented year is written.
    expect(screen.getByText('Année inconnue')).toBeTruthy();
  });
});
