type BrandMarkProps = {
  className?: string;
};

/**
 * The app's logo mark: a play triangle cut out of a solid badge, in
 * `currentColor`/`var(--bg)` so it adapts to whatever text color and
 * background it's placed on (topbar, 404 page, ...) without extra props.
 */
export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <path
        d="M25 20.5 L44.5 32 L25 43.5 Z"
        fill="var(--bg)"
        stroke="var(--bg)"
        strokeWidth="5.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
