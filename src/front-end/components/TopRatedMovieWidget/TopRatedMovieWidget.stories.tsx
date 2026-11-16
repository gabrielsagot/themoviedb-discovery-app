import type { Meta, StoryObj } from '@storybook/react-vite';
import TopRatedMovieWidget from './TopRatedMovieWidget';

// A poster drawn in the story itself, so that Storybook needs no network.
const demoPoster = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b4f8a"/><stop offset="1" stop-color="#e2a23b"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="120" r="46" fill="#fff" opacity=".85"/><rect x="40" y="210" width="120" height="14" rx="7" fill="#fff" opacity=".85"/><rect x="60" y="238" width="80" height="10" rx="5" fill="#fff" opacity=".6"/></svg>',
)}`;

// An address that holds no image: the browser cannot load it.
const brokenPoster = 'data:image/png;base64,AAAA';

const meta = {
  title: 'Widgets/Film le mieux noté',
  component: TopRatedMovieWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Le widget « Film le mieux noté » du tableau de bord : le film du catalogue avec la meilleure note, avec son affiche, son titre, son année de sortie et sa note sur 10. Il ne classe rien : le film est choisi en amont. Une affiche absente ou qui ne se charge pas est remplacée par un texte explicite, un titre long passe à la ligne, et une année inconnue est dite comme telle. Les films des exemples sont fictifs.',
      },
    },
  },
  // A widget fills one tile of the dashboard grid, it is not full width.
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    movie: {
      control: 'object',
      description:
        "Le film le mieux noté : `title`, `rating` (sur 10), et facultativement `year` (4 chiffres) et `posterUrl`. `null` ou `undefined` quand aucun film n'est noté.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    movie: {
      title: 'Le Phare des horizons',
      year: 2019,
      posterUrl: demoPoster,
      rating: 9.1,
    },
    status: 'ready',
  },
} satisfies Meta<typeof TopRatedMovieWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : une note de 9,1 / 10. */
export const Nominal: Story = {};

/** Sans affiche, un remplacement explicite prend sa place. */
export const MissingPoster: Story = {
  args: {
    movie: { title: 'Le Phare des horizons', year: 2019, rating: 9.1 },
  },
};

/** Une affiche qui ne se charge pas est remplacée de la même façon. */
export const BrokenPoster: Story = {
  args: {
    movie: {
      title: 'Le Phare des horizons',
      year: 2019,
      posterUrl: brokenPoster,
      rating: 9.1,
    },
  },
};

/** Un titre long passe à la ligne et reste lisible en entier. */
export const LongTitle: Story = {
  args: {
    movie: {
      title:
        "Le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse à travers les cinq continents",
      year: 2019,
      posterUrl: demoPoster,
      rating: 9.1,
    },
  },
};

/** Une année inconnue est dite comme telle, sans écrire « null » ni 0. */
export const UnknownYear: Story = {
  args: {
    movie: {
      title: 'Le Phare des horizons',
      year: null,
      posterUrl: demoPoster,
      rating: 9.1,
    },
  },
};

/** Une note entière garde une décimale : 9 s'écrit « 9,0 ». */
export const WholeRating: Story = {
  args: {
    movie: {
      title: 'Le Phare des horizons',
      year: 2019,
      posterUrl: demoPoster,
      rating: 9,
    },
  },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Aucun film n'est noté : le widget ne montre aucun film ni de note à 0. */
export const NoRatedMovie: Story = {
  args: { movie: null },
};

/** Les données n'ont pas pu être récupérées. */
export const ErrorState: Story = {
  args: { status: 'error' },
};

/** Le widget reste lisible sur l'écran d'un téléphone. */
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

/** Le widget dans le thème sombre. */
export const DarkTheme: Story = {
  globals: { theme: 'dark' },
};
