# themoviedb-discovery-app

Application web de découverte de films qui s'appuie sur l'API de [The Movie Database (TMDB)](https://www.themoviedb.org/). Elle affiche les films populaires en France et permet de consulter leur fiche détaillée.

## Fonctionnalités

- Liste des films populaires, avec pagination et paramètres de langue et de région.
- Fiche détaillée pour chaque film.
- Pages « À propos » et « Page introuvable ».
- Thème clair ou sombre, conservé dans le navigateur.
- API Express intermédiaire pour appeler TMDB sans exposer le jeton dans le navigateur.

Les paramètres par défaut sont la langue `fr-FR`, la région `FR` et la première page.

## Prérequis

- Node.js 24 (version indiquée dans `.nvmrc`).
- npm.
- Un jeton d'accès à l'API TMDB. Vous pouvez en obtenir un depuis les paramètres de votre compte TMDB, dans la section API.

## Installation et démarrage

1. Installez les dépendances :

   ```sh
   npm install
   ```

2. Créez un fichier `.env` à la racine du projet et ajoutez votre jeton d'accès :

   ```dotenv
   TMDB_ACCESS_TOKEN=votre_jeton_d_acces_tmdb
   ```

   Gardez ce jeton privé et ne le publiez pas dans le dépôt.

3. Démarrez le serveur et l'application :

   ```sh
   npm run dev
   ```

4. Ouvrez [http://localhost:5173](http://localhost:5173).

Le serveur Express écoute sur le port `3000`. Vite sert l'interface sur le port `5173` et transmet les requêtes `/api` au serveur Express.

## Création de la base de données

Le modèle de données (dictionnaire, règles de gestion, MCD, schéma relationnel et contraintes d'intégrité) est décrit dans [docs/dashboard-01-modele-donnees.md](docs/dashboard-01-modele-donnees.md).

Après l'installation des dépendances, créez et initialisez la base SQLite avec le CLI du backend. Sans commande, le CLI crée la base par défaut `data/movies.sqlite` :

```sh
node src/back-end/backend-cli.ts
```

L'option globale `--path` (ou `-p`) sélectionne un autre fichier SQLite ; les dossiers manquants sont créés :

```sh
node src/back-end/backend-cli.ts --path ./data/custom-movies.sqlite
```

La commande explicite `create-database` est équivalente et accepte `--path` avant ou après son nom :

```sh
node src/back-end/backend-cli.ts create-database --path ./data/custom-movies.sqlite
```

L'initialisation est transactionnelle : elle crée les tables manquantes sans supprimer les données d'une base existante, et une erreur annule toutes les modifications.

Le schéma contient les tables `movies`, `genres`, `countries`, `movie_genres` et `production_countries`. L'année de sortie `release_year` est calculée automatiquement à partir d'une date `release_date` complète (`AAAA-MM-JJ`) et reste vide sinon ; les durées, budgets et recettes renseignés doivent être strictement positifs.

### Gestion des genres

Le module `src/back-end/database/genre-repository.ts` lit et écrit les genres de la base. Un genre (type `Genre`) est identifié par son code TMDB `id` et porte un libellé `name`.

| Fonction                         | Rôle                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `findGenreById(database, id)`    | Renvoie le genre correspondant, ou `undefined` s'il n'existe pas.                       |
| `listGenres(database)`           | Renvoie tous les genres, triés par identifiant croissant.                               |
| `upsertGenres(database, genres)` | Insère les nouveaux genres et met à jour le libellé des genres existants, sans doublon. |
| `deleteUnusedGenres(database)`   | Supprime les genres associés à aucun film et renvoie leur nombre.                       |

`upsertGenres` accepte n'importe quel itérable (tableau, `Set`, valeurs d'une `Map`, générateur). Un itérable vide ne modifie rien ; si un identifiant apparaît plusieurs fois, le dernier libellé est conservé. Les écritures sont groupées : si un genre est invalide (nom manquant), aucun genre du lot n'est enregistré et l'erreur est propagée.

```ts
import { getDatabase } from './src/back-end/database/schema.ts';
import {
  listGenres,
  upsertGenres,
} from './src/back-end/database/genre-repository.ts';

const database = getDatabase();
upsertGenres(database, [
  { id: 35, name: 'Comédie' },
  { id: 12, name: 'Aventure' },
]);
console.log(listGenres(database)); // [{ id: 12, name: 'Aventure' }, { id: 35, name: 'Comédie' }]
database.close();
```

### Importer et nettoyer les genres

Le fichier CSV contient exactement les colonnes `id` et `name`, dans n'importe quel ordre et sans distinction de casse. Un exemple avec les 19 genres TMDB en français est fourni dans [data/genres.csv](data/genres.csv) :

```csv
id,name
12,Aventure
35,Comédie
878,Science-Fiction
```

Le parseur accepte les fins de ligne LF et CRLF, le BOM UTF-8, les virgules dans les champs entre guillemets (`"Familial, jeunesse"`) et les guillemets échappés (`""`) ; les lignes vides sont ignorées. Les identifiants doivent être des entiers positifs et les noms ne peuvent pas être vides.

Importer ou actualiser les genres, dans la base par défaut ou celle choisie avec `--path` :

```sh
node src/back-end/backend-cli.ts add-genres ./data/genres.csv
node src/back-end/backend-cli.ts --path ./data/custom-movies.sqlite add-genres ./data/genres.csv
```

Le CSV est entièrement validé avant l'ouverture de la base, puis importé dans une seule transaction : un genre existant voit son libellé mis à jour, sans doublon, et en cas d'erreur aucun genre n'est enregistré. La commande affiche le nombre de genres importés et le chemin de la base.

Supprimer les genres associés à aucun film (ceux utilisés par au moins un film sont conservés) :

```sh
node src/back-end/backend-cli.ts clean-genres
node src/back-end/backend-cli.ts --path ./data/custom-movies.sqlite clean-genres
```

En cas d'erreur (fichier introuvable, en-tête ou valeur invalide, échec d'écriture), le CLI affiche `error: <message>` sur la sortie d'erreur et se termine avec le code 1.

### Gestion des pays

Le module `src/back-end/database/country-repository.ts` lit et écrit les pays de production de la base. Un pays (type `Country`) est identifié par son code ISO 3166-1 alpha-2 `code` (par exemple `FR`) et porte un libellé `name`.

| Fonction                               | Rôle                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `findCountryByCode(database, code)`    | Renvoie le pays correspondant, ou `undefined` s'il n'existe pas.                    |
| `listCountries(database)`              | Renvoie tous les pays, triés par code croissant (liste vide si aucun pays).         |
| `upsertCountries(database, countries)` | Insère les nouveaux pays et met à jour le libellé des pays existants, sans doublon. |

`upsertCountries` accepte n'importe quel itérable (tableau, `Set`, valeurs d'une `Map`, générateur). Un itérable vide ne modifie rien ; si un code apparaît plusieurs fois, le dernier libellé est conservé. Les écritures sont groupées : si un pays est invalide (nom manquant), aucun pays du lot n'est enregistré et l'erreur est propagée.

```ts
import { getDatabase } from './src/back-end/database/schema.ts';
import {
  listCountries,
  upsertCountries,
} from './src/back-end/database/country-repository.ts';

const database = getDatabase();
upsertCountries(database, [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
]);
console.log(listCountries(database)); // [{ code: 'BE', name: 'Belgique' }, { code: 'FR', name: 'France' }]
database.close();
```

### Gestion des films

Le module `src/back-end/database/movie-repository.ts` lit et écrit les films de la base. Un film (type `StoredMovie`, à ne pas confondre avec le type `Movie` des réponses de l'API TMDB) est identifié par son identifiant TMDB `id`. Une valeur inconnue (absente chez TMDB, ou égale à zéro pour la durée, le budget et les recettes) vaut `null`.

| Fonction                         | Rôle                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `findMovieById(database, id)`    | Renvoie le film correspondant, ou `undefined` s'il n'existe pas.                    |
| `listMovies(database)`           | Renvoie tous les films, triés par identifiant croissant (liste vide si aucun film). |
| `upsertMovies(database, movies)` | Insère les nouveaux films et actualise les films existants, sans doublon.           |

`upsertMovies` accepte n'importe quel itérable (tableau, `Set`, valeurs d'une `Map`, générateur) de `MovieInput`, c'est-à-dire un film sans `release_year`. Cette année de sortie est calculée par la base à partir de `release_date` et n'est jamais écrite directement.

- Un film existant est **actualisé sur place** (`INSERT … ON CONFLICT DO UPDATE`) : ses genres et ses pays de production sont conservés. `INSERT OR REPLACE` supprimerait la ligne avant de la recréer, et la suppression en cascade effacerait ces associations.
- Les autres films, y compris ceux des autres années, ne sont pas modifiés.
- Un itérable vide ne modifie rien ; si un identifiant apparaît plusieurs fois, la dernière version est conservée.
- Les écritures sont groupées : si un film est invalide (titre manquant, durée, budget ou recettes négatifs ou nuls), aucun film du lot n'est enregistré et l'erreur est propagée, y compris dans une transaction ouverte par l'appelant.

```ts
import { getDatabase } from './src/back-end/database/schema.ts';
import {
  findMovieById,
  upsertMovies,
} from './src/back-end/database/movie-repository.ts';

const database = getDatabase();
upsertMovies(database, [
  {
    id: 1,
    title: 'Le Voyage imaginaire',
    original_title: 'The Imaginary Journey',
    original_language: 'en',
    overview: 'Un film fictif.',
    release_date: '2019-05-30',
    popularity: 87.5,
    vote_average: 8.5,
    vote_count: 18000,
    poster_path: null,
    backdrop_path: null,
    runtime_minutes: 133,
    budget: null,
    revenue: null,
    collected_at: new Date().toISOString(),
  },
]);
console.log(findMovieById(database, 1)?.release_year); // 2019
database.close();
```

Les genres et les pays d'un film sont gérés à part, par leurs propres modules et les tables `movie_genres` et `production_countries`.

### Mettre à jour la base depuis TMDB

Le service `src/back-end/services/tmdb-sync-service.ts` alimente et actualise la base à partir de l'API TMDB : le catalogue des genres, celui des pays, puis un **échantillon** des films de chaque année de sortie, avec leurs genres et leurs pays.

```ts
import { getDatabase } from './src/back-end/database/schema.ts';
import { createTmdbClient } from './src/back-end/services/tmdb-client.ts';
import { updateDatabaseFromTmdb } from './src/back-end/services/tmdb-sync-service.ts';
import { tmdbAccessToken } from './src/back-end/utils/config.ts';

const database = getDatabase();
const summary = await updateDatabaseFromTmdb(
  database,
  createTmdbClient(tmdbAccessToken),
  { years: [2022, 2023, 2024], moviesPerYear: 100 },
);
console.log(summary); // { genres: 19, countries: 249, movies: 300, failures: [] }
database.close();
```

| Option          | Défaut          | Description                                                              |
| --------------- | --------------- | ------------------------------------------------------------------------ |
| `years`         | obligatoire     | Années de sortie à collecter : entiers de `1000` à `9999`.               |
| `moviesPerYear` | `100`           | Nombre maximal de films collectés par année, du plus populaire au moins. |
| `language`      | `fr-FR`         | Langue des titres, résumés et noms de genres.                            |
| `now`           | horloge système | Horloge qui donne la date d'observation (`collected_at`) de chaque film. |

Les options sont vérifiées avant toute requête (une `RangeError` explicite sinon). La fonction renvoie un bilan : nombre de genres et de pays reçus, nombre de films enregistrés et liste des `failures`.

Déroulement :

1. les genres (`GET /3/genre/movie/list`) puis les pays (`GET /3/configuration/countries`) sont insérés ou renommés ;
2. pour chaque année, TMDB Discover (`GET /3/discover/movie`, filtre `primary_release_year`, du plus populaire au moins) est lu page par page jusqu'à `moviesPerYear` films, sans jamais dépasser la page 500 que TMDB accepte ; un film présent sur deux pages n'est compté qu'une fois ;
3. la fiche de chaque film (`GET /3/movie/{id}`) est lue puis enregistrée avec ses genres et ses pays.

Règles du modèle de données appliquées au passage :

- une date de sortie vide, absente ou impossible devient inconnue (`null`) ;
- une durée, un budget ou des recettes égaux à `0` deviennent inconnus ; une popularité, une note ou un nombre de votes égaux à `0` sont conservés, mais absents ils restent inconnus ;
- les noms de pays sont en anglais (`France`, `Germany`), comme dans les fiches des films, pour qu'une mise à jour du catalogue et une mise à jour d'un film ne se renomment jamais l'une l'autre.

**Actualisation** : relancer la mise à jour ne crée aucun doublon. Un film déjà présent est actualisé sur place, ses genres et ses pays sont **remplacés** par ceux de TMDB (ceux qu'il n'a plus sont détachés, les nouveaux rattachés), et les films des autres années ne sont pas touchés. Chaque film est écrit dans un groupe d'écritures avec ses genres et ses pays : si l'écriture échoue, rien de ce film n'est conservé.

**Erreurs** : un film qui ne peut pas être lu (par exemple un `404`) ou enregistré est signalé dans `failures` (`{ movieId, message }`) et les autres sont traités. Trois cas arrêtent en revanche toute la mise à jour : un jeton refusé par TMDB (`401`, car tous les autres films échoueraient aussi), l'échec d'un catalogue et l'échec de TMDB Discover.

Le client TMDB (`createTmdbClient`) n'est qu'une des implémentations de `TmdbSource`, l'interface de lecture que le service utilise : les tests la remplacent par une fausse source et n'ont besoin ni du réseau ni d'un jeton. Le jeton n'est envoyé qu'à TMDB, dans l'en-tête `Authorization`, jamais dans l'adresse.

Les fonctions `replaceMovieGenres` et `replaceMovieCountries` (`src/back-end/database/movie-associations.ts`) remplacent les genres ou les pays d'un film par ceux donnés.

## API locale

| Méthode | Route                 | Description                                                       |
| ------- | --------------------- | ----------------------------------------------------------------- |
| `GET`   | `/api/health`         | Vérifie que le serveur répond.                                    |
| `GET`   | `/api/movies/popular` | Renvoie les films populaires.                                     |
| `GET`   | `/api/movies/:id`     | Renvoie les détails du film correspondant à son identifiant TMDB. |

Les routes des films acceptent les paramètres `language`, `page` et `region`. Exemple :

```text
/api/movies/popular?language=fr-FR&page=1&region=FR
```

## Vérifications

```sh
npm test          # Lance les tests avec la couverture
npm run test:verbose
npm run lint      # Vérifie le code
npm run fmt:check # Vérifie le formatage
```

La configuration de couverture des tests exige 100 % pour les instructions, branches, fonctions et lignes.
