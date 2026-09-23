// Langue par défaut pour les requêtes à l'API TMDB
export const DEFAULT_LANGUAGE = 'fr-FR';

// Page par défaut pour les requêtes à l'API TMDB
export const DEFAULT_PAGE = '1';

// Région par défaut pour les requêtes à l'API TMDB
export const DEFAULT_REGION = 'FR';

// Tri par défaut pour les requêtes discover/movie
export const DEFAULT_SORT_BY = 'popularity.desc';

// Nombre de votes minimum imposé quand le tri se fait par note, pour éviter
// qu'un film à 10/10 avec 3 votes ne remonte devant des films installés.
export const MIN_VOTE_COUNT_FOR_RATING_SORT = 200;

// Nombre de membres du casting renvoyés par la fiche film détaillée.
export const CAST_LIMIT = 12;

// Nombre de films similaires renvoyés par la fiche film détaillée.
export const SIMILAR_LIMIT = 6;

// Durée de vie du cache mémoire pour les réponses "films" (popular/discover,
// search, détail), en millisecondes.
export const MOVIES_CACHE_TTL_MS = 5 * 60 * 1000;

// Durée de vie du cache mémoire pour la liste des genres, en millisecondes.
export const GENRES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
