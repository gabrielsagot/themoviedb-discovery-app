// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DashboardPage from './DashboardPage';

afterEach(cleanup);

describe('DashboardPage', () => {
  it('renders the dashboard page with its title and introduction', () => {
    // Arrange and act: render the page, which has no widget yet.
    render(<DashboardPage />);

    // Assert: the page landmark, its title and its introduction are shown.
    expect(screen.getByRole('main')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tableau de bord des films',
      }),
    ).toBeTruthy();
    expect(screen.getByText('TMDB Discovery')).toBeTruthy();
    expect(screen.getByText(/Explorez les données du catalogue/)).toBeTruthy();
  });

  it('shows the Films and Genres sections of the mock-up in order', () => {
    // Arrange and act
    render(<DashboardPage />);

    // Assert: each section is a named region with its heading and subtitle.
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Films', 'Genres']);

    const films = screen.getByRole('region', { name: 'Films' });
    expect(
      within(films).getByText(
        'Les films qui se distinguent dans notre catalogue',
      ),
    ).toBeTruthy();

    const genres = screen.getByRole('region', { name: 'Genres' });
    expect(
      within(genres).getByText('Les tendances de notre catalogue'),
    ).toBeTruthy();
  });

  it('is accessible without any widget: each section explains it is empty', () => {
    // Arrange and act
    render(<DashboardPage />);

    // Assert: every section shows the empty state instead of widgets.
    for (const name of ['Films', 'Genres']) {
      expect(
        within(screen.getByRole('region', { name })).getByText(
          "Aucun widget n'est encore configuré pour cette section.",
        ),
      ).toBeTruthy();
    }
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });
});
