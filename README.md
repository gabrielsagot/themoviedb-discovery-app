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
| `deleteUnusedCountries(database)`      | Supprime les pays associés à aucun film et renvoie leur nombre.                     |

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

### Importer et nettoyer les pays

Le fichier CSV contient exactement les colonnes `code` et `name`, dans n'importe quel ordre et sans distinction de casse. Les codes sont au format ISO 3166-1 alpha-2 : exactement deux lettres majuscules (`FR`, `GB`, `US`). Un exemple avec 30 pays de production courants est fourni dans [data/countries.csv](data/countries.csv) :

```csv
code,name
FR,France
GB,Royaume-Uni
US,États-Unis
```

Le parseur accepte les fins de ligne LF et CRLF, le BOM UTF-8, les espaces autour des valeurs, les virgules dans les champs entre guillemets et les guillemets échappés ; les lignes vides sont ignorées et un fichier ne contenant que l'en-tête n'importe aucun pays. Un code en minuscules (`fr`), de trois lettres (`FRA`) ou un nom vide provoquent une erreur qui indique la ligne concernée.

Importer ou actualiser les pays, dans la base par défaut ou celle choisie avec `--path` :

```sh
node src/back-end/backend-cli.ts add-countries ./data/countries.csv
node src/back-end/backend-cli.ts --path ./data/custom-movies.sqlite add-countries ./data/countries.csv
```

Comme pour les genres, le CSV est entièrement validé avant l'ouverture de la base, puis importé dans une seule transaction : un pays existant voit son libellé mis à jour, sans doublon, et en cas d'erreur aucun pays n'est enregistré. La commande affiche le nombre de pays importés et le chemin de la base.

Supprimer les pays associés à aucun film dans `production_countries` (ceux utilisés par au moins un film sont conservés) :

```sh
node src/back-end/backend-cli.ts clean-countries
node src/back-end/backend-cli.ts --path ./data/custom-movies.sqlite clean-countries
```

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
