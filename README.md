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

### Importer des films depuis un CSV

Le module `src/back-end/database/movie-csv.ts` importe les films d'un fichier CSV dans la base. Un exemple de trois films fictifs est fourni dans [data/movies.csv](data/movies.csv).

L'en-tête doit contenir les colonnes obligatoires `id`, `title`, `original_title` et `original_language`, et peut ajouter n'importe quelle colonne facultative : `overview`, `release_date`, `popularity`, `vote_average`, `vote_count`, `poster_path`, `backdrop_path`, `runtime_minutes`, `budget`, `revenue` et `collected_at`. Les colonnes peuvent être dans n'importe quel ordre et sans distinction de casse ; une colonne manquante parmi les obligatoires, inconnue ou répétée provoque une erreur qui les signale toutes.

```csv
id,title,original_title,original_language,release_date,runtime_minutes,budget
900001,Le Voyage imaginaire,The Imaginary Journey,en,2019-05-30,133,11000000
```

| Colonne                                        | Règle                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                           | Entier positif : l'identifiant TMDB du film.                                                                                                                |
| `title`, `original_title`, `original_language` | Texte non vide.                                                                                                                                             |
| `overview`                                     | Texte, éventuellement vide.                                                                                                                                 |
| `release_date`                                 | Date réelle au format `AAAA-MM-JJ` (`2023-02-29` est refusée), ou vide si inconnue.                                                                         |
| `popularity`                                   | Nombre supérieur ou égal à 0, ou vide.                                                                                                                      |
| `vote_average`                                 | Nombre de 0 à 10, ou vide.                                                                                                                                  |
| `vote_count`                                   | Entier supérieur ou égal à 0, ou vide.                                                                                                                      |
| `poster_path`, `backdrop_path`                 | Chemin de l'image, ou vide.                                                                                                                                 |
| `runtime_minutes`, `budget`, `revenue`         | Entier positif, ou vide. La valeur `0`, que TMDB utilise pour un champ inconnu, est lue comme inconnue.                                                     |
| `collected_at`                                 | Date ou date et heure ISO 8601 avec fuseau (`2026-11-03T10:00:00Z`, `…+01:00`), enregistrée en UTC. Si elle est absente ou vide, c'est l'heure de l'import. |

Les nombres sont des nombres décimaux simples : l'écriture avec exposant (`1e3`), hexadécimale ou `Infinity` est refusée. Le parseur accepte les fins de ligne LF et CRLF, le BOM UTF-8, les espaces autour des valeurs, les virgules dans les champs entre guillemets et les guillemets échappés ; les lignes vides sont ignorées, et un fichier qui ne contient que l'en-tête n'importe aucun film. Une valeur vide est inconnue (`null`).

Toute erreur (fichier introuvable, en-tête invalide, valeur invalide, guillemet mal fermé) lève une `MovieCsvError` qui indique la colonne, la valeur et la ligne concernées.

```ts
import { getDatabase } from './src/back-end/database/schema.ts';
import { importMoviesCsv } from './src/back-end/database/movie-csv.ts';

const database = getDatabase();
console.log(importMoviesCsv(database, './data/movies.csv')); // 3
database.close();
```

`importMoviesCsv(database, filePath)` valide **tout** le fichier avant d'écrire quoi que ce soit, puis enregistre les films avec `upsertMovies` dans un seul groupe d'écritures : si l'une d'elles échoue, aucun film n'est importé. Les films nouveaux sont insérés et les films existants, identifiés par leur `id`, sont actualisés sans doublon. La fonction renvoie le nombre de films distincts importés (un film répété dans le fichier compte une fois, avec sa dernière version).

Un film importé **remplace** le film enregistré : une colonne absente du CSV remet la valeur correspondante à « inconnue ». Ses genres et ses pays de production sont, eux, conservés.

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
