// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import NameCountWidget from './NameCountWidget';

afterEach(cleanup);

describe('NameCountWidget', () => {
  it('names the card with the label it is given', () => {
    // Arrange and act
    render(<NameCountWidget label="Élément en tête" name="Drame" count={3} />);

    // Assert: the label is the heading that names the whole card.
    expect(
      screen.getByRole('article', { name: 'Élément en tête' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Élément en tête' }),
    ).toBeTruthy();
  });

  it('shows the name and its count in the same way whatever the label', () => {
    // Arrange and act
    const { unmount } = render(
      <NameCountWidget label="A" name="Drame" count={322} />,
    );
    const first = screen.getByRole('article').textContent.replace('A', '');
    unmount();
    render(<NameCountWidget label="B" name="Drame" count={322} />);

    // Assert: only the label differs, the rules of the name and count are shared.
    expect(screen.getByRole('article').textContent.replace('B', '')).toBe(
      first,
    );
    expect(first).toBe('Drame322 films');
  });

  it.each([
    [322, '322 films'],
    [1, '1 film'],
    [1000, '1000 films'],
    [12345, '12 345 films'],
  ])('writes a count of %i as %s', (count, expected) => {
    // Arrange and act
    render(<NameCountWidget label="Genre" name="Drame" count={count} />);

    // Assert
    expect(screen.getByRole('article').textContent).toBe(
      `GenreDrame${expected}`,
    );
  });

  it('keeps the label in every state', () => {
    // Arrange and act
    const { unmount: unmountEmpty } = render(
      <NameCountWidget label="Genre" name={null} count={3} />,
    );
    expect(screen.getByRole('heading', { name: 'Genre' })).toBeTruthy();
    expect(screen.getByText('Aucune donnée disponible')).toBeTruthy();
    unmountEmpty();
    const { unmount: unmountLoading } = render(
      <NameCountWidget label="Genre" name="Drame" count={3} status="loading" />,
    );
    expect(screen.getByRole('heading', { name: 'Genre' })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    unmountLoading();
    render(
      <NameCountWidget label="Genre" name="Drame" count={3} status="error" />,
    );

    // Assert
    expect(screen.getByRole('heading', { name: 'Genre' })).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
