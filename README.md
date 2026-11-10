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

| Méthode | Route                 | Description                                                       |
| ------- | --------------------- | ----------------------------------------------------------------- |
| `GET`   | `/api/health`         | Vérifie que le serveur répond.                                    |
| `GET`   | `/api/movies/popular` | Renvoie les films populaires.                                     |
| `GET`   | `/api/movies/:id`     | Renvoie les détails du film correspondant à son identifiant TMDB. |

Les routes des films acceptent les paramètres `language`, `page` et `region`. Exemple :

```text
/api/movies/popular?language=fr-FR&page=1&region=FR
```

## Storybook

Storybook présente les composants du tableau de bord **isolément et dans tous leurs états**, sans API ni base de données : il sert à développer un widget, à le valider visuellement et à documenter ses propriétés.

```sh
npm run storybook
```

Storybook s'ouvre sur [http://localhost:6006](http://localhost:6006). Pour le construire sans le lancer, comme le fait la CI (job `storybook-build`) :

```sh
npm run build-storybook
```

Le résultat est écrit dans `storybook-static/`, ignoré par git.

- **Où écrire une histoire** : à côté du composant, dans `Composant/Composant.stories.tsx`. Storybook trouve aussi les pages de documentation `*.mdx` sous `src/front-end/`.
- **Une histoire par état** : nominal, chargement, absence de données, erreur. Déclarer le composant avec `tags: ['autodocs']` génère la documentation de ses propriétés.
- **Styles** : Storybook charge `global.css` et `app.css`, un widget y a donc l'apparence qu'il a dans l'application.
- **Barre d'outils** : le sélecteur **Thème** bascule entre le thème clair et le thème sombre ; **Viewport size** simule un téléphone ou une tablette ; **Vision filter** simule des déficiences visuelles.
- **Accessibilité** : l'onglet **Accessibility**, en bas de l'écran, liste les problèmes détectés dans l'histoire affichée.
- La configuration est dans le dossier `.storybook/` (`main.ts` pour les histoires et les extensions, `preview.tsx` pour les styles et le sélecteur de thème). La page d'accueil de Storybook, `Introduction`, reprend ces explications.

### Les widgets du tableau de bord

Les widgets sont dans `src/front-end/components/`, chacun avec son composant, son style, ses histoires et ses tests. Dans Storybook, ils sont regroupés sous **Widgets**.

| Widget            | Composant                                       | Ce qu'il montre                                                           |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| « Films en base » | `MoviesCountWidget/MoviesCountWidget.tsx`       | Le nombre de films de la base, avec la période de leurs années de sortie. |
| « Durée moyenne » | `AverageRuntimeWidget/AverageRuntimeWidget.tsx` | La durée moyenne des films, en minutes.                                   |
| « Note moyenne »  | `AverageRatingWidget/AverageRatingWidget.tsx`   | La note moyenne simple des films, sur 10, avec deux décimales.            |

Tous les widgets s'appuient sur `WidgetCard`, la carte commune : un titre (`h3`), puis le contenu du widget, ou un message ou un espace réservé quand il n'y en a pas. Elle gère les quatre états :

| État      | Ce que l'on voit                                                  | Pour les technologies d'assistance                                             |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ready`   | Le contenu du widget.                                             | La carte est un `article` nommé par son titre.                                 |
| `loading` | Un espace réservé animé (immobile si l'on réduit les animations). | La carte est marquée occupée (`aria-busy`) et annonce « Chargement en cours ». |
| `empty`   | « Aucune donnée disponible ».                                     | Texte lisible dans la carte.                                                   |
| `error`   | « Les données sont indisponibles ».                               | Annoncé comme une alerte (`role="alert"`).                                     |

Les widgets qui montrent un nombre et son unité utilisent aussi `WidgetValue` : le nombre en grand, l'unité en petit juste après. Il reçoit la valeur **déjà formatée** (la mise en forme française reste dans chaque widget) et, quand l'unité est une abréviation ou un symbole, un `unitLabel` que les technologies d'assistance lisent à la place : « min » est lu « minutes », et « / 10 » est lu « sur 10 ».

Le texte réservé aux technologies d'assistance utilise la classe globale `visually-hidden` (`global.css`).

Les widgets ne calculent pas leurs données : ils reçoivent une valeur **déjà calculée** et l'affichent. Un widget valide ce qu'il reçoit : une valeur absente ou impossible donne l'état `empty`, jamais un `0` inventé. Par exemple, « Durée moyenne » affiche « aucune donnée » pour une moyenne inférieure à 1 minute, car le modèle de données traite une durée de 0 comme inconnue.

Pour ajouter un widget : créer son composant autour de `WidgetCard`, ses histoires (une par état, avec `tags: ['autodocs']`), puis ses tests. Les tests chargent les histoires avec `composeStories` de `@storybook/react-vite` : ils vérifient ainsi ce que Storybook affiche, et un état oublié dans les histoires est un état non testé. Un absent n'est jamais remplacé par `0` : `null` ou `undefined` donne l'état `empty`, alors qu'un vrai `0` est affiché.

## Vérifications

```sh
npm test          # Lance les tests avec la couverture
npm run test:verbose
npm run lint      # Vérifie le code
npm run fmt:check # Vérifie le formatage
```

La configuration de couverture des tests exige 100 % pour les instructions, branches, fonctions et lignes.
