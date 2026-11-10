// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import WidgetValue from './WidgetValue';

afterEach(cleanup);

describe('WidgetValue', () => {
  it('shows the value and its unit', () => {
    // Arrange and act
    const { container } = render(<WidgetValue value="1000" unit="films" />);

    // Assert: the value is large, the unit is small, and they read in order.
    expect(container.textContent).toBe('1000 films');
    expect(container.querySelector('.widget-value-number')?.textContent).toBe(
      '1000',
    );
    expect(container.querySelector('.widget-value-unit')?.textContent).toBe(
      'films',
    );
  });

  it('reads a unit that is a symbol with its spoken label', () => {
    // Arrange and act
    const { container } = render(
      <WidgetValue value="6,78" unit="/ 10" unitLabel="sur 10" />,
    );

    // Assert: the unit stays on screen but is hidden from assistive
    // technologies, which read the label instead.
    const unit = container.querySelector('.widget-value-unit');
    expect(unit?.textContent).toBe('/ 10');
    expect(unit?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('sur 10').className).toBe('visually-hidden');
  });

  it('keeps the unit readable when it has no spoken label', () => {
    // Arrange and act
    const { container } = render(<WidgetValue value="2" unit="films" />);

    // Assert
    expect(
      container
        .querySelector('.widget-value-unit')
        ?.getAttribute('aria-hidden'),
    ).toBeNull();
    expect(container.querySelector('.visually-hidden')).toBeNull();
  });
});
