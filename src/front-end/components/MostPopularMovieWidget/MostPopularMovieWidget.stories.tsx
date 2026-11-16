import type { Meta, StoryObj } from '@storybook/react-vite';
import MostPopularMovieWidget from './MostPopularMovieWidget';

// A poster drawn in the story itself, so that Storybook needs no network.
const demoPoster = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b2d8e"/><stop offset="1" stop-color="#e2623b"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="120" r="46" fill="#fff" opacity=".85"/><rect x="40" y="210" width="120" height="14" rx="7" fill="#fff" opacity=".85"/><rect x="60" y="238" width="80" height="10" rx="5" fill="#fff" opacity=".6"/></svg>',
)}`;

const meta = {
  title: 'Widgets/Film le plus populaire',
  component: MostPopularMovieWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Film le plus populaire » du tableau de bord : le film du catalogue avec le plus fort indice de popularité, avec son affiche, son titre, son année de sortie et sa popularité à deux décimales. La popularité est l'indice calculé par TMDB : ce n'est ni une note sur 10 ni un nombre de votes, et le widget l'écrit avec son libellé « popularité » pour ne pas les confondre. Il ne classe rien : le film est choisi en amont. Une popularité inconnue n'est jamais présentée comme 0. Les films des exemples sont fictifs.",
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
        "Le film le plus populaire : `title`, `popularity` (indice TMDB, au moins 0), et facultativement `year` (4 chiffres) et `posterUrl`. `null` ou `undefined` quand il n'y en a pas.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    movie: {
      title: 'La Marche des lanternes',
      year: 2024,
      posterUrl: demoPoster,
      popularity: 1036.49,
    },
    status: 'ready',
  },
} satisfies Meta<typeof MostPopularMovieWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : 1 036,49 popularité. */
export const Nominal: Story = {};

/** Sans affiche, un remplacement explicite prend sa place. */
export const MissingPoster: Story = {
  args: {
    movie: {
      title: 'La Marche des lanternes',
      year: 2024,
      popularity: 1036.49,
    },
  },
};

/** Un titre long passe à la ligne et reste lisible en entier. */
export const LongTitle: Story = {
  args: {
    movie: {
      title:
        "La Marche des lanternes ou le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse",
      year: 2024,
      posterUrl: demoPoster,
      popularity: 1036.49,
    },
  },
};

/** Une année inconnue est dite comme telle, sans écrire « null » ni 0. */
export const UnknownYear: Story = {
  args: {
    movie: {
      title: 'La Marche des lanternes',
      year: null,
      posterUrl: demoPoster,
      popularity: 1036.49,
    },
  },
};

/** Une popularité sous 1 000 s'écrit aussi avec deux décimales : 7,5 devient « 7,50 ». */
export const SmallPopularity: Story = {
  args: {
    movie: {
      title: 'La Marche des lanternes',
      year: 2024,
      posterUrl: demoPoster,
      popularity: 7.5,
    },
  },
};

/** Une popularité inconnue n'est pas présentée comme 0 : le widget n'affiche aucune donnée. */
export const UnknownPopularity: Story = {
  args: {
    movie: {
      title: 'La Marche des lanternes',
      year: 2024,
      posterUrl: demoPoster,
      popularity: null,
    },
  },
};

/** Aucun film n'est fourni : aucune donnée. */
export const NoMovie: Story = {
  args: { movie: null },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
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
