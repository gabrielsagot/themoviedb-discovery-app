// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MovieRoiWidget from './MovieRoiWidget';

afterEach(cleanup);

const movie = {
  title: 'Le Moulin',
  year: 2016,
  posterUrl: 'poster.jpg',
  roi: 150,
};

describe('MovieRoiWidget', () => {
  it('names the card with the label it is given', () => {
    // Arrange and act
    render(<MovieRoiWidget label="Film à comparer" movie={movie} />);

    // Assert: the label is the heading that names the whole card.
    expect(
      screen.getByRole('article', { name: 'Film à comparer' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Film à comparer' }),
    ).toBeTruthy();
  });

  it('shows the movie and its return in the same way whatever the label', () => {
    // Arrange and act
    const { unmount } = render(<MovieRoiWidget label="A" movie={movie} />);
    const first = screen.getByRole('article').textContent.replace('A', '');
    unmount();
    render(<MovieRoiWidget label="B" movie={movie} />);

    // Assert: only the label differs, the rules of the return are shared.
    expect(screen.getByRole('article').textContent.replace('B', '')).toBe(
      first,
    );
    expect(first).toContain('150,00 % ROI');
  });

  it('keeps the label in every state', () => {
    // Arrange and act
    const { unmount: unmountEmpty } = render(
      <MovieRoiWidget label="Film à comparer" movie={null} />,
    );
    expect(
      screen.getByRole('heading', { name: 'Film à comparer' }),
    ).toBeTruthy();
    expect(screen.getByText('Aucune donnée disponible')).toBeTruthy();
    unmountEmpty();
    const { unmount: unmountLoading } = render(
      <MovieRoiWidget label="Film à comparer" movie={movie} status="loading" />,
    );
    expect(
      screen.getByRole('heading', { name: 'Film à comparer' }),
    ).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    unmountLoading();
    render(
      <MovieRoiWidget label="Film à comparer" movie={movie} status="error" />,
    );

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Film à comparer' }),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the sign of a negative return and tells a return of 0 from a missing one', () => {
    // Arrange and act
    const { unmount: unmountLoss } = render(
      <MovieRoiWidget label="Film" movie={{ ...movie, roi: -100 }} />,
    );
    expect(screen.getByRole('article').textContent).toContain('-100,00 % ROI');
    unmountLoss();
    const { unmount: unmountZero } = render(
      <MovieRoiWidget label="Film" movie={{ ...movie, roi: 0 }} />,
    );
    expect(screen.getByRole('article').textContent).toContain('0,00 % ROI');
    unmountZero();
    render(<MovieRoiWidget label="Film" movie={{ ...movie, roi: null }} />);

    // Assert: a missing return is not a return of 0 %.
    expect(screen.getByText('Aucune donnée disponible')).toBeTruthy();
    expect(screen.getByRole('article').textContent).not.toContain('0,00');
  });
});
