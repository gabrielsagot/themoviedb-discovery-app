import type { Meta, StoryObj } from '@storybook/react-vite';
import BestRatedGenreWidget from './BestRatedGenreWidget';

const meta = {
  title: 'Widgets/Meilleure note',
  component: BestRatedGenreWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Meilleure note » du tableau de bord : le genre qui a la meilleure note moyenne, avec cette note sur 10 et deux décimales. La note est une **moyenne simple** : chaque film noté du genre compte une fois, quel que soit son nombre de votes. Ce n'est pas la note pondérée, et le widget l'écrit sous la note (« Moyenne simple, non pondérée par les votes ») pour ne pas les confondre. Il ne calcule rien : la moyenne est calculée en amont sur les notes valides du genre. Un genre sans note valide n'est jamais présenté comme noté 0.",
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
        "Nom du genre à la meilleure note moyenne, tel qu'il doit être écrit. `null`, `undefined` ou vide quand aucun genre n'est connu.",
    },
    average: {
      control: { type: 'number', min: 0, max: 10, step: 0.01 },
      description:
        "Note moyenne **simple** du genre, sur 10 (pas la note pondérée). `null` ou `undefined` quand le genre n'a aucune note valide : ce n'est pas 0.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    genreName: 'Animation',
    average: 7.41,
    status: 'ready',
  },
} satisfies Meta<typeof BestRatedGenreWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : Animation, 7,41 / 10. */
export const Nominal: Story = {};

/** Un nom de genre long passe à la ligne et reste lisible en entier. */
export const LongName: Story = {
  args: {
    genreName: 'Film de science-fiction, de fantasy et d’aventures spatiales',
  },
};

/** Une note entière garde ses deux décimales : 8 s'écrit « 8,00 ». */
export const WholeRating: Story = {
  args: { average: 8 },
};

/** Une moyenne de 0 est une vraie note, pas une absence de note. */
export const ZeroAverage: Story = {
  args: { average: 0 },
};

/** Un genre sans note valide n'est pas présenté comme noté 0 : le widget n'affiche aucune donnée. */
export const GenreWithoutRatings: Story = {
  args: { average: null },
};

/** Aucun genre n'est connu : aucune donnée. */
export const NoKnownGenre: Story = {
  args: { genreName: null },
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
