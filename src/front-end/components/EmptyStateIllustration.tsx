/**
 * The empty-search-results illustration: a spotlight sweeping an empty
 * stage, a magnifying glass finding nothing where the light lands, and a
 * film reel that's rolled off to one side, trailing its unspooled strip.
 * Pure inline SVG using the app's own CSS variables (no image assets),
 * so it stays in the app's palette and adapts automatically to dark mode.
 */
export default function EmptyStateIllustration() {
  return (
    <svg className="empty-state__art" viewBox="0 0 280 210" aria-hidden="true">
      <defs>
        <linearGradient id="empty-state-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id="empty-state-pool" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.24" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        cx="140"
        cy="176"
        rx="118"
        ry="10"
        fill="var(--border)"
        opacity="0.35"
      />

      <path d="M140 4 L58 160 L96 160 Z" fill="var(--accent)" opacity="0.06" />
      <path
        d="M140 4 L184 160 L222 160 Z"
        fill="var(--accent)"
        opacity="0.06"
      />
      <path d="M140 4 L78 160 L202 160 Z" fill="url(#empty-state-beam)" />
      <ellipse
        cx="140"
        cy="160"
        rx="64"
        ry="14"
        fill="url(#empty-state-pool)"
      />
      <ellipse
        cx="140"
        cy="160"
        rx="64"
        ry="14"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.2"
        strokeWidth="1.5"
      />

      <path
        d="M36 56 l3.5 8 8 3.5 -8 3.5 -3.5 8 -3.5 -8 -8 -3.5 8 -3.5 Z"
        fill="var(--accent)"
        opacity="0.55"
      />
      <path
        d="M238 38 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"
        fill="var(--accent)"
        opacity="0.45"
      />
      <path
        d="M212 138 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z"
        fill="var(--accent)"
        opacity="0.5"
      />
      <circle cx="54" cy="108" r="2.5" fill="var(--accent)" opacity="0.45" />
      <circle cx="230" cy="90" r="3" fill="var(--accent)" opacity="0.4" />
      <circle cx="96" cy="34" r="2" fill="var(--accent)" opacity="0.35" />

      <g transform="translate(218 62) rotate(14)">
        <rect
          x="-9"
          y="-6.5"
          width="18"
          height="13"
          rx="2.5"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="1.6"
        />
        <path
          d="M-3.5 -6.5 v13 M3.5 -6.5 v13"
          stroke="var(--text-secondary)"
          strokeWidth="1.2"
        />
      </g>

      <g transform="rotate(-12 140 134)">
        <circle
          cx="132"
          cy="124"
          r="23"
          fill="var(--surface)"
          stroke="var(--text-secondary)"
          strokeWidth="3.5"
        />
        <path
          d="M148 140 L166 158"
          stroke="var(--text-secondary)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M119 112 a15 15 0 0 1 18 -7"
          stroke="var(--border)"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M56 178 q24 8 42 -6 q16 -12 40 -4 q18 6 34 -4"
        fill="none"
        stroke="var(--border)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g transform="translate(96 168) rotate(4)">
        <rect
          x="-7"
          y="-5"
          width="14"
          height="10"
          rx="2"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.4"
        />
      </g>
      <g transform="translate(122 173) rotate(-6)">
        <rect
          x="-7"
          y="-5"
          width="14"
          height="10"
          rx="2"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.4"
        />
      </g>
      <g transform="translate(46 178)">
        <circle
          r="21"
          fill="var(--surface)"
          stroke="var(--text-secondary)"
          strokeWidth="2.5"
        />
        <circle
          r="6"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2.2"
        />
        <circle
          cx="10.5"
          cy="-7"
          r="3.6"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.8"
        />
        <circle
          cx="-10.5"
          cy="-7"
          r="3.6"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.8"
        />
        <circle
          cx="10.5"
          cy="9"
          r="3.6"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.8"
        />
        <circle
          cx="-10.5"
          cy="9"
          r="3.6"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.8"
        />
        <circle
          cx="0"
          cy="13"
          r="3.6"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.8"
        />
      </g>
    </svg>
  );
}
