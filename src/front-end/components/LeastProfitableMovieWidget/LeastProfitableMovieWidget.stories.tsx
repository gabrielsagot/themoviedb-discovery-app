import type { Meta, StoryObj } from '@storybook/react-vite';
import LeastProfitableMovieWidget from './LeastProfitableMovieWidget';

// A poster drawn in the story itself, so that Storybook needs no network.
const demoPoster = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4a68"/><stop offset="1" stop-color="#b5546b"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="120" r="46" fill="#fff" opacity=".85"/><rect x="40" y="210" width="120" height="14" rx="7" fill="#fff" opacity=".85"/><rect x="60" y="238" width="80" height="10" rx="5" fill="#fff" opacity=".6"/></svg>',
)}`;

const meta = {
  title: 'Widgets/Film le moins rentable',
  component: LeastProfitableMovieWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Film le moins rentable » du tableau de bord : le film avec le plus faible retour sur investissement (ROI), avec son affiche, son titre, son année de sortie et son ROI en pourcentage à deux décimales, avec son signe : une perte est négative (-100,00 % ROI). C'est le même widget que « Film le plus rentable », avec un autre libellé : la formule du ROI et les règles d'éligibilité sont donc identiques, et restent à valider avant l'intégration aux données réelles (voir le README). Le widget affiche le résultat qu'il reçoit : il ne calcule pas le ROI, ne classe pas les films et ne décide pas lesquels sont éligibles. Un ROI nul est une valeur valide, un ROI inconnu n'est jamais présenté comme 0 %. Les films des exemples sont fictifs.",
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
        "Le film au plus faible ROI : `title`, `roi` (en pourcentage, négatif pour une perte, 0 est une valeur valide), et facultativement `year` (4 chiffres) et `posterUrl`. `null` ou `undefined` quand aucun film n'est éligible.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    movie: {
      title: 'Le Dernier Rideau',
      year: 2012,
      posterUrl: demoPoster,
      roi: -100,
    },
    status: 'ready',
  },
} satisfies Meta<typeof LeastProfitableMovieWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans le ticket : -100,00 % ROI, le signe négatif est conservé. */
export const Nominal: Story = {};

/** Une perte partielle garde aussi son signe : -42,5 s'écrit « -42,50 ». */
export const PartialLoss: Story = {
  args: {
    movie: {
      title: 'Le Dernier Rideau',
      year: 2012,
      posterUrl: demoPoster,
      roi: -42.5,
    },
  },
};

/** Un ROI de 0 est une valeur valide (le film a juste remboursé son budget), pas une donnée absente. */
export const ZeroRoi: Story = {
  args: {
    movie: {
      title: 'Le Dernier Rideau',
      year: 2012,
      posterUrl: demoPoster,
      roi: 0,
    },
  },
};

/** Un ROI inconnu n'est pas présenté comme 0 % : le widget n'affiche aucune donnée. */
export const UnknownRoi: Story = {
  args: {
    movie: {
      title: 'Le Dernier Rideau',
      year: 2012,
      posterUrl: demoPoster,
      roi: null,
    },
  },
};

/** Sans affiche, un remplacement explicite prend sa place. */
export const MissingPoster: Story = {
  args: {
    movie: { title: 'Le Dernier Rideau', year: 2012, roi: -100 },
  },
};

/** Un titre long passe à la ligne et reste lisible en entier. */
export const LongTitle: Story = {
  args: {
    movie: {
      title:
        "Le Dernier Rideau ou le Merveilleux Voyage extraordinaire de l'incroyable Monsieur Alphonse",
      year: 2012,
      posterUrl: demoPoster,
      roi: -100,
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
