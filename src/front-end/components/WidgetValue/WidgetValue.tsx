import './WidgetValue.css';

export interface WidgetValueProps {
  /** The value, already formatted for display (e.g. "1000" or "6,78"). */
  value: string;
  /** The unit written after the value (e.g. "films", "min" or "/ 10"). */
  unit: string;
  /**
   * How assistive technologies read the unit, when it is abbreviated or is a
   * symbol: "minutes" for "min", "sur 10" for "/ 10". The unit is written as
   * is on screen and this text is read instead. Omit it when the unit reads
   * well as it is.
   */
  unitLabel?: string;
}

/**
 * A value and its unit, written the same way by every widget of the
 * dashboard: the value large and bold, the unit small after it.
 */
export default function WidgetValue({
  value,
  unit,
  unitLabel,
}: WidgetValueProps) {
  return (
    <p className="widget-value">
      <span className="widget-value-number">{value}</span>{' '}
      {unitLabel ? (
        <>
          <span className="widget-value-unit" aria-hidden="true">
            {unit}
          </span>
          <span className="visually-hidden">{unitLabel}</span>
        </>
      ) : (
        <span className="widget-value-unit">{unit}</span>
      )}
    </p>
  );
}
