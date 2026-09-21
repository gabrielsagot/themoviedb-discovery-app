type RatingRingProps = {
  /** TMDB vote_average, from 0 to 10. */
  value: number;
  /** TMDB vote_count, used to detect a movie with no votes yet. */
  voteCount: number;
  /** Outer diameter of the ring, in pixels. */
  size?: number;
  /** Stroke width of the ring, in pixels. */
  strokeWidth?: number;
};

type RatingTier = 'good' | 'mid' | 'low' | 'none';

const getRatingTier = (value: number, voteCount: number): RatingTier => {
  if (voteCount === 0) return 'none';
  if (value >= 7) return 'good';
  if (value >= 5) return 'mid';
  return 'low';
};

/**
 * A small circular progress ring showing a movie's rating out of 10, styled
 * after the rating badges used across TMDB and streaming platforms. The
 * ring's color reflects the rating tier (good / mid / low), and a movie
 * with no votes yet renders as a neutral, empty ring.
 */
export default function RatingRing({
  value,
  voteCount,
  size = 36,
  strokeWidth = 3,
}: RatingRingProps) {
  const tier = getRatingTier(value, voteCount);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = tier === 'none' ? 0 : Math.min(value, 10) / 10;
  const offset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <div
      className={`rating-ring rating-ring--${tier}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        tier === 'none'
          ? 'Pas encore de note'
          : `Note de ${value.toFixed(1)} sur 10`
      }
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="rating-ring__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        {tier !== 'none' && (
          <circle
            className="rating-ring__progress"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </svg>
      <span className="rating-ring__value" aria-hidden="true">
        {tier === 'none' ? '–' : value.toFixed(1)}
      </span>
    </div>
  );
}
