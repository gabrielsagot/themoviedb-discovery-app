import type { Meta, StoryObj } from '@storybook/react-vite';
import MoviesCountWidget from './MoviesCountWidget';

const meta = {
  title: 'Widgets/Films en base',
  component: MoviesCountWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Films en base » du tableau de bord : le nombre de films que la base contient, avec la période de leurs années de sortie. Il présente aussi les états du chargement, de l'absence de données et de l'erreur.",
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
      control: 'number',
      description:
        'Nombre de films en base. `null` ou `undefined` quand il est inconnu.',
    },
    period: {
      control: 'object',
      description: 'Première et dernière année de sortie : `{ from, to }`.',
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    count: 1000,
    period: { from: 2023, to: 2027 },
    status: 'ready',
  },
} satisfies Meta<typeof MoviesCountWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : 1000 films de 2023 à 2027. */
export const Nominal: Story = {};

/** Sans période, la pastille des années est masquée. */
export const WithoutPeriod: Story = {
  args: { period: undefined },
};

/** Quand tous les films sont sortis la même année, une seule année est écrite. */
export const SingleYear: Story = {
  args: { period: { from: 2024, to: 2024 } },
};

/** En français, 0 et 1 sont au singulier : « 1 film ». */
export const SingleMovie: Story = {
  args: { count: 1, period: { from: 2024, to: 2024 } },
};

/** Une base vide est une vraie valeur : 0 film, pas une absence de donnée. */
export const EmptyDatabase: Story = {
  args: { count: 0, period: undefined },
};

/** Les grands nombres sont groupés par trois chiffres, à partir de 10 000. */
export const LargeCount: Story = {
  args: { count: 1234567, period: { from: 1990, to: 2027 } },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Le nombre de films est inconnu : le widget ne le remplace pas par 0. */
export const NoData: Story = {
  args: { count: null, period: undefined },
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
