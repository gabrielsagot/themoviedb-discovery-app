import type { Meta, StoryObj } from '@storybook/react-vite';
import DominantGenreWidget from './DominantGenreWidget';

const meta = {
  title: 'Widgets/Genre dominant',
  component: DominantGenreWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Genre dominant » du tableau de bord : le genre qui apparaît dans le plus de films, avec le nombre de films. Il affiche le résultat reçu et ne compte rien : un film qui a plusieurs genres est compté pour chacun d'eux en amont, et le widget ne recompte pas les films multigenres. Un nom long passe à la ligne au lieu d'être coupé. C'est le même widget que « Pays le plus représenté », avec un autre libellé : les règles du nom et de l'effectif sont donc identiques.",
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
    genreName: {
      control: 'text',
      description:
        "Nom du genre dominant, tel qu'il doit être écrit. `null`, `undefined` ou vide quand aucun genre n'est connu.",
    },
    count: {
      control: { type: 'number', min: 0, step: 1 },
      description:
        "Nombre de films du genre, déjà compté : un entier d'au moins 1, sinon le widget n'affiche aucune donnée.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    genreName: 'Drame',
    count: 322,
    status: 'ready',
  },
} satisfies Meta<typeof DominantGenreWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : Drame, 322 films. */
export const Nominal: Story = {};

/** Un nom de genre long passe à la ligne et reste lisible en entier. */
export const LongName: Story = {
  args: {
    genreName: 'Film de science-fiction, de fantasy et d’aventures spatiales',
    count: 1234,
  },
};

/** Un nom sans espace, plus large que la carte, ne la fait pas déborder. */
export const UnbreakableName: Story = {
  args: {
    genreName: 'Science-Fiction-Fantastique-Anticipation-Dystopique-Spatiale',
  },
};

/** Avec un seul film, l'unité est au singulier. */
export const SingleMovie: Story = {
  args: { genreName: 'Western', count: 1 },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Aucun genre n'est connu : le widget ne le remplace ni par un genre inventé ni par 0. */
export const NoKnownGenre: Story = {
  args: { genreName: null, count: null },
};

/** Un effectif impossible (0) n'est pas une donnée : aucune donnée. */
export const InvalidCount: Story = {
  args: { count: 0 },
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
