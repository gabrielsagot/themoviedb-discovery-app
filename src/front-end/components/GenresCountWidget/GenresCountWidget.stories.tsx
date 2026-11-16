import type { Meta, StoryObj } from '@storybook/react-vite';
import GenresCountWidget from './GenresCountWidget';

const meta = {
  title: 'Widgets/Genres représentés',
  component: GenresCountWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Genres représentés » du tableau de bord : le nombre de genres distincts représentés dans le catalogue, avec la mention « Diversité du catalogue ». Il ne compte rien : un film qui a plusieurs genres ajoute chacun d'eux une seule fois en amont, et le widget affiche le nombre reçu, sans compter les associations entre films et genres. Un vrai zéro (aucun genre) est une valeur valide, qui n'est pas confondue avec une donnée inconnue.",
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
    count: {
      control: { type: 'number', min: 0, step: 1 },
      description:
        "Nombre de genres distincts représentés : un entier d'au moins 0. `null` ou `undefined` quand il est inconnu, ce qui n'est pas 0.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    count: 19,
    status: 'ready',
  },
} satisfies Meta<typeof GenresCountWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : 19 genres. */
export const Nominal: Story = {};

/** Un seul genre s'écrit au singulier : « 1 genre ». */
export const SingleGenre: Story = {
  args: { count: 1 },
};

/** Zéro genre est une valeur valide : le catalogue n'a aucun genre, ce n'est pas une donnée inconnue. */
export const ZeroGenres: Story = {
  args: { count: 0 },
};

/** Une valeur inconnue n'est pas présentée comme 0 : le widget n'affiche aucune donnée. */
export const UnknownCount: Story = {
  args: { count: null },
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
