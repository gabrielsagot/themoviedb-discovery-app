// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import WidgetName from './WidgetName';

afterEach(cleanup);

describe('WidgetName', () => {
  it('writes the name it is given', () => {
    // Arrange and act
    render(<WidgetName>Drame</WidgetName>);

    // Assert
    expect(screen.getByText('Drame').className).toBe('widget-name');
  });

  it('keeps a long name in full, so that it can wrap instead of being cut', () => {
    // Arrange
    const name = 'Saint-Vincent-et-les-Grenadines-Saint-Christophe-et-Niévès';

    // Act
    render(<WidgetName>{name}</WidgetName>);

    // Assert: the whole name is in the page, in the element that wraps.
    expect(screen.getByText(name).className).toBe('widget-name');
  });
});
