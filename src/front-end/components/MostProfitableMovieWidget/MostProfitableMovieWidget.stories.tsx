import type { Meta, StoryObj } from '@storybook/react-vite';
import MostProfitableMovieWidget from './MostProfitableMovieWidget';

// A poster drawn in the story itself, so that Storybook needs no network.
const demoPoster = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f6b4a"/><stop offset="1" stop-color="#d9c24a"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="120" r="46" fill="#fff" opacity=".85"/><rect x="40" y="210" width="120" height="14" rx="7" fill="#fff" opacity=".85"/><rect x="60" y="238" width="80" height="10" rx="5" fill="#fff" opacity=".6"/></svg>',
)}`;

const meta = {
  title: 'Widgets/Film le plus rentable',
  component: MostProfitableMovieWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Film le plus rentable » du tableau de bord : le film avec le meilleur retour sur investissement (ROI), avec son affiche, son titre, son année de sortie et son ROI en pourcentage à deux décimales. Le widget affiche le résultat qu'il reçoit : il ne calcule pas le ROI, ne classe pas les films et ne décide pas lesquels sont éligibles. La formule du ROI et les règles d'éligibilité des budgets et des recettes restent à valider avant l'intégration aux données réelles (voir le README). Un ROI inconnu n'est jamais présenté comme 0 %. Les films des exemples sont fictifs.",
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
        "Le film au meilleur ROI : `title`, `roi` (en pourcentage, négatif pour une perte), et facultativement `year` (4 chiffres) et `posterUrl`. `null` ou `undefined` quand aucun film n'est éligible.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    movie: {
      title: 'Le Trésor du vieux moulin',
      year: 2016,
      posterUrl: demoPoster,
      roi: 69667.36,
    },
    status: 'ready',
  },
} satisfies Meta<typeof MostProfitableMovieWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : 69 667,36 % ROI. */
export const Nominal: Story = {};

/** Sans affiche, un remplacement explicite prend sa place. */
export const MissingPoster: Story = {
  args: {
    movie: { title: 'Le Trésor du vieux moulin', year: 2016, roi: 69667.36 },
  },
};

/** Un titre long passe à la ligne et reste lisible en entier. */
export const LongTitle: Story = {
  args: {
    movie: {
      title:
        "Le Trésor du vieux moulin ou le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse",
      year: 2016,
      posterUrl: demoPoster,
      roi: 69667.36,
    },
  },
};

/** Une année inconnue est dite comme telle, sans écrire « null » ni 0. */
export const UnknownYear: Story = {
  args: {
    movie: {
      title: 'Le Trésor du vieux moulin',
      year: null,
      posterUrl: demoPoster,
      roi: 69667.36,
    },
  },
};

/** Un ROI de moins de 1 000 s'écrit aussi avec deux décimales : 12,5 devient « 12,50 ». */
export const SmallRoi: Story = {
  args: {
    movie: {
      title: 'Le Trésor du vieux moulin',
      year: 2016,
      posterUrl: demoPoster,
      roi: 12.5,
    },
  },
};

/** Un ROI inconnu n'est pas présenté comme 0 % : le widget n'affiche aucune donnée. */
export const UnknownRoi: Story = {
  args: {
    movie: {
      title: 'Le Trésor du vieux moulin',
      year: 2016,
      posterUrl: demoPoster,
      roi: null,
    },
  },
};

/** Aucun film n'est éligible : aucune donnée. */
export const NoEligibleMovie: Story = {
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
