import { useEffect, useMemo, useState } from 'react';
import type { Genre } from '../../back-end/schemas/MoviesTypes';
import { DEFAULT_LANGUAGE } from '../../back-end/constants';

/**
 * Loads the official TMDB genre list once and exposes it both as an array
 * (for the filter bar) and as an id -> name map (for the genre chips on a
 * movie). Failures are swallowed: genre labels are a nice-to-have, not
 * something worth surfacing an error state over, and the back-end caches
 * this list for a day anyway.
 * @param language The TMDB language to request the genre names in.
 */
export function useGenres(language: string = DEFAULT_LANGUAGE) {
  const [genres, setGenres] = useState<Genre[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/genres?language=${language}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.genres) setGenres(data.genres);
      })
      .catch(() => {
        /* genre labels are optional; the app works without them */
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const genreMap = useMemo(() => {
    if (!genres) return null;
    return new Map(genres.map((genre) => [genre.id, genre.name]));
  }, [genres]);

  return { genres, genreMap };
}
