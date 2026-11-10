import { useId } from 'react';
import type { ReactNode } from 'react';
import './WidgetCard.css';

/**
 * What a widget currently shows:
 * - `ready`: its content;
 * - `loading`: a placeholder while the data is being fetched;
 * - `empty`: a message, because there is no data to show;
 * - `error`: a message, because the data could not be fetched.
 */
export type WidgetStatus = 'ready' | 'loading' | 'empty' | 'error';

/**
 * The states a widget receives from the code that fetches its data. The
 * `empty` state is not one of them: a widget decides it itself, when the data
 * it receives is missing or invalid.
 */
export type WidgetDataStatus = Exclude<WidgetStatus, 'empty'>;

export interface WidgetCardProps {
  /** The name of the widget, shown as its heading (e.g. "Films en base"). */
  label: string;
  /** What the widget shows; its content when `ready`. Defaults to `ready`. */
  status?: WidgetStatus;
  /** The content of the widget, shown only when its status is `ready`. */
  children?: ReactNode;
}

/**
 * The card shared by every widget of the dashboard: a label, then the
 * content of the widget, or a message or a placeholder when there is none.
 * Each state is announced to assistive technologies: a loading widget is
 * marked busy, an error is announced as an alert, and the heading names the
 * whole card.
 */
export default function WidgetCard({
  label,
  status = 'ready',
  children,
}: WidgetCardProps) {
  const labelId = useId();

  return (
    <article
      className="widget-card"
      aria-labelledby={labelId}
      aria-busy={status === 'loading'}
    >
      <h3 id={labelId} className="widget-card-label">
        {label}
      </h3>

      {status === 'ready' && children}

      {status === 'loading' && (
        <>
          <div className="widget-card-skeleton" aria-hidden="true" />
          <p className="visually-hidden" role="status">
            Chargement en cours
          </p>
        </>
      )}

      {status === 'empty' && (
        <p className="widget-card-message">Aucune donnée disponible</p>
      )}

      {status === 'error' && (
        <p
          className="widget-card-message widget-card-message-error"
          role="alert"
        >
          Les données sont indisponibles
        </p>
      )}
    </article>
  );
}
