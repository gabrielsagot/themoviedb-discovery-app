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

## API locale

| Méthode | Route                  | Description                                                         |
| ------- | ---------------------- | ------------------------------------------------------------------- |
| `GET`   | `/api/health`          | Vérifie que le serveur répond.                                      |
| `GET`   | `/api/movies/popular`  | Renvoie les films populaires.                                       |
| `GET`   | `/api/movies/:id`      | Renvoie les détails du film correspondant à son identifiant TMDB.   |
| `GET`   | `/api/discover/movies` | Renvoie une page des films sortis une année donnée (TMDB Discover). |

Les routes des films acceptent les paramètres `language`, `page` et `region`. Exemple :

```text
/api/movies/popular?language=fr-FR&page=1&region=FR
```

### Films par année de sortie

`GET /api/discover/movies` interroge l'API TMDB Discover (`GET /3/discover/movie`) avec le filtre `primary_release_year` et renvoie **une seule page** de films sortis l'année demandée. La route ne parcourt pas automatiquement les autres pages, ne récupère pas le détail des films et n'écrit rien dans la base SQLite.

| Paramètre  | Obligatoire | Valeur par défaut | Description                                            |
| ---------- | ----------- | ----------------- | ------------------------------------------------------ |
| `year`     | Oui         | —                 | Année de sortie : quatre chiffres, de `1000` à `9999`. |
| `language` | Non         | `fr-FR`           | Langue des titres et résumés.                          |
| `page`     | Non         | `1`               | Page de résultats à consulter.                         |
| `region`   | Non         | `FR`              | Région utilisée par TMDB pour les dates de sortie.     |

Un paramètre optionnel vide, répété ou structuré reprend sa valeur par défaut. Exemples :

```text
/api/discover/movies?year=2020
/api/discover/movies?year=2020&language=en-US&page=2&region=US
```

La réponse conserve la pagination de TMDB ; chaque film est au même format que pour `/api/movies/popular` (sans les propriétés `adult` et `video`), et une année sans film renvoie une liste `results` vide :

```json
{
  "page": 2,
  "results": [
    { "id": 496243, "title": "Parasite", "release_date": "2019-05-30" }
  ],
  "total_pages": 12,
  "total_results": 231
}
```

Pour parcourir une année, appeler la route avec `page=1`, puis `page=2`, etc., jusqu'à `total_pages`.

Erreurs :

| Statut | Cas                                                                                                 | Corps de la réponse                        |
| ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `400`  | `year` absent, invalide, répété ou structuré (TMDB n'est pas appelé)                                | `{ "error": "<message explicite>" }`       |
| `500`  | Échec HTTP de TMDB, erreur réseau ou réponse JSON illisible (l'erreur est journalisée côté serveur) | `{ "error": "Failed to discover movies" }` |

Le jeton TMDB reste côté serveur : il n'est envoyé qu'à TMDB et n'apparaît jamais dans les réponses.

## Vérifications

```sh
npm test          # Lance les tests avec la couverture
npm run test:verbose
npm run lint      # Vérifie le code
npm run fmt:check # Vérifie le formatage
```

La configuration de couverture des tests exige 100 % pour les instructions, branches, fonctions et lignes.
