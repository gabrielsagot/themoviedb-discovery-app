// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import WidgetCard from './WidgetCard';

afterEach(cleanup);

describe('WidgetCard', () => {
  it('names the card after its label', () => {
    // Arrange and act
    render(<WidgetCard label="Films en base">Contenu</WidgetCard>);

    // Assert: the card is an article named by its heading.
    expect(screen.getByRole('article', { name: 'Films en base' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Films en base' }),
    ).toBeTruthy();
  });

  it('gives each card its own heading id', () => {
    // Arrange and act
    render(
      <>
        <WidgetCard label="Premier" />
        <WidgetCard label="Second" />
      </>,
    );

    // Assert: both cards stay named after their own label.
    expect(screen.getByRole('article', { name: 'Premier' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Second' })).toBeTruthy();
  });

  describe('ready', () => {
    it('shows its content by default', () => {
      // Arrange and act
      render(<WidgetCard label="Films en base">Contenu du widget</WidgetCard>);

      // Assert
      const card = screen.getByRole('article');
      expect(card.textContent).toContain('Contenu du widget');
      expect(card.getAttribute('aria-busy')).toBe('false');
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('loading', () => {
    it('shows a placeholder instead of its content and is marked busy', () => {
      // Arrange and act
      render(
        <WidgetCard label="Films en base" status="loading">
          Contenu du widget
        </WidgetCard>,
      );

      // Assert: the card is busy, announces the loading, and hides its content.
      const card = screen.getByRole('article');
      expect(card.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByRole('status').textContent).toBe(
        'Chargement en cours',
      );
      expect(card.textContent).not.toContain('Contenu du widget');
      expect(
        card
          .querySelector('.widget-card-skeleton')
          ?.getAttribute('aria-hidden'),
      ).toBe('true');
    });
  });

  describe('empty', () => {
    it('explains that there is no data instead of showing its content', () => {
      // Arrange and act
      render(
        <WidgetCard label="Films en base" status="empty">
          Contenu du widget
        </WidgetCard>,
      );

      // Assert
      const card = screen.getByRole('article');
      expect(card.textContent).toContain('Aucune donnée disponible');
      expect(card.textContent).not.toContain('Contenu du widget');
      expect(card.getAttribute('aria-busy')).toBe('false');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('error', () => {
    it('announces that the data is unavailable instead of showing its content', () => {
      // Arrange and act
      render(
        <WidgetCard label="Films en base" status="error">
          Contenu du widget
        </WidgetCard>,
      );

      // Assert: the error is announced as an alert.
      expect(screen.getByRole('alert').textContent).toBe(
        'Les données sont indisponibles',
      );
      expect(screen.getByRole('article').textContent).not.toContain(
        'Contenu du widget',
      );
    });
  });
});
