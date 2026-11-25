import type { ReactNode } from 'react';
import './WidgetName.css';

export interface WidgetNameProps {
  /** The name to write, such as the name of a country or of a genre. */
  children: ReactNode;
}

/**
 * A name in a widget of the dashboard, such as the name of a country or of a
 * genre: written in bold under the label of the widget. A long name wraps on
 * several lines instead of being cut, even when it has no space.
 */
export default function WidgetName({ children }: WidgetNameProps) {
  return <p className="widget-name">{children}</p>;
}
