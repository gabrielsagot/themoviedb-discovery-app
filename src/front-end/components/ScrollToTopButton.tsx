import { useEffect, useState } from 'react';

const SHOW_AFTER_PX = 700;

/**
 * A small button that appears once the page is scrolled far enough to make
 * getting back to the top tedious — which happens quickly once a few extra
 * pages of movies have been loaded.
 */
export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > SHOW_AFTER_PX);
    };

    // Deferred rather than called straight away, so the effect itself never
    // sets state synchronously while still catching a page restored
    // mid-scroll by the browser.
    const initialCheck = window.setTimeout(handleScroll, 0);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleClick = () => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      className={`scroll-top${isVisible ? ' scroll-top--visible' : ''}`}
      onClick={handleClick}
      aria-label="Revenir en haut de la page"
      tabIndex={isVisible ? 0 : -1}
      aria-hidden={!isVisible}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 16V5M10 5L5 10M10 5l5 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
